"use client";
import React, { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { AccountInterface } from "../Account/Account.interface";
import type { SubscriptionInterface } from "../Subscription/Subscription.interface";
import type {
  Budget,
  TxByAccount,
  SummaryRow,
  AccountBalance,
  MonthData,
  YearData,
} from "./Budget.interface";

// ─── Constantes ───────────────────────────────────────────────────────────────

const MONTH_NAMES: Record<number, string> = {
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

const FREQ_LABELS: Record<string, string> = {
  monthly: "mensuelle",
  yearly: "annuelle",
  quarterly: "trimestrielle",
  occasional: "occasionnel",
};

function fmt(num: number | string, decimals = 2) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(parseFloat(String(num)) || 0);
}

// ─── Composant unifié ─────────────────────────────────────────────────────────
// • Sans params  → vue année (app/page.tsx)
// • Avec params  → vue mois  (app/budget/[year]/[month]/page.tsx)

export default function BudgetMonthView({
  params,
}: {
  params?: Promise<{ year: string; month: string }>;
}) {
  // Résolution des params (vue mois) ou détection de l'année courante (vue année)
  const resolved = params ? use(params) : null;
  const urlYear = resolved ? parseInt(resolved.year) : null;
  const urlMonth = resolved ? parseInt(resolved.month) : null;
  const isMonthView = urlYear !== null && urlMonth !== null;

  const [yearState, setYearState] = useState(
    urlYear ?? new Date().getFullYear(),
  );
  const [monthData, setMonthData] = useState<MonthData | null>(null);
  const [yearData, setYearData] = useState<YearData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
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

  const fetchMonth = useCallback(async (y: number, m: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/budget/${y}/${m}`,
        {
          headers: { Accept: "application/json" },
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMonthData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isMonthView) fetchMonth(urlYear!, urlMonth!);
    else fetchYear(yearState);
  }, [isMonthView, urlYear, urlMonth, yearState, fetchYear, fetchMonth]);

  // ── Actions POST (vue mois) ───────────────────────────────────────────────
  async function postAction(path: string) {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/budget${path}`,
      {
        method: "POST",
        headers: { Accept: "application/json" },
      },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }

  const handleApprove = async (b: Budget) => {
    if (
      !window.confirm(
        `Approuver « ${b.category.name} » et créer la transaction de ${b.actualAmount} € ?`,
      )
    )
      return;
    try {
      await postAction(`/${b.id}/approve`);
      await fetchMonth(urlYear!, urlMonth!);
    } catch (e) {
      alert(`Erreur : ${e instanceof Error ? e.message : e}`);
    }
  };

  const handleUnapprove = async (b: Budget) => {
    if (!window.confirm("Annuler l'approbation et supprimer la transaction ?"))
      return;
    try {
      await postAction(`/${b.id}/unapprove`);
      await fetchMonth(urlYear!, urlMonth!);
    } catch (e) {
      alert(`Erreur : ${e instanceof Error ? e.message : e}`);
    }
  };

  const handleDelete = async (b: Budget) => {
    if (!window.confirm("Supprimer cette ligne ?")) return;
    try {
      await postAction(`/${b.id}/delete`);
      await fetchMonth(urlYear!, urlMonth!);
    } catch (e) {
      alert(`Erreur : ${e instanceof Error ? e.message : e}`);
    }
  };

  const handleDuplicate = async () => {
    if (!window.confirm("Copier ces lignes vers le mois suivant ?")) return;
    try {
      await postAction(`/${urlYear}/${urlMonth}/duplicate`);
      await fetchMonth(urlYear!, urlMonth!);
    } catch (e) {
      alert(`Erreur : ${e instanceof Error ? e.message : e}`);
    }
  };

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
          onClick={() =>
            isMonthView ? fetchMonth(urlYear!, urlMonth!) : fetchYear(yearState)
          }
        >
          <i className="bi bi-arrow-clockwise me-1"></i>Réessayer
        </button>
      </div>
    );
  }

  // ── VUE ANNÉE ─────────────────────────────────────────────────────────────
  if (!isMonthView && yearData) {
    const {
      currentYear,
      currentMonth,
      availableYears,
      accounts,
      summary,
      accountBalances,
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
            <span className="fw-semibold">
              Récapitulatif annuel {yearState}
            </span>
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
                  <th className="text-end" style={{ minWidth: "100px" }}>
                    Budget prévu
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
                          {MONTH_NAMES[m]}
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
                            {/* Solde principal */}
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: ".95rem",
                                color: colorRef < 0 ? "#842029" : "#0a3622",
                              }}
                            >
                              {fmt(bal)} €
                            </div>

                            {/* Badges crédit / débit */}
                            {((ab?.credit ?? 0) > 0 ||
                              (ab?.debit ?? 0) > 0) && (
                              <div className="d-flex gap-1 justify-content-end mt-1">
                                {(ab?.credit ?? 0) > 0 && (
                                  <span
                                    style={{
                                      fontSize: ".78rem",
                                      fontWeight: 600,
                                      color: "#146c43",
                                      background: "#d1e7dd",
                                      borderRadius: "4px",
                                      padding: "1px 5px",
                                    }}
                                  >
                                    +{fmt(ab!.credit, 0)}
                                  </span>
                                )}
                                {(ab?.debit ?? 0) > 0 && (
                                  <span
                                    style={{
                                      fontSize: ".78rem",
                                      fontWeight: 600,
                                      color: "#842029",
                                      background: "#f8d7da",
                                      borderRadius: "4px",
                                      padding: "1px 5px",
                                    }}
                                  >
                                    −{fmt(ab!.debit, 0)}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Solde projeté */}
                            {(ab?.planned_net ?? 0) !== 0 && (
                              <div
                                style={{
                                  marginTop:
                                    (ab!.balance_projected ?? 0) < 0
                                      ? "8px"
                                      : "4px",
                                  paddingTop: "4px",
                                  borderTop: "1px solid rgba(0,0,0,.10)",
                                }}
                                title="Estimation avec budget prévu"
                              >
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
                                <div
                                  style={{
                                    fontSize: ".82rem",
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
                              </div>
                            )}
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
                      <td className="text-end text-muted small">
                        {budgetRow ? `${fmt(budgetRow.total_planned)} €` : "—"}
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

  // ── VUE MOIS ──────────────────────────────────────────────────────────────
  if (!monthData) return null;

  const {
    year,
    month,
    nowYear,
    nowMonth,
    periodLabel,
    accounts,
    txByAccount,
    subscriptions,
    budgets,
  } = monthData;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  return (
    <>
      {/* En-tête */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <Link
            href="/budget"
            className="text-muted text-decoration-none small d-inline-flex align-items-center gap-1 mb-1"
          >
            <i className="bi bi-chevron-left"></i> Retour Budget {year}
          </Link>
          <h1 className="h3 mb-0 fw-bold">
            Budget —{" "}
            <span className="text-primary">
              {periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1)}
            </span>
          </h1>
        </div>
        <div className="d-flex gap-2">
          <Link
            href={`/budget/${year}/${month}/new`}
            className="btn btn-primary btn-sm rounded-pill px-3"
          >
            <i className="bi bi-plus-lg me-1"></i>Nouvelle ligne
          </Link>
          <button
            className="btn btn-outline-secondary btn-sm rounded-pill px-3"
            onClick={handleDuplicate}
          >
            <i className="bi bi-copy me-1"></i>Dupliquer →
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="card mb-4 border-0 shadow-sm rounded-3 p-3">
        <div className="d-flex align-items-center gap-3 flex-wrap">
          <div className="d-flex align-items-center gap-2">
            <label
              className="text-uppercase text-muted mb-0"
              style={{
                fontSize: ".7rem",
                letterSpacing: ".08em",
                fontWeight: 600,
              }}
            >
              Mois
            </label>
            <select
              className="form-select form-select-sm rounded-pill border-0 bg-light"
              style={{ width: "auto" }}
              value={month}
              onChange={(e) =>
                (window.location.href = `/budget/${year}/${e.target.value}`)
              }
            >
              {Object.entries(MONTH_NAMES).map(([n, name]) => (
                <option key={n} value={n}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="d-flex align-items-center gap-2">
            <label
              className="text-uppercase text-muted mb-0"
              style={{
                fontSize: ".7rem",
                letterSpacing: ".08em",
                fontWeight: 600,
              }}
            >
              Année
            </label>
            <select
              className="form-select form-select-sm rounded-pill border-0 bg-light"
              style={{ width: "auto" }}
              value={year}
              onChange={(e) =>
                (window.location.href = `/budget/${e.target.value}/${month}`)
              }
            >
              {Array.from({ length: 4 }, (_, i) => nowYear - 2 + i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="ms-auto d-flex gap-2">
            <Link
              href={`/budget/${prevYear}/${prevMonth}`}
              className="btn btn-outline-secondary btn-sm rounded-circle"
              style={{
                width: "32px",
                height: "32px",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <i className="bi bi-chevron-left"></i>
            </Link>
            <Link
              href={`/budget/${nowYear}/${nowMonth}`}
              className="btn btn-outline-primary btn-sm rounded-pill px-3"
            >
              Aujourd'hui
            </Link>
            <Link
              href={`/budget/${nextYear}/${nextMonth}`}
              className="btn btn-outline-secondary btn-sm rounded-circle"
              style={{
                width: "32px",
                height: "32px",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <i className="bi bi-chevron-right"></i>
            </Link>
          </div>
        </div>
      </div>

      {/* Cartes comptes */}
      <div className="row g-3 mb-4">
        {accounts.map((account) => {
          const tx = txByAccount[account.id] ?? {
            credit: 0,
            debit: 0,
            subs: 0,
          };
          const net = tx.credit - tx.debit;
          return (
            <div className="col-md-4 col-sm-6" key={account.id}>
              <div
                className="card h-100 border-0 shadow-sm rounded-3"
                style={{ overflow: "hidden" }}
              >
                <div
                  style={{
                    height: "4px",
                    background: "var(--bs-primary)",
                  }}
                ></div>
                <div className="card-body pt-3">
                  <div className="d-flex align-items-center gap-3 mb-3">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{
                        width: "42px",
                        height: "42px",
                        background: "#e7f3ff",
                      }}
                    >
                      <i className="bi bi-piggy-bank text-primary fs-5"></i>
                    </div>
                    <div className="min-w-0">
                      <div className="fw-semibold text-truncate">
                        {account.name}
                      </div>
                      <div className="small text-muted">
                        Solde :{" "}
                        <span
                          className={`fw-semibold ${account.balance < 0 ? "text-danger" : "text-dark"}`}
                        >
                          {fmt(account.balance)} {account.currency ?? "€"}
                        </span>
                      </div>
                    </div>
                  </div>
                  {tx.credit > 0 || tx.debit > 0 ? (
                    <>
                      <div className="d-flex justify-content-between small mb-1">
                        <span className="text-success d-flex align-items-center gap-1">
                          <i className="bi bi-arrow-down-circle-fill"></i>
                          Entrées
                        </span>
                        <span className="fw-semibold text-success">
                          +{fmt(tx.credit)} €
                        </span>
                      </div>
                      <div className="d-flex justify-content-between small mb-1">
                        <span className="text-danger d-flex align-items-center gap-1">
                          <i className="bi bi-arrow-up-circle-fill"></i>Sorties
                        </span>
                        <span className="fw-semibold text-danger">
                          −{fmt(tx.debit - tx.subs)} €
                        </span>
                      </div>
                      {tx.subs > 0 && (
                        <div className="d-flex justify-content-between small mb-1">
                          <span className="text-warning d-flex align-items-center gap-1">
                            <i className="bi bi-arrow-repeat"></i>Abonnements
                          </span>
                          <span className="fw-semibold text-warning">
                            −{fmt(tx.subs)} €
                          </span>
                        </div>
                      )}
                      <div className="border-top pt-2 mt-2 d-flex justify-content-between small">
                        <span className="text-muted fw-medium">
                          Net du mois
                        </span>
                        <span
                          className={`fw-bold ${net >= 0 ? "text-success" : "text-danger"}`}
                        >
                          {net > 0 ? "+" : ""}
                          {fmt(net)} €
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="text-muted small text-center py-2 bg-light rounded-2">
                      <i className="bi bi-dash-circle me-1"></i>Aucun mouvement
                      ce mois
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Abonnements */}
      {subscriptions.length > 0 && (
        <div className="card mb-4 border-0 shadow-sm rounded-3">
          <div
            className="card-header bg-white border-bottom d-flex justify-content-between align-items-center py-3 rounded-top-3"
            style={{ borderLeft: "4px solid var(--bs-warning)" }}
          >
            <span className="fw-semibold">
              <i className="bi bi-arrow-repeat me-2 text-warning"></i>
              Abonnements actifs ce mois
            </span>
            <span className="badge rounded-pill bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25">
              {subscriptions.length}
            </span>
          </div>
          <div className="table-responsive">
            <table className="table table-sm table-hover mb-0">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Compte</th>
                  <th>Catégorie</th>
                  <th>Fréquence</th>
                  <th className="text-end">Montant</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((sub) => (
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
                        {FREQ_LABELS[sub.frequency] ?? sub.frequency}
                      </span>
                    </td>
                    <td className="text-end fw-semibold text-danger">
                      -{fmt(sub.amount)} €
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="table-light fw-semibold">
                <tr>
                  <td colSpan={4}>Total abonnements</td>
                  <td className="text-end text-danger">
                    -
                    {fmt(
                      subscriptions.reduce(
                        (s, sub) => s + parseFloat(String(sub.amount)),
                        0,
                      ),
                    )}{" "}
                    €
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Tableau budget */}
      {budgets.length > 0 && (
        <div className="card border-0 shadow-sm rounded-3">
          <div
            className="card-header bg-white border-bottom d-flex align-items-center py-3 rounded-top-3"
            style={{ borderLeft: "4px solid var(--bs-primary)" }}
          >
            <i className="bi bi-clipboard-check me-2 text-primary"></i>
            <span className="fw-semibold">Budget prévisionnel</span>
          </div>
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th>Catégorie</th>
                  <th>Fréquence</th>
                  <th>Compte</th>
                  <th className="text-end">Prévu</th>
                  <th className="text-end">Écart</th>
                  <th className="text-end">Réalisé</th>
                  <th style={{ width: "110px" }}>Avancement</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {budgets.map((b) => {
                  const variance = b.plannedAmount - b.actualAmount;
                  const pct =
                    b.plannedAmount > 0
                      ? Math.round((b.actualAmount / b.plannedAmount) * 100)
                      : 0;
                  return (
                    <tr
                      key={b.id}
                      className={b.isApproved ? "table-success" : ""}
                      style={{ verticalAlign: "middle" }}
                    >
                      <td>
                        <span className="fw-medium">{b.category.name}</span>
                        {b.label && (
                          <span className="text-muted small"> — {b.label}</span>
                        )}
                        <span
                          className={`badge ms-1 rounded-pill ${b.category.transactionType === "income" ? "bg-success bg-opacity-10 text-success" : b.category.transactionType === "expense" ? "bg-danger bg-opacity-10 text-danger" : "bg-primary bg-opacity-10 text-primary"}`}
                          style={{ fontSize: ".7rem" }}
                        >
                          {b.category.transactionType === "income"
                            ? "recette"
                            : b.category.transactionType === "expense"
                              ? "dépense"
                              : "virement"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge rounded-pill badge-${b.category.frequency}`}
                          style={{ fontSize: ".72rem" }}
                        >
                          {FREQ_LABELS[b.category.frequency] ??
                            b.category.frequency}
                        </span>
                      </td>
                      <td className="small text-muted">
                        {b.account ? (
                          b.account.name
                        ) : (
                          <span className="text-warning">
                            <i className="bi bi-exclamation-triangle me-1"></i>
                            Non défini
                          </span>
                        )}
                      </td>
                      <td className="text-end text-muted">
                        {fmt(b.plannedAmount)} €
                      </td>
                      <td
                        className={`text-end fw-medium ${variance > 0 ? "text-success" : variance < 0 ? "text-danger" : "text-muted"}`}
                      >
                        {variance > 0 ? "+" : ""}
                        {fmt(variance)} €
                      </td>
                      <td className="text-end fw-semibold">
                        {fmt(b.actualAmount)} €
                      </td>
                      <td style={{ minWidth: "120px" }}>
                        {b.plannedAmount > 0 && (
                          <div>
                            <div
                              className="progress rounded-pill"
                              style={{ height: "6px" }}
                            >
                              <div
                                className={`progress-bar rounded-pill ${pct > 100 ? "bg-danger" : pct > 80 ? "bg-warning" : "bg-success"}`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              ></div>
                            </div>
                            <small
                              className={`mt-1 d-block ${pct > 100 ? "text-danger" : "text-muted"}`}
                              style={{ fontSize: ".7rem" }}
                            >
                              {pct} %
                            </small>
                          </div>
                        )}
                      </td>
                      <td>
                        {b.isApproved ? (
                          <>
                            <span
                              className="badge rounded-pill bg-success text-white"
                              style={{
                                fontSize: ".72rem",
                                fontWeight: "600",
                                padding: "4px 8px",
                              }}
                            >
                              <i className="bi bi-check-circle-fill me-1"></i>
                              Approuvé
                            </span>
                            {b.approvedAt && (
                              <div
                                className="text-muted"
                                style={{ fontSize: ".68rem", marginTop: "2px" }}
                              >
                                {b.approvedAt}
                              </div>
                            )}
                          </>
                        ) : (
                          <span
                            className="badge rounded-pill bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25"
                            style={{ fontSize: ".72rem" }}
                          >
                            En attente
                          </span>
                        )}
                      </td>
                      <td className="text-end" style={{ whiteSpace: "nowrap" }}>
                        {!b.isApproved ? (
                          <button
                            className="btn btn-success btn-action me-1 rounded-circle"
                            title="Approuver → créer transaction"
                            onClick={() => handleApprove(b)}
                            style={{
                              width: "30px",
                              height: "30px",
                              padding: 0,
                            }}
                          >
                            <i className="bi bi-check-lg"></i>
                          </button>
                        ) : (
                          <button
                            className="btn btn-outline-warning btn-action me-1 rounded-circle"
                            title="Annuler l'approbation"
                            onClick={() => handleUnapprove(b)}
                            style={{
                              width: "30px",
                              height: "30px",
                              padding: 0,
                            }}
                          >
                            <i className="bi bi-x-lg"></i>
                          </button>
                        )}
                        <Link
                          href={`/budget/${year}/${month}/edit/${b.id}`}
                          className="btn btn-outline-primary btn-action me-1 rounded-circle"
                          style={{
                            width: "30px",
                            height: "30px",
                            padding: 0,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <i className="bi bi-pencil"></i>
                        </Link>
                        {!b.isApproved && (
                          <button
                            className="btn btn-outline-danger btn-action rounded-circle"
                            onClick={() => handleDelete(b)}
                            style={{
                              width: "30px",
                              height: "30px",
                              padding: 0,
                            }}
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="table-light fw-semibold">
                <tr>
                  <td colSpan={3}>Solde net (recettes − dépenses)</td>
                  {(() => {
                    const netPlanned =
                      budgets
                        .filter((b) => b.category.transactionType === "income")
                        .reduce(
                          (s, b) => s + parseFloat(String(b.plannedAmount)),
                          0,
                        ) -
                      budgets
                        .filter((b) => b.category.transactionType === "expense")
                        .reduce(
                          (s, b) => s + parseFloat(String(b.plannedAmount)),
                          0,
                        );
                    const variance = budgets.reduce(
                      (s, b) =>
                        s +
                        (parseFloat(String(b.plannedAmount)) -
                          parseFloat(String(b.actualAmount))),
                      0,
                    );
                    const netActual =
                      budgets
                        .filter((b) => b.category.transactionType === "income")
                        .reduce(
                          (s, b) => s + parseFloat(String(b.actualAmount)),
                          0,
                        ) -
                      budgets
                        .filter((b) => b.category.transactionType === "expense")
                        .reduce(
                          (s, b) => s + parseFloat(String(b.actualAmount)),
                          0,
                        );
                    return (
                      <React.Fragment key="tfoot-totals">
                        <td
                          className={`text-end fw-semibold ${netPlanned >= 0 ? "text-success" : "text-danger"}`}
                        >
                          {netPlanned > 0 ? "+" : ""}
                          {fmt(netPlanned)} €
                        </td>
                        <td
                          className={`text-end fw-semibold ${variance >= 0 ? "text-success" : "text-danger"}`}
                        >
                          {variance > 0 ? "+" : ""}
                          {fmt(variance)} €
                        </td>
                        <td
                          className={`text-end fw-semibold ${netActual >= 0 ? "text-success" : "text-danger"}`}
                        >
                          {netActual > 0 ? "+" : ""}
                          {fmt(netActual)} €
                        </td>
                      </React.Fragment>
                    );
                  })()}
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
