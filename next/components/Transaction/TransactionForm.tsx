"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AccountInterface } from "../Account/Account.interface";
import type { CategoryInterface } from "../Category/Category.interface";
import CategoryPicker from "../Category/CategoryPicker";
import AccountPicker from "../Account/AccountPicker";
import OptionPicker, { type PickerOption } from "./OptionPicker";

interface TransactionFormProps {
  initialData?: {
    id?: number;
    transactionDate?: string;
    accountId?: number;
    categoryId?: number;
    type?: string;
    amount?: number;
    label?: string;
    notes?: string;
    year?: number;
    month?: number;
  };
  title: string;
  defaultYear?: number;
  defaultMonth?: number;
}

const API = process.env.NEXT_PUBLIC_API_URL;

const TYPE_OPTIONS: PickerOption[] = [
  { value: "debit", label: "Débit (Sortie)", color: "danger" },
  { value: "credit", label: "Crédit (Entrée)", color: "success" },
];

export default function TransactionForm({
  initialData,
  title,
  defaultYear,
  defaultMonth,
}: TransactionFormProps) {
  const router = useRouter();
  const [grouped, setGrouped] = useState<Record<string, CategoryInterface[]>>(
    {},
  );
  const [accounts, setAccounts] = useState<AccountInterface[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [accountId, setAccountId] = useState<string>(
    initialData?.accountId != null ? String(initialData.accountId) : "",
  );
  const [categoryId, setCategoryId] = useState<string>(
    initialData?.categoryId != null ? String(initialData.categoryId) : "",
  );
  const [type, setType] = useState<string>(initialData?.type ?? "debit");

  useEffect(() => {
    setAccountId(
      initialData?.accountId != null ? String(initialData.accountId) : "",
    );
    setCategoryId(
      initialData?.categoryId != null ? String(initialData.categoryId) : "",
    );
    setType(initialData?.type ?? "debit");
  }, [initialData?.accountId, initialData?.categoryId, initialData?.type]);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/accounts`).then((r) => r.json()),
      fetch(`${API}/categories`).then((r) => r.json()),
    ]).then(([accountsData, categoriesData]) => {
      setAccounts(accountsData.accounts ?? []);
      setGrouped(categoriesData.grouped ?? {});
    });
  }, []);

  const defaultDate = (() => {
    if (initialData?.transactionDate) return initialData.transactionDate;
    if (defaultYear && defaultMonth) {
      return `${defaultYear}-${String(defaultMonth).padStart(2, "0")}-01`;
    }
    return new Date().toISOString().split("T")[0];
  })();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const form = e.currentTarget;
    const get = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement)
        .value;

    const body = {
      transactionDate: get("transactionDate"),
      accountId: accountId ? parseInt(accountId) : null,
      categoryId: categoryId ? parseInt(categoryId) : null,
      type,
      amount: get("amount"),
      label: get("label") || null,
      notes: get("notes") || null,
    };

    const url = initialData?.id
      ? `${API}/transactions/${initialData.id}/edit`
      : `${API}/transactions/new`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Erreur ${res.status}`);
      }
      const saved = await res.json();
      router.push(`/transactions/${saved.year}/${saved.month}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const backHref =
    initialData?.year && initialData?.month
      ? `/transactions/${initialData.year}/${initialData.month}`
      : defaultYear && defaultMonth
        ? `/transactions/${defaultYear}/${defaultMonth}`
        : "/transactions";

  return (
    <div className="row justify-content-center">
      <div className="col-lg-6">
        <div className="d-flex align-items-center mb-4">
          <Link
            href={backHref}
            className="text-muted text-decoration-none me-3"
          >
            <i className="bi bi-chevron-left"></i>
          </Link>
          <h1 className="h4 mb-0">{title}</h1>
        </div>

        {error && (
          <div className="alert alert-danger mb-3">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            {error}
          </div>
        )}

        <div className="card p-4">
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Date</label>
              <input
                type="date"
                name="transactionDate"
                className="form-control"
                defaultValue={defaultDate}
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Compte</label>
              <AccountPicker
                accounts={accounts}
                value={accountId}
                onChange={setAccountId}
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Type</label>
              <OptionPicker
                options={TYPE_OPTIONS}
                value={type}
                onChange={setType}
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Catégorie</label>
              <CategoryPicker
                grouped={grouped}
                value={categoryId}
                onChange={setCategoryId}
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Montant</label>
              <div className="input-group">
                <input
                  type="number"
                  name="amount"
                  step="0.01"
                  min="0"
                  className="form-control"
                  defaultValue={initialData?.amount ?? ""}
                  required
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
                defaultValue={initialData?.label ?? ""}
              />
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
              <Link href={backHref} className="btn btn-outline-secondary">
                Annuler
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
