"use client";
import React from "react";
import Link from "next/link";

interface TransactionFormProps {
  initialData?: {
    transactionDate?: string;
    accountId?: string;
    type?: string;
    categoryId?: string;
    amount?: number;
    label?: string;
    notes?: string;
  };
  title: string;
  action: (formData: FormData) => Promise<void>;
}

export default function TransactionForm({
  initialData,
  title,
  action,
}: TransactionFormProps) {
  const shortcuts = [
    { label: "Salaire", type: "credit", category: "Revenus" },
    { label: "Courses", type: "debit", category: "Alimentation" },
    { label: "Électricité", type: "debit", category: "Énergie" },
    { label: "Virement", type: "transfer", category: "Transfert" },
  ];

  return (
    <div className="row justify-content-center">
      <div className="col-lg-6">
        <div className="d-flex align-items-center mb-4">
          <Link href="/transactions" className="text-muted text-decoration-none me-3">
            <i className="bi bi-chevron-left"></i>
          </Link>
          <h1 className="h4 mb-0">{title}</h1>
        </div>
        <div className="card p-4">
          <form action={action}>
            <div className="mb-3">
              <label className="form-label">Date</label>
              <input
                type="date"
                name="transactionDate"
                className="form-control"
                defaultValue={initialData?.transactionDate || new Date().toISOString().split("T")[0]}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Compte</label>
              <select name="accountId" className="form-select" defaultValue={initialData?.accountId || ""}>
                <option value="">Sélectionnez un compte</option>
                <option value="1">Compte Courant</option>
                <option value="2">Épargne</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label">Type</label>
              <select name="type" className="form-select" defaultValue={initialData?.type || "debit"}>
                <option value="credit">Crédit (Entrée)</option>
                <option value="debit">Débit (Sortie)</option>
                <option value="transfer">Virement</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label">Catégorie</label>
              <select name="categoryId" className="form-select" defaultValue={initialData?.categoryId || ""}>
                <option value="">Sélectionnez une catégorie</option>
                <option value="1">Salaire</option>
                <option value="2">Courses</option>
                <option value="3">Loyer</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label">Montant</label>
              <div className="input-group">
                <input
                  type="number"
                  name="amount"
                  step="0.01"
                  className="form-control"
                  defaultValue={initialData?.amount || ""}
                />
                <span className="input-group-text">€</span>
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label">Libellé</label>
              <input
                type="text"
                name="label"
                className="form-control"
                defaultValue={initialData?.label || ""}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Notes</label>
              <textarea
                name="notes"
                className="form-control"
                rows={3}
                defaultValue={initialData?.notes || ""}
              ></textarea>
            </div>

            {!initialData && (
              <div className="mb-3">
                <label className="form-label small text-muted">Raccourcis</label>
                <div className="d-flex flex-wrap gap-2">
                  {shortcuts.map((s) => (
                    <button key={s.label} type="button" className="btn btn-outline-secondary btn-sm">
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="d-flex gap-2 mt-3">
              <button type="submit" className="btn btn-primary">
                <i className="bi bi-check-lg me-1"></i>Enregistrer
              </button>
              <Link href="/transactions" className="btn btn-outline-secondary">
                Annuler
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
