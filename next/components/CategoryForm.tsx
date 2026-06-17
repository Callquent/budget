"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface CategoryFormProps {
  initialData?: {
    id?: number;
    name?: string;
    transactionType?: string;
    frequency?: string;
    description?: string;
  };
  title: string;
}

const API = process.env.NEXT_PUBLIC_API_URL;

export default function CategoryForm({ initialData, title }: CategoryFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const form = e.currentTarget;
    const body = {
      name:            (form.elements.namedItem("name") as HTMLInputElement).value,
      transactionType: (form.elements.namedItem("transactionType") as HTMLSelectElement).value,
      frequency:       (form.elements.namedItem("frequency") as HTMLSelectElement).value,
      description:     (form.elements.namedItem("description") as HTMLTextAreaElement).value,
    };

    const url = initialData?.id
      ? `${API}/categories/${initialData.id}/edit`
      : `${API}/categories/new`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      router.push("/categories");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="row justify-content-center">
      <div className="col-lg-5">
        <div className="d-flex align-items-center mb-4">
          <Link href="/categories" className="text-muted text-decoration-none me-3">
            <i className="bi bi-chevron-left"></i>
          </Link>
          <h1 className="h4 mb-0">{title}</h1>
        </div>
        <div className="card p-4">
          {error && (
            <div className="alert alert-danger mb-3">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>{error}
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
                <label className="form-label">Type de transaction</label>
                <select
                  name="transactionType"
                  className="form-select"
                  defaultValue={initialData?.transactionType ?? "expense"}
                >
                  <option value="income">Recette</option>
                  <option value="expense">Dépense</option>
                  <option value="transfer">Virement</option>
                </select>
              </div>
              <div className="col-6">
                <label className="form-label">Fréquence</label>
                <select
                  name="frequency"
                  className="form-select"
                  defaultValue={initialData?.frequency ?? "monthly"}
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
                name="description"
                className="form-control"
                rows={3}
                defaultValue={initialData?.description ?? ""}
              />
            </div>
            <div className="d-flex gap-2 mt-3">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving
                  ? <><span className="spinner-border spinner-border-sm me-1"></span>Enregistrement…</>
                  : <><i className="bi bi-check-lg me-1"></i>Enregistrer</>
                }
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
