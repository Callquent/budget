import CategoryForm from '@/components/CategoryForm';

export default function CategoryNewPage() {
  return (
    <CategoryForm
      title="Nouvelle catégorie"
      onSubmit={(data) => console.log('Saving new category:', data)}
    />
  );
}
