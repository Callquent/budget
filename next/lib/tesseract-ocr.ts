import { createWorker } from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ReceiptOcrResult {
  total: number | null;
  rawText: string;
  strategy: "total-context" | "frequency-voting" | "generic-pattern" | "none";
}

// ─── Prétraitement de l'image (canvas) ─────────────────────────────────────
// Convertit en niveaux de gris + augmente le contraste pour améliorer la
// reconnaissance sur des tickets de caisse souvent flous ou peu contrastés.
// Extrait en fonctions réutilisables pour être appliqué aussi bien à un
// fichier importé qu'à une frame capturée en direct depuis la caméra.

// Limite la taille pour rester performant tout en gardant une résolution
// suffisante pour l'OCR.
const MAX_DIM = 1800;

function drawScaled(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): HTMLCanvasElement {
  const scale = Math.min(1, MAX_DIM / Math.max(sourceWidth, sourceHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sourceWidth * scale);
  canvas.height = Math.round(sourceHeight * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Contexte canvas indisponible.");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function applyGrayscaleContrast(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Contexte canvas indisponible.");

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
}

async function preprocessImage(file: File): Promise<HTMLCanvasElement> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Impossible de charger l'image."));
    image.src = URL.createObjectURL(file);
  });

  const canvas = drawScaled(img, img.width, img.height);
  applyGrayscaleContrast(canvas);
  URL.revokeObjectURL(img.src);
  return canvas;
}

// Capture une frame de la vidéo en cours (caméra en direct) sous forme de
// canvas prétraité, prêt pour l'OCR — même pipeline que pour un fichier.
export function captureCanvasFromVideo(
  video: HTMLVideoElement,
): HTMLCanvasElement {
  const canvas = drawScaled(video, video.videoWidth, video.videoHeight);
  applyGrayscaleContrast(canvas);
  return canvas;
}

// ─── Extraction du montant total (stratégie à 3 niveaux) ───────────────────

const AMOUNT_RE = /(\d{1,4}[.,]\d{2})\b/g;

function toNumber(match: string): number {
  return parseFloat(match.replace(",", "."));
}

// Mots-clés identifiant une ligne "total / paiement" plutôt qu'une ligne
// produit. On ne cherche des montants que sur ces lignes-là (+ la ligne
// suivante), ce qui élimine structurellement les prix au kg ("2.49 €/kg",
// "1.99 €/kg"...) du calcul : ils n'apparaissent jamais sur ce type de ligne.
const KEYWORD_RE =
  /total(?!isé)|carte\s*(bancaire)?|\bcb\b|esp[eè]ces|ch[eè]que|à\s*payer|net\s*[aà]\s*payer|montant|ttc/i;

// Niveau 1 (prioritaire) : parmi les montants trouvés sur des lignes
// "total/paiement", on retient celui qui revient le plus souvent. Le total
// réel est presque toujours répété plusieurs fois sur un ticket (ligne
// TOTAL, ligne moyen de paiement, récapitulatif TVA en bas), alors qu'une
// éventuelle erreur de lecture OCR sur une occurrence donnée (ex: "TTC"
// mal reconnu et fusionné avec le nombre suivant) ne l'est pas.
function tryContextFrequency(
  lines: string[],
): { value: number; count: number } | null {
  const candidates: number[] = [];

  lines.forEach((line, i) => {
    if (KEYWORD_RE.test(line)) {
      const window = [line, lines[i + 1] ?? ""].join(" ");
      const found = [...window.matchAll(AMOUNT_RE)].map((m) =>
        toNumber(m[1]),
      );
      candidates.push(...found);
    }
  });

  if (!candidates.length) return null;

  const counts = new Map<number, number>();
  candidates.forEach((n) => counts.set(n, (counts.get(n) ?? 0) + 1));

  const sorted = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]; // fréquence décroissante
    return b[0] - a[0]; // puis montant décroissant
  });

  const [value, count] = sorted[0];
  return { value, count };
}

// Niveau 2 : repli — vote de fréquence sur l'intégralité du texte (utile si
// aucune ligne "total/paiement" n'a été détectée, par ex. en cas de flou
// important sur cette zone du ticket).
function tryFrequencyVoting(text: string): number | null {
  const all = [...text.matchAll(AMOUNT_RE)].map((m) => toNumber(m[1]));
  if (!all.length) return null;

  const counts = new Map<number, number>();
  all.forEach((n) => counts.set(n, (counts.get(n) ?? 0) + 1));

  const sorted = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
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

  const contextVoted = tryContextFrequency(lines);
  if (contextVoted !== null) {
    return { total: contextVoted.value, strategy: "total-context" };
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

// ─── Extraction de texte natif depuis un PDF ───────────────────────────────
// Certains tickets sont des PDF envoyés par e-mail (ex: E.Leclerc) et
// contiennent déjà du texte réel — inutile de passer par l'OCR, on peut lire
// le texte directement, ce qui est bien plus fiable qu'une reconnaissance
// d'image. On reconstruit les lignes en regroupant les éléments de texte par
// position verticale (l'API pdf.js ne renvoie pas de sauts de ligne), pour
// que la logique de détection par mots-clés (qui raisonne ligne par ligne)
// fonctionne de la même façon que sur du texte OCR.
async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const allLines: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const rows = new Map<number, { x: number; str: string }[]>();
    for (const item of content.items as any[]) {
      if (!item.str || !item.str.trim()) continue;
      // transform[5] = position verticale (Y) du texte sur la page.
      const y = Math.round(item.transform[5]);
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y)!.push({ x: item.transform[4], str: item.str });
    }

    // L'axe Y d'un PDF part du bas de la page : on trie donc du plus grand
    // au plus petit pour retrouver l'ordre de lecture (haut → bas), puis
    // chaque ligne est triée de gauche à droite.
    const sortedY = [...rows.keys()].sort((a, b) => b - a);
    for (const y of sortedY) {
      const row = rows.get(y)!.sort((a, b) => a.x - b.x);
      allLines.push(row.map((r) => r.str).join(" "));
    }
  }

  return allLines.join("\n");
}

// ─── Point d'entrée principal ───────────────────────────────────────────────

// Reconnaissance sur un canvas déjà prétraité (ex : frame capturée depuis la
// caméra en direct). Partagé par extractTotalFromReceipt pour les photos.
async function recognizeCanvas(canvas: HTMLCanvasElement): Promise<ReceiptOcrResult> {
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

// Utilisé par le mode "caméra en direct" de OCRModal : le canvas vient d'une
// frame vidéo déjà capturée et prétraitée via captureCanvasFromVideo.
export async function extractTotalFromCanvas(
  canvas: HTMLCanvasElement,
): Promise<ReceiptOcrResult> {
  return recognizeCanvas(canvas);
}

export async function extractTotalFromReceipt(
  file: File,
): Promise<ReceiptOcrResult> {
  // PDF avec texte natif : pas besoin d'OCR, on lit directement le texte.
  if (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  ) {
    const rawText = await extractTextFromPdf(file);
    const { total, strategy } = extractTotalFromText(rawText);
    return { total, rawText, strategy };
  }

  // Sinon (photo), on passe par le pipeline OCR habituel.
  const canvas = await preprocessImage(file);
  return recognizeCanvas(canvas);
}
