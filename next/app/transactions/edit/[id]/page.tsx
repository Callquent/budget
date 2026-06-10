import TransactionForm from '@/components/TransactionForm';

async function updateTransaction(formData: FormData) {
  'use server';

  const data = {
    transactionDate: formData.get('transactionDate'),
    accountId: formData.get('accountId'),
    type: formData.get('type'),
    categoryId: formData.get('categoryId'),
    amount: formData.get('amount'),
    label: formData.get('label'),
    notes: formData.get('notes'),
  };

  console.log('Updating transaction:', data);

  // await db.update(...).where(eq(transactions.id, id));
  // revalidatePath('/transactions');
  // redirect('/transactions');
}

export default async function TransactionEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params; // ← async params Next.js 15

  return (
    <TransactionForm
      title="Modifier la transaction"
      initialData={{
        transactionDate: '2026-06-01',
        label: 'Exemple de transaction',
        amount: 100.00,
        type: 'debit',
        categoryId: '1',
        accountId: '1',
      }}
      action={updateTransaction}
    />
  );
}
