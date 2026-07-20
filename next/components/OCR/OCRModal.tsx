"use client";
import React, { useEffect, useRef, useState } from "react";
import type { AccountInterface } from "../Account/Account.interface";
import type { CategoryInterface } from "../Category/Category.interface";
import CategoryPicker from "../Category/CategoryPicker";
import AccountPicker from "../Account/AccountPicker";
import { extractTotalFromReceipt } from "../../lib/tesseract-ocr";

const API = process.env.NEXT_PUBLIC_API_URL;

type Step = "idle" | "analyzing" | "review" | "submitting";

interface OCRModalProps {
  show: boolean;
  onClose: () => void;
  onSuccess: (
    amount: number,
    categoryId: number,
    accountId: number,
    label?: string,
  ) => void | Promise<void>;
}

export default function OCRModal({ show, onClose, onSuccess }: OCRModalProps) {
  const [grouped, setGrouped] = useState<Record<string, CategoryInterface[]>>(
    {},
  );
  const [accounts, setAccounts] = useState<AccountInterface[]>([]);
  const [step, setStep] = useState<Step>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [total, setTotal] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [accountId, setAccountId] = useState<string>("");
  const [label, setLabel] = useState<string>("Ticket de caisse");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Charge comptes / catégories à l'ouverture, comme dans BudgetForm.
  useEffect(() => {
    if (!show) return;
    Promise.all([
      fetch(`${API}/categories`).then((r) => r.json()),
      fetch(`${API}/accounts`).then((r) => r.json()),
    ])
      .then(([categoriesData, accountsData]) => {
        setGrouped(categoriesData.grouped ?? {});
        setAccounts(accountsData.accounts ?? []);
      })
      .catch(() =>
        setError("Impossible de charger les comptes et catégories."),
      );
  }, [show]);

  // Réinitialise l'état à chaque fermeture.
  useEffect(() => {
    if (!show) {
      setStep("idle");
      setPreviewUrl(null);
      setError(null);
      setTotal("");
      setCategoryId("");
      setAccountId("");
      setLabel("Ticket de caisse");
    }
  }, [show]);

  if (!show) return null;

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setPreviewUrl(URL.createObjectURL(file));
    setStep("analyzing");

    try {
      const result = await extractTotalFromReceipt(file);
      if (result.total === null) {
        setError(
          "Le montant total n'a pas pu être détecté automatiquement. Vous pouvez le saisir manuellement.",
        );
      }
      setTotal(result.total !== null ? result.total.toFixed(2) : "");
      setStep("review");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erreur lors de l'analyse de l'image.",
      );
      setStep("review");
    }
  };

  const handleConfirm = async () => {
    const amount = parseFloat(total.replace(",", "."));
    if (!amount || amount <= 0) {
      setError("Veuillez indiquer un montant valide.");
      return;
    }
    if (!categoryId) {
      setError("Veuillez sélectionner une catégorie.");
      return;
    }
    if (!accountId) {
      setError("Veuillez sélectionner un compte.");
      return;
    }

    setStep("submitting");
    setError(null);
    try {
      await onSuccess(amount, parseInt(categoryId), parseInt(accountId), label);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erreur lors de l'enregistrement.",
      );
      setStep("review");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,.5)",
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "500px",
          maxHeight: "90vh",
          background: "#fff",
          borderRadius: "12px",
          boxShadow: "0 10px 40px rgba(0,0,0,.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* En-tête */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1rem 1.25rem",
            borderBottom: "1px solid #e9ecef",
            flexShrink: 0,
          }}
        >
          <h5 className="mb-0" style={{ fontWeight: 600 }}>
            <i className="bi bi-receipt me-2 text-success"></i>
            Scanner un ticket de caisse
          </h5>
          <button
            type="button"
            onClick={onClose}
            disabled={step === "submitting"}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.5rem",
              lineHeight: 1,
              color: "#6c757d",
              cursor: step === "submitting" ? "not-allowed" : "pointer",
              padding: 0,
            }}
            aria-label="Fermer"
          >
            &times;
          </button>
        </div>

        {/* Corps (scrollable) */}
        <div
          style={{
            padding: "1.25rem",
            overflowY: "auto",
            flexGrow: 1,
          }}
        >
          {error && (
            <div className="alert alert-warning py-2 small mb-3">{error}</div>
          )}

          {step === "idle" && (
            <div
              style={{
                border: "2px dashed #ced4da",
                borderRadius: "12px",
                textAlign: "center",
                padding: "3rem 1rem",
                cursor: "pointer",
                color: "#6c757d",
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <i
                className="bi bi-camera d-block mb-2"
                style={{ fontSize: "2.5rem" }}
              ></i>
              <span>Cliquez pour importer une photo du ticket</span>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />

          {previewUrl && step !== "idle" && (
            <div
              style={{
                display: "flex",
                gap: "1rem",
                alignItems: "flex-start",
                marginBottom: "1rem",
              }}
            >
              <img
                src={previewUrl}
                alt="Aperçu du ticket"
                style={{
                  width: "90px",
                  height: "90px",
                  objectFit: "cover",
                  borderRadius: "8px",
                  border: "1px solid #dee2e6",
                  flexShrink: 0,
                }}
              />
              <div style={{ flexGrow: 1 }}>
                {step === "analyzing" && (
                  <div
                    className="text-muted"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: ".5rem",
                    }}
                  >
                    <span className="spinner-border spinner-border-sm"></span>
                    Analyse du ticket en cours…
                  </div>
                )}
                {(step === "review" || step === "submitting") && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={step === "submitting"}
                  >
                    <i className="bi bi-arrow-repeat me-1"></i>Changer de photo
                  </button>
                )}
              </div>
            </div>
          )}

          {(step === "review" || step === "submitting") && (
            <>
              <div className="mb-3">
                <label className="form-label">Montant total détecté</label>
                <div className="input-group">
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={total}
                    onChange={(e) => setTotal(e.target.value)}
                    disabled={step === "submitting"}
                  />
                  <span className="input-group-text">€</span>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">Libellé</label>
                <input
                  type="text"
                  className="form-control"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  disabled={step === "submitting"}
                />
              </div>

              <div className="mb-3">
                <label className="form-label d-block">Compte</label>
                <AccountPicker
                  accounts={accounts}
                  value={accountId}
                  onChange={setAccountId}
                  disabled={step === "submitting"}
                />
              </div>

              <div className="mb-1">
                <label className="form-label d-block">Catégorie</label>
                <CategoryPicker
                  grouped={grouped}
                  value={categoryId}
                  onChange={setCategoryId}
                  disabled={step === "submitting"}
                />
              </div>
            </>
          )}
        </div>

        {/* Pied de page */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: ".5rem",
            padding: "1rem 1.25rem",
            borderTop: "1px solid #e9ecef",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={onClose}
            disabled={step === "submitting"}
          >
            Annuler
          </button>
          {(step === "review" || step === "submitting") && (
            <button
              type="button"
              className="btn btn-success"
              onClick={handleConfirm}
              disabled={step === "submitting"}
            >
              {step === "submitting" ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1"></span>
                  Enregistrement…
                </>
              ) : (
                <>
                  <i className="bi bi-check-lg me-1"></i>Ajouter au budget
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
