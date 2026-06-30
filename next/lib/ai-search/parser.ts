import type { AddEntityType, ParsedIntent, SubscriptionData } from './types';

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
  /cours(e?s?)|supermarche|hypermarche|lidl|carrefour|intermarche|auchan|alimentation|epicerie|monoprix|leclerc|biocoop/;

const SUBSCRIPTION_PATTERN =
  /abonnement|ter\b|netflix|spotify|gym|adobe|canal|amazon|prime|sfr|orange|bouygue|freemobile|deezer/;

// Mots qui déclenchent une intention de création.
// Placé en priorité haute : "ajouter un abonnement" ne doit pas tomber
// dans subscription_status à cause du mot "abonnement".
const ADD_VERB_PATTERN = /\bajout|\bajouter|\bcree|\bcreer|\bnouveau\b|\bnouvelle\b|\bnew\b/;

export function classify(query: string, subscriptions: SubscriptionData[], categories: import('./types').CategoryData[] = []): ParsedIntent {
  const n = normalize(query);
  const mo = parseMonth(query);
  const yr = parseYear(query);

  // ── 1. Intention de création (transaction / abonnement / budget / catégorie) ──
  // Vérifié EN PREMIER : "ajouter une transaction alimentation" ne doit pas
  // être interprété comme une recherche de courses, "ajouter un abonnement"
  // ne doit pas être interprété comme une consultation de statut, etc.
  if (ADD_VERB_PATTERN.test(n)) {
    let entity: AddEntityType | null = null;

    if (/transaction|depense|recette|virement|operation|mouvement/.test(n)) {
      entity = 'transaction';
    } else if (/abonnement|abonn/.test(n)) {
      entity = 'subscription';
    } else if (/budget|ligne|prevision/.test(n)) {
      entity = 'budget';
    } else if (/categorie|categor/.test(n)) {
      entity = 'category';
    }

    return { intent: 'add_menu', entity, month: mo, year: yr };
  }

  // ── 2. Recherche par catégorie avec mois/année ─────────────────
  // Ex: "course juin 2026", "Vacances juillet 2026", "Crédit habitation Septembre 2026"
  // Mots à ignorer dans le matching (verbes, prépositions, mois, années)
  const STOP_WORDS = new Set(['pour', 'avec', 'dans', 'les', 'des', 'mes', 'mon', 'sur', 'en', 'de', 'la', 'le', 'du', ...Object.keys(MONTHS_FR), '2016','2017','2018','2019','2020','2021','2022','2023','2024','2025','2026','2027','2028','2029','2030']);
  const queryWords = n.split(' ').filter((w) => w.length > 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
  
  if (queryWords.length > 0 && categories.length > 0) {
    // Chercher une catégorie dont le nom correspond aux mots de la requête
    for (const cat of categories) {
      const catNorm = normalize(cat.name);
      const catWords = catNorm.split(' ').filter((w) => w.length > 2);
      
      // Vérifier si tous les mots de la catégorie sont dans la requête
      const allMatch = catWords.every((cw) => 
        queryWords.some((qw) => qw === cw || qw.includes(cw) || cw.includes(qw))
      );
      
      // Si on a une correspondance et qu'on a un mois/année, retourner la catégorie
      if (allMatch && catWords.length > 0 && (mo || yr)) {
        return { intent: 'category_data', category: cat.name, month: mo, year: yr };
      }
      
      // Vérifier si la requête contient exactement le nom de la catégorie
      if (n.includes(catNorm) && (mo || yr)) {
        return { intent: 'category_data', category: cat.name, month: mo, year: yr };
      }
    }
  }

  // ── 2b. Achats / courses (lecture) ───────────────────────────────
  if (FOOD_PATTERN.test(n)) {
    return { intent: 'transactions_category', category: 'Alimentation', month: mo, year: yr };
  }

  // ── 3. Abonnements (lecture) ─────────────────────────────────────
  if (SUBSCRIPTION_PATTERN.test(n) || n.includes('abonnement')) {
    // Si mois/année spécifiés, retourner la liste des abonnements pour cette période
    if (mo || yr) {
      return { intent: 'subscriptions_list', filter: null, month: mo, year: yr };
    }
    
    const matchedSub = subscriptions.find((s) =>
      normalize(s.name).split(' ').some((w) => w.length > 2 && n.includes(w)),
    );
    const isStatusQuery = /actif|activ|encore|toujours|valide|expire|termine/.test(n);
    if (isStatusQuery || matchedSub) {
      return { intent: 'subscription_status', sub: matchedSub ?? null, query };
    }
    const filter =
      /inactif|inactiv|termine|expire|annule/.test(n) ? 'inactive'
      : /actif|activ/.test(n) ? 'active'
      : null;
    return { intent: 'subscriptions_list', filter, month: mo, year: yr };
  }

  // ── 4. Solde / projection ────────────────────────────────────────
  if (/solde|rest|dispo|argent|combien|avoir/.test(n)) {
    if (mo && yr) return { intent: 'balance_forecast', month: mo, year: yr };
    return { intent: 'balance_current', month: mo, year: yr };
  }

  // ── 5. Consultation budget d'un mois ─────────────────────────────
  if (/budget|prevu|planifie/.test(n) && (mo || yr)) {
    return { intent: 'budget_month', month: mo, year: yr };
  }

  // ── 6. Dépenses par catégorie ─────────────────────────────────────
  if (/depense|expense|cout/.test(n)) {
    return { intent: 'expenses_summary', month: mo, year: yr };
  }

  // ── 7. Liste des catégories ───────────────────────────────────────
  if (/categori|categor/.test(n)) {
    return { intent: 'categories_summary', month: mo, year: yr };
  }

  return { intent: 'unknown', query, month: mo, year: yr };
}
