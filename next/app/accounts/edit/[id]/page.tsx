import AccountForm from "@/components/AccountForm";

// next/app/accounts/edit/[id]/page.tsx
export default async function AccountEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/accounts/${id}`, {
    cache: "no-store",
  });
  const data = await res.json();

  return <AccountForm title={`Modifier « ${data.name} »`} initialData={data} />;
}
