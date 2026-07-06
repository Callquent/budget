"use client";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    Tesseract: any;
  }
}

interface TesseractLoaderProps {
  children: React.ReactNode;
}

export default function TesseractLoader({ children }: TesseractLoaderProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.Tesseract) {
      setIsLoaded(true);
      return;
    }

    const loadTesseract = async () => {
      if (isLoaded || isLoading) return;
      
      setIsLoading(true);
      setError(null);

      try {
        // Charger le script principal de Tesseract.js
        await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.browser.min.js');
        
        // Vérifier que Tesseract est disponible
        if (!window.Tesseract) {
          throw new Error('Tesseract.js not loaded');
        }
        
        setIsLoaded(true);
      } catch (err) {
        console.error('Failed to load Tesseract.js:', err);
        setError('Impossible de charger la bibliothèque OCR');
      } finally {
        setIsLoading(false);
      }
    };

    // Charger Tesseract.js quand le composant est monté
    loadTesseract();
  }, []);

  // Fonction utilitaire pour charger un script
  const loadScript = (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
      document.body.appendChild(script);
    });
  };

  if (isLoading) {
    return (
      <div className="text-center py-4">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Chargement de l'OCR...</span>
        </div>
        <p className="mt-2 text-muted small">Chargement de la bibliothèque OCR...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger">
        <i className="bi bi-exclamation-triangle-fill me-2"></i>
        {error}
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="alert alert-warning">
        <i className="bi bi-exclamation-triangle-fill me-2"></i>
        La bibliothèque OCR n'est pas chargée.
      </div>
    );
  }

  return <>{children}</>;
}

// ============================================================================
// Prétraitement d'image côté navigateur
// ============================================================================
// Un seuillage global "tout ou rien" (noir/blanc dur) a été testé et donne
// d'excellents résultats sur les lignes en gras (ex: "TOTAL 1.71€") mais
// détruit complètement le texte fin du reste du ticket. On applique donc
// uniquement un passage en niveaux de gris + un étirement de contraste
// (équivalent à un "auto-contraste"), qui aide l'algorithme de binarisation
// interne de Tesseract sans supprimer d'information utile.
export async function preprocessReceiptImage(file: File): Promise<Blob> {
  const img = await loadImageFromFile(file);

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Impossible d'initialiser le canvas de prétraitement");

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // 1. Conversion en niveaux de gris (luminance perceptuelle)
  const gray = new Uint8ClampedArray(data.length / 4);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  // 2. Étirement de contraste basé sur les percentiles 1% / 99%
  //    (ignore les valeurs extrêmes isolées : reflets, ombres profondes)
  const histogram = new Array(256).fill(0);
  for (let j = 0; j < gray.length; j++) histogram[gray[j]]++;

  const totalPixels = gray.length;
  const lowCutoff = totalPixels * 0.01;
  const highCutoff = totalPixels * 0.99;

  let cumulative = 0;
  let low = 0;
  for (let v = 0; v < 256; v++) {
    cumulative += histogram[v];
    if (cumulative >= lowCutoff) { low = v; break; }
  }

  cumulative = 0;
  let high = 255;
  for (let v = 255; v >= 0; v--) {
    cumulative += histogram[v];
    if (cumulative >= totalPixels - highCutoff) { high = v; break; }
  }

  const range = Math.max(high - low, 1);

  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const stretched = Math.min(255, Math.max(0, ((gray[j] - low) * 255) / range));
    data[i] = data[i + 1] = data[i + 2] = stretched;
  }

  ctx.putImageData(imageData, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Échec de génération de l\'image prétraitée'))),
      'image/png',
      1
    );
  });
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossible de charger l'image pour le prétraitement"));
    };
    img.src = url;
  });
}

// Fonction pour obtenir Tesseract
export async function getTesseract(): Promise<any> {
  if (typeof window !== "undefined" && window.Tesseract) {
    return window.Tesseract;
  }

  // Attendre que Tesseract soit chargé
  await new Promise<void>((resolve, reject) => {
    const checkInterval = setInterval(() => {
      if (window.Tesseract) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 100);

    // Timeout après 10 secondes
    setTimeout(() => {
      clearInterval(checkInterval);
      reject(new Error('Tesseract.js loading timeout'));
    }, 10000);
  });

  return window.Tesseract;
}
