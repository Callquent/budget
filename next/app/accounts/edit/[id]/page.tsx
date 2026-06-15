import AccountForm from '@/components/AccountForm';

async function updateAccount(formData: FormData) {
  'use server';

  const data = {
    name: formData.get('name'),
    type: formData.get('type'),
    currency: formData.get('currency'),
    balance: formData.get('balance'),
  };

  console.log('Updating account:', data);
  // await db.update(...);
  // revalidatePath('/accounts');
  // redirect('/accounts');
}

export default async function AccountEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <AccountForm
      title="Modifier le compte"
      initialData={{
        id,
        name: 'Compte Courant',
        type: 'debit',
        currency: '€',
        balance: 1250.50,
      }}
      action={updateAccount}
    />
  );
}
