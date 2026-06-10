import BudgetForm from '@/components/BudgetForm';

async function updateBudget(formData: FormData) {
  'use server';

  const data = {
    label: formData.get('label'),
    categoryId: formData.get('categoryId'),
    accountId: formData.get('accountId'),
    year: formData.get('year'),
    month: formData.get('month'),
    plannedAmount: formData.get('plannedAmount'),
    actualAmount: formData.get('actualAmount'),
  };

  console.log('Updating budget:', data);

  // Exemple : await db.update(...).where(eq(budget.id, id));
  // revalidatePath('/budget');
  // redirect('/budget');
}

export default function BudgetEditPage() {
  return (
    <BudgetForm
      title="Modifier la ligne de budget"
      initialData={{
        label: 'Exemple de label',
        categoryId: '1',
        accountId: '1',
        year: 2026,
        month: 6,
        plannedAmount: 500,
        actualAmount: 480,
      }}
      action={updateBudget}
    />
  );
}
