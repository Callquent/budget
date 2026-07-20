"use client";
import React, { useEffect, useRef, useState } from "react";
import type { AccountInterface } from "../Account/Account.interface";
import type { CategoryInterface } from "../Category/Category.interface";
import CategoryPicker from "../Category/CategoryPicker";
import AccountPicker from "../Account/AccountPicker";
import {
  extractTotalFromReceipt,
  extractTotalFromCanvas,
  captureCanvasFromVideo,
} from "../../lib/tesseract-ocr";

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
  const [debugText, setDebugText] = useState<string>("");
  const [debugStrategy, setDebugStrategy] = useState<string>("");
  const [isPdf, setIsPdf] = useState(false);
  const [fileName, setFileName] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [captureSource, setCaptureSource] = useState<"file" | "camera">(
    "file",
  );

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  const startCamera = async () => {
    setError(null);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      setStep("idle");
      // Le <video> n'est monté qu'une fois cameraActive=true ; on attend le
      // prochain rendu pour lui attacher le flux.
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch (err) {
      setCameraError(
        "Impossible d'accéder à la caméra. Vérifiez les autorisations du navigateur.",
      );
    }
  };

  const handleCapture = async () => {
    if (!videoRef.current) return;
    const canvas = captureCanvasFromVideo(videoRef.current);
    stopCamera();

    setPreviewUrl(canvas.toDataURL("image/jpeg", 0.85));
    setIsPdf(false);
    setCaptureSource("camera");
    setFileName("Photo (caméra)");
    setStep("analyzing");

    try {
      const result = await extractTotalFromCanvas(canvas);
      setDebugText(result.rawText);
      setDebugStrategy(result.strategy);
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
          : "Erreur lors de l'analyse de la photo.",
      );
      setStep("review");
    }
  };

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
      stopCamera();
      setCameraError(null);
      setStep("idle");
      setPreviewUrl(null);
      setError(null);
      setTotal("");
      setCategoryId("");
      setAccountId("");
      setLabel("Ticket de caisse");
      setDebugText("");
      setDebugStrategy("");
      setIsPdf(false);
      setFileName("");
    }
    // Coupe aussi la caméra si le composant se démonte pendant qu'elle tourne.
    return () => stopCamera();
  }, [show]);

  if (!show) return null;

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const filePdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    setError(null);
    setIsPdf(filePdf);
    setCaptureSource("file");
    setFileName(file.name);
    setPreviewUrl(filePdf ? null : URL.createObjectURL(file));
    setStep("analyzing");

    try {
      const result = await extractTotalFromReceipt(file);
      setDebugText(result.rawText);
      setDebugStrategy(result.strategy);
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
          : "Erreur lors de l'analyse du fichier.",
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

          {step === "idle" && !cameraActive && (
            <>
              <div
                style={{
                  border: "2px dashed #ced4da",
                  borderRadius: "12px",
                  textAlign: "center",
                  padding: "2rem 1rem",
                  cursor: "pointer",
                  color: "#6c757d",
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <i
                  className="bi bi-upload d-block mb-2"
                  style={{ fontSize: "2rem" }}
                ></i>
                <span>Importer une photo du ticket, ou un PDF</span>
              </div>

              <div className="d-flex align-items-center gap-2 my-3 text-muted small">
                <hr className="flex-grow-1" />
                ou
                <hr className="flex-grow-1" />
              </div>

              <button
                type="button"
                className="btn btn-outline-success w-100"
                onClick={startCamera}
              >
                <i className="bi bi-camera-fill me-2"></i>
                Utiliser la caméra en direct
              </button>

              {cameraError && (
                <div className="alert alert-warning py-2 small mt-3 mb-0">
                  {cameraError}
                </div>
              )}
            </>
          )}

          {step === "idle" && cameraActive && (
            <div>
              <div
                style={{
                  position: "relative",
                  borderRadius: "12px",
                  overflow: "hidden",
                  background: "#000",
                }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: "100%", display: "block" }}
                />
              </div>
              <div className="d-flex gap-2 mt-3">
                <button
                  type="button"
                  className="btn btn-success flex-grow-1"
                  onClick={handleCapture}
                >
                  <i className="bi bi-camera-fill me-2"></i>Capturer
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={stopCamera}
                >
                  Annuler
                </button>
              </div>
              <div className="text-muted small text-center mt-2">
                Cadrez le ticket, en particulier la ligne du total, puis
                capturez.
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf,.pdf"
            capture="environment"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />

          {(previewUrl || (isPdf && fileName)) && step !== "idle" && (
            <div
              style={{
                display: "flex",
                gap: "1rem",
                alignItems: "flex-start",
                marginBottom: "1rem",
              }}
            >
              {isPdf ? (
                <div
                  style={{
                    width: "90px",
                    height: "90px",
                    borderRadius: "8px",
                    border: "1px solid #dee2e6",
                    flexShrink: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#f8f9fa",
                    color: "#6c757d",
                    padding: "0.25rem",
                  }}
                >
                  <i
                    className="bi bi-file-earmark-pdf"
                    style={{ fontSize: "1.75rem", color: "#dc3545" }}
                  ></i>
                  <span
                    className="small text-truncate"
                    style={{ maxWidth: "80px" }}
                  >
                    {fileName}
                  </span>
                </div>
              ) : (
                <img
                  src={previewUrl!}
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
              )}
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
                    onClick={() =>
                      captureSource === "camera"
                        ? startCamera()
                        : fileInputRef.current?.click()
                    }
                    disabled={step === "submitting"}
                  >
                    <i className="bi bi-arrow-repeat me-1"></i>
                    {captureSource === "camera"
                      ? "Reprendre une photo"
                      : "Changer de fichier"}
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

              {debugText && (
                <details className="mt-3">
                  <summary
                    className="text-muted small"
                    style={{ cursor: "pointer" }}
                  >
                    Texte détecté par l'OCR ({debugStrategy})
                  </summary>
                  <pre
                    className="small bg-light p-2 rounded mt-1"
                    style={{
                      whiteSpace: "pre-wrap",
                      maxHeight: "150px",
                      overflowY: "auto",
                    }}
                  >
                    {debugText}
                  </pre>
                </details>
              )}
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
