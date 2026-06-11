import BudgetMonthView from "@/components/BudgetMonthView";

export default function BudgetMonthPage({
  params,
}: {
  params: Promise<{ year: string; month: string }>;
}) {
  return <BudgetMonthView params={params} />;
}
