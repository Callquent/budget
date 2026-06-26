export type TransactionType = 'income' | 'expense' | 'transfer';
export type SubscriptionStatus = 'active' | 'inactive';
export type Frequency = 'monthly' | 'yearly' | 'quarterly' | 'occasional';

export interface CategoryData {
  id: number;
  name: string;
  transactionType: TransactionType;
  frequency?: Frequency;
}

export interface AccountData {
  id: number;
  name: string;
  type: 'credit' | 'debit';
  balance: string;
  currency: string;
}

export interface TransactionData {
  id: number;
  label: string;
  amount: string;
  type: 'credit' | 'debit';
  category: Pick<CategoryData, 'id' | 'name' | 'transactionType'>;
  account: Pick<AccountData, 'id' | 'name'>;
  year: number;
  month: number;
  transactionDate: string;
}

export interface SubscriptionData {
  id: number;
  name: string;
  amount: string;
  frequency: Frequency;
  status: SubscriptionStatus;
  category: Pick<CategoryData, 'name' | 'transactionType'>;
  account: Pick<AccountData, 'name'>;
  startDate: string;
  endDate?: string;
  notes?: string;
}

export interface MonthlyBudgetData {
  id: number;
  category: Pick<CategoryData, 'name' | 'transactionType'>;
  account?: Pick<AccountData, 'name'>;
  year: number;
  month: number;
  plannedAmount: string;
  actualAmount: string;
  label?: string;
  isApproved?: boolean;
}

export interface BudgetContext {
  transactions: TransactionData[];
  subscriptions: SubscriptionData[];
  accounts: AccountData[];
  monthlyBudgets: MonthlyBudgetData[];
  categories: CategoryData[];
}

// ── Intent types ──────────────────────────────────────────────

export type IntentType =
  | 'transactions_category'
  | 'subscription_status'
  | 'subscriptions_list'
  | 'balance_current'
  | 'balance_forecast'
  | 'budget_month'
  | 'budget_add'
  | 'expenses_summary'
  | 'categories_summary'
  | 'unknown';

export interface BaseIntent {
  intent: IntentType;
  month?: number | null;
  year?: number | null;
}

export interface TransactionsCategoryIntent extends BaseIntent {
  intent: 'transactions_category';
  category: string;
  /** Noms alternatifs de catégorie à tester (insensible à la casse) */
  categoryHints?: string[];
}

export interface SubscriptionStatusIntent extends BaseIntent {
  intent: 'subscription_status';
  sub: SubscriptionData | null;
  query: string;
}

export interface SubscriptionsListIntent extends BaseIntent {
  intent: 'subscriptions_list';
  filter: SubscriptionStatus | null;
}

export interface BalanceForecastIntent extends BaseIntent {
  intent: 'balance_forecast';
  month: number;
  year: number;
}

export interface BudgetAddIntent extends BaseIntent {
  intent: 'budget_add';
}

export interface UnknownIntent extends BaseIntent {
  intent: 'unknown';
  query: string;
}

export type ParsedIntent =
  | TransactionsCategoryIntent
  | SubscriptionStatusIntent
  | SubscriptionsListIntent
  | BalanceForecastIntent
  | BudgetAddIntent
  | ({ intent: 'balance_current' | 'budget_month' | 'expenses_summary' | 'categories_summary' } & BaseIntent)
  | UnknownIntent;

// ── Chat message ──────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  /** Raw HTML safe string produced by the response builder */
  html: string;
  timestamp: Date;
}

export interface AddBudgetLinePayload {
  category: string;
  amount: number;
  month: number;
  year: number;
}
