interface BudgetBase {
  plannedAmount: number;
  actualAmount: number;
  isApproved: boolean;
  label?: string;
}

export interface Budget extends BudgetBase {
  id: number;
  approvedAt?: string;
  account: { id: number; name: string; type: string; balance: string; currency: string } | null;
  category: { id: number; name: string; transactionType: string };
  year: number;
  month: number;
}

export interface BudgetFormProps {
  initialData?: Partial<BudgetBase> & {
    id?: number;
    year?: number;
    month?: number;
    // Forme plate (compatibilité)
    categoryId?: number;
    accountId?: number;
    // Forme imbriquée (retournée par l'API)
    account?: { id: number; name: string; type: string; balance: string; currency: string } | null;
    category?: { id: number; name: string; transactionType: string; frequency: string };
  };
  title: string;
  currentYear?: number;
  currentMonth?: number;
}

export interface TxByAccount {
  [accountId: number]: { credit: number; debit: number; subs: number };
}

export interface SummaryRow {
  total_planned: number;
  total_actual: number;
}

export interface AccountBalance {
  balance: number;
  balance_projected: number;
  credit: number;
  debit: number;
  subs: number;
  planned_net: number;
}

export interface MonthData {
  year: number;
  month: number;
  nowYear: number;
  nowMonth: number;
  periodLabel: string;
  accounts: any[];
  txByAccount: TxByAccount;
  subscriptions: any[];
  budgets: Budget[];
}

export interface YearData {
  year: number;
  currentYear: number;
  currentMonth: number;
  availableYears: number[];
  accounts: any[];
  summary: Record<number, SummaryRow>;
  accountBalances: Record<number, Record<number, AccountBalance>>;
}
