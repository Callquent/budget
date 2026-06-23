"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AccountInterface } from "../Account/Account.interface";
import type { CategoryInterface } from "../Category/Category.interface";

interface SubscriptionFormProps {
  initialData?: {
    id?: number;
    name?: string;
    accountId?: number;
    categoryId?: number;
    amount?: string;
    frequency?: string;
    startDate?: string;
    endDate?: string | null;
    dayOfMonth?: number | null;
    status?: string;
    notes?: string;
  };
  title: string;
}

const API = process.env.NEXT_PUBLIC_API_URL;

export default function SubscriptionForm({
  initialData,
  title,
}: SubscriptionFormProps) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountInterface[]>([]);
  const [categories, setCategories] = useState<CategoryInterface[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Charger comptes et catégories en parallèle
    Promise.all([
      fetch(`${API}/accounts`).then((r) => r.json()),
      fetch(`${API}/categories`).then((r) => r.json()),
    ]).then(([accountsData, categoriesData]) => {
      setAccounts(accountsData.accounts ?? []);
      // Aplatir les catégories groupées
      const allCategories: CategoryInterface[] = Object.values(
        categoriesData.grouped ?? {},
      ).flat() as CategoryInterface[];
      setCategories(allCategories);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const form = e.currentTarget;
    const get = (name: string) =>
      (
        form.elements.namedItem(name) as
          | HTMLInputElement
          | HTMLSelectElement
          | HTMLTextAreaElement
      ).value;

    const body = {
      name: get("name"),
      accountId: parseInt(get("accountId")),
      categoryId: parseInt(get("categoryId")),
      amount: get("amount"),
      frequency: get("frequency"),
      startDate: get("startDate"),
      endDate: get("endDate") || null,
      dayOfMonth: get("dayOfMonth") ? parseInt(get("dayOfMonth")) : null,
      status: get("status"),
      notes: get("notes") || null,
    };

    const url = initialData?.id
      ? `${API}/subscriptions/${initialData.id}/edit`
      : `${API}/subscriptions/new`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      router.push("/subscriptions");
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
          <Link
            href="/subscriptions"
            className="text-muted text-decoration-none me-3"
          >
            <i className="bi bi-chevron-left"></i>
          </Link>
          <h1 className="h4 mb-0">{title}</h1>
        </div>
        <div className="card p-4">
          {error && (
            <div className="alert alert-danger mb-3">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Nom</label>
              <input
                type="text"
                name="name"
                className="form-control"
                defaultValue={initialData?.name ?? ""}
                required
              />
            </div>
            <div className="row g-3 mb-3">
              <div className="col-6">
                <label className="form-label">Compte</label>
                <select
                  name="accountId"
                  className="form-select"
                  defaultValue={initialData?.accountId ?? ""}
                  required
                >
                  <option value="">Sélectionnez un compte</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-6">
                <label className="form-label">Catégorie</label>
                <select
                  name="categoryId"
                  className="form-select"
                  defaultValue={initialData?.categoryId ?? ""}
                  required
                >
                  <option value="">Sélectionnez une catégorie</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="row g-3 mb-3">
              <div className="col-6">
                <label className="form-label">Montant</label>
                <div className="input-group">
                  <input
                    type="number"
                    name="amount"
                    step="0.01"
                    className="form-control"
                    defaultValue={initialData?.amount ?? ""}
                    required
                  />
                  <span className="input-group-text">€</span>
                </div>
              </div>
              <div className="col-6">
                <label className="form-label">Fréquence</label>
                <select
                  name="frequency"
                  className="form-select"
                  defaultValue={initialData?.frequency ?? "monthly"}
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
                  name="startDate"
                  className="form-control"
                  defaultValue={
                    initialData?.startDate ??
                    new Date().toISOString().slice(0, 10)
                  }
                  required
                />
              </div>
              <div className="col-6">
                <label className="form-label">Date de fin</label>
                <input
                  type="date"
                  name="endDate"
                  className="form-control"
                  defaultValue={initialData?.endDate ?? ""}
                />
              </div>
            </div>
            <div className="row g-3 mb-3">
              <div className="col-6">
                <label className="form-label">Jour du mois</label>
                <input
                  type="number"
                  name="dayOfMonth"
                  className="form-control"
                  defaultValue={initialData?.dayOfMonth ?? ""}
                  min="1"
                  max="28"
                />
              </div>
              <div className="col-6">
                <label className="form-label">Statut</label>
                <select
                  name="status"
                  className="form-select"
                  defaultValue={initialData?.status ?? "active"}
                >
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                </select>
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label">Notes</label>
              <textarea
                name="notes"
                className="form-control"
                rows={3}
                defaultValue={initialData?.notes ?? ""}
              />
            </div>
            <div className="d-flex gap-2 mt-3">
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
