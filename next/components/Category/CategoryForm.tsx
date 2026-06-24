"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CategoryFormProps } from "./Category.interface";
import OptionPicker, { type PickerOption } from "../Transaction/OptionPicker";

const API = process.env.NEXT_PUBLIC_API_URL;

const TYPE_OPTIONS: PickerOption[] = [
  { value: "income", label: "Recette", color: "success" },
  { value: "expense", label: "Dépense", color: "danger" },
  { value: "transfer", label: "Virement", color: "primary" },
];

const FREQUENCY_OPTIONS: PickerOption[] = [
  { value: "monthly", label: "Mensuelle" },
  { value: "quarterly", label: "Trimestrielle" },
  { value: "yearly", label: "Annuelle" },
  { value: "occasional", label: "Occasionnelle" },
];

export default function CategoryForm({
  initialData,
  title,
}: CategoryFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [transactionType, setTransactionType] = useState<string>(
    initialData?.transactionType ?? "expense",
  );
  const [frequency, setFrequency] = useState<string>(
    initialData?.frequency ?? "monthly",
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const form = e.currentTarget;
    const body = {
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      transactionType,
      frequency,
      description: (
        form.elements.namedItem("description") as HTMLTextAreaElement
      ).value,
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
          <Link
            href="/categories"
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
            <div className="mb-3">
              <label className="form-label">Type de transaction</label>
              <OptionPicker
                options={TYPE_OPTIONS}
                value={transactionType}
                onChange={setTransactionType}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Fréquence</label>
              <OptionPicker
                options={FREQUENCY_OPTIONS}
                value={frequency}
                onChange={setFrequency}
              />
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
