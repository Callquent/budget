import TransactionForm from '@/components/TransactionForm';

async function saveTransaction(formData: FormData) {
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

  console.log('Saving new transaction:', data);

  // await db.insert(...);
  // revalidatePath('/transactions');
  // redirect('/transactions');
}

export default function TransactionNewPage() {
  return (
    <TransactionForm
      title="Nouvelle transaction"
      action={saveTransaction}
    />
  );
}
