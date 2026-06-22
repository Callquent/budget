"use client";
import Link from "next/link";
import AccountList from "@/components/Account/AccountList";

export default function AccountsPage() {
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">
          <i className="bi bi-bank me-2 text-primary"></i>Comptes
        </h1>
        <Link href="/accounts/new" className="btn btn-primary btn-sm">
          <i className="bi bi-plus-lg me-1"></i>Nouveau compte
        </Link>
      </div>

      <AccountList />
    </>
  );
}
