"use client";
import React, { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { AccountInterface } from "../Account/Account.interface";
import type { SubscriptionInterface } from "../Subscription/Subscription.interface";
import OCRModal from "../OCR/OCRModal";

// ─── Constantes ───────────────────────────────────────────────────────────────
// Les noms de mois et libellés de fréquence viennent désormais de l'API
// (monthData.monthNames / monthData.frequencyLabels), source unique partagée
// avec le backend (App\Support\BudgetLabels) — plus de duplication entre
// BudgetYearView, BudgetMonthView et le PHP.

function fmt(num: number | string, decimals = 2) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(parseFloat(String(num)) || 0);
}

// ─── Composant vue mois ───────────────────────────────────────────────────────
// Utilisé par app/budget/[year]/[month]/page.tsx (liste budget prévisionnelle)

export default function BudgetMonthView({
  params,
}: {
  params: Promise<{ year: string; month: string }>;
}) {
  const resolved = use(params);
  const urlYear = parseInt(resolved.year);
  const urlMonth = parseInt(resolved.month);

  const [monthData, setMonthData] = useState<MonthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOCRModal, setShowOCRModal] = useState(false);
  const [isCreatingTransaction, setIsCreatingTransaction] = useState(false);

  // Catégories de dépense disponibles pour l'import OCR, dérivées des lignes
  // de budget déjà chargées pour le mois (pas besoin d'un endpoint dédié).
  const expenseCategories = React.useMemo(() => {
    if (!monthData) return [];
    const seen = new Map<number, { id: number; name: string }>();
    monthData.budgets
      .filter((b) => b.category.transactionType === "expense")
      .forEach((b) => {
        if (!seen.has(b.category.id)) {
          seen.set(b.category.id, { id: b.category.id, name: b.category.name });
        }
      });
    return Array.from(seen.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [monthData]);

  // ── Fetch ─────────────────────────────────────────────────────────────────
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
    fetchMonth(urlYear, urlMonth);
  }, [urlYear, urlMonth, fetchMonth]);

  // ── Actions POST ──────────────────────────────────────────────────────────
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
      await fetchMonth(urlYear, urlMonth);
    } catch (e) {
      alert(`Erreur : ${e instanceof Error ? e.message : e}`);
    }
  };

  const handleUnapprove = async (b: Budget) => {
    if (!window.confirm("Annuler l'approbation et supprimer la transaction ?"))
      return;
    try {
      await postAction(`/${b.id}/unapprove`);
      await fetchMonth(urlYear, urlMonth);
    } catch (e) {
      alert(`Erreur : ${e instanceof Error ? e.message : e}`);
    }
  };

  const handleDelete = async (b: Budget) => {
    if (!window.confirm("Supprimer cette ligne ?")) return;
    try {
      await postAction(`/${b.id}/delete`);
      await fetchMonth(urlYear, urlMonth);
    } catch (e) {
      alert(`Erreur : ${e instanceof Error ? e.message : e}`);
    }
  };

  const handleDuplicate = async () => {
    if (!window.confirm("Copier ces lignes vers le mois suivant ?")) return;
    try {
      await postAction(`/${urlYear}/${urlMonth}/duplicate`);
      await fetchMonth(urlYear, urlMonth);
    } catch (e) {
      alert(`Erreur : ${e instanceof Error ? e.message : e}`);
    }
  };

  // ── OCR Functions ─────────────────────────────────────────────────────────
  const handleOCRSuccess = async (
    amount: number,
    categoryId: number,
    accountId: number,
    label?: string,
  ) => {
    const currentYear = urlYear;
    const currentMonth = urlMonth;

    setIsCreatingTransaction(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/ocr/receipt`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: amount,
            categoryId: categoryId,
            accountId: accountId,
            label: label ?? "Ticket de caisse",
            year: currentYear,
            month: currentMonth,
            transactionDate: `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`,
          }),
        },
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error ?? `Erreur ${response.status}`);
      }

      // Rafraîchir les données du mois
      await fetchMonth(currentYear, currentMonth);

      // Afficher un message de succès
      alert(`Transaction de ${fmt(amount)} € ajoutée avec succès !`);
    } catch (e) {
      alert(
        `Erreur lors de l'ajout de la transaction : ${e instanceof Error ? e.message : e}`,
      );
    } finally {
      setIsCreatingTransaction(false);
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
          onClick={() => fetchMonth(urlYear, urlMonth)}
        >
          <i className="bi bi-arrow-clockwise me-1"></i>Réessayer
        </button>
      </div>
    );
  }

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
    monthNames,
    frequencyLabels,
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
          <button
            className="btn btn-outline-success btn-sm rounded-pill px-3"
            onClick={() => setShowOCRModal(true)}
            disabled={isCreatingTransaction}
          >
            <i className="bi bi-receipt me-1"></i>Scanner ticket
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
              {Object.entries(monthNames).map(([n, name]) => (
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

          const accountBudgets = budgets.filter(
            (b) => b.account?.id === account.id,
          );
          const hasAccountBudgets = accountBudgets.length > 0;
          const accountAllApproved =
            hasAccountBudgets && accountBudgets.every((b) => b.isApproved);

          const budgetPlanned =
            accountBudgets
              .filter((b) => b.category.transactionType === "income")
              .reduce((s, b) => s + parseFloat(String(b.plannedAmount)), 0) -
            accountBudgets
              .filter((b) => b.category.transactionType === "expense")
              .reduce((s, b) => s + parseFloat(String(b.plannedAmount)), 0);

          const budgetActual =
            accountBudgets
              .filter((b) => b.category.transactionType === "income")
              .reduce((s, b) => s + parseFloat(String(b.actualAmount)), 0) -
            accountBudgets
              .filter((b) => b.category.transactionType === "expense")
              .reduce((s, b) => s + parseFloat(String(b.actualAmount)), 0);

          const estimationValue = accountAllApproved
            ? budgetActual
            : budgetPlanned;
          const estimationLabel = accountAllApproved
            ? "Budget réalisé"
            : "Estimation prévue fin de mois";

          return (
            <div className="col-md-4 col-sm-6" key={account.id}>
              <div
                className="card h-100 border-0 shadow-sm rounded-3"
                style={{ overflow: "hidden" }}
              >
                <div
                  style={{ height: "4px", background: "var(--bs-primary)" }}
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
                    <div className="min-w-0 flex-grow-1">
                      <div className="d-flex align-items-center justify-content-between gap-2">
                        <div className="fw-semibold text-truncate">
                          {account.name}
                        </div>
                        {hasAccountBudgets && (
                          <div className="text-end flex-shrink-0">
                            <div
                              style={{
                                fontSize: ".62rem",
                                color: "#adb5bd",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {estimationLabel}
                            </div>
                            <span
                              className={`badge rounded-pill ${estimationValue >= 0 ? "bg-success" : "bg-danger"}`}
                              style={{ fontSize: ".72rem", fontWeight: 600 }}
                            >
                              {estimationValue > 0 ? "+" : ""}
                              {fmt(estimationValue)} €
                            </span>
                          </div>
                        )}
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
                        {frequencyLabels[sub.frequency] ?? sub.frequency}
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
                      <td className="small text-muted">
                        {b.account ? (
                          b.category.transactionType === "transfer" &&
                          b.destinationAccount ? (
                            <span className="d-inline-flex align-items-center gap-1">
                              {b.account.name}
                              <i className="bi bi-arrow-right"></i>
                              {b.destinationAccount.name}
                            </span>
                          ) : (
                            b.account.name
                          )
                        ) : (
                          <span className="text-warning">
                            <i className="bi bi-exclamation-triangle me-1"></i>
                            Non défini
                          </span>
                        )}
                        {b.category.transactionType === "transfer" &&
                          b.account &&
                          !b.destinationAccount && (
                            <div className="text-warning" style={{ fontSize: ".72rem" }}>
                              <i className="bi bi-exclamation-triangle me-1"></i>
                              Compte destinataire manquant
                            </div>
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
                  <td colSpan={2}>Solde net (recettes − dépenses)</td>
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

      <OCRModal
        show={showOCRModal}
        onClose={() => setShowOCRModal(false)}
        onSuccess={handleOCRSuccess}
      />
    </>
  );
}
