import BudgetForm from "@/components/BudgetForm";

async function saveBudget(formData: FormData) {
  "use server";

  const data = {
    label: formData.get("label"),
    categoryId: formData.get("categoryId"),
    accountId: formData.get("accountId"),
    year: formData.get("year"),
    month: formData.get("month"),
    plannedAmount: formData.get("plannedAmount"),
    actualAmount: formData.get("actualAmount"),
  };

  console.log("Saving new budget:", data);

  // Exemple : await db.insert(...);
  // revalidatePath("/budget");
  // redirect("/budget");
}

export default function BudgetNewPage() {
  return (
    <BudgetForm
      title="Nouvelle ligne de budget"
      action={saveBudget}
    />
  );
}
