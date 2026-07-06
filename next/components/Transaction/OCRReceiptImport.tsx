"use client";
import React, { useState, useRef } from "react";
import { loadTesseract, OCR_CONFIG, preprocessReceiptImage, extractAmountFromOCRText, extractDateFromOCRText, extractShopFromOCRText } from "@/lib/tesseract-ocr";

interface OCRReceiptImportProps {
  year: number;
  month: number;
  onClose: () => void;
  onSuccess: (amount: number, label?: string) => void;
  show?: boolean;
}

export default function OCRReceiptImport({
  year,
  month,
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
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"upload" | "processing" | "result" | "error">("upload");
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [useSelection, setUseSelection] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Ne rien afficher si le modal ne doit pas être visible
  if (!show) return null;

  // Fonction pour extraire les données du texte OCR
  const extractDataFromText = (text: string) => {
    const amount = extractAmountFromOCRText(text);
    const date = extractDateFromOCRText(text);
    const label = extractShopFromOCRText(text);
    return { amount, label: label || "Ticket de caisse", date };
  };

  const handleImageUpload = async (file: File, rect?: { left: number; top: number; width: number; height: number }) => {
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
      // Si une zone de sélection est fournie, on garde le fichier original :
      // le rect est calculé par rapport aux dimensions natives d'origine.
      const imageToRecognize: File | Blob = rect ? file : await preprocessReceiptImage(file);

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

      const recognizeOptions: any = rect ? { rect } : {};
      const { data: { text } } = await worker.recognize(imageToRecognize, recognizeOptions);
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

  // Gestionnaires pour la sélection de zone
  const startSelection = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!useSelection) return;
    const rect = imageRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setSelectionStart({ x, y });
    setIsSelecting(true);
    setSelectionRect(null);
  };

  const updateSelection = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!isSelecting || !selectionStart) return;
    const rect = imageRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const width = x - selectionStart.x;
    const height = y - selectionStart.y;
    
    // Assurer des dimensions positives
    const normalizedRect = {
      x: width >= 0 ? selectionStart.x : x,
      y: height >= 0 ? selectionStart.y : y,
      width: Math.abs(width),
      height: Math.abs(height),
    };
    
    setSelectionRect(normalizedRect);
  };

  const endSelection = () => {
    if (!isSelecting) return;
    setIsSelecting(false);
    setSelectionStart(null);
  };

  const clearSelection = () => {
    setSelectionRect(null);
    setUseSelection(false);
  };

  const toggleSelectionMode = () => {
    setUseSelection(!useSelection);
    if (useSelection) {
      setSelectionRect(null);
      setSelectionStart(null);
    }
  };

  const applySelection = async () => {
    if (!selectionRect || !originalFile) return;
    
    // Réinitialiser pour relancer l'OCR avec la zone sélectionnée
    setIsProcessing(true);
    setStep("processing");
    setOcrText("");
    setExtractedAmount(null);
    setExtractedLabel("");
    setExtractedDate("");
    
    try {
      // Calculer les coordonnées relatives pour Tesseract
      // Tesseract utilise des coordonnées en pixels par rapport à l'image originale
      const imgElement = imageRef.current;
      if (!imgElement) throw new Error("Image non chargée");
      
      const naturalWidth = imgElement.naturalWidth;
      const naturalHeight = imgElement.naturalHeight;
      const displayWidth = imgElement.width;
      const displayHeight = imgElement.height;
      
      // Calculer le ratio entre affichage et taille naturelle
      const widthRatio = naturalWidth / displayWidth;
      const heightRatio = naturalHeight / displayHeight;
      
      const rectForOCR = {
        left: selectionRect.x * widthRatio,
        top: selectionRect.y * heightRatio,
        width: selectionRect.width * widthRatio,
        height: selectionRect.height * heightRatio,
      };
      
      await handleImageUpload(originalFile, rectForOCR);
      
    } catch (err) {
      console.error("Error applying selection:", err);
      setIsProcessing(false);
      setStep("result");
    }
  };

  const handleSubmit = () => {
    if (extractedAmount !== null) {
      onSuccess(extractedAmount, extractedLabel);
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
    setError(null);
    setSelectionRect(null);
    setUseSelection(false);
    setSelectionStart(null);
    setIsSelecting(false);
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
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="mb-0">Aperçu de l&apos;image</h6>
                    <div className="d-flex gap-2">
                      <button
                        className={`btn btn-sm ${useSelection ? 'btn-success' : 'btn-outline-secondary'}`}
                        onClick={toggleSelectionMode}
                        disabled={isProcessing}
                        title={useSelection ? "Désactiver la sélection de zone" : "Sélectionner une zone pour l'OCR"}
                      >
                        <i className={`bi ${useSelection ? 'bi-bounding-box-circles' : 'bi-upc-scan'}`}></i>
                        {useSelection ? ' Zone' : ' Zone OCR'}
                      </button>
                      {useSelection && selectionRect && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={applySelection}
                          disabled={isProcessing}
                        >
                          <i className="bi bi-check-lg"></i> Appliquer
                        </button>
                      )}
                      {useSelection && !selectionRect && (
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={toggleSelectionMode}
                        >
                          <i className="bi bi-x-lg"></i>
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img
                      src={image}
                      alt="Receipt preview"
                      style={{ ...styles.previewImage, cursor: useSelection ? 'crosshair' : 'default' }}
                      ref={imageRef}
                      onMouseDown={startSelection}
                      onMouseMove={updateSelection}
                      onMouseUp={endSelection}
                      onMouseLeave={endSelection}
                    />
                    {useSelection && selectionRect && (
                      <div
                        style={{
                          position: 'absolute',
                          left: `${selectionRect.x}px`,
                          top: `${selectionRect.y}px`,
                          width: `${selectionRect.width}px`,
                          height: `${selectionRect.height}px`,
                          border: '2px solid #0d6efd',
                          backgroundColor: 'rgba(13, 110, 253, 0.1)',
                          pointerEvents: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    )}
                    {useSelection && isSelecting && selectionStart && !selectionRect && (
                      <div
                        style={{
                          position: 'absolute',
                          left: `${selectionStart.x}px`,
                          top: `${selectionStart.y}px`,
                          width: '0px',
                          height: '0px',
                          border: '2px dashed #0d6efd',
                          pointerEvents: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    )}
                  </div>
                  {useSelection && (
                    <p className="text-muted small mt-2">
                      Cliquez et faites glisser pour sélectionner la zone à analyser, puis cliquez sur "Appliquer"
                    </p>
                  )}
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
              </div>

              <div style={styles.extractedText}>
                <h6 className="mb-2 text-muted">Texte extrait</h6>
                <div>{ocrText}</div>
              </div>

              <div className="d-flex gap-2 mt-4">
                <button
                  className="btn btn-primary flex-grow-1"
                  onClick={handleSubmit}
                  disabled={extractedAmount === null || isProcessing}
                >
                  <i className="bi bi-check-lg me-1"></i>
                  Ajouter {extractedAmount !== null ? `${extractedAmount.toFixed(2)} €` : ""} au budget
                </button>
                {useSelection && selectionRect && (
                  <button
                    className="btn btn-outline-warning"
                    onClick={clearSelection}
                    disabled={isProcessing}
                  >
                    <i className="bi bi-x-circle me-1"></i>Effacer zone
                  </button>
                )}
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
