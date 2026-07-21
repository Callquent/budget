"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CategoryFormProps } from "./Category.interface";
import OptionPicker, { type PickerOption } from "../Transaction/OptionPicker";

const API = process.env.NEXT_PUBLIC_API_URL;

export default function CategoryForm({ initialData, title }: CategoryFormProps) {
  const router = useRouter();
  const [error,   setError]   = useState<string | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [loading, setLoading] = useState(true);

  const [typeOptions, setTypeOptions] = useState<PickerOption[]>([]);

  const [transactionType, setTransactionType] = useState<string>(
    initialData?.transactionType ?? "",
  );

  // ── Fetch des options depuis Symfony (/categories/options) ────────────────
  useEffect(() => {
    fetch(`${API}/categories/options`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setTypeOptions(data.transactionTypes);
        // Valeur par défaut après chargement si pas d'initialData
        if (!transactionType) setTransactionType(data.transactionTypes[0]?.value ?? "");
      })
      .catch((e) => setError(`Impossible de charger les options : ${e.message}`))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // La catégorie Virement est désormais auto-provisionnée côté backend
  // (voir CategoryRepository::findOrCreateTransferCategory) : plus besoin
  // d'en créer une manuellement, donc on retire ce choix à la création.
  // On le garde disponible en édition pour ne pas casser le type de la
  // catégorie Virement existante si l'utilisateur la modifie.
  const isNew = !initialData?.id;
  const availableTypeOptions = isNew
    ? typeOptions.filter((o) => o.value !== "transfer")
    : typeOptions;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const form = e.currentTarget;
    const body = {
      name:            (form.elements.namedItem("name") as HTMLInputElement).value,
      transactionType,
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
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              {error}
            </div>
          )}
          {loading ? (
            <div className="d-flex justify-content-center py-4">
              <div className="spinner-border text-primary" role="status"></div>
            </div>
          ) : (
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
                  options={availableTypeOptions}
                  value={transactionType}
                  onChange={setTransactionType}
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
                <button type="submit" className="btn btn-primary" disabled={saving}>
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
          )}
        </div>
      </div>
    </div>
  );
}
