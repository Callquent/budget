import CategoryForm from '@/components/CategoryForm';

export default function CategoryEditPage({ params }: { params: { id: string } }) {
  return (
    <CategoryForm
      title="Modifier la catégorie"
      initialData={{
        id: params.id,
        name: 'Alimentation',
        transactionType: 'expense',
        frequency: 'monthly',
        description: 'Achats hebdomadaires'
      }}
      onSubmit={(data) => console.log('Updating category:', data)}
    />
  );
}
