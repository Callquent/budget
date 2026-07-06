"use client";
import React, { useState, useRef } from "react";
import { loadTesseract, OCR_CONFIG, preprocessReceiptImage, extractAmountFromOCRText, extractDateFromOCRText, extractShopFromOCRText } from "@/lib/tesseract-ocr";

interface OCRCategoryOption {
  id: number;
  name: string;
}

interface OCRAccountOption {
  id: number;
  name: string;
}

interface OCRReceiptImportProps {
  year: number;
  month: number;
  categories: OCRCategoryOption[];
  accounts: OCRAccountOption[];
  onClose: () => void;
  onSuccess: (
    amount: number,
    categoryId: number,
    accountId: number,
    label?: string,
  ) => void;
  show?: boolean;
}

export default function OCRReceiptImport({
  year,
  month,
  categories,
  accounts,
  onClose,
  onSuccess,
  show = true,
}: OCRReceiptImportProps) {
  const [image, setImage] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrText, setOcrText] = useState<string>("");
  const [extractedAmount, setExtractedAmount] = useState<number | null>(null);
  const [extractedLabel, setExtractedLabel] = useState<string>("");
  const [extractedDate, setExtractedDate] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | "">(
    categories.length === 1 ? categories[0].id : ""
  );
  const [selectedAccountId, setSelectedAccountId] = useState<number | "">(
    accounts.length === 1 ? accounts[0].id : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"upload" | "processing" | "result" | "error">("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ne rien afficher si le modal ne doit pas être visible
  if (!show) return null;

  // Fonction pour extraire les données du texte OCR
  const extractDataFromText = (text: string) => {
    const amount = extractAmountFromOCRText(text);
    const date = extractDateFromOCRText(text);
    const label = extractShopFromOCRText(text);
    return { amount, label: label || "Ticket de caisse", date };
  };

  const handleImageUpload = async (file: File) => {
    setError(null);
    setIsProcessing(true);
    setStep("processing");
    setOriginalFile(file);

    try {
      // Vérifier la taille du fichier
      if (file.size > 5 * 1024 * 1024) { // 5MB
        throw new Error("Le fichier est trop grand (max 5MB). Veuillez redimensionner l'image.");
      }

      // Lire l'image comme base64 pour affichage
      const reader = new FileReader();
      reader.onload = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Utiliser Tesseract.js pour extraire le texte
      const Tesseract = await loadTesseract();

      // Prétraiter l'image (niveaux de gris + étirement de contraste) pour
      // aider Tesseract à mieux distinguer les chiffres sur une photo de
      // ticket (reflets, éclairage inégal, papier froissé, etc.)
      const imageToRecognize: Blob = await preprocessReceiptImage(file);

      // Utiliser un worker configuré (PSM + whitelist + OEM) plutôt que
      // Tesseract.recognize() seul, qui ignorait jusqu'ici ces paramètres.
      const worker = await Tesseract.createWorker(OCR_CONFIG.lang, OCR_CONFIG.oem, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") {
            console.log(`OCR progress: ${Math.round(m.progress * 100)}%`);
          }
        },
      });

      await worker.setParameters({
        tessedit_pageseg_mode: OCR_CONFIG.tessedit_pageseg_mode,
        tessedit_char_whitelist: OCR_CONFIG.tessedit_char_whitelist,
      });

      const { data: { text } } = await worker.recognize(imageToRecognize);
      await worker.terminate();

      // Vérifier si du texte a été extrait
      if (!text || text.trim().length === 0) {
        throw new Error("Aucun texte détecté dans l'image. Essayez avec une image plus nette ou mieux éclairée.");
      }

      setOcrText(text);
      setStep("result");

      // Extraire le montant et autres informations
      const result = extractDataFromText(text);
      setExtractedAmount(result.amount);
      setExtractedLabel(result.label || "Ticket de caisse");
      setExtractedDate(result.date || "");

      setIsProcessing(false);

    } catch (err) {
      console.error("OCR Error:", err);
      const errorMessage = err instanceof Error ? err.message : "Erreur inconnue lors de la reconnaissance.";
      setError(errorMessage);
      setStep("error");
      setIsProcessing(false);
    }
  };

  const handleSubmit = () => {
    if (
      extractedAmount !== null &&
      selectedCategoryId !== "" &&
      selectedAccountId !== ""
    ) {
      onSuccess(extractedAmount, selectedCategoryId, selectedAccountId, extractedLabel);
      onClose();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleImageUpload(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageUpload(e.dataTransfer.files[0]);
    }
  };

  const retry = () => {
    setStep("upload");
    setImage(null);
    setOriginalFile(null);
    setOcrText("");
    setExtractedAmount(null);
    setExtractedLabel("");
    setExtractedDate("");
    setSelectedCategoryId(categories.length === 1 ? categories[0].id : "");
    setSelectedAccountId(accounts.length === 1 ? accounts[0].id : "");
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Styles
  const styles = {
    modalOverlay: {
      position: "fixed" as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      display: "flex" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      zIndex: 1050,
    },
    modal: {
      backgroundColor: "white",
      borderRadius: "12px",
      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
      maxWidth: "600px",
      width: "90%",
      maxHeight: "90vh",
      overflowY: "auto" as const,
    },
    uploadZone: {
      border: "2px dashed #dee2e6",
      borderRadius: "8px",
      padding: "40px",
      textAlign: "center" as const,
      cursor: "pointer",
      transition: "all 0.3s",
      backgroundColor: "#f8f9fa",
    },
    uploadZoneActive: {
      borderColor: "#0d6efd",
      backgroundColor: "#e7f1ff",
    },
    previewImage: {
      maxWidth: "100%",
      maxHeight: "300px",
      objectFit: "contain" as const,
      borderRadius: "8px",
      marginBottom: "20px",
    },
    resultCard: {
      backgroundColor: "#f8f9fa",
      borderRadius: "8px",
      padding: "20px",
      marginBottom: "20px",
    },
    extractedText: {
      backgroundColor: "#e9ecef",
      padding: "15px",
      borderRadius: "8px",
      maxHeight: "200px",
      overflowY: "auto" as const,
      fontFamily: "monospace",
      fontSize: "12px",
      whiteSpace: "pre-wrap" as const,
      wordBreak: "break-word" as const,
    },
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className="p-4">
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2 className="h5 mb-0">
              <i className="bi bi-receipt me-2"></i>
              Importer un ticket de caisse
            </h2>
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={onClose}
            >
              <i className="bi bi-x-lg"></i>
            </button>
          </div>

          {step === "upload" && (
            <>
              <p className="text-muted mb-4">
                Importez une photo de votre ticket de caisse pour extraire 
                automatiquement le montant total.
              </p>

              <div
                style={styles.uploadZone}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  capture="environment"
                  style={{ display: "none" }}
                />
                <div className="mb-3">
                  <i
                    className="bi bi-upload text-primary"
                    style={{ fontSize: "3rem" }}
                  ></i>
                </div>
                <p className="mb-2 fw-semibold">
                  Glissez-déposez une image ici ou cliquez pour sélectionner
                </p>
                <p className="text-muted small mb-0">
                  Formats supportés: JPG, PNG, WEBP
                </p>
              </div>

              <div className="text-center mt-4">
                <button
                  className="btn btn-outline-secondary"
                  onClick={onClose}
                >
                  Annuler
                </button>
              </div>
            </>
          )}

          {step === "processing" && (
            <div className="text-center py-5">
              <div
                className="spinner-border text-primary"
                style={{ width: "3rem", height: "3rem" }}
                role="status"
              >
                <span className="visually-hidden">Traitement...</span>
              </div>
              <p className="mt-3 text-muted">
                Analyse du ticket en cours...
              </p>
              <p className="text-muted small">
                Cela peut prendre quelques secondes selon la taille de l&apos;image.
              </p>
            </div>
          )}

          {step === "result" && (
            <>
              {image && (
                <div className="mb-4">
                  <h6 className="mb-2">Aperçu de l&apos;image</h6>
                  <img
                    src={image}
                    alt="Receipt preview"
                    style={styles.previewImage}
                  />
                </div>
              )}

              <div style={styles.resultCard}>
                <h6 className="mb-3">
                  <i className="bi bi-check-circle text-success me-2"></i>
                  Résultats extraits
                </h6>

                {extractedAmount !== null ? (
                  <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="text-muted">Montant total</span>
                      <span
                        className="h4 mb-0"
                        style={{ color: "#0d6efd" }}
                      >
                        {extractedAmount.toFixed(2)} €
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="alert alert-warning mb-3">
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    Aucun montant détecté. Vérifiez que le total est visible sur l&apos;image.
                  </div>
                )}

                {extractedLabel && (
                  <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="text-muted">Magasin</span>
                      <span className="fw-medium">{extractedLabel}</span>
                    </div>
                  </div>
                )}

                {extractedDate && (
                  <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="text-muted">Date</span>
                      <span className="fw-medium">{extractedDate}</span>
                    </div>
                  </div>
                )}

                <div className="mb-1">
                  <label className="form-label text-muted mb-1">
                    Catégorie <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select"
                    value={selectedCategoryId}
                    onChange={(e) =>
                      setSelectedCategoryId(
                        e.target.value ? Number(e.target.value) : ""
                      )
                    }
                  >
                    <option value="">Choisir une catégorie…</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-1 mt-3">
                  <label className="form-label text-muted mb-1">
                    Compte <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select"
                    value={selectedAccountId}
                    onChange={(e) =>
                      setSelectedAccountId(
                        e.target.value ? Number(e.target.value) : ""
                      )
                    }
                  >
                    <option value="">Choisir un compte…</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.extractedText}>
                <h6 className="mb-2 text-muted">Texte extrait</h6>
                <div>{ocrText}</div>
              </div>

              <div className="d-flex gap-2 mt-4">
                <button
                  className="btn btn-primary flex-grow-1"
                  onClick={handleSubmit}
                  disabled={
                    extractedAmount === null ||
                    isProcessing ||
                    selectedCategoryId === "" ||
                    selectedAccountId === ""
                  }
                >
                  <i className="bi bi-check-lg me-1"></i>
                  Ajouter {extractedAmount !== null ? `${extractedAmount.toFixed(2)} €` : ""} au budget
                </button>
                <button
                  className="btn btn-outline-secondary"
                  onClick={retry}
                >
                  <i className="bi bi-arrow-clockwise me-1"></i>Réessayer
                </button>
              </div>
            </>
          )}

          {step === "error" && (
            <div className="text-center py-4">
              <div
                className="text-danger mb-3"
                style={{ fontSize: "3rem" }}
              >
                <i className="bi bi-exclamation-triangle-fill"></i>
              </div>
              <h5 className="mb-2">Erreur de reconnaissance</h5>
              <p className="text-muted mb-4">
                {error}
                {error?.includes("Tesseract") && (
                  <>
                    <br />
                    <small>
                      Astuce: La bibliothèque OCR (Tesseract.js) est en cours de chargement. 
                      Cela peut prendre quelques secondes à la première utilisation.
                    </small>
                  </>
                )}
              </p>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-primary flex-grow-1"
                  onClick={retry}
                >
                  <i className="bi bi-arrow-clockwise me-1"></i>Réessayer
                </button>
                <button
                  className="btn btn-outline-secondary"
                  onClick={onClose}
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
