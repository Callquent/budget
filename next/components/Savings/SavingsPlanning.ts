// Nombre de mois entre deux échéances, par fréquence. 'occasional' n'a pas
// de cadence : un versement unique, donc aucune durée à estimer.
export const PERIOD_MONTHS: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

export const PERIOD_LABELS: Record<string, string> = {
  monthly: "month",
  quarterly: "quarter",
  yearly: "year",
};

// Durées proposées comme objectif (en mois).
export const TARGET_DURATIONS = [
  { months: 3, label: "3 months" },
  { months: 4, label: "4 months" },
  { months: 6, label: "6 months" },
  { months: 12, label: "12 months" },
  { months: 24, label: "2 years" },
] as const;

export function formatDuration(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} year${years > 1 ? "s" : ""}`);
  if (rest > 0) parts.push(`${rest} month${rest > 1 ? "s" : ""}`);
  return parts.join(" ") || "0 months";
}

export interface DurationEstimate {
  periods: number; // nombre de versements nécessaires
  months: number; // durée totale en mois
}

// Combien de versements (et de mois) pour atteindre le montant restant.
export function estimateDuration(
  remaining: number,
  contribution: number,
  frequency: string,
): DurationEstimate | null {
  const periodMonths = PERIOD_MONTHS[frequency];
  if (!periodMonths || contribution <= 0 || remaining <= 0) return null;

  const periods = Math.ceil(remaining / contribution);
  return { periods, months: periods * periodMonths };
}

// Montant à verser par période pour finir en `totalMonths` mois.
// null si la durée est plus courte qu'une seule période (ex: 6 mois en annuel).
export function suggestContribution(
  remaining: number,
  frequency: string,
  totalMonths: number,
): number | null {
  const periodMonths = PERIOD_MONTHS[frequency];
  if (!periodMonths || remaining <= 0) return null;

  const periods = Math.floor(totalMonths / periodMonths);
  if (periods < 1) return null;

  return Math.ceil((remaining / periods) * 100) / 100;
}

// Mois du dernier versement : le 1er versement tombe le mois de départ,
// donc N versements finissent (N - 1) périodes plus tard.
export function completionDate(
  base: Date,
  periods: number,
  frequency: string,
): Date {
  const periodMonths = PERIOD_MONTHS[frequency] ?? 1;
  const d = new Date(base.getFullYear(), base.getMonth(), 1);
  d.setMonth(d.getMonth() + (periods - 1) * periodMonths);
  return d;
}

export function formatMonthYear(d: Date): string {
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}
