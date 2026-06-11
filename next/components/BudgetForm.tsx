"use client";
import React from "react";

interface Category {
  id: number | string;
  name: string;
  transactionType?: string;
}

interface Account {
  id: number | string;
  name: string;
  type?: string;
}

interface BudgetFormProps {
  initialData?: {
    label?: string;
    categoryId?: string;
    accountId?: string;
    year?: number;
    month?: number;
    plannedAmount?: number;
    actualAmount?: number;
    isApproved?: boolean;
  };
  title: string;
  action: (formData: FormData) => Promise<void>;
  /** Listes dynamiques issues du controller Symfony */
  categories?: Category[];
  accounts?: Account[];
  /** Année et mois courants (pré-remplissage) */
  currentYear?: number;
  currentMonth?: number;
  /** Mode lecture seule (ligne approuvée) */
  readOnly?: boolean;
}

export default function BudgetForm({
  initialData,
  title,
  action,
  categories = [],
  accounts = [],
  currentYear = new Date().getFullYear(),
  currentMonth = new Date().getMonth() + 1,
  readOnly = false,
}: BudgetFormProps) {
  const isApproved = initialData?.isApproved ?? false;

  return (
    <div className="row justify-content-center">
      <div className="col-lg-6">
        <div className="d-flex align-items-center mb-4">
          <a href="/" className="text-muted text-decoration-none me-3">
            <i className="bi bi-chevron-left"></i>
          </a>
          <h1 className="h4 mb-0">{title}</h1>
        </div>

        {isApproved && (
          <div className="alert alert-warning d-flex align-items-center gap-2 mb-3">
            <i className="bi bi-lock-fill"></i>
            <span>
              Cette ligne est <strong>verrouillée</strong> car elle a été approuvée.
              Annulez d'abord l'approbation pour la modifier.
            </span>
          </div>
        )}

        <div className="card p-4">
          <form action={action}>
            {/* Label */}
            <div className="mb-3">
              <label className="form-label">Label</label>
              <input
                type="text"
                name="label"
                className="form-control"
                defaultValue={initialData?.label ?? ""}
                disabled={readOnly || isApproved}
              />
            </div>

            {/* Catégorie — options dynamiques issues du controller */}
            <div className="mb-3">
              <label className="form-label">Catégorie</label>
              <select
                name="categoryId"
                className="form-select"
                defaultValue={initialData?.categoryId ?? ""}
                disabled={readOnly || isApproved}
              >
                <option value="">Sélectionnez une catégorie</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={String(cat.id)}>
                    {cat.name}
                    {cat.transactionType ? ` (${cat.transactionType})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Compte — options dynamiques issues du controller (AccountRepository) */}
            <div className="mb-3">
              <label className="form-label">Compte</label>
              <select
                name="accountId"
                className="form-select"
                defaultValue={initialData?.accountId ?? ""}
                disabled={readOnly || isApproved}
              >
                <option value="">Sélectionnez un compte</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={String(acc.id)}>
                    {acc.name}
                  </option>
                ))}
              </select>
              {/* Avertissement compte manquant — requis pour l'approbation */}
              {!initialData?.accountId && (
                <div className="form-text text-warning">
                  <i className="bi bi-exclamation-triangle me-1"></i>
                  Un compte est requis pour pouvoir approuver cette ligne.
                </div>
              )}
            </div>

            {/* Année / Mois */}
            <div className="row g-3 mb-3">
              <div className="col-6">
                <label className="form-label">Année</label>
                <input
                  type="number"
                  name="year"
                  className="form-control"
                  defaultValue={initialData?.year ?? currentYear}
                  disabled={readOnly || isApproved}
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
                  disabled={readOnly || isApproved}
                />
              </div>
            </div>

            {/* Montant prévu */}
            <div className="mb-3">
              <label className="form-label">Montant prévu</label>
              <div className="input-group">
                <input
                  type="number"
                  name="plannedAmount"
                  step="0.01"
                  className="form-control"
                  defaultValue={initialData?.plannedAmount ?? ""}
                  disabled={readOnly || isApproved}
                />
                <span className="input-group-text">€</span>
              </div>
            </div>

            {/* Montant réalisé — éditable même si approuvée (avant dés-approbation) */}
            <div className="mb-3">
              <label className="form-label">Montant réalisé</label>
              <div className="input-group">
                <input
                  type="number"
                  name="actualAmount"
                  step="0.01"
                  className="form-control"
                  defaultValue={initialData?.actualAmount ?? ""}
                  disabled={readOnly || isApproved}
                />
                <span className="input-group-text">€</span>
              </div>
            </div>

            <div className="d-flex gap-2 mt-3">
              {!readOnly && !isApproved && (
                <button type="submit" className="btn btn-primary">
                  <i className="bi bi-check-lg me-1"></i>Enregistrer
                </button>
              )}
              <a
                href={
                  initialData?.year && initialData?.month
                    ? `/budget/${initialData.year}/${initialData.month}`
                    : "/"
                }
                className="btn btn-outline-secondary"
              >
                {readOnly || isApproved ? "Retour" : "Annuler"}
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
