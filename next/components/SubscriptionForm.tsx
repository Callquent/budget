"use client";
import React from "react";
import Link from "next/link";

interface SubscriptionFormProps {
  initialData?: any;
  title: string;
  onSubmit: (data: any) => void;
}

export default function SubscriptionForm({
  initialData,
  title,
  onSubmit,
}: SubscriptionFormProps) {
  return (
    <div className="row justify-content-center">
      <div className="col-lg-6">
        <div className="d-flex align-items-center mb-4">
          <Link
            href="/subscriptions"
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
                <label className="form-label">Compte</label>
                <select
                  className="form-select"
                  defaultValue={initialData?.accountId || ""}
                >
                  <option value="">Sélectionnez un compte</option>
                  <option value="1">Compte Courant</option>
                  <option value="2">Épargne</option>
                </select>
              </div>
              <div className="col-6">
                <label className="form-label">Catégorie</label>
                <select
                  className="form-select"
                  defaultValue={initialData?.categoryId || ""}
                >
                  <option value="">Sélectionnez une catégorie</option>
                  <option value="1">Loisirs</option>
                  <option value="2">Sante</option>
                  <option value="3">Assurance</option>
                </select>
              </div>
            </div>
            <div className="row g-3 mb-3">
              <div className="col-6">
                <label className="form-label">Montant</label>
                <div className="input-group">
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    defaultValue={initialData?.amount || ""}
                  />
                  <span className="input-group-text">€</span>
                </div>
              </div>
              <div className="col-6">
                <label className="form-label">Fréquence</label>
                <select
                  className="form-select"
                  defaultValue={initialData?.frequency || "monthly"}
                >
                  <option value="monthly">Mensuel</option>
                  <option value="yearly">Annuel</option>
                  <option value="quarterly">Trimestriel</option>
                  <option value="occasional">Occasionnel</option>
                </select>
              </div>
            </div>
            <div className="row g-3 mb-3">
              <div className="col-6">
                <label className="form-label">Date de début</label>
                <input
                  type="date"
                  className="form-control"
                  defaultValue={initialData?.startDate || ""}
                />
              </div>
              <div className="col-6">
                <label className="form-label">Date de fin</label>
                <input
                  type="date"
                  className="form-control"
                  defaultValue={initialData?.endDate || ""}
                />
              </div>
            </div>
            <div className="row g-3 mb-3">
              <div className="col-6">
                <label className="form-label">Jour du mois</label>
                <input
                  type="number"
                  className="form-control"
                  defaultValue={initialData?.dayOfMonth || ""}
                  min="1"
                  max="31"
                />
              </div>
              <div className="col-6">
                <label className="form-label">Statut</label>
                <select
                  className="form-select"
                  defaultValue={initialData?.status || "active"}
                >
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                </select>
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label">Notes</label>
              <textarea
                className="form-control"
                rows={3}
                defaultValue={initialData?.notes || ""}
              ></textarea>
            </div>
            <div className="d-flex gap-2 mt-3">
              <button type="submit" className="btn btn-primary">
                <i className="bi bi-check-lg me-1"></i>Enregistrer
              </button>
              <Link href="/subscriptions" className="btn btn-outline-secondary">
                Annuler
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
