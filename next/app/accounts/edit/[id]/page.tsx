import AccountForm from '@/components/AccountForm';

export default function AccountEditPage({ params }: { params: { id: string } }) {
  return (
    <AccountForm
      title="Modifier le compte"
      initialData={{
        id: params.id,
        name: 'Compte Courant',
        type: 'debit',
        currency: '€',
        balance: 1250.50
      }}
      onSubmit={(data) => console.log('Updating account:', data)}
    />
  );
}
