"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AccountInterface } from "../Account/Account.interface";
import type { CategoryInterface } from "../Category/Category.interface";
import type { BudgetFormProps } from "./Budget.interface";

const API = process.env.NEXT_PUBLIC_API_URL;

export default function BudgetForm({
  initialData,
  title,
  currentYear = new Date().getFullYear(),
  currentMonth = new Date().getMonth() + 1,
}: BudgetFormProps) {
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryInterface[]>([]);
  const [accounts, setAccounts] = useState<AccountInterface[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Champs contrôlés : on ne peut pas compter sur defaultValue pour les <select>
  // car les options (categories/accounts) arrivent de façon async après le montage.
  // defaultValue n'est appliqué qu'au montage initial, donc si initialData.categoryId
  // existe avant que les <option> ne soient rendues, le select reste vide.
  const [categoryId, setCategoryId] = useState<string>(
    initialData?.categoryId != null ? String(initialData.categoryId) : "",
  );
  const [accountId, setAccountId] = useState<string>(
    initialData?.accountId != null ? String(initialData.accountId) : "",
  );

  const isApproved = initialData?.isApproved ?? false;

  // Si initialData arrive/charge après le premier rendu (ex: fetch SSR résolu plus tard,
  // ou navigation client vers un autre id), on resynchronise les selects contrôlés.
  useEffect(() => {
    setCategoryId(
      initialData?.categoryId != null ? String(initialData.categoryId) : "",
    );
    setAccountId(
      initialData?.accountId != null ? String(initialData.accountId) : "",
    );
  }, [initialData?.categoryId, initialData?.accountId]);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/categories`).then((r) => r.json()),
      fetch(`${API}/accounts`).then((r) => r.json()),
    ]).then(([categoriesData, accountsData]) => {
      const allCategories: CategoryInterface[] = Object.values(
        categoriesData.grouped ?? {},
      ).flat() as CategoryInterface[];
      setCategories(allCategories);
      setAccounts(accountsData.accounts ?? []);
    });
  }, []);

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
      plannedAmount: get("plannedAmount"),
      actualAmount: get("actualAmount") || get("plannedAmount"),
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
              <label className="form-label">Catégorie</label>
              <select
                name="categoryId"
                className="form-select"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={isApproved}
                required
              >
                <option value="">Sélectionnez une catégorie</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                    {cat.transactionType ? ` (${cat.transactionType})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              <label className="form-label">Compte</label>
              <select
                name="accountId"
                className="form-select"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                disabled={isApproved}
              >
                <option value="">Sélectionnez un compte</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
              {!initialData?.accountId && (
                <div className="form-text text-warning">
                  <i className="bi bi-exclamation-triangle me-1"></i>
                  Un compte est requis pour pouvoir approuver cette ligne.
                </div>
              )}
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
                <input
                  type="number"
                  name="month"
                  className="form-control"
                  defaultValue={initialData?.month ?? currentMonth}
                  min="1"
                  max="12"
                  disabled={isApproved}
                  required
                />
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
                  defaultValue={initialData?.plannedAmount ?? ""}
                  disabled={isApproved}
                  required
                />
                <span className="input-group-text">€</span>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label">Montant réalisé</label>
              <div className="input-group">
                <input
                  type="number"
                  name="actualAmount"
                  step="0.01"
                  className="form-control"
                  defaultValue={initialData?.actualAmount ?? ""}
                  disabled={isApproved}
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
