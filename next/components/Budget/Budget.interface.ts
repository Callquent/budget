interface BudgetBase {
  plannedAmount: number;
  actualAmount: number;
  isApproved: boolean;
  label?: string;
}

export interface Budget extends BudgetBase {
  id: number;
  approvedAt?: string;
  account: { name: string } | null;
  category: { name: string; transactionType: string; frequency: string };
}

export interface BudgetFormProps {
  initialData?: Partial<BudgetBase> & {
    id?: number;
    categoryId?: number;
    accountId?: number;
    year?: number;
    month?: number;
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
