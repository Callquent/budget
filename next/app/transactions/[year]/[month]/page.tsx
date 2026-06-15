"use client";

import React, { useState, use } from "react";
import Link from "next/link";
import MonthYearSelector from "@/components/MonthYearSelector";
import MonthSummaryCards from "@/components/MonthSummaryCards";
import AccountsTransactionsTab from "@/components/AccountsTransactionsTab";
import AllTransactionsTab from "@/components/AllTransactionsTab";

// ... (MOCK_DATA inchangé, conserve le tien)
const MOCK_DATA = {
  monthLabel: 'juin',
  nowYear: 2026,
  nowMonth: 6,
  months: {
    1: 'Janvier', 2: 'Février', 3: 'Mars', 4: 'Avril', 5: 'Mai', 6: 'Juin',
    7: 'Juillet', 8: 'Août', 9: 'Septembre', 10: 'Octobre', 11: 'Novembre', 12: 'Décembre'
  } as Record<number, string>,
  totalCredit: 2500.00,
  totalDebit: 1200.00,
  byAccount: [
    {
      account: { id: 1, name: 'Compte Courant', type: 'checking', currency: '€', balance: 1250.50 },
      credit: 2000, debit: 800, balanceEnd: 1450.50,
      transactions: [
        { id: 101, transactionDate: '2026-06-01', label: 'Salarie', type: 'credit', amount: 2000, category: { name: 'Salaire', transactionType: 'income' }, notes: 'Virement mensuel' },
        { id: 102, transactionDate: '2026-06-05', label: 'Loyer', type: 'debit', amount: 700, category: { name: 'Logement', transactionType: 'expense' }, notes: '' },
        { id: 103, transactionDate: '2026-06-10', label: 'Courses', type: 'debit', amount: 100, category: { name: 'Alimentation', transactionType: 'expense' }, notes: '' },
      ]
    },
    {
      account: { id: 2, name: 'Épargne', type: 'credit', currency: '€', balance: 5000.00 },
      credit: 500, debit: 400, balanceEnd: 5100.00,
      transactions: [
        { id: 201, transactionDate: '2026-06-02', label: 'Intérêts', type: 'credit', amount: 500, category: { name: 'Revenus', transactionType: 'income' }, notes: '' },
        { id: 202, transactionDate: '2026-06-15', label: 'Virement vers courant', type: 'debit', amount: 400, category: { name: 'Transfert', transactionType: 'transfer' }, notes: '' },
      ]
    }
  ],
  transactions: [
    { id: 101, transactionDate: '2026-06-01', label: 'Salarie', type: 'credit', amount: 2000, category: { name: 'Salaire', transactionType: 'income' }, account: { name: 'Compte Courant' }, notes: 'Virement mensuel' },
    { id: 102, transactionDate: '2026-06-05', label: 'Loyer', type: 'debit', amount: 700, category: { name: 'Logement', transactionType: 'expense' }, account: { name: 'Compte Courant' }, notes: '' },
    { id: 103, transactionDate: '2026-06-10', label: 'Courses', type: 'debit', amount: 100, category: { name: 'Alimentation', transactionType: 'expense' }, account: { name: 'Compte Courant' }, notes: '' },
    { id: 201, transactionDate: '2026-06-02', label: 'Intérêts', type: 'credit', amount: 500, category: { name: 'Revenus', transactionType: 'income' }, account: { name: 'Épargne' }, notes: '' },
    { id: 202, transactionDate: '2026-06-15', label: 'Virement vers courant', type: 'debit', amount: 400, category: { name: 'Transfert', transactionType: 'transfer' }, account: { name: 'Épargne' }, notes: '' },
  ]
};

export default function TransactionsPage({ params }: { params: Promise<{ year: string; month: string }> }) {
  const { year, month } = use(params); // ← unwrap async params
  const [activeTab, setActiveTab] = useState<'accounts' | 'all'>('accounts');
  const { monthLabel, nowYear, nowMonth, months, totalCredit, totalDebit, byAccount, transactions } = MOCK_DATA;

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

      <MonthYearSelector year={year} month={month} nowYear={nowYear} nowMonth={nowMonth} months={months} />

      <MonthSummaryCards totalCredit={totalCredit} totalDebit={totalDebit} />

      <ul className="nav nav-tabs mb-0" role="tablist">
        <li className="nav-item" role="presentation">
          <button className={`nav-link ${activeTab === 'accounts' ? 'active' : ''}`} onClick={() => setActiveTab('accounts')} type="button">
            <i className="bi bi-bank me-1"></i>Comptes
            <span className="badge bg-secondary ms-1">{byAccount.length}</span>
          </button>
        </li>
        <li className="nav-item" role="presentation">
          <button className={`nav-link ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')} type="button">
            <i className="bi bi-pencil-square me-1"></i>Toutes les transactions
            <span className="badge bg-secondary ms-1">{transactions.length}</span>
          </button>
        </li>
      </ul>

      <div className="tab-content border border-top-0 rounded-bottom bg-white p-0 mb-4">
        {activeTab === 'accounts' && (
          <AccountsTransactionsTab byAccount={byAccount} monthLabel={monthLabel} year={year} month={month} />
        )}

        {activeTab === 'all' && (
          <AllTransactionsTab
            transactions={transactions}
            totalCredit={totalCredit}
            totalDebit={totalDebit}
            monthLabel={monthLabel}
            year={year}
            month={month}
          />
        )}
      </div>
    </>
  );
}
