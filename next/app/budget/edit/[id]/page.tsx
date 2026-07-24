import { notFound } from "next/navigation";
import BudgetForm from "@/components/Budget/BudgetForm";

// Emplacement réel dans le projet :
// next/app/budget/edit/[id]/page.tsx
export default async function BudgetEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  const res = await fetch(`${apiUrl}/budget/${id}`, { cache: "no-store" });

  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`Erreur ${res.status} lors du chargement de la ligne budgétaire ${id}`);

  const data = await res.json();

  return (
    <BudgetForm
      title={
        data.isApproved
          ? `Budget verrouillé — ${data.label ?? ""}`
          : "Modifier le budget"
      }
      initialData={data}
    />
  );
}
