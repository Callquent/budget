"use client";
import React from "react";
import Link from "next/link";

interface CategoryFormProps {
  initialData?: any;
  title: string;
  onSubmit: (data: any) => void;
}

export default function CategoryForm({
  initialData,
  title,
  onSubmit,
}: CategoryFormProps) {
  return (
    <div className="row justify-content-center">
      <div className="col-lg-5">
        <div className="d-flex align-items-center mb-4">
          <Link
            href="/categories"
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
              <label className="form-label">Nom</label>
              <input
                type="text"
                className="form-control"
                defaultValue={initialData?.name || ""}
              />
            </div>
            <div className="row g-3 mb-3">
              <div className="col-6">
                <label className="form-label">Type de transaction</label>
                <select
                  className="form-select"
                  defaultValue={initialData?.transactionType || "expense"}
                >
                  <option value="income">Recette</option>
                  <option value="expense">Dépense</option>
                  <option value="transfer">Virement</option>
                </select>
              </div>
              <div className="col-6">
                <label className="form-label">Fréquence</label>
                <select
                  className="form-select"
                  defaultValue={initialData?.frequency || "monthly"}
                >
                  <option value="monthly">Mensuelle</option>
                  <option value="yearly">Annuelle</option>
                  <option value="quarterly">Trimestrielle</option>
                  <option value="occasional">Occasionnelle</option>
                </select>
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label">Description</label>
              <textarea
                className="form-control"
                rows={3}
                defaultValue={initialData?.description || ""}
              ></textarea>
            </div>
            <div className="d-flex gap-2 mt-3">
              <button type="submit" className="btn btn-primary">
                <i className="bi bi-check-lg me-1"></i>Enregistrer
              </button>
              <Link href="/categories" className="btn btn-outline-secondary">
                Annuler
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
