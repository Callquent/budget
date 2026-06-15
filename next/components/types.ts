export interface Category {
  name: string;
  transactionType: string;
}

export interface Account {
  id: number;
  name: string;
  type: string;
  currency: string;
  balance: number;
}

export interface Transaction {
  id: number;
  transactionDate: string;
  label: string;
  type: "credit" | "debit";
  amount: number;
  category: Category;
  notes?: string;
}

export interface TransactionWithAccount extends Transaction {
  account: { name: string };
}

export interface AccountRow {
  account: Account;
  credit: number;
  debit: number;
  balanceEnd: number;
  transactions: Transaction[];
}

export function formatNumber(num: number) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}
