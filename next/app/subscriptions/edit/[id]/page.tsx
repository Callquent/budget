import SubscriptionForm from '@/components/SubscriptionForm';

export default function SubscriptionEditPage({ params }: { params: { id: string } }) {
  return (
    <SubscriptionForm
      title="Modifier l'abonnement"
      initialData={{
        id: params.id,
        name: 'Netflix',
        accountId: '1',
        categoryId: '1',
        amount: 13.49,
        frequency: 'monthly',
        startDate: '2023-01-01',
        endDate: null,
        dayOfMonth: 1,
        status: 'active',
        notes: ''
      }}
      onSubmit={(data) => console.log('Updating subscription:', data)}
    />
  );
}
