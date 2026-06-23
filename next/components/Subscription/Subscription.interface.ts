interface SubscriptionBase {
  name: string;
  amount: string;
  frequency: "monthly" | "yearly" | "quarterly" | "occasional";
  status: "active" | "inactive";
  startDate: string;
  endDate: string | null;
}

export interface SubscriptionInterface extends SubscriptionBase {
  id: number;
  account: { name: string };
  category: { name: string };
}

export interface SubscriptionFormProps {
  initialData?: Partial<SubscriptionBase> & {
    id?: number;
    accountId?: number;
    categoryId?: number;
    dayOfMonth?: number | null;
    notes?: string;
  };
  title: string;
}
