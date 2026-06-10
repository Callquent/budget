"use client";
import React from "react";

interface BudgetFormProps {
  initialData?: {
    label?: string;
    categoryId?: string;
    accountId?: string;
    year?: number;
    month?: number;
    plannedAmount?: number;
    actualAmount?: number;
  };
  title: string;
  action: (formData: FormData) => Promise<void>;
}

export default function BudgetForm({
  initialData,
  title,
  action,
}: BudgetFormProps) {
  return (
    <div className="row justify-content-center">
      <div className="col-lg-6">
        <div className="d-flex align-items-center mb-4">
          <a href="/" className="text-muted text-decoration-none me-3">
            <i className="bi bi-chevron-left"></i>
          </a>
          <h1 className="h4 mb-0">{title}</h1>
        </div>
        <div className="card p-4">
          <form action={action}>
            <div className="mb-3">
              <label className="form-label">Label</label>
              <input
                type="text"
                name="label"
                className="form-control"
                defaultValue={initialData?.label || ""}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Catégorie</label>
              <select
                name="categoryId"
                className="form-select"
                defaultValue={initialData?.categoryId || ""}
              >
                <option value="">Sélectionnez une catégorie</option>
                <option value="1">Alimentation</option>
                <option value="2">Loyer</option>
                <option value="3">Salaire</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label">Compte</label>
              <select
                name="accountId"
                className="form-select"
                defaultValue={initialData?.accountId || ""}
              >
                <option value="">Sélectionnez un compte</option>
                <option value="1">Compte Courant</option>
                <option value="2">Épargne</option>
              </select>
            </div>
            <div className="row g-3 mb-3">
              <div className="col-6">
                <label className="form-label">Année</label>
                <input
                  type="number"
                  name="year"
                  className="form-control"
                  defaultValue={initialData?.year || 2026}
                />
              </div>
              <div className="col-6">
                <label className="form-label">Mois</label>
                <input
                  type="number"
                  name="month"
                  className="form-control"
                  defaultValue={initialData?.month || 6}
                  min="1"
                  max="12"
                />
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label">Montant prévu</label>
              <input
                type="number"
                name="plannedAmount"
                step="0.01"
                className="form-control"
                defaultValue={initialData?.plannedAmount || ""}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Montant réalisé</label>
              <input
                type="number"
                name="actualAmount"
                step="0.01"
                className="form-control"
                defaultValue={initialData?.actualAmount || ""}
              />
            </div>
            <div className="d-flex gap-2 mt-3">
              <button type="submit" className="btn btn-primary">
                <i className="bi bi-check-lg me-1"></i>Enregistrer
              </button>
              <a href="/" className="btn btn-outline-secondary">
                Annuler
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
