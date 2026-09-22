"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AccountInterface } from "../Account/Account.interface";
import type { CategoryInterface } from "../Category/Category.interface";
import type { BudgetFormProps } from "./Budget.interface";
import CategoryPicker from "../Category/CategoryPicker";
import AccountPicker from "../Account/AccountPicker";

const API = process.env.NEXT_PUBLIC_API_URL;

const FREQUENCIES = [
  { value: "monthly", label: "Mensuel" },
  { value: "yearly", label: "Annuel" },
  { value: "quarterly", label: "Trimestriel" },
  { value: "occasional", label: "Occasionnel" },
] as const;

const MONTH_NAMES = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

export default function BudgetForm({
  initialData,
  title,
  currentYear = new Date().getFullYear(),
  currentMonth = new Date().getMonth() + 1,
}: BudgetFormProps) {
  const router = useRouter();
  const [grouped, setGrouped] = useState<Record<string, CategoryInterface[]>>(
    {},
  );
  const [accounts, setAccounts] = useState<AccountInterface[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [categoryId, setCategoryId] = useState<string>("");
  const [accountId, setAccountId] = useState<string>("");
  const [destinationAccountId, setDestinationAccountId] = useState<string>("");
  const [plannedAmount, setPlannedAmount] = useState<string>(
    initialData?.plannedAmount != null ? String(initialData.plannedAmount) : "",
  );
  const [actualAmount, setActualAmount] = useState<string>(
    initialData?.actualAmount != null ? String(initialData.actualAmount) : "",
  );
  const [sameAmount, setSameAmount] = useState(false);

  const isApproved = initialData?.isApproved ?? false;
  const alreadyLinkedToSubscription =
    initialData?.sourceSubscriptionId != null ||
    initialData?.sourceSubscription?.id != null;

  // ─── Conversion en abonnement ────────────────────────────────────────────
  const [showConvertForm, setShowConvertForm] = useState(false);
  const [convertFrequency, setConvertFrequency] = useState<string>("monthly");
  const [convertDayOfMonth, setConvertDayOfMonth] = useState<string>("");
  const [convertEndDate, setConvertEndDate] = useState<string>("");
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);

  const handleConvertToSubscription = async () => {
    setConverting(true);
    setConvertError(null);

    try {
      const res = await fetch(
        `${API}/budget/${initialData!.id}/convert-to-subscription`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            frequency: convertFrequency,
            dayOfMonth: convertDayOfMonth ? parseInt(convertDayOfMonth) : null,
            endDate: convertEndDate || null,
          }),
        },
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Erreur ${res.status}`);
      router.push("/subscriptions");
    } catch (e: any) {
      setConvertError(e.message);
    } finally {
      setConverting(false);
    }
  };

  // Pour une catégorie Virement, une seule ligne Budget porte les deux
  // comptes : "Compte" (accountId) = expéditeur (débit), "Compte
  // destinataire" (destinationAccountId) = destinataire (crédit). Le backend
  // en déduit le sens tout seul, plus besoin de le choisir manuellement.
  const selectedCategoryType = React.useMemo(() => {
    for (const [txType, cats] of Object.entries(grouped)) {
      if (cats.some((c) => String(c.id) === categoryId)) return txType;
    }
    return null;
  }, [grouped, categoryId]);
  const isTransferCategory = selectedCategoryType === "transfer";
  const canConvertToSubscription =
    !!initialData?.id && !isTransferCategory && !alreadyLinkedToSubscription;

  useEffect(() => {
    if (!isTransferCategory) {
      setDestinationAccountId("");
    } else if (destinationAccountId && destinationAccountId === accountId) {
      setDestinationAccountId("");
    }
  }, [isTransferCategory, accountId, destinationAccountId]);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/categories`).then((r) => r.json()),
      fetch(`${API}/accounts`).then((r) => r.json()),
    ]).then(([categoriesData, accountsData]) => {
      setGrouped(categoriesData.grouped ?? {});
      setAccounts(accountsData.accounts ?? []);
      setCategoryId(
        initialData?.category?.id != null ? String(initialData.category.id)
        : initialData?.categoryId != null ? String(initialData.categoryId)
        : "",
      );
      setAccountId(
        initialData?.account?.id != null ? String(initialData.account.id)
        : initialData?.accountId != null ? String(initialData.accountId)
        : "",
      );
      setDestinationAccountId(
        initialData?.destinationAccount?.id != null ? String(initialData.destinationAccount.id)
        : initialData?.destinationAccountId != null ? String(initialData.destinationAccountId)
        : "",
      );
    });
  }, [initialData?.category?.id, initialData?.account?.id, initialData?.destinationAccount?.id, initialData?.categoryId, initialData?.accountId, initialData?.destinationAccountId]);

  // Appelé par CategoryPicker après une création rapide de catégorie : on
  // l'ajoute directement au state local pour l'afficher sans recharger la
  // liste complète depuis l'API.
  const handleCategoryCreated = (type: string, category: CategoryInterface) => {
    setGrouped((prev) => ({
      ...prev,
      [type]: [...(prev[type] ?? []), category],
    }));
  };

  const handleSameAmountToggle = (checked: boolean) => {
    setSameAmount(checked);
    setActualAmount(checked ? plannedAmount : "");
  };

  const handlePlannedAmountChange = (value: string) => {
    setPlannedAmount(value);
    if (sameAmount) setActualAmount(value);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (!accountId) {
      setError("Veuillez sélectionner un compte.");
      setSaving(false);
      return;
    }

    if (isTransferCategory && !destinationAccountId) {
      setError("Veuillez sélectionner le compte destinataire pour une ligne de virement.");
      setSaving(false);
      return;
    }

    const form = e.currentTarget;
    const get = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement)
        .value;

    const body = {
      label: get("label") || null,
      categoryId: parseInt(categoryId),
      accountId: parseInt(accountId),
      destinationAccountId:
        isTransferCategory && destinationAccountId
          ? parseInt(destinationAccountId)
          : null,
      year: parseInt(get("year")),
      month: parseInt(get("month")),
      plannedAmount: plannedAmount,
      actualAmount: sameAmount ? plannedAmount : (actualAmount || plannedAmount),
    };

    const url = initialData?.id
      ? `${API}/budget/${initialData.id}/edit`
      : `${API}/budget/new`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const saved = await res.json();
      router.push(`/budget/${saved.year}/${saved.month}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="row justify-content-center">
      <div className="col-lg-6">
        <div className="d-flex align-items-center mb-4">
          <Link href="/" className="text-muted text-decoration-none me-3">
            <i className="bi bi-chevron-left"></i>
          </Link>
          <h1 className="h4 mb-0 flex-grow-1">{title}</h1>
          {canConvertToSubscription && (
            <div className="dropdown">
              <button
                type="button"
                className="btn btn-link text-muted p-1"
                data-bs-toggle="dropdown"
                aria-expanded="false"
                aria-label="Actions"
              >
                <i className="bi bi-three-dots-vertical fs-5"></i>
              </button>
              <ul className="dropdown-menu dropdown-menu-end">
                <li>
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => setShowConvertForm(true)}
                  >
                    <i className="bi bi-arrow-repeat me-2"></i>
                    Convertir en abonnement
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>

        {isApproved && (
          <div className="alert alert-warning d-flex align-items-center gap-2 mb-3">
            <i className="bi bi-lock-fill"></i>
            <span>
              Cette ligne est <strong>verrouillée</strong> car elle a été
              approuvée. Annulez d'abord l'approbation pour la modifier.
            </span>
          </div>
        )}

        {error && (
          <div className="alert alert-danger mb-3">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            {error}
          </div>
        )}

        <div className="card p-4">
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Label</label>
              <input
                type="text"
                name="label"
                className="form-control"
                defaultValue={initialData?.label ?? ""}
                disabled={isApproved}
              />
            </div>

            <div className="mb-3">
              <label className="form-label">
                {isTransferCategory ? "Compte expéditeur" : "Compte"}{" "}
                <span className="text-danger">*</span>
              </label>
              <AccountPicker
                accounts={accounts}
                value={accountId}
                onChange={setAccountId}
                disabled={isApproved}
                required
              />
              {!accountId && (
                <div className="form-text text-warning mt-1">
                  <i className="bi bi-exclamation-triangle me-1"></i>
                  Un compte est requis pour enregistrer cette ligne.
                </div>
              )}
            </div>

            <div className="mb-3">
              <label className="form-label">Catégorie</label>
              <CategoryPicker
                grouped={grouped}
                value={categoryId}
                onChange={setCategoryId}
                onCategoryCreated={handleCategoryCreated}
                disabled={isApproved}
              />
            </div>

            {isTransferCategory && (
              <div className="mb-3">
                <label className="form-label">Compte destinataire</label>
                <AccountPicker
                  accounts={accounts.filter(
                    (a) => String(a.id) !== accountId,
                  )}
                  value={destinationAccountId}
                  onChange={setDestinationAccountId}
                  disabled={isApproved || !accountId}
                />
                <div className={`form-text ${accountId && !destinationAccountId ? "text-warning mt-1" : ""}`}>
                  {accountId ? (
                    <>
                      {!destinationAccountId && <i className="bi bi-exclamation-triangle me-1"></i>}
                      {destinationAccountId
                        ? "Ce compte recevra le crédit lors de l'approbation."
                        : "Requis pour pouvoir approuver ce virement."}
                    </>
                  ) : (
                    "Sélectionnez d'abord le compte expéditeur ci-dessus."
                  )}
                </div>
              </div>
            )}

            <div className="row g-3 mb-3">
              <div className="col-6">
                <label className="form-label">Année</label>
                <input
                  type="number"
                  name="year"
                  className="form-control"
                  defaultValue={initialData?.year ?? currentYear}
                  disabled={isApproved}
                  required
                />
              </div>
              <div className="col-6">
                <label className="form-label">Mois</label>
                <select
                  name="month"
                  className="form-select"
                  defaultValue={initialData?.month ?? currentMonth}
                  disabled={isApproved}
                  required
                >
                  {MONTH_NAMES.map((label, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label">Montant prévu</label>
              <div className="input-group">
                <input
                  type="number"
                  name="plannedAmount"
                  step="0.01"
                  className="form-control"
                  value={plannedAmount}
                  onChange={(e) => handlePlannedAmountChange(e.target.value)}
                  disabled={isApproved}
                  required
                />
                <span className="input-group-text">€</span>
              </div>
            </div>

            <div className="form-check form-switch mb-3">
              <input
                type="checkbox"
                role="switch"
                id="sameAmount"
                className="form-check-input"
                checked={sameAmount}
                onChange={(e) => handleSameAmountToggle(e.target.checked)}
                disabled={isApproved}
              />
              <label className="form-check-label" htmlFor="sameAmount">
                Montant réalisé identique au montant prévu
              </label>
            </div>

            <div className="mb-3">
              <label className="form-label">Montant réalisé</label>
              <div className="input-group">
                <input
                  type="number"
                  name="actualAmount"
                  step="0.01"
                  className="form-control"
                  value={actualAmount}
                  onChange={(e) => setActualAmount(e.target.value)}
                  disabled={isApproved || sameAmount}
                />
                <span className="input-group-text">€</span>
              </div>
            </div>

            <div className="d-flex gap-2 mt-3">
              {!isApproved && (
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1"></span>
                      Enregistrement…
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-lg me-1"></i>Enregistrer
                    </>
                  )}
                </button>
              )}
              <Link
                href={
                  initialData?.year && initialData?.month
                    ? `/budget/${initialData.year}/${initialData.month}`
                    : "/"
                }
                className="btn btn-outline-secondary"
              >
                {isApproved ? "Retour" : "Annuler"}
              </Link>
            </div>
          </form>
        </div>

        {canConvertToSubscription && showConvertForm && (
          <div className="card p-4 mt-3">
            <h2 className="h6 mb-3">Convertir cette ligne en abonnement</h2>
            <p className="text-muted small">
              Un nouvel abonnement sera créé avec la même catégorie, le même
              compte et le même montant prévu. Cette ligne restera liée à
              l'abonnement pour ne pas être dupliquée lors des prochaines
              synchronisations.
            </p>

            {convertError && (
              <div className="alert alert-danger mb-3">
                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                {convertError}
              </div>
            )}

            <div className="mb-3">
              <label className="form-label d-block">Fréquence</label>
              <div className="d-flex flex-wrap gap-2">
                {FREQUENCIES.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    className={`btn btn-sm ${convertFrequency === f.value ? "btn-primary" : "btn-outline-secondary"}`}
                    onClick={() => setConvertFrequency(f.value)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-6">
                <label className="form-label">Jour du mois</label>
                <input
                  type="number"
                  className="form-control"
                  min="1"
                  max="28"
                  value={convertDayOfMonth}
                  onChange={(e) => setConvertDayOfMonth(e.target.value)}
                />
              </div>
              <div className="col-6">
                <label className="form-label">Date de fin</label>
                <input
                  type="date"
                  className="form-control"
                  value={convertEndDate}
                  onChange={(e) => setConvertEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-primary"
                disabled={converting}
                onClick={handleConvertToSubscription}
              >
                {converting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1"></span>
                    Conversion…
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-lg me-1"></i>Créer l'abonnement
                  </>
                )}
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={converting}
                onClick={() => setShowConvertForm(false)}
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
