"use client";
import React from "react";
import Link from "next/link";

interface AccountFormProps {
  initialData?: any;
  title: string;
  onSubmit: (data: any) => void;
}

export default function AccountForm({
  initialData,
  title,
  onSubmit,
}: AccountFormProps) {
  return (
    <div className="row justify-content-center">
      <div className="col-lg-5">
        <div className="d-flex align-items-center mb-4">
          <Link
            href="/accounts"
            className="text-muted text-decoration-none me-3"
          >
            <i className="bi bi-chevron-left"></i>
          </Link>
          <h1 className="h4 mb-0">{title}</h1>
        </div>
        <div className="card p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit({});
            }}
          >
            <div className="mb-3">
              <label className="form-label">Nom du compte</label>
              <input
                type="text"
                className="form-control"
                defaultValue={initialData?.name || ""}
              />
            </div>
            <div className="row g-3 mb-3">
              <div className="col-6">
                <label className="form-label">Type</label>
                <select
                  className="form-select"
                  defaultValue={initialData?.type || "debit"}
                >
                  <option value="credit">Crédit</option>
                  <option value="debit">Débit</option>
                </select>
              </div>
              <div className="col-6">
                <label className="form-label">Devise</label>
                <input
                  type="text"
                  className="form-control"
                  defaultValue={initialData?.currency || "€"}
                />
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label">Solde initial</label>
              <div className="input-group">
                <input
                  type="number"
                  step="0.01"
                  className="form-control"
                  defaultValue={initialData?.balance || ""}
                />
                <span className="input-group-text">€</span>
              </div>
            </div>
            <div className="d-flex gap-2 mt-3">
              <button type="submit" className="btn btn-primary">
                <i className="bi bi-check-lg me-1"></i>Enregistrer
              </button>
              <Link href="/accounts" className="btn btn-outline-secondary">
                Annuler
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
