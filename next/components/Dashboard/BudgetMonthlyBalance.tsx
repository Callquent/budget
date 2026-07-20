"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL;

function fmt(num: number | string) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parseFloat(String(num)) || 0);
}

interface MonthlyBalanceData {
  monthNames: string[];
  netPlannedMonthly: (number | string)[];
  netActualMonthly: (number | string)[];
}

// Reprend le contenu de l'ex-onglet "Bilan Mensuel" de la page Statistiques,
// désormais affiché directement sur le dashboard (données de l'année en cours).
export default function BudgetMonthlyBalance() {
  const [data, setData] = useState<MonthlyBalanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const year = new Date().getFullYear();
        const res = await fetch(`${API}/statistics/${year}`, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          setData({
            monthNames: json.monthNames,
            netPlannedMonthly: json.netPlannedMonthly,
            netActualMonthly: json.netActualMonthly,
          });
        }
      } catch (e) {
        // Comme pour l'alerte de découvert : amélioration non bloquante du
        // dashboard, on n'affiche rien mais on log pour diagnostiquer.
        console.error("BudgetMonthlyBalance: échec du chargement", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !data) return null;

  const toNum = (v: number | string) => parseFloat(String(v)) || 0;

  return (
    <div className="card mb-4 border-0 shadow-sm rounded-3">
      <div className="card-header bg-white fw-semibold">
        <i className="bi bi-cash-stack me-2 text-primary"></i>
        Bilan mensuel (revenus − dépenses)
      </div>
      <div className="card-body">
        <div className="row g-3">
          {data.monthNames.map((name, idx) => {
            const actualNet = toNum(data.netActualMonthly[idx] ?? 0);
            const plannedNet = toNum(data.netPlannedMonthly[idx] ?? 0);
            const isPositive = actualNet > 0;
            const isNegative = actualNet < 0;
            const bgClass = isPositive
              ? "bg-success-subtle"
              : isNegative
                ? "bg-danger-subtle"
                : "bg-light";
            const badgeClass = isPositive
              ? "bg-success"
              : isNegative
                ? "bg-danger"
                : "bg-secondary";

            return (
              <div className="col-md-3 col-sm-6" key={idx}>
                <div className={`card h-100 border-0 ${bgClass}`}>
                  <div className="card-body text-center py-3">
                    <div className="text-muted small fw-semibold mb-2 text-uppercase">
                      {name}
                    </div>
                    <span
                      className={`badge ${badgeClass} px-3 py-2`}
                      style={{ fontSize: "0.95rem" }}
                    >
                      {isPositive ? "+" : ""}
                      {fmt(actualNet)} €
                    </span>
                    <div className="text-muted small mt-2">
                      Prévu : {plannedNet > 0 ? "+" : ""}
                      {fmt(plannedNet)} €
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
