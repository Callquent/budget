"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";

// ─── Constantes ───────────────────────────────────────────────────────────────
// Les noms de mois viennent désormais de l'API (yearData.monthNames), source
// unique partagée avec le backend (App\Support\BudgetLabels) — plus de
// duplication entre BudgetYearView, BudgetMonthView et le PHP.

function fmt(num: number | string, decimals = 2) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(parseFloat(String(num)) || 0);
}

// ─── Composant vue année ──────────────────────────────────────────────────────
// Utilisé par app/budget/page.tsx (tableau récapitulatif des mois)

export default function BudgetYearView() {
  const [yearState, setYearState] = useState(new Date().getFullYear());
  const [yearData, setYearData] = useState<YearData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchYear = useCallback(async (y: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/budget/${y}`,
        {
          headers: { Accept: "application/json" },
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setYearData(await res.json());
      setYearState(y);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchYear(yearState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── États communs ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="d-flex flex-column justify-content-center align-items-center py-5 gap-3">
        <div
          className="spinner-border text-primary"
          style={{ width: "2rem", height: "2rem" }}
          role="status"
        ></div>
        <span className="text-muted small">Chargement des données…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger border-0 shadow-sm d-flex align-items-center gap-3 rounded-3">
        <i className="bi bi-exclamation-triangle-fill fs-5 flex-shrink-0"></i>
        <div className="flex-grow-1">
          <div className="fw-semibold">Impossible de charger les données</div>
          <div className="small text-danger-emphasis">{error}</div>
        </div>
        <button
          className="btn btn-sm btn-danger ms-auto"
          onClick={() => fetchYear(yearState)}
        >
          <i className="bi bi-arrow-clockwise me-1"></i>Réessayer
        </button>
      </div>
    );
  }

  if (!yearData) return null;

  const {
    currentYear,
    currentMonth,
    availableYears,
    accounts,
    summary,
    accountBalances,
    monthNames,
  } = yearData;

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h1 className="h3 mb-0 fw-bold">
          <i className="bi bi-calendar3 me-2 text-primary"></i>Budget{" "}
          {yearState}
        </h1>
      </div>

      <div className="card mb-4 border-0 shadow-sm rounded-3 p-3">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <span
            className="text-uppercase text-muted me-1"
            style={{
              fontSize: ".7rem",
              letterSpacing: ".08em",
              fontWeight: 600,
            }}
          >
            Année
          </span>
          {availableYears.map((y) => (
            <button
              key={y}
              onClick={() => fetchYear(y)}
              className={`btn btn-sm rounded-pill px-3 ${y === yearState ? "btn-primary" : "btn-outline-secondary"}`}
            >
              {y}
              {y === currentYear && (
                <span
                  className={`badge ms-1 ${y === yearState ? "bg-white text-primary" : "bg-primary text-white"}`}
                  style={{ fontSize: ".6rem" }}
                >
                  en cours
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="card mb-4 border-0 shadow-sm rounded-3">
        <div
          className="card-header bg-white border-bottom d-flex justify-content-between align-items-center py-3 rounded-top-3"
          style={{ borderLeft: "4px solid var(--bs-primary)" }}
        >
          <span className="fw-semibold">Récapitulatif annuel {yearState}</span>
          <span className="text-muted small">
            <i className="bi bi-info-circle me-1"></i>Solde fin de mois par
            compte
          </span>
        </div>
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead>
              <tr>
                <th style={{ minWidth: "110px" }}>Mois</th>
                {accounts.map((a) => (
                  <th
                    key={a.id}
                    className="text-end"
                    style={{ minWidth: "130px" }}
                  >
                    <span className="d-flex align-items-center justify-content-end gap-1">
                      <i className="bi bi-piggy-bank text-success small"></i>
                      {a.name}
                    </span>
                  </th>
                ))}
                <th className="text-end" style={{ minWidth: "120px" }}>
                  Total
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                const budgetRow = summary[m] ?? null;
                let totalBalance = 0;
                accounts.forEach((a) => {
                  totalBalance +=
                    accountBalances[a.id]?.[m]?.balance ?? a.balance;
                });

                return (
                  <tr key={m}>
                    <td>
                      <Link
                        href={`/budget/${yearState}/${m}`}
                        className="text-decoration-none fw-semibold text-dark"
                      >
                        {monthNames[m]}
                        {yearState === currentYear && m === currentMonth && (
                          <span
                            className="badge bg-primary bg-opacity-10 text-primary ms-1 rounded-pill"
                            style={{ fontSize: ".6rem" }}
                          >
                            en cours
                          </span>
                        )}
                      </Link>
                    </td>
                    {accounts.map((a) => {
                      const ab = accountBalances[a.id]?.[m];
                      const bal = ab?.balance ?? a.balance;
                      const colorRef =
                        (ab?.planned_net ?? 0) !== 0 &&
                        ab?.balance_projected != null
                          ? ab.balance_projected
                          : bal;
                      return (
                        <td
                          key={a.id}
                          className="text-end"
                          style={{
                            background:
                              colorRef < 0
                                ? "rgba(220,53,69,.08)"
                                : "rgba(25,135,84,.07)",
                            borderLeft:
                              colorRef < 0
                                ? "3px solid rgba(220,53,69,.35)"
                                : "3px solid rgba(25,135,84,.35)",
                          }}
                        >
                          {/* Solde projeté */}
                          {((ab?.month_planned_net ?? 0) !== 0 ||
                            ab?.month_all_approved) && (
                            <div
                              style={{
                                marginTop:
                                  (ab!.balance_projected ?? 0) < 0
                                    ? "8px"
                                    : "4px",
                                paddingTop: "4px",
                              }}
                              title="Estimation avec budget prévu"
                            >
                              {!ab?.month_all_approved && (
                                <div
                                  style={{
                                    fontSize: ".68rem",
                                    color: "#adb5bd",
                                    marginBottom: "1px",
                                    textAlign: "right",
                                  }}
                                >
                                  Estimation prévue du solde en fin de mois
                                </div>
                              )}
                              <div
                                style={{
                                  textAlign: "right",
                                  marginBottom: "2px",
                                }}
                              >
                                {(() => {
                                  const allApproved = ab?.month_all_approved;
                                  const value = allApproved
                                    ? (ab?.credit ?? 0) - (ab?.debit ?? 0)
                                    : (ab?.month_planned_net ?? 0);
                                  const label = allApproved
                                    ? "Réalisé"
                                    : "Estimation";
                                  if (value === 0)
                                    return (
                                      <span className="text-muted small">
                                        —
                                      </span>
                                    );
                                  return (
                                    <span
                                      className={`badge rounded-pill ${value >= 0 ? "bg-success" : "bg-danger"}`}
                                      style={{
                                        fontSize: ".75rem",
                                        fontWeight: 600,
                                      }}
                                      title={label}
                                    >
                                      {value >= 0 ? "+" : ""}
                                      {fmt(value)} €
                                    </span>
                                  );
                                })()}
                              </div>
                              {!ab?.month_all_approved && (
                                <div
                                  style={{
                                    fontSize: "1rem",
                                    fontWeight: 600,
                                    color:
                                      (ab!.balance_projected ?? 0) < 0
                                        ? "#842029"
                                        : "#055160",
                                    textAlign: "right",
                                  }}
                                >
                                  {fmt(ab!.balance_projected)} €
                                </div>
                              )}
                            </div>
                          )}

                          {/* Solde principal */}
                          <div
                            style={{
                              borderTop:
                                (ab?.planned_net ?? 0) !== 0
                                  ? "1px solid rgba(0,0,0,.10)"
                                  : "none",
                            }}
                          >
                            <div
                              style={{
                                fontSize: ".68rem",
                                color: "#adb5bd",
                                marginBottom: "1px",
                                textAlign: "right",
                              }}
                            >
                              Solde actuel
                            </div>
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: "1rem",
                                color: colorRef < 0 ? "#842029" : "#0a3622",
                              }}
                            >
                              {fmt(bal)} €
                            </div>
                          </div>
                        </td>
                      );
                    })}
                    <td
                      className="text-end fw-bold"
                      style={{
                        color: totalBalance < 0 ? "#842029" : "#0a3622",
                        background:
                          totalBalance < 0
                            ? "rgba(220,53,69,.1)"
                            : "rgba(25,135,84,.09)",
                        borderLeft:
                          totalBalance < 0
                            ? "3px solid rgba(220,53,69,.45)"
                            : "3px solid rgba(25,135,84,.45)",
                        fontSize: "1rem",
                      }}
                    >
                      {fmt(totalBalance)} €
                    </td>
                    <td>
                      <Link
                        href={`/budget/${yearState}/${m}`}
                        className="btn btn-outline-secondary btn-action"
                        title="Détail"
                      >
                        <i className="bi bi-eye"></i>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="table-light">
              <tr>
                <td className="fw-semibold">Solde actuel</td>
                {accounts.map((a) => (
                  <td key={a.id} className="text-end fw-semibold">
                    {fmt(a.balance)} €
                  </td>
                ))}
                <td className="text-end fw-bold text-primary">
                  {fmt(accounts.reduce((s, a) => s + a.balance, 0))} €
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
}
