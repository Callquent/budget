"use client";

import React, { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import MonthYearSelector from "@/components/Transaction/MonthYearSelector";
import MonthSummaryCards from "@/components/Transaction/MonthSummaryCards";
import AccountsTransactionsTab from "@/components/Transaction/AccountsTransactionsTab";
import AllTransactionsTab from "@/components/Transaction/AllTransactionsTab";
import {
  AccountRow,
  TransactionWithAccount,
} from "@/components/Transaction/Transaction.interface";

const MONTHS: Record<number, string> = {
  1: "Janvier",
  2: "Février",
  3: "Mars",
  4: "Avril",
  5: "Mai",
  6: "Juin",
  7: "Juillet",
  8: "Août",
  9: "Septembre",
  10: "Octobre",
  11: "Novembre",
  12: "Décembre",
};

interface ApiData {
  year: string;
  month: string;
  nowYear: number;
  nowMonth: number;
  totalCredit: number;
  totalDebit: number;
  byAccount: AccountRow[];
  transactions: TransactionWithAccount[];
}

const API = process.env.NEXT_PUBLIC_API_URL;

interface TransactionListProps {
  year: string;
  month: string;
}

export default function TransactionList({ year, month }: TransactionListProps) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"accounts" | "all">("accounts");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/transactions/${year}/${month}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading)
    return (
      <div className="d-flex justify-content-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Chargement…</span>
        </div>
      </div>
    );

  if (error)
    return (
      <div className="alert alert-danger d-flex align-items-center gap-2">
        <i className="bi bi-exclamation-triangle-fill"></i>
        Impossible de charger les transactions : {error}
        <button
          className="btn btn-sm btn-outline-danger ms-auto"
          onClick={fetchData}
        >
          Réessayer
        </button>
      </div>
    );

  if (!data) return null;

  const {
    nowYear,
    nowMonth,
    totalCredit,
    totalDebit,
    byAccount,
    transactions,
  } = data;
  const monthLabel = MONTHS[parseInt(month)];

  return (
    <>
      <MonthYearSelector
        year={year}
        month={month}
        nowYear={nowYear}
        nowMonth={nowMonth}
        months={MONTHS}
      />

      <MonthSummaryCards totalCredit={totalCredit} totalDebit={totalDebit} />

      <ul className="nav nav-tabs mb-0" role="tablist">
        <li className="nav-item" role="presentation">
          <button
            className={`nav-link ${activeTab === "accounts" ? "active" : ""}`}
            onClick={() => setActiveTab("accounts")}
            type="button"
          >
            <i className="bi bi-bank me-1"></i>Comptes
            <span className="badge bg-secondary ms-1">{byAccount.length}</span>
          </button>
        </li>
        <li className="nav-item" role="presentation">
          <button
            className={`nav-link ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
            type="button"
          >
            <i className="bi bi-pencil-square me-1"></i>Toutes les transactions
            <span className="badge bg-secondary ms-1">
              {transactions.length}
            </span>
          </button>
        </li>
      </ul>

      <div className="tab-content border border-top-0 rounded-bottom bg-white p-0 mb-4">
        {activeTab === "accounts" && (
          <AccountsTransactionsTab
            byAccount={byAccount}
            monthLabel={monthLabel}
            year={year}
            month={month}
          />
        )}
        {activeTab === "all" && (
          <AllTransactionsTab
            transactions={transactions}
            totalCredit={totalCredit}
            totalDebit={totalDebit}
            monthLabel={monthLabel}
            year={year}
            month={month}
            onRefresh={fetchData}
          />
        )}
      </div>
    </>
  );
}
