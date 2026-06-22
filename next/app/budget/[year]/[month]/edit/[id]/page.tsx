import BudgetForm from "@/components/BudgetForm";

// next/app/budget/edit/[id]/page.tsx
export default async function BudgetEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  const res = await fetch(`${apiUrl}/budget/${id}`, { cache: "no-store" });
  const data = await res.json();

  return (
    <BudgetForm
      title={data.isApproved ? `Budget verrouillé — ${data.label ?? ""}` : "Modifier le budget"}
      initialData={data}
    />
  );
}
