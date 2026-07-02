export interface AccountInterface {
  id: number;
  name: string;
  balance: string;
  currency: string;
}

export interface AccountFormProps {
  initialData?: Partial<AccountInterface>;
  title: string;
}
