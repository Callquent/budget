import type { AccountInterface } from "../Account/Account.interface";
import type { CategoryInterface } from "../Category/Category.interface";

export interface Transaction {
  id: number;
  transactionDate: string;
  label: string;
  type: "credit" | "debit";
  amount: number;
  category: CategoryInterface;
  notes?: string;
}

export interface TransactionWithAccount extends Transaction {
  account: { name: string };
}

export interface AccountRow {
  account: AccountInterface;
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
