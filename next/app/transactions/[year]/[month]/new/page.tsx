import TransactionForm from "@/components/Transaction/TransactionForm";

// next/app/transactions/[year]/[month]/new/page.tsx
export default async function TransactionNewPage({
  params,
}: {
  params: Promise<{ year: string; month: string }>;
}) {
  const { year, month } = await params;

  return (
    <TransactionForm
      title="Nouvelle transaction"
      defaultYear={parseInt(year)}
      defaultMonth={parseInt(month)}
    />
  );
}
