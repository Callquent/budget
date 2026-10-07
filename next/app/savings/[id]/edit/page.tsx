import { notFound } from "next/navigation";
import SavingsGoalForm from "@/components/Savings/SavingsGoalForm";
import type { SavingsGoalInterface } from "@/components/Savings/Savings.interface";

async function getSavingsGoal(id: string): Promise<SavingsGoalInterface | null> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/savings/${id}`, {
    cache: "no-store",
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load savings goal (${res.status})`);

  return res.json();
}

export default async function EditSavingsGoalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const goal = await getSavingsGoal(id);
  if (!goal) notFound();

  return (
    <SavingsGoalForm
      // Le contrôleur renvoie account/category en objets imbriqués (plus
      // les champs de progression calculés) : on en dérive accountId /
      // categoryId à plat, ce que SavingsGoalForm attend pour préremplir
      // AccountPicker / CategoryPicker.
      initialData={{
        ...goal,
        accountId: goal.account?.id,
        categoryId: goal.category?.id,
      }}
      title={`Edit: ${goal.name}`}
    />
  );
}
