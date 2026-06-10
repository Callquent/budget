import AccountForm from '@/components/AccountForm';

export default function AccountNewPage() {
  return (
    <AccountForm
      title="Nouveau compte"
      onSubmit={(data) => console.log('Saving new account:', data)}
    />
  );
}
