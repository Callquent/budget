import { redirect } from 'next/navigation';

export default function TransactionsIndexPage() {
  const now = new Date();
  redirect(`/transactions/${now.getFullYear()}/${now.getMonth() + 1}`);
}
