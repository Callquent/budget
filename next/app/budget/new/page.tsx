import BudgetForm from "@/components/Budget/BudgetForm";

export default async function BudgetNewPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    month?: string;
    categoryId?: string;
    accountId?: string;
    amount?: string;
    label?: string;
  }>;
}) {
  const { year, month, categoryId, accountId, amount, label } =
    await searchParams;

  // Pré-remplissage quand on arrive depuis une ligne d'abonnement (bouton
  // "créer le budget" dans BudgetMonthView) : categoryId/accountId/amount/label
  // sont alors passés en query params.
  const hasPrefill = categoryId || accountId || amount || label;

  return (
    <BudgetForm
      title="Nouvelle ligne de budget"
      currentYear={year ? parseInt(year) : new Date().getFullYear()}
      currentMonth={month ? parseInt(month) : new Date().getMonth() + 1}
      initialData={
        hasPrefill
          ? {
              categoryId: categoryId ? parseInt(categoryId) : undefined,
              accountId: accountId ? parseInt(accountId) : undefined,
              plannedAmount: amount ?? undefined,
              actualAmount: amount ?? undefined,
              label: label ?? undefined,
            }
          : undefined
      }
    />
  );
}
