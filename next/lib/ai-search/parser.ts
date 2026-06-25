import type { ParsedIntent, SubscriptionData } from './types';

// ── Month name table (French, with/without accents) ───────────

const MONTHS_FR: Record<string, number> = {
  janvier: 1,
  fevrier: 2,
  février: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  aout: 8,
  août: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  decembre: 12,
  décembre: 12,
};

/** Month number → canonical French name */
export const MONTH_NAMES: Record<number, string> = {
  1: 'janvier', 2: 'février', 3: 'mars', 4: 'avril',
  5: 'mai', 6: 'juin', 7: 'juillet', 8: 'août',
  9: 'septembre', 10: 'octobre', 11: 'novembre', 12: 'décembre',
};

// ── Text normalisation ─────────────────────────────────────────

/**
 * Lower-case, strip accents, collapse punctuation to spaces.
 * Used for all pattern matching so we never depend on accent input.
 */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .trim();
}

/** Extract a month number from anywhere in the string. */
export function parseMonth(text: string): number | null {
  const n = normalize(text);
  for (const [key, value] of Object.entries(MONTHS_FR)) {
    const kn = normalize(key);
    if (n.includes(kn)) return value;
  }
  return null;
}

/** Extract a 4-digit year (2010-2099) from the string. */
export function parseYear(text: string): number | null {
  const m = text.match(/\b(20[1-9][0-9])\b/);
  return m ? parseInt(m[1], 10) : null;
}

// ── Grocery / food keyword set ─────────────────────────────────

const FOOD_PATTERN =
  /cours(e?s?)|supermarche|hypermarche|lidl|carrefour|intermarche|auchan|alimentation|epicerie|monoprix|leclerc|biocoop/;

const SUBSCRIPTION_PATTERN =
  /abonn|ter\b|netflix|spotify|gym|adobe|canal|amazon|prime|sfr|orange|bouygue|freemobile|deezer|hulu|disney/;

// ── Main classifier ────────────────────────────────────────────

/**
 * Parse a free-form French question and return a structured intent.
 * All subscriptions are passed in so we can match by name directly.
 */
export function classify(
  query: string,
  subscriptions: SubscriptionData[],
): ParsedIntent {
  const n = normalize(query);
  const mo = parseMonth(query);
  const yr = parseYear(query);

  // ── 1. Food / grocery transactions ──────────────────────────
  if (FOOD_PATTERN.test(n)) {
    return { intent: 'transactions_category', category: 'Alimentation', month: mo, year: yr };
  }

  // ── 2. Subscription queries ──────────────────────────────────
  if (SUBSCRIPTION_PATTERN.test(n)) {
    // Try to match a specific subscription by name
    const matchedSub = subscriptions.find((s) =>
      normalize(s.name)
        .split(' ')
        .some((word) => word.length > 2 && n.includes(word)),
    );

    const isStatusQuery = /actif|activ|encore|toujours|valide|expire|termine/.test(n);

    if (isStatusQuery || matchedSub) {
      return { intent: 'subscription_status', sub: matchedSub ?? null, query };
    }

    const filter =
      /inactif|inactiv|termine|expire|annule/.test(n)
        ? 'inactive'
        : /actif|activ/.test(n)
        ? 'active'
        : null;

    return { intent: 'subscriptions_list', filter, month: mo, year: yr };
  }

  // ── 3. Balance / forecast ────────────────────────────────────
  if (/solde|rest|dispo|argent|combien|avoir/.test(n)) {
    if (mo && yr) {
      return { intent: 'balance_forecast', month: mo, year: yr };
    }
    return { intent: 'balance_current', month: mo, year: yr };
  }

  // ── 4. Add a budget line ─────────────────────────────────────
  if (/ajout|creer|nouveau|nouvelle|ajouter/.test(n) && /budget|ligne/.test(n)) {
    return { intent: 'budget_add', month: mo, year: yr };
  }

  // ── 5. View budget for a period ──────────────────────────────
  if (/budget|prevu|planifie/.test(n) && (mo || yr)) {
    return { intent: 'budget_month', month: mo, year: yr };
  }

  // ── 6. Expense breakdown by category ────────────────────────
  if (/depense|expense|depenser|cout|couts/.test(n)) {
    return { intent: 'expenses_summary', month: mo, year: yr };
  }

  // ── 7. Categories list ───────────────────────────────────────
  if (/categori|categor/.test(n)) {
    return { intent: 'categories_summary', month: mo, year: yr };
  }

  return { intent: 'unknown', query, month: mo, year: yr };
}
