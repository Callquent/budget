import CategoryForm from "@/components/CategoryForm";

// next/app/categories/edit/[id]/page.tsx
export default async function CategoryEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  const res = await fetch(`${apiUrl}/categories/${id}`, { cache: "no-store" });
  const data = await res.json();

  return <CategoryForm title={`Modifier « ${data.name} »`} initialData={data} />;
}
