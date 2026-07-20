import BudgetForm from "@/components/Budget/BudgetForm";

export default async function BudgetNewPage({
  params,
}: {
  params: Promise<{ year: string; month: string }>;
}) {
  const { year, month } = await params;

  return (
    <BudgetForm
      title="Nouvelle ligne de budget"
      currentYear={parseInt(year)}
      currentMonth={parseInt(month)}
    />
  );
}
