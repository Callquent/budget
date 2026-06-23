export interface SubscriptionInterface {
  id: number;
  name: string;
  amount: string;
  frequency: "monthly" | "yearly" | "quarterly" | "occasional";
  status: "active" | "inactive";
  account: { name: string };
  category: { name: string };
  startDate: string;
  endDate: string | null;
}
