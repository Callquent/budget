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

export interface BudgetData {
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
  budgets: BudgetData[];
  categories: CategoryData[];
}

// ── Intent types ──────────────────────────────────────────────

export type AddEntityType = 'transaction' | 'subscription' | 'budget' | 'category';

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
  | 'category_data'
  | 'add_menu'
  | 'unknown';

export interface BaseIntent {
  intent: IntentType;
  month?: number | null;
  year?: number | null;
}

export interface TransactionsCategoryIntent extends BaseIntent {
  intent: 'transactions_category';
  category: string;
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
  account?: string;
}

export interface BudgetAddIntent extends BaseIntent {
  intent: 'budget_add';
}

export interface CategoryDataIntent extends BaseIntent {
  intent: 'category_data';
  category: string;
}

/**
 * Generic "add" intent. When the entity type can be determined directly
 * from the query (e.g. "ajouter un abonnement"), `entity` is set and the
 * UI jumps straight to that form. Otherwise `entity` is null and the UI
 * shows the 4-card chooser menu.
 */
export interface AddMenuIntent extends BaseIntent {
  intent: 'add_menu';
  entity: AddEntityType | null;
}

export interface UnknownIntent extends BaseIntent {
  intent: 'unknown';
  query: string;
}

export interface BalanceCurrentIntent extends BaseIntent {
  intent: 'balance_current';
  account?: string;
}

export type ParsedIntent =
  | TransactionsCategoryIntent
  | SubscriptionStatusIntent
  | SubscriptionsListIntent
  | BalanceForecastIntent
  | BalanceCurrentIntent
  | BudgetAddIntent
  | CategoryDataIntent
  | AddMenuIntent
  | ({ intent: 'budget_month' | 'expenses_summary' | 'categories_summary' } & BaseIntent)
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
  label?: string;
}

export interface AddTransactionPayload {
  label: string;
  amount: number;
  type: 'credit' | 'debit';
  date: string; // YYYY-MM-DD
  category: string;
  account: string;
}

export interface AddSubscriptionPayload {
  name: string;
  amount: number;
  frequency: Frequency;
  dayOfMonth?: number;
  startDate: string;
  endDate?: string;
  category: string;
  account: string;
}

export interface AddCategoryPayload {
  name: string;
  transactionType: TransactionType;
  frequency: Frequency;
  description?: string;
}

/** Callbacks the response builder can invoke when a form is submitted. */
export interface AddEntityHandlers {
  onAddBudget?: (payload: AddBudgetLinePayload) => Promise<void>;
  onAddTransaction?: (payload: AddTransactionPayload) => Promise<void>;
  onAddSubscription?: (payload: AddSubscriptionPayload) => Promise<void>;
  onAddCategory?: (payload: AddCategoryPayload) => Promise<void>;
}
