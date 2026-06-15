import CategoryForm from '@/components/CategoryForm';

async function updateCategory(formData: FormData) {
  'use server';

  const data = {
    name: formData.get('name'),
    transactionType: formData.get('transactionType'),
    frequency: formData.get('frequency'),
    description: formData.get('description'),
  };

  console.log('Updating category:', data);
  // await db.update(...);
  // revalidatePath('/categories');
  // redirect('/categories');
}

export default async function CategoryEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <CategoryForm
      title="Modifier la catégorie"
      initialData={{
        id,
        name: 'Alimentation',
        transactionType: 'expense',
        frequency: 'monthly',
        description: 'Achats hebdomadaires',
      }}
      action={updateCategory}
    />
  );
}
