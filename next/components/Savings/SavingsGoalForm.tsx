"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AccountInterface } from "../Account/Account.interface";
import type { CategoryInterface } from "../Category/Category.interface";
import type { SavingsGoalFormProps } from "./Savings.interface";
import CategoryPicker from "../Category/CategoryPicker";
import AccountPicker from "../Account/AccountPicker";
import {
  PERIOD_LABELS,
  TARGET_DURATIONS,
  completionDate,
  estimateDuration,
  formatDuration,
  formatMonthYear,
  suggestContribution,
} from "./SavingsPlanning";

const API = process.env.NEXT_PUBLIC_API_URL;

const FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "occasional", label: "One-time" },
] as const;

export default function SavingsGoalForm({
  initialData,
  title,
}: SavingsGoalFormProps) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountInterface[]>([]);
  // On ne garde que les catégories de type "expense" : une contribution
  // d'épargne est budgétée comme une dépense planifiée sur un compte.
  // CategoryPicker n'affiche que les groupes présents dans `grouped`, donc
  // ne lui passer que "expense" masque income/transfer sans le modifier.
  const [grouped, setGrouped] = useState<Record<string, CategoryInterface[]>>({});

  const [accountId, setAccountId] = useState<string>(
    initialData?.accountId != null ? String(initialData.accountId) : "",
  );
  const [categoryId, setCategoryId] = useState<string>(
    initialData?.categoryId != null ? String(initialData.categoryId) : "",
  );
  const [frequency, setFrequency] = useState<string>(
    initialData?.frequency ?? "monthly",
  );
  const [status, setStatus] = useState<string>(initialData?.status ?? "active");
  const [targetAmount, setTargetAmount] = useState<string>(
    initialData?.targetAmount != null ? String(initialData.targetAmount) : "",
  );
  const [contributionAmount, setContributionAmount] = useState<string>(
    initialData?.contributionAmount != null
      ? String(initialData.contributionAmount)
      : "",
  );
  const [startDate, setStartDate] = useState<string>(
    initialData?.startDate ?? new Date().toISOString().slice(0, 10),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isEditing = initialData?.id != null;
  const target = Number(initialData?.targetAmount ?? 0);
  const contributed = Number(initialData?.contributedAmount ?? 0);
  const progress =
    initialData?.progressPercentage ??
    (target > 0 ? Math.min(100, (contributed / target) * 100) : 0);

  // ─── Planification : durée estimée + propositions ───────────────────────
  // Montant restant à épargner, calculé sur la valeur en cours de saisie
  // (moins ce qui est déjà épargné en édition).
  const formTarget = Number(targetAmount) || 0;
  const formContribution = Number(contributionAmount) || 0;
  const remaining = Math.max(0, formTarget - contributed);
  const periodLabel = PERIOD_LABELS[frequency];
  const estimate = estimateDuration(remaining, formContribution, frequency);
  // Si des versements ont déjà eu lieu, le reste démarre à partir de
  // maintenant (ou de la date de départ si elle est dans le futur).
  const now = new Date();
  const start = new Date(startDate);
  const planBase = contributed > 0 && start < now ? now : start;
  const finishDate =
    estimate && !isNaN(planBase.getTime())
      ? completionDate(planBase, estimate.periods, frequency)
      : null;

  useEffect(() => {
    Promise.all([
      fetch(`${API}/accounts`).then((r) => r.json()),
      fetch(`${API}/categories`).then((r) => r.json()),
    ]).then(([accountsData, categoriesData]) => {
      setAccounts(accountsData.accounts ?? []);
      setGrouped({ expense: categoriesData.grouped?.expense ?? [] });
    });
  }, []);

  // Appelé par CategoryPicker après une création rapide de catégorie : on
  // l'ajoute directement au state local (même pattern que BudgetForm).
  const handleCategoryCreated = (type: string, category: CategoryInterface) => {
    setGrouped((prev) => ({
      ...prev,
      [type]: [...(prev[type] ?? []), category],
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (!accountId) {
      setError("Please select an account.");
      setSaving(false);
      return;
    }
    if (!categoryId) {
      setError("Please select or create a category for this goal.");
      setSaving(false);
      return;
    }

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
      accountId: parseInt(accountId),
      categoryId: parseInt(categoryId),
      targetAmount: get("targetAmount"),
      contributionAmount: get("contributionAmount"),
      frequency,
      startDate: get("startDate"),
      endDate: get("endDate") || null,
      dayOfMonth: get("dayOfMonth") ? parseInt(get("dayOfMonth")) : null,
      status,
      notes: get("notes") || null,
    };

    const url = initialData?.id
      ? `${API}/savings/${initialData.id}/edit`
      : `${API}/savings/new`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      router.push("/savings");
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
          <Link href="/savings" className="text-muted text-decoration-none me-3">
            <i className="bi bi-chevron-left"></i>
          </Link>
          <h1 className="h4 mb-0">{title}</h1>
        </div>

        {isEditing && target > 0 && (
          <div className="card p-4 mb-3">
            <div className="d-flex justify-content-between mb-1">
              <span className="fw-semibold">
                {contributed.toFixed(2)}&nbsp;/&nbsp;{target.toFixed(2)}&nbsp;€
              </span>
              <span className="text-muted">{progress.toFixed(0)}%</span>
            </div>
            <div className="progress" style={{ height: "10px" }}>
              <div
                className="progress-bar bg-success"
                role="progressbar"
                style={{ width: `${Math.min(100, progress)}%` }}
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="alert alert-danger mb-3">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            {error}
          </div>
        )}

        <div className="card p-4">
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Goal name</label>
              <input
                type="text"
                name="name"
                className="form-control"
                placeholder="e.g. New bike, Car reserve, Garage"
                defaultValue={initialData?.name ?? ""}
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label">
                Account <span className="text-danger">*</span>
              </label>
              <AccountPicker
                accounts={accounts}
                value={accountId}
                onChange={setAccountId}
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Category</label>
              <CategoryPicker
                grouped={grouped}
                value={categoryId}
                onChange={setCategoryId}
                onCategoryCreated={handleCategoryCreated}
              />
              <div className="form-text">
                Use a dedicated category per goal (e.g. "Bike savings") so
                its progress isn't mixed with other budget lines.
              </div>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-6">
                <label className="form-label">Target amount</label>
                <div className="input-group">
                  <input
                    type="number"
                    name="targetAmount"
                    step="0.01"
                    className="form-control"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    required
                  />
                  <span className="input-group-text">€</span>
                </div>
              </div>
              <div className="col-6">
                <label className="form-label">
                  Amount per {periodLabel ?? "period"}
                </label>
                <div className="input-group">
                  <input
                    type="number"
                    name="contributionAmount"
                    step="0.01"
                    className="form-control"
                    value={contributionAmount}
                    onChange={(e) => setContributionAmount(e.target.value)}
                    required
                  />
                  <span className="input-group-text">€</span>
                </div>
              </div>
            </div>

            {/* ── Planner : durée estimée + propositions ─────────────── */}
            {frequency === "occasional" ? (
              formTarget > 0 && formContribution > 0 && (
                <div className="alert alert-light border small mb-3">
                  <i className="bi bi-info-circle me-1"></i>
                  One-time contribution: this single deposit covers{" "}
                  <strong>
                    {Math.min(100, (formContribution / formTarget) * 100).toFixed(0)}%
                  </strong>{" "}
                  of the goal.
                </div>
              )
            ) : (
              remaining > 0 && (
                <div className="border rounded p-3 mb-3 bg-light">
                  {estimate ? (
                    <div className="mb-2">
                      <i className="bi bi-hourglass-split me-1 text-primary"></i>
                      At{" "}
                      <strong>
                        {formContribution.toFixed(2)} € / {periodLabel}
                      </strong>
                      , you reach {remaining === formTarget ? "" : "the remaining "}
                      <strong>{remaining.toFixed(2)} €</strong> in{" "}
                      <strong>{formatDuration(estimate.months)}</strong> (
                      {estimate.periods} deposit{estimate.periods > 1 ? "s" : ""})
                      {finishDate && <> — around {formatMonthYear(finishDate)}</>}.
                    </div>
                  ) : (
                    <div className="mb-2 text-muted">
                      <i className="bi bi-hourglass-split me-1"></i>
                      Enter an amount per {periodLabel} to see how long it takes.
                    </div>
                  )}

                  <div className="small text-muted mb-1">Or pick a deadline:</div>
                  <div className="d-flex flex-wrap gap-2">
                    {TARGET_DURATIONS.map((d) => {
                      const amount = suggestContribution(remaining, frequency, d.months);
                      if (amount == null) return null;
                      const isSelected =
                        estimate != null && Math.abs(formContribution - amount) < 0.005;
                      return (
                        <button
                          key={d.months}
                          type="button"
                          className={`btn btn-sm ${isSelected ? "btn-primary" : "btn-outline-primary"}`}
                          onClick={() => setContributionAmount(amount.toFixed(2))}
                        >
                          {d.label} · {amount.toFixed(2)} € / {periodLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )
            )}

            <div className="mb-3">
              <label className="form-label d-block">Frequency</label>
              <div className="d-flex flex-wrap gap-2">
                {FREQUENCIES.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    className={`btn btn-sm ${frequency === f.value ? "btn-primary" : "btn-outline-secondary"}`}
                    onClick={() => setFrequency(f.value)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-6">
                <label className="form-label">Start date</label>
                <input
                  type="date"
                  name="startDate"
                  className="form-control"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="col-6">
                <label className="form-label">End date (optional)</label>
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
                <label className="form-label">Day of month</label>
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
                <label className="form-label d-block">Status</label>
                <div className="form-check form-switch mt-1">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="statusSwitch"
                    checked={status === "active"}
                    onChange={(e) => setStatus(e.target.checked ? "active" : "inactive")}
                    style={{ width: "2.5em", height: "1.25em", cursor: "pointer" }}
                  />
                  <label
                    className={`form-check-label fw-semibold ms-2 ${status === "active" ? "text-success" : "text-secondary"}`}
                    htmlFor="statusSwitch"
                  >
                    {status === "active" ? "Active" : "Inactive"}
                  </label>
                </div>
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
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1"></span>
                    Saving…
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-lg me-1"></i>Save
                  </>
                )}
              </button>
              <Link href="/savings" className="btn btn-outline-secondary">
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
