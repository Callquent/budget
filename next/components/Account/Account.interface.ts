export interface AccountInterface {
  id: number;
  name: string;
  type: "debit" | "credit";
  balance: string;
  currency: string;
}

export interface AccountFormProps {
  initialData?: Partial<AccountInterface>;
  title: string;
}
