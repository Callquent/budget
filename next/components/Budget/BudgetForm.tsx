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
  const [plannedAmount, setPlannedAmount] = useState<string>(
    initialData?.plannedAmount != null ? String(initialData.plannedAmount) : "",
  );
  const [actualAmount, setActualAmount] = useState<string>(
    initialData?.actualAmount != null ? String(initialData.actualAmount) : "",
  );
  const [sameAmount, setSameAmount] = useState(false);

  const isApproved = initialData?.isApproved ?? false;

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
    });
  }, [initialData?.category?.id, initialData?.account?.id, initialData?.categoryId, initialData?.accountId]);

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

    const form = e.currentTarget;
    const get = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement)
        .value;

    const body = {
      label: get("label") || null,
      categoryId: parseInt(categoryId),
      accountId: accountId ? parseInt(accountId) : null,
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
          <h1 className="h4 mb-0">{title}</h1>
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
              <label className="form-label">Compte</label>
              <AccountPicker
                accounts={accounts}
                value={accountId}
                onChange={setAccountId}
                disabled={isApproved}
              />
              {!initialData?.account?.id && !initialData?.accountId && (
                <div className="form-text text-warning mt-1">
                  <i className="bi bi-exclamation-triangle me-1"></i>
                  Un compte est requis pour pouvoir approuver cette ligne.
                </div>
              )}
            </div>

            <div className="mb-3">
              <label className="form-label">Catégorie</label>
              <CategoryPicker
                grouped={grouped}
                value={categoryId}
                onChange={setCategoryId}
                disabled={isApproved}
              />
            </div>

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
      </div>
    </div>
  );
}
