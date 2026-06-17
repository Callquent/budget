"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

export interface Account {
  id: number;
  name: string;
  type: "debit" | "credit";
  balance: string;
  currency: string;
}

function formatNumber(num: number) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

const API = process.env.NEXT_PUBLIC_API_URL;

export default function AccountList() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/accounts`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data = await res.json();
      setAccounts(data.accounts);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleDelete = async (id: number) => {
    if (!window.confirm("Supprimer ce compte ?")) return;
    try {
      const res = await fetch(`${API}/accounts/${id}/delete`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`${res.status} — ${body}`);
      }
      fetchAccounts();
    } catch (e: any) {
      alert(`Erreur lors de la suppression : ${e.message}`);
    }
  };

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
        Impossible de charger les comptes : {error}
        <button
          className="btn btn-sm btn-outline-danger ms-auto"
          onClick={fetchAccounts}
        >
          Réessayer
        </button>
      </div>
    );

  if (accounts.length === 0)
    return (
      <div className="alert alert-info">
        Aucun compte.{" "}
        <Link href="/accounts/new" className="alert-link">
          En créer un
        </Link>
        .
      </div>
    );

  return (
    <div className="row g-3">
      {accounts.map((account) => (
        <div className="col-md-4" key={account.id}>
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <h5 className="card-title mb-1">{account.name}</h5>
                  <span
                    className={`badge ${account.type === "credit" ? "bg-success" : "bg-secondary"}`}
                  >
                    {account.type === "credit" ? "Crédit" : "Débit"}
                  </span>
                </div>
                <span className="fs-5 fw-bold text-primary">
                  {formatNumber(parseFloat(account.balance))} {account.currency}
                </span>
              </div>
            </div>
            <div className="card-footer bg-transparent d-flex gap-2">
              <Link
                href={`/accounts/edit/${account.id}`}
                className="btn btn-sm btn-outline-primary"
              >
                <i className="bi bi-pencil me-1"></i>Modifier
              </Link>
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={() => handleDelete(account.id)}
              >
                <i className="bi bi-trash me-1"></i>Supprimer
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
