export interface CategoryInterface {
  id: number;
  name: string;
  description: string;
  transactionType: string;
  parentId: number | null;
}

export interface CategoryFormProps {
  initialData?: Partial<CategoryInterface>;
  title: string;
}

export interface CategoryApiResponse {
  grouped: Record<string, CategoryInterface[]>;
}
