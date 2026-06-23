"use client";
import React, { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { AccountInterface } from "../Account/Account.interface";
import type { SubscriptionInterface } from "../Subscription/Subscription.interface";

interface Budget {
  id: number;
  plannedAmount: number;
  actualAmount: number;
  isApproved: boolean;
  approvedAt?: string;
  label?: string;
  account: { name: string } | null;
  category: { name: string; transactionType: string; frequency: string };
}

interface TxByAccount {
  [accountId: number]: { credit: number; debit: number; subs: number };
}

interface SummaryRow {
  total_planned: number;
  total_actual: number;
}

interface AccountBalance {
  balance: number;
  balance_projected: number;
  credit: number;
  debit: number;
  subs: number;
  planned_net: number;
}

// Vue mois
interface MonthData {
  year: number;
  month: number;
  nowYear: number;
  nowMonth: number;
  periodLabel: string;
  accounts: AccountInterface[];
  txByAccount: TxByAccount;
  subscriptions: SubscriptionInterface[];
  budgets: Budget[];
}

// Vue année
interface YearData {
  year: number;
  currentYear: number;
  currentMonth: number;
  availableYears: number[];
  accounts: AccountInterface[];
  summary: Record<number, SummaryRow>;
  accountBalances: Record<number, Record<number, AccountBalance>>;
}

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

function fmt(num: number, decimals = 2) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
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
      <div className="d-flex justify-content-center align-items-center py-5">
        <div className="spinner-border text-primary me-3" role="status"></div>
        <span className="text-muted">Chargement…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger d-flex align-items-center gap-2">
        <i className="bi bi-exclamation-triangle-fill"></i>
        <span>Impossible de charger les données : {error}</span>
        <button
          className="btn btn-sm btn-outline-danger ms-auto"
          onClick={() =>
            isMonthView ? fetchMonth(urlYear!, urlMonth!) : fetchYear(yearState)
          }
        >
          Réessayer
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
          <h1 className="h3 mb-0">
            <i className="bi bi-calendar3 me-2 text-primary"></i>Budget{" "}
            {yearState}
          </h1>
        </div>

        <div className="card mb-4 p-3">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="text-muted me-2 small fw-semibold">ANNÉE</span>
            {availableYears.map((y) => (
              <button
                key={y}
                onClick={() => fetchYear(y)}
                className={`btn btn-sm ${y === yearState ? "btn-dark" : "btn-outline-secondary"}`}
              >
                {y}
                {y === currentYear && (
                  <span
                    className="badge bg-primary ms-1"
                    style={{ fontSize: ".6rem" }}
                  >
                    en cours
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="card mb-4">
          <div className="card-header bg-white d-flex justify-content-between align-items-center">
            <span className="fw-semibold">
              Récapitulatif annuel {yearState}
            </span>
            <span className="text-muted small">
              Solde fin de mois par compte
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
                        <i
                          className={`bi ${a.type === "credit" ? "bi-piggy-bank text-success" : "bi-wallet2 text-secondary"} small`}
                        ></i>
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
                              className="badge bg-primary ms-1"
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
                        return (
                          <td key={a.id} className="text-end">
                            <div
                              className={`fw-semibold ${bal < 0 ? "text-danger" : ""}`}
                            >
                              {fmt(bal)} €
                            </div>
                            {(ab?.credit ?? 0) > 0 || (ab?.debit ?? 0) > 0 ? (
                              <div
                                className="text-muted"
                                style={{
                                  fontSize: ".72rem",
                                  lineHeight: "1.3",
                                }}
                              >
                                {(ab?.credit ?? 0) > 0 && (
                                  <span className="text-success">
                                    +{fmt(ab!.credit, 0)}
                                  </span>
                                )}
                                {(ab?.debit ?? 0) > 0 && (
                                  <span className="text-danger ms-1">
                                    −{fmt(ab!.debit, 0)}
                                  </span>
                                )}
                              </div>
                            ) : null}
                            {(ab?.planned_net ?? 0) !== 0 && (
                              <div
                                className="text-muted fst-italic"
                                style={{
                                  fontSize: ".72rem",
                                  lineHeight: "1.4",
                                }}
                                title="Solde projeté avec budget prévu"
                              >
                                →{" "}
                                <span
                                  className={
                                    (ab!.balance_projected ?? 0) < 0
                                      ? "text-danger"
                                      : "text-info"
                                  }
                                >
                                  {fmt(ab!.balance_projected)} €
                                </span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td
                        className={`text-end fw-bold ${totalBalance < 0 ? "text-danger" : "text-primary"}`}
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
            href={`/budget/${year}`}
            className="text-muted text-decoration-none small"
          >
            <i className="bi bi-chevron-left"></i> Budget {year}
          </Link>
          <h1 className="h3 mb-0 mt-1">
            Budget prévisionnel —{" "}
            {periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1)}
          </h1>
        </div>
        <div className="d-flex gap-2">
          <Link
            href={`/budget/${year}/${month}/new`}
            className="btn btn-primary btn-sm"
          >
            <i className="bi bi-plus-lg me-1"></i>Nouvelle ligne
          </Link>
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={handleDuplicate}
          >
            <i className="bi bi-copy me-1"></i>Dupliquer →
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="card mb-4 p-3">
        <div className="d-flex align-items-center gap-3 flex-wrap">
          <div className="d-flex align-items-center gap-2">
            <label className="text-muted small fw-semibold mb-0">MOIS</label>
            <select
              className="form-select form-select-sm"
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
            <label className="text-muted small fw-semibold mb-0">ANNÉE</label>
            <select
              className="form-select form-select-sm"
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
              className="btn btn-outline-secondary btn-sm"
            >
              <i className="bi bi-chevron-left"></i>
            </Link>
            <Link
              href={`/budget/${nowYear}/${nowMonth}`}
              className="btn btn-outline-secondary btn-sm"
            >
              Aujourd'hui
            </Link>
            <Link
              href={`/budget/${nextYear}/${nextMonth}`}
              className="btn btn-outline-secondary btn-sm"
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
              <div className="card h-100 border-0 shadow-sm">
                <div className="card-body">
                  <div className="d-flex align-items-center gap-3 mb-3">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{
                        width: "40px",
                        height: "40px",
                        background:
                          account.type === "credit" ? "#d1fae5" : "#fee2e2",
                      }}
                    >
                      <i
                        className={`bi ${account.type === "credit" ? "bi-piggy-bank text-success" : "bi-wallet2 text-danger"} fs-5`}
                      ></i>
                    </div>
                    <div>
                      <div className="fw-semibold">{account.name}</div>
                      <div className="small text-muted">
                        Solde actuel :{" "}
                        <strong>
                          {fmt(account.balance)} {account.currency ?? "€"}
                        </strong>
                      </div>
                    </div>
                  </div>
                  {tx.credit > 0 || tx.debit > 0 ? (
                    <>
                      <div className="d-flex justify-content-between small mb-1">
                        <span className="text-success">
                          <i className="bi bi-arrow-down-circle me-1"></i>
                          Entrées
                        </span>
                        <span className="fw-medium text-success">
                          +{fmt(tx.credit)} €
                        </span>
                      </div>
                      <div className="d-flex justify-content-between small mb-1">
                        <span className="text-danger">
                          <i className="bi bi-arrow-up-circle me-1"></i>Sorties
                        </span>
                        <span className="fw-medium text-danger">
                          -{fmt(tx.debit - tx.subs)} €
                        </span>
                      </div>
                      {tx.subs > 0 && (
                        <div className="d-flex justify-content-between small mb-1">
                          <span className="text-warning">
                            <i className="bi bi-arrow-repeat me-1"></i>
                            Abonnements
                          </span>
                          <span className="fw-medium text-warning">
                            -{fmt(tx.subs)} €
                          </span>
                        </div>
                      )}
                      <div className="border-top pt-2 mt-1 d-flex justify-content-between small fw-semibold">
                        <span>Net du mois</span>
                        <span
                          className={net >= 0 ? "text-success" : "text-danger"}
                        >
                          {net > 0 ? "+" : ""}
                          {fmt(net)} €
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="text-muted small text-center py-1">
                      Aucun mouvement ce mois
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
        <div className="card mb-4">
          <div className="card-header bg-white d-flex justify-content-between align-items-center">
            <span className="fw-semibold">
              <i className="bi bi-arrow-repeat me-2 text-primary"></i>
              Abonnements actifs ce mois
            </span>
            <span className="badge bg-primary">{subscriptions.length}</span>
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
                    -{fmt(subscriptions.reduce((s, sub) => s + sub.amount, 0))}{" "}
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
        <div className="card">
          <div className="card-header bg-white fw-semibold">
            <i className="bi bi-clipboard-check me-2 text-primary"></i>Budget
            prévisionnel
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
                      className={
                        b.isApproved ? "table-success bg-opacity-50" : ""
                      }
                    >
                      <td>
                        <span className="fw-medium">{b.category.name}</span>
                        {b.label && (
                          <span className="text-muted small"> — {b.label}</span>
                        )}
                        <span
                          className={`badge ms-1 ${b.category.transactionType === "income" ? "badge-income" : b.category.transactionType === "expense" ? "badge-expense" : "badge-transfer"}`}
                        >
                          {b.category.transactionType === "income"
                            ? "recette"
                            : b.category.transactionType === "expense"
                              ? "dépense"
                              : "virement"}
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge-${b.category.frequency}`}>
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
                        className={`text-end ${variance > 0 ? "text-success" : variance < 0 ? "text-danger" : ""}`}
                      >
                        {variance > 0 ? "+" : ""}
                        {fmt(variance)} €
                      </td>
                      <td className="text-end">{fmt(b.actualAmount)} €</td>
                      <td>
                        {b.plannedAmount > 0 && (
                          <>
                            <div className="progress">
                              <div
                                className={`progress-bar ${pct > 100 ? "bg-danger" : pct > 80 ? "bg-warning" : "bg-success"}`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              ></div>
                            </div>
                            <small className="text-muted">{pct} %</small>
                          </>
                        )}
                      </td>
                      <td>
                        {b.isApproved ? (
                          <>
                            <span className="badge bg-success">
                              <i className="bi bi-check-circle me-1"></i>
                              Approuvé
                            </span>
                            {b.approvedAt && (
                              <div
                                className="text-muted"
                                style={{ fontSize: ".7rem" }}
                              >
                                {b.approvedAt}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="badge bg-secondary bg-opacity-25 text-secondary">
                            En attente
                          </span>
                        )}
                      </td>
                      <td className="text-end" style={{ whiteSpace: "nowrap" }}>
                        {!b.isApproved ? (
                          <button
                            className="btn btn-success btn-action me-1"
                            title="Approuver → créer transaction"
                            onClick={() => handleApprove(b)}
                          >
                            <i className="bi bi-check-lg"></i>
                          </button>
                        ) : (
                          <button
                            className="btn btn-outline-warning btn-action me-1"
                            title="Annuler l'approbation"
                            onClick={() => handleUnapprove(b)}
                          >
                            <i className="bi bi-x-lg"></i>
                          </button>
                        )}
                        <Link
                          href={`/budget/${year}/${month}/edit/${b.id}`}
                          className="btn btn-outline-primary btn-action me-1"
                        >
                          <i className="bi bi-pencil"></i>
                        </Link>
                        {!b.isApproved && (
                          <button
                            className="btn btn-outline-danger btn-action"
                            onClick={() => handleDelete(b)}
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
                        .reduce((s, b) => s + b.plannedAmount, 0) -
                      budgets
                        .filter((b) => b.category.transactionType === "expense")
                        .reduce((s, b) => s + b.plannedAmount, 0);
                    const variance = budgets.reduce(
                      (s, b) => s + (b.plannedAmount - b.actualAmount),
                      0,
                    );
                    const netActual =
                      budgets
                        .filter((b) => b.category.transactionType === "income")
                        .reduce((s, b) => s + b.actualAmount, 0) -
                      budgets
                        .filter((b) => b.category.transactionType === "expense")
                        .reduce((s, b) => s + b.actualAmount, 0);
                    return (
                      <>
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
                      </>
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
