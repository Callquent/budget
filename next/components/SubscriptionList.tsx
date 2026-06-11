"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";

export interface Subscription {
  id: number;
  name: string;
  amount: string;
  frequency: "monthly" | "yearly" | "quarterly" | "occasional";
  status: "active" | "inactive";
  account: { name: string };
  category: { name: string };
  startDate: string;
  endDate: string | null;
}

const freqLabels: Record<string, string> = {
  monthly: "Mensuel",
  yearly: "Annuel",
  quarterly: "Trimestriel",
  occasional: "Occasionnel",
};

function formatNumber(num: number) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("fr-FR");
}

const API = process.env.NEXT_PUBLIC_API_URL;

export default function SubscriptionList() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/subscriptions`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data = await res.json();
      setSubscriptions(data.subscriptions);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const handleToggle = async (id: number) => {
    await fetch(`${API}/subscriptions/${id}/toggle`, { method: "POST" });
    fetchSubscriptions();
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Supprimer cet abonnement ?")) return;
    await fetch(`${API}/subscriptions/${id}/delete`, { method: "POST" });
    fetchSubscriptions();
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
        Impossible de charger les abonnements : {error}
        <button
          className="btn btn-sm btn-outline-danger ms-auto"
          onClick={fetchSubscriptions}
        >
          Réessayer
        </button>
      </div>
    );

  const active = subscriptions.filter((s) => s.status === "active");
  const inactive = subscriptions.filter((s) => s.status === "inactive");
  const monthlyTotal = active.reduce((sum, s) => {
    const amount = parseFloat(s.amount);
    if (s.frequency === "monthly") return sum + amount;
    if (s.frequency === "yearly") return sum + amount / 12;
    if (s.frequency === "quarterly") return sum + amount / 3;
    return sum;
  }, 0);

  if (subscriptions.length === 0)
    return (
      <div className="alert alert-info">
        Aucun abonnement.{" "}
        <Link href="/subscriptions/new" className="alert-link">
          En ajouter un
        </Link>
        .
      </div>
    );

  return (
    <>
      <div className="alert alert-light border mb-4 d-flex align-items-center gap-3">
        <i className="bi bi-info-circle text-primary fs-5"></i>
        <span>
          Coût mensuel estimé (abonnements actifs) :{" "}
          <strong className="fw-bold">{formatNumber(monthlyTotal)} €</strong>
        </span>
      </div>

      {/* Actifs */}
      <div className="card mb-4">
        <div className="card-header bg-white">
          <span className="fw-semibold">Actifs</span>
          <span className="badge bg-success ms-2">{active.length}</span>
        </div>
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Compte</th>
                <th>Catégorie</th>
                <th>Fréquence</th>
                <th className="text-end">Montant</th>
                <th>Début</th>
                <th>Fin</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {active.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-muted text-center py-3">
                    Aucun abonnement actif.
                  </td>
                </tr>
              ) : (
                active.map((sub) => (
                  <tr key={sub.id}>
                    <td className="fw-medium">{sub.name}</td>
                    <td>{sub.account.name}</td>
                    <td>
                      <span className="badge badge-expense">
                        {sub.category.name}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${sub.frequency}`}>
                        {freqLabels[sub.frequency] ?? sub.frequency}
                      </span>
                    </td>
                    <td className="text-end fw-semibold">
                      {formatNumber(parseFloat(sub.amount))} €
                    </td>
                    <td className="text-muted small">{formatDate(sub.startDate)}</td>
                    <td className="text-muted small">{formatDate(sub.endDate) ?? "∞"}</td>
                    <td className="text-end" style={{ whiteSpace: "nowrap" }}>
                      <Link
                        href={`/subscriptions/edit/${sub.id}`}
                        className="btn btn-outline-primary btn-action me-1"
                      >
                        <i className="bi bi-pencil"></i>
                      </Link>
                      <button
                        onClick={() => handleToggle(sub.id)}
                        className="btn btn-outline-warning btn-action me-1"
                        title="Désactiver"
                      >
                        <i className="bi bi-pause"></i>
                      </button>
                      <button
                        onClick={() => handleDelete(sub.id)}
                        className="btn btn-outline-danger btn-action"
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inactifs */}
      {inactive.length > 0 && (
        <div className="card">
          <div className="card-header bg-white">
            <span className="fw-semibold text-muted">Inactifs</span>
            <span className="badge bg-secondary ms-2">{inactive.length}</span>
          </div>
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Compte</th>
                  <th>Catégorie</th>
                  <th>Fréquence</th>
                  <th className="text-end">Montant</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="text-muted">
                {inactive.map((sub) => (
                  <tr key={sub.id}>
                    <td>{sub.name}</td>
                    <td>{sub.account.name}</td>
                    <td>{sub.category.name}</td>
                    <td>{freqLabels[sub.frequency] ?? sub.frequency}</td>
                    <td className="text-end">{formatNumber(parseFloat(sub.amount))} €</td>
                    <td className="text-end" style={{ whiteSpace: "nowrap" }}>
                      <Link
                        href={`/subscriptions/edit/${sub.id}`}
                        className="btn btn-outline-secondary btn-action me-1"
                      >
                        <i className="bi bi-pencil"></i>
                      </Link>
                      <button
                        onClick={() => handleToggle(sub.id)}
                        className="btn btn-outline-success btn-action"
                        title="Réactiver"
                      >
                        <i className="bi bi-play"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
