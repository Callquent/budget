import type { AccountInterface } from "../Account/Account.interface";
import type { CategoryInterface } from "../Category/Category.interface";

export type SavingsFrequency = "monthly" | "quarterly" | "yearly" | "occasional";
export type SavingsStatus = "active" | "inactive" | "completed";

export interface SavingsGoalInterface {
  id: number;
  name: string;
  targetAmount: number | string;
  contributionAmount: number | string;
  frequency: SavingsFrequency;
  status: SavingsStatus;
  startDate: string;
  endDate?: string | null;
  dayOfMonth?: number | null;
  notes?: string | null;
  account?: AccountInterface;
  accountId?: number;
  category?: CategoryInterface;
  categoryId?: number;
  // Calculés côté backend à chaque réponse, jamais persistés.
  contributedAmount?: number;
  remainingAmount?: number;
  progressPercentage?: number;
}

export interface SavingsGoalFormProps {
  initialData?: Partial<SavingsGoalInterface> & { id?: number };
  title: string;
}

export interface SavingsListProps {
  goals: SavingsGoalInterface[];
}
