"use client";

import { use } from "react";
import Link from "next/link";
import TransactionList from "@/components/TransactionList";

export default function TransactionsPage({
  params,
}: {
  params: Promise<{ year: string; month: string }>;
}) {
  const { year, month } = use(params);

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h1 className="h3 mb-0">
          <i className="bi bi-list-ul me-2 text-primary"></i>Transactions
        </h1>
        <Link href={`/transactions/${year}/${month}/new`} className="btn btn-primary btn-sm">
          <i className="bi bi-plus-lg me-1"></i>Nouvelle transaction
        </Link>
      </div>

      <TransactionList year={year} month={month} />
    </>
  );
}
