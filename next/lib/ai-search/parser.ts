import type { ParsedIntent, SubscriptionData } from './types';

export const MONTHS_FR: Record<string, number> = {
  janvier:1, fevrier:2, mars:3, avril:4, mai:5, juin:6,
  juillet:7, aout:8, septembre:9, octobre:10, novembre:11, decembre:12,
};

export const MONTH_NAMES: Record<number, string> = {
  1:'janvier',2:'février',3:'mars',4:'avril',5:'mai',6:'juin',
  7:'juillet',8:'août',9:'septembre',10:'octobre',11:'novembre',12:'décembre',
};

/**
 * Normalise un texte : minuscules, remplacement accent par accent,
 * puis tout caractère non alphanumérique → espace.
 * Gère correctement les emojis, ponctuation, guillemets, etc.
 */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[àâä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[îï]/g, 'i')
    .replace(/[ôö]/g, 'o')
    .replace(/[ùûü]/g, 'u')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseMonth(text: string): number | null {
  const n = normalize(text);
  for (const [key, value] of Object.entries(MONTHS_FR)) {
    if (n.includes(key)) return value;
  }
  return null;
}

export function parseYear(text: string): number | null {
  const m = text.match(/\b(20[1-9][0-9])\b/);
  return m ? parseInt(m[1], 10) : null;
}

const FOOD_PATTERN =
  /courses?|supermarche|hypermarche|lidl|carrefour|intermarche|auchan|alimentation|epicerie|monoprix|leclerc|biocoop/;

// Mots-clés → noms de catégories possibles (insensible à la casse)
const FOOD_CATEGORY_HINTS = ['Courses', 'Alimentation', 'Supermarché', 'Nourriture'];

const SUBSCRIPTION_PATTERN =
  /abonnement|ter\b|netflix|spotify|gym|adobe|canal|amazon|prime|sfr|orange|bouygue|freemobile|deezer/;

export function classify(query: string, subscriptions: SubscriptionData[], categories: import('./types').CategoryData[] = []): ParsedIntent {
  const n = normalize(query);
  const mo = parseMonth(query);
  const yr = parseYear(query);

  // ── Recherche directe dans les catégories connues ────────────────
  // Priorité maximale : si la query contient un mot du nom de catégorie
  // (après normalisation), on retourne direct sans passer par les patterns.
  // Mots à ignorer dans le matching (mois, années, mots génériques)
  const STOP_WORDS = new Set(['pour', 'avec', 'dans', 'les', 'des', 'mes', 'mon', 'sur', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre', 'janvier', 'fevrier', 'mars', 'avril']);
  const queryWords = n.split(' ').filter((w) => w.length > 3 && !STOP_WORDS.has(w) && !/^20\d\d$/.test(w));
  if (queryWords.length > 0) {
    for (const cat of categories) {
      const catNorm = normalize(cat.name);
      const catWords = catNorm.split(' ').filter((w) => w.length > 2);
      // Tous les mots de la catégorie doivent être présents dans la query
      const allMatch = catWords.every((cw) => queryWords.some((qw) => qw === cw || qw.startsWith(cw) || cw.startsWith(qw)));
      if (allMatch && catWords.length > 0) {
        return { intent: 'transactions_category', category: cat.name, categoryHints: [cat.name], month: mo, year: yr };
      }
    }
  }

  if (FOOD_PATTERN.test(n)) {
    return { intent: 'transactions_category', category: 'Alimentation', categoryHints: FOOD_CATEGORY_HINTS, month: mo, year: yr };
  }

  if (SUBSCRIPTION_PATTERN.test(n) || /abonnement/.test(n)) {
    // "mes abonnements [actifs/inactifs]" → liste, pas recherche d'un abonnement spécifique
    const isListQuery = /mes abonnements|tous les abonnements|liste/.test(n);
    const filter =
      /inactif|inactiv|termine|expire|annule/.test(n) ? 'inactive'
      : /actif|activ/.test(n) ? 'active'
      : null;

    if (isListQuery) {
      return { intent: 'subscriptions_list', filter, month: mo, year: yr };
    }

    const matchedSub = subscriptions.find((s) =>
      normalize(s.name).split(' ').some((w) => w.length > 2 && n.includes(w)),
    );
    const isStatusQuery = /encore|toujours|valide|expire|termine/.test(n);
    if (isStatusQuery || matchedSub) {
      return { intent: 'subscription_status', sub: matchedSub ?? null, query };
    }
    return { intent: 'subscriptions_list', filter, month: mo, year: yr };
  }

  if (/solde|rest|dispo|argent|combien|avoir/.test(n)) {
    if (mo && yr) return { intent: 'balance_forecast', month: mo, year: yr };
    return { intent: 'balance_current', month: mo, year: yr };
  }

  if (/ajout|creer|ajouter|nouveau|nouvelle/.test(n) && /budget|ligne/.test(n)) {
    return { intent: 'budget_add', month: mo, year: yr };
  }

  if (/budget|prevu|planifie/.test(n) && (mo || yr)) {
    return { intent: 'budget_month', month: mo, year: yr };
  }

  if (/depense|expense|cout/.test(n)) {
    return { intent: 'expenses_summary', month: mo, year: yr };
  }

  if (/categori|categor/.test(n)) {
    return { intent: 'categories_summary', month: mo, year: yr };
  }

  return { intent: 'unknown', query, month: mo, year: yr };
}
