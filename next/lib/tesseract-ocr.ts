import { createWorker } from "tesseract.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ReceiptOcrResult {
  total: number | null;
  rawText: string;
  strategy: "total-context" | "frequency-voting" | "generic-pattern" | "none";
}

// ─── Prétraitement de l'image (canvas) ─────────────────────────────────────
// Convertit en niveaux de gris + augmente le contraste pour améliorer la
// reconnaissance sur des tickets de caisse souvent flous ou peu contrastés.

async function preprocessImage(file: File): Promise<HTMLCanvasElement> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Impossible de charger l'image."));
    image.src = URL.createObjectURL(file);
  });

  // Limite la taille pour rester performant tout en gardant une résolution
  // suffisante pour l'OCR.
  const maxDim = 1800;
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Contexte canvas indisponible.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const contrast = 1.35;

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const adjusted = Math.min(
      255,
      Math.max(0, (gray - 128) * contrast + 128),
    );
    data[i] = data[i + 1] = data[i + 2] = adjusted;
  }

  ctx.putImageData(imageData, 0, 0);
  URL.revokeObjectURL(img.src);
  return canvas;
}

// ─── Extraction du montant total (stratégie à 3 niveaux) ───────────────────

const AMOUNT_RE = /(\d{1,4}[.,]\d{2})\b/g;

function toNumber(match: string): number {
  return parseFloat(match.replace(",", "."));
}

// Niveau 1 : recherche des lignes contenant "TOTAL" (ou variantes) et
// extraction du montant le plus proche sur cette ligne / la suivante.
function tryTotalContext(lines: string[]): number | null {
  const totalLineRe = /total(?!isé)|à\s*payer|net\s*[aà]\s*payer|montant/i;
  for (let i = 0; i < lines.length; i++) {
    if (totalLineRe.test(lines[i])) {
      const candidates = [lines[i], lines[i + 1] ?? ""].join(" ");
      const found = [...candidates.matchAll(AMOUNT_RE)].map((m) =>
        toNumber(m[1]),
      );
      if (found.length) {
        // Le plus grand montant sur la ligne "total" est généralement le bon
        // (évite de prendre un sous-total ou une quantité).
        return Math.max(...found);
      }
    }
  }
  return null;
}

// Niveau 2 : vote de fréquence — le montant qui apparaît le plus souvent
// dans le texte (hors lignes clairement identifiées comme sous-totaux/TVA)
// est souvent le total, car il est répété (ligne détail + ligne total).
function tryFrequencyVoting(text: string): number | null {
  const all = [...text.matchAll(AMOUNT_RE)].map((m) => toNumber(m[1]));
  if (!all.length) return null;

  const counts = new Map<number, number>();
  all.forEach((n) => counts.set(n, (counts.get(n) ?? 0) + 1));

  const sorted = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]; // fréquence décroissante
    return b[0] - a[0]; // puis montant décroissant
  });

  return sorted[0]?.[0] ?? null;
}

// Niveau 3 : repli générique — on prend le plus grand montant plausible
// trouvé dans tout le texte (le total est presque toujours le plus élevé
// sur un ticket de caisse simple).
function tryGenericPattern(text: string): number | null {
  const all = [...text.matchAll(AMOUNT_RE)].map((m) => toNumber(m[1]));
  if (!all.length) return null;
  return Math.max(...all);
}

export function extractTotalFromText(rawText: string): {
  total: number | null;
  strategy: ReceiptOcrResult["strategy"];
} {
  const lines = rawText.split(/\r?\n/).filter((l) => l.trim().length > 0);

  const contextResult = tryTotalContext(lines);
  if (contextResult !== null) {
    return { total: contextResult, strategy: "total-context" };
  }

  const votedResult = tryFrequencyVoting(rawText);
  if (votedResult !== null) {
    return { total: votedResult, strategy: "frequency-voting" };
  }

  const genericResult = tryGenericPattern(rawText);
  if (genericResult !== null) {
    return { total: genericResult, strategy: "generic-pattern" };
  }

  return { total: null, strategy: "none" };
}

// ─── Point d'entrée principal ───────────────────────────────────────────────

export async function extractTotalFromReceipt(
  file: File,
): Promise<ReceiptOcrResult> {
  const canvas = await preprocessImage(file);

  const worker = await createWorker("fra");
  try {
    const {
      data: { text },
    } = await worker.recognize(canvas);
    const { total, strategy } = extractTotalFromText(text);
    return { total, rawText: text, strategy };
  } finally {
    await worker.terminate();
  }
}
