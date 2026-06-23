import TransactionForm from "@/components/Transaction/TransactionForm";

// next/app/transactions/edit/[id]/page.tsx
export default async function TransactionEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  const res = await fetch(`${apiUrl}/transactions/${id}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    // Next.js 14+ : notFound() ou throw pour déclencher la 404 page
    throw new Error(`Transaction ${id} introuvable`);
  }

  const data = await res.json();

  return <TransactionForm title="Modifier la transaction" initialData={data} />;
}
