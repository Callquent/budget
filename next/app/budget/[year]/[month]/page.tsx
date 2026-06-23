import BudgetMonthView from "@/components/Budget/BudgetMonthView";

export default function BudgetMonthPage({
  params,
}: {
  params: Promise<{ year: string; month: string }>;
}) {
  return <BudgetMonthView params={params} />;
}
