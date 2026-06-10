import SubscriptionForm from '@/components/SubscriptionForm';

export default function SubscriptionNewPage() {
  return (
    <SubscriptionForm
      title="Nouvel abonnement"
      onSubmit={(data) => console.log('Saving new subscription:', data)}
    />
  );
}
