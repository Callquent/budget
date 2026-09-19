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

  // Approuver directement une ligne abonnement : crée la ligne de budget du
  // mois (si besoin) puis l'approuve en une seule action.
  const handleApproveSubscription = async (sub: SubscriptionInterface) => {
    if (
      !window.confirm(
        `Approuver « ${sub.category.name} » et créer la transaction de ${fmt(sub.amount)} € ?`,
      )
    )
      return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/budget/new`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          label: sub.name,
          categoryId: sub.category.id,
          accountId: sub.account.id,
          destinationAccountId: null,
          year: urlYear,
          month: urlMonth,
          plannedAmount: sub.amount,
          actualAmount: sub.amount,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = await res.json();
      await postAction(`/${created.id}/approve`);
      await fetchMonth(urlYear, urlMonth);
    } catch (e) {
      alert(`Erreur : ${e instanceof Error ? e.message : e}`);
    }
  };

  // ── Duplication depuis un autre mois ────────────────────────────────────
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [dupYear, setDupYear] = useState(
    urlMonth === 1 ? urlYear - 1 : urlYear,
  );
  const [dupMonth, setDupMonth] = useState(urlMonth === 1 ? 12 : urlMonth - 1);
  const [dupBudgets, setDupBudgets] = useState<Budget[] | null>(null);
  const [dupLoading, setDupLoading] = useState(false);
  const [dupError, setDupError] = useState<string | null>(null);
  const [dupSelected, setDupSelected] = useState<number[]>([]);
  const [dupSaving, setDupSaving] = useState(false);

  const loadDuplicateSource = useCallback(async (y: number, m: number) => {
    setDupLoading(true);
    setDupError(null);
    setDupSelected([]);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/budget/${y}/${m}`,
        { headers: { Accept: "application/json" } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: MonthData = await res.json();
      setDupBudgets(data.budgets ?? []);
    } catch (e) {
      setDupError(e instanceof Error ? e.message : "Erreur inconnue");
      setDupBudgets(null);
    } finally {
      setDupLoading(false);
    }
  }, []);

  const openDuplicateModal = () => {
    setShowDuplicateModal(true);
    loadDuplicateSource(dupYear, dupMonth);
  };

  const changeDupYear = (y: number) => {
    setDupYear(y);
    loadDuplicateSource(y, dupMonth);
  };

  const changeDupMonth = (m: number) => {
    setDupMonth(m);
    loadDuplicateSource(dupYear, m);
  };

  const toggleDupSelected = (id: number) => {
    setDupSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const dupAllSelected =
    dupBudgets !== null &&
    dupBudgets.length > 0 &&
    dupSelected.length === dupBudgets.length;

  const toggleDupSelectAll = () => {
    if (!dupBudgets) return;
    setDupSelected(dupAllSelected ? [] : dupBudgets.map((b) => b.id));
  };

  // Ajoute les lignes sélectionnées dans le mois affiché (urlYear/urlMonth) :
  // nouvelle ligne pour chacune, montant réalisé réinitialisé au montant
  // prévu (ligne non encore approuvée).
  const handleAddDuplicatedLines = async () => {
    if (!dupBudgets || dupSelected.length === 0) return;
    setDupSaving(true);
    try {
      for (const id of dupSelected) {
        const src = dupBudgets.find((b) => b.id === id);
        if (!src) continue;
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/budget/new`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              label: src.label ?? null,
              categoryId: src.category.id,
              accountId: src.account?.id ?? null,
              destinationAccountId: src.destinationAccount?.id ?? null,
              year: urlYear,
              month: urlMonth,
              plannedAmount: src.plannedAmount,
              actualAmount: src.plannedAmount,
            }),
          },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }
      setShowDuplicateModal(false);
      await fetchMonth(urlYear, urlMonth);
    } catch (e) {
      alert(`Erreur : ${e instanceof Error ? e.message : e}`);
    } finally {
      setDupSaving(false);
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

  // Un abonnement déjà représenté par une ligne de budget (même catégorie,
  // même compte, même montant) ne doit pas être affiché une seconde fois.
  const isDejaBudgete = (sub: (typeof subscriptions)[number]) =>
    budgets.some(
      (b) =>
        b.category.name === sub.category.name &&
        b.account.id === sub.account.id &&
        Math.abs(
          parseFloat(String(b.plannedAmount)) - parseFloat(String(sub.amount)),
        ) < 0.01,
    );
  const subscriptionsNonBudgetees = subscriptions.filter(
    (sub) => !isDejaBudgete(sub),
  );
  // Une ligne de budget qui correspond à un abonnement (même logique inverse)
  const isAbonnement = (b: (typeof budgets)[number]) =>
    subscriptions.some(
      (sub) =>
        sub.category.name === b.category.name &&
        sub.account.id === b.account.id &&
        Math.abs(
          parseFloat(String(b.plannedAmount)) - parseFloat(String(sub.amount)),
        ) < 0.01,
    );

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
            href={`/budget/new?year=${year}&month=${month}`}
            className="btn btn-primary btn-sm rounded-pill px-3"
          >
            <i className="bi bi-plus-lg me-1"></i>Nouvelle ligne
          </Link>
          <button
            className="btn btn-outline-secondary btn-sm rounded-pill px-3"
            onClick={openDuplicateModal}
          >
            <i className="bi bi-copy me-1"></i>Dupliquer depuis…
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

      {/* Tableau budget (inclut les abonnements actifs, toujours visibles) */}
      {(budgets.length > 0 || subscriptionsNonBudgetees.length > 0) && (
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
                      className={
                        b.isApproved
                          ? "table-success"
                          : isAbonnement(b)
                            ? "table-warning"
                            : ""
                      }
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
                        {isAbonnement(b) && (
                          <span
                            className="badge ms-1 rounded-pill bg-warning bg-opacity-10 text-warning"
                            style={{ fontSize: ".7rem" }}
                          >
                            <i className="bi bi-arrow-repeat me-1"></i>
                            abonnement
                          </span>
                        )}
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
                          href={`/budget/edit/${b.id}`}
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
                        {!b.isApproved && !isAbonnement(b) && (
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
                {subscriptionsNonBudgetees.map((sub) => (
                  <tr
                    key={`sub-${sub.id}`}
                    className="table-warning"
                    style={{ verticalAlign: "middle" }}
                  >
                    <td>
                      <span className="fw-medium">{sub.category.name}</span>
                      <span className="text-muted small"> — {sub.name}</span>
                      <span
                        className="badge ms-1 rounded-pill bg-warning bg-opacity-10 text-warning"
                        style={{ fontSize: ".7rem" }}
                      >
                        abonnement
                      </span>
                    </td>
                    <td className="small text-muted">{sub.account.name}</td>
                    <td className="text-end text-muted">{fmt(sub.amount)} €</td>
                    <td className="text-end fw-medium text-muted">
                      {fmt(0)} €
                    </td>
                    <td className="text-end fw-semibold">
                      {fmt(sub.amount)} €
                    </td>
                    <td style={{ minWidth: "120px" }}>
                      <div>
                        <div
                          className="progress rounded-pill"
                          style={{ height: "6px" }}
                        >
                          <div
                            className="progress-bar rounded-pill bg-success"
                            style={{ width: "100%" }}
                          ></div>
                        </div>
                        <small
                          className="mt-1 d-block text-muted"
                          style={{ fontSize: ".7rem" }}
                        >
                          100 %
                        </small>
                      </div>
                    </td>
                    <td>
                      <span
                        className="badge rounded-pill bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25"
                        style={{ fontSize: ".72rem" }}
                      >
                        <i className="bi bi-arrow-repeat me-1"></i>
                        {frequencyLabels[sub.frequency] ?? sub.frequency}
                      </span>
                    </td>
                    <td className="text-end" style={{ whiteSpace: "nowrap" }}>
                      <button
                        className="btn btn-success btn-action me-1 rounded-circle"
                        title="Approuver → créer la ligne de budget et la transaction"
                        onClick={() => handleApproveSubscription(sub)}
                        style={{
                          width: "30px",
                          height: "30px",
                          padding: 0,
                        }}
                      >
                        <i className="bi bi-check-lg"></i>
                      </button>
                      <Link
                        href={`/budget/new?year=${year}&month=${month}&categoryId=${sub.category.id}&accountId=${sub.account.id}&amount=${sub.amount}&label=${encodeURIComponent(sub.name)}`}
                        className="btn btn-outline-primary btn-action me-1 rounded-circle"
                        title={`Créer/ajuster le budget « ${sub.category.name} » pour ce mois`}
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
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="table-light fw-semibold">
                <tr>
                  <td colSpan={2}>Solde net (recettes − dépenses)</td>
                  {(() => {
                    const subsTotal = subscriptionsNonBudgetees.reduce(
                      (s, sub) => s + parseFloat(String(sub.amount)),
                      0,
                    );
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
                        ) -
                      subsTotal;
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
                        ) -
                      subsTotal;
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

      {showDuplicateModal && (
        <>
          <div className="modal-backdrop fade show"></div>
          <div className="modal fade show d-block" tabIndex={-1} role="dialog">
            <div
              className="modal-dialog modal-lg modal-dialog-scrollable"
              role="document"
            >
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    <i className="bi bi-copy me-2"></i>
                    Dupliquer vers {monthNames[urlMonth]} {urlYear}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowDuplicateModal(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  <p className="text-muted small">
                    Choisissez le mois source, sélectionnez les lignes à
                    copier, puis cliquez sur « Ajouter ».
                  </p>
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small text-muted">
                        Année
                      </label>
                      <input
                        type="number"
                        className="form-control"
                        value={dupYear}
                        onChange={(e) =>
                          changeDupYear(parseInt(e.target.value) || dupYear)
                        }
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small text-muted">
                        Mois
                      </label>
                      <select
                        className="form-select"
                        value={dupMonth}
                        onChange={(e) => changeDupMonth(parseInt(e.target.value))}
                      >
                        {Object.entries(monthNames)
                          .map(
                            ([key, label]) =>
                              [Number(key), label] as [number, string],
                          )
                          .sort((a, b) => a[0] - b[0])
                          .map(([num, label]) => (
                            <option key={num} value={num}>
                              {label}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {dupLoading && (
                    <div className="text-center text-muted py-4">
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Chargement…
                    </div>
                  )}

                  {dupError && (
                    <div className="alert alert-danger">
                      <i className="bi bi-exclamation-triangle-fill me-2"></i>
                      {dupError}
                    </div>
                  )}

                  {!dupLoading &&
                    !dupError &&
                    dupBudgets !== null &&
                    (dupBudgets.length === 0 ? (
                      <p className="text-muted mb-0">
                        Aucune ligne de budget pour {monthNames[dupMonth]}{" "}
                        {dupYear}.
                      </p>
                    ) : (
                      <>
                        <div className="form-check mb-2 border-bottom pb-2">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            id="dup-select-all"
                            checked={dupAllSelected}
                            onChange={toggleDupSelectAll}
                          />
                          <label
                            className="form-check-label fw-semibold"
                            htmlFor="dup-select-all"
                          >
                            Tout sélectionner ({dupBudgets.length})
                          </label>
                        </div>
                        <div className="list-group">
                          {dupBudgets.map((b) => (
                            <label
                              key={b.id}
                              className="list-group-item d-flex align-items-center gap-2"
                            >
                              <input
                                type="checkbox"
                                className="form-check-input mt-0"
                                checked={dupSelected.includes(b.id)}
                                onChange={() => toggleDupSelected(b.id)}
                              />
                              <span className="flex-grow-1">
                                <span className="fw-medium">
                                  {b.category.name}
                                </span>
                                {b.label && (
                                  <span className="text-muted small">
                                    {" "}
                                    — {b.label}
                                  </span>
                                )}
                                <br />
                                <span className="text-muted small">
                                  {b.account?.name ?? "Compte non défini"}
                                </span>
                              </span>
                              <span className="fw-semibold">
                                {fmt(b.plannedAmount)} €
                              </span>
                            </label>
                          ))}
                        </div>
                      </>
                    ))}
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowDuplicateModal(false)}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={dupSelected.length === 0 || dupSaving}
                    onClick={handleAddDuplicatedLines}
                  >
                    {dupSaving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1"></span>
                        Ajout…
                      </>
                    ) : (
                      <>
                        <i className="bi bi-plus-lg me-1"></i>
                        Ajouter ({dupSelected.length})
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <OCRModal
        show={showOCRModal}
        onClose={() => setShowOCRModal(false)}
        onSuccess={handleOCRSuccess}
      />
    </>
  );
}
