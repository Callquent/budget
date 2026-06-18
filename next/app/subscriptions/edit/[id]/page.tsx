import SubscriptionForm from "@/components/SubscriptionForm";

// next/app/subscriptions/edit/[id]/page.tsx
export default async function SubscriptionEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  const res = await fetch(`${apiUrl}/subscriptions/${id}`, { cache: "no-store" });
  const data = await res.json();

  return (
    <SubscriptionForm
      title={`Modifier « ${data.name} »`}
      initialData={{
        id:         data.id,
        name:       data.name,
        accountId:  data.account?.id,
        categoryId: data.category?.id,
        amount:     data.amount,
        frequency:  data.frequency,
        startDate:  data.startDate?.slice(0, 10),
        endDate:    data.endDate?.slice(0, 10) ?? null,
        dayOfMonth: data.dayOfMonth,
        status:     data.status,
        notes:      data.notes,
      }}
    />
  );
}
