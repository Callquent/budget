"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface AccountFormProps {
  initialData?: {
    id?: number;
    name?: string;
    type?: string;
    currency?: string;
    balance?: string;
  };
  title: string;
}

const API = process.env.NEXT_PUBLIC_API_URL;

export default function AccountForm({ initialData, title }: AccountFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const form = e.currentTarget;
    const body = {
      name:     (form.elements.namedItem("name") as HTMLInputElement).value,
      type:     (form.elements.namedItem("type") as HTMLSelectElement).value,
      currency: (form.elements.namedItem("currency") as HTMLInputElement).value,
      balance:  (form.elements.namedItem("balance") as HTMLInputElement).value,
    };

    const url = initialData?.id
      ? `${API}/accounts/${initialData.id}/edit`
      : `${API}/accounts/new`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      router.push("/accounts");
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
          <Link href="/accounts" className="text-muted text-decoration-none me-3">
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
              <label className="form-label">Nom du compte</label>
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
                <label className="form-label">Type</label>
                <select name="type" className="form-select" defaultValue={initialData?.type ?? "debit"}>
                  <option value="credit">Crédit</option>
                  <option value="debit">Débit</option>
                </select>
              </div>
              <div className="col-6">
                <label className="form-label">Devise</label>
                <input
                  type="text"
                  name="currency"
                  className="form-control"
                  defaultValue={initialData?.currency ?? "EUR"}
                  required
                />
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label">Solde initial</label>
              <div className="input-group">
                <input
                  type="number"
                  name="balance"
                  step="0.01"
                  className="form-control"
                  defaultValue={initialData?.balance ?? "0"}
                />
                <span className="input-group-text">€</span>
              </div>
            </div>
            <div className="d-flex gap-2 mt-3">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving
                  ? <><span className="spinner-border spinner-border-sm me-1"></span>Enregistrement…</>
                  : <><i className="bi bi-check-lg me-1"></i>Enregistrer</>
                }
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
