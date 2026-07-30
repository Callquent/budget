import BudgetForm from "@/components/Budget/BudgetForm";

export default async function BudgetNewPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { year, month } = await searchParams;

  return (
    <BudgetForm
      title="Nouvelle ligne de budget"
      currentYear={year ? parseInt(year) : new Date().getFullYear()}
      currentMonth={month ? parseInt(month) : new Date().getMonth() + 1}
    />
  );
}
