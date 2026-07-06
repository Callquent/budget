// Configuration pour Tesseract.js OCR
// Ce fichier centralise la configuration et le chargement de Tesseract.js

declare global {
  interface Window {
    Tesseract: any;
  }
}

// Variable pour stocker la promesse de chargement de Tesseract
let tesseractPromise: Promise<any> | null = null;

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
      (blob) => (blob ? resolve(blob) : reject(new Error("Échec de génération de l'image prétraitée"))),
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

// Fonction pour charger Tesseract.js dynamiquement
export async function loadTesseract(): Promise<any> {
  // Si déjà chargé, retourner directement
  if (typeof window !== 'undefined' && window.Tesseract) {
    return window.Tesseract;
  }

  // Si une promesse de chargement est déjà en cours, la réutiliser
  if (tesseractPromise) {
    return tesseractPromise;
  }

  // Créer une nouvelle promesse de chargement
  tesseractPromise = new Promise(async (resolve, reject) => {
    try {
      // Essayer d'importer dynamiquement depuis npm
      // Note: Dans Next.js, les imports dynamiques fonctionnent mieux avec SSR désactivé
      const { default: Tesseract } = await import('tesseract.js');
      window.Tesseract = Tesseract;
      resolve(Tesseract);
    } catch (importError) {
      console.warn('Impossible de charger tesseract.js depuis npm, tentative avec CDN...', importError);
      
      // Charger depuis CDN comme fallback
      const scriptUrl = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.browser.min.js';
      
      const script = document.createElement('script');
      script.src = scriptUrl;
      script.async = true;
      
      script.onload = () => {
        // Attendre un peu que Tesseract soit complètement initialisé
        const checkTesseract = setInterval(() => {
          if (window.Tesseract) {
            clearInterval(checkTesseract);
            resolve(window.Tesseract);
          }
        }, 100);

        // Timeout après 30 secondes
        setTimeout(() => {
          clearInterval(checkTesseract);
          reject(new Error('Timeout: Tesseract.js a mis trop de temps à se charger'));
        }, 30000);
      };
      
      script.onerror = () => {
        reject(new Error('Échec du chargement de Tesseract.js depuis CDN'));
      };
      
      document.head.appendChild(script);
    }
  });

  // Attendre que la promesse se résolve
  return tesseractPromise;
}

// Configuration par défaut pour l'OCR des tickets de caisse
// IMPORTANT : ces paramètres doivent être appliqués via worker.setParameters()
// après Tesseract.createWorker() — Tesseract.recognize() seul les ignore.
export const OCR_CONFIG = {
  // Langues à utiliser (français + anglais pour une meilleure reconnaissance)
  lang: 'fra+eng',

  // Moteur LSTM uniquement : plus précis que le moteur legacy sur les photos
  oem: 1,

  // PSM 6 = "bloc de texte uniforme", adapté aux tickets de caisse imprimés
  // en colonnes régulières (plus fiable que le mode "page complète" par défaut)
  tessedit_pageseg_mode: '6',

  // Options de reconnaissance — restreint les caractères plausibles pour
  // éviter que l'OCR ne choisisse "/", "\" ou "|" à la place de chiffres
  tessedit_char_whitelist: '0123456789.,:-€ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÀÂÇÉÈÊËÎÏÔÙÛÜÑäöüß',

  // Options de performance
  workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.browser.min.js',
  corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core.wasm.js',

  // Timeout pour le traitement (en secondes)
  timeout: 30000,
};

// Patterns pour extraire les informations des tickets de caisse
export const RECEIPT_PATTERNS = {
  // Patterns pour trouver le montant total
  // Ordre important : du plus spécifique au plus général
  total: [
    // 🎯 PRIORITÉ MAX : "Total 1.71€" ou "Total 1,71€" (avec décimales)
    /(?:TOTAL|Total|total)\s+([\d]+[.,][\d]{2})\s*€/i,
    // 🎯 PRIORITÉ MAX : "Total 1.71 €" (avec espace avant €)
    /(?:TOTAL|Total|total)\s+([\d]+[.,][\d]{2})\s+€/i,
    // 🥈 PRIORITÉ HAUTE : "Total 1.71" (sans € mais avec décimales)
    /(?:TOTAL|Total|total)\s+([\d]+[.,][\d]{2})/i,
    // 🥈 PRIORITÉ HAUTE : "Total: 1,71€" ou "Total: 1.71€"
    /(?:TOTAL|Total|total|MONTANT|Montant|montant)\s*(?:TTC|ttc|HT|ht)?\s*[:\-]?\s*([\d]+[.,][\d]{2})\s*€/i,
    // 🥈 PRIORITÉ HAUTE : "À payer: 1,71€"
    /(?:À payer|A payer|Total à payer|Amount)\s*[:\-]?\s*([\d]+[.,][\d]{2})\s*€/i,
    // ✅ PRIORITÉ NORMale : "1,71 €" ou "1.71€" (avec décimales, sans Total)
    /([\d]+[.,][\d]{2})\s*€/,
    // ✅ PRIORITÉ NORMale : "1.71" (avec décimales, sans €)
    /\b([\d]+[.,][\d]{2})\b/,
    // ⚠️ PRIORITÉ FAIBLE : "Total 4€" ou "Total 4 €" (sans décimales)
    /(?:TOTAL|Total|total)\s+([\d]+[.,]?\d*)\s*€/i,
    // ⚠️ PRIORITÉ FAIBLE : "Total: 4,50" (sans €, avec ou sans décimales)
    /(?:TOTAL|Total|total|MONTANT|Montant|montant)\s*(?:TTC|ttc|HT|ht)?\s*[:\-]?\s*([\d]+[.,]?\d*)/i,
    // ⚠️ PRIORITÉ FAIBLE : "À payer: 4,50"
    /(?:À payer|A payer|Total à payer|Amount)\s*[:\-]?\s*([\d]+[.,]?\d*)/i,
    // ⚠️ PRIORITÉ MINIMALE : "4 €" (nombre entier suivi de €)
    /([\d]{1,4})\s*€/,
    // ⚠️ PRIORITÉ MINIMALE : Format français avec séparateurs de milliers
    /([\d]{1,4}[\s]?[\d]{3}[.,][\d]{2})\s*€/,
    // ⚠️ PRIORITÉ MINIMALE : Dernier recours
    /([\d]+[.,]?\d*)\s*€/,
  ],
  
  // Patterns pour la date
  date: [
    /(\d{2}\/\d{2}\/\d{4})/,
    /(\d{4}\-\d{2}\-\d{2})/,
    /Date[:\s]+(\d{2}\/\d{2}\/\d{4})/i,
  ],
  
  // Patterns pour le nom du magasin
  shop: [
    /^([A-ZÉÈÊÔÇ][A-Za-zéèêôç\s\-']+)/m,
    /([A-ZÉÈÊ][a-zéèê]+(?:\s+[A-ZÉÈÊ][a-zéèê]+)*)/,
  ],
  
  // Mots-clés à ignorer pour le nom du magasin
  ignoreKeywords: ['TOTAL', 'total', 'MONTANT', 'montant', '€', 'EUR', 'HT', 'TTC'],
};

// ============================================================================
// Nettoyage des artefacts OCR courants
// ============================================================================
// Tesseract confond souvent le chiffre "7" avec "/", "-", "|" ou "l" quand
// l'image est bruitée. Sur les tickets Grand Frais testés, "1.71€" ressort
// régulièrement en "1./1€", "1-71€" ou "V.I1E". On corrige ces cas ciblés
// (position du séparateur décimal connue) plutôt que de faire une correction
// globale trop agressive qui casserait d'autres chiffres.
export function cleanOCRText(raw: string): string {
  return raw
    // "1./1€" ou "1.\1€" ou "1.|1€" → le caractère entre le séparateur et le
    // dernier chiffre remplace un "7" manquant : "1.71€"
    .replace(/(\d)[.,]\s?[\/\\|]\s?(\d)(?=\s*[€eE£]?)/g, '$1.7$2')
    // "1-71€" → tiret confondu avec le point décimal
    .replace(/(\d)-(\d{2})\s*[€eE£]/g, '$1.$2€')
    // "11.71€" type doublon du 1 (ex: seuil de binarisation trop dur) : on ne
    // touche pas ce cas ici, il est géré par le vote de fréquence plus bas.
    // Confusions classiques de caractères pour "7" isolé entre deux chiffres
    .replace(/(\d)[Il|](\d{2})\s*[€eE£]/g, '$1.$2€')
    // Normaliser la virgule décimale en point
    .replace(/(\d),(\d{2})(?=\s*[€eE£]|\s|$)/g, '$1.$2')
    // Normaliser le symbole euro (espaces parasites autour du €)
    .replace(/(\d)\s*[€eE£]\s*/g, '$1€');
}

// Recherche le montant sur la ligne contenant "TOTAL" (ou variantes lues par
// l'OCR comme "JOTAL", "T0TAL") et les 2 lignes suivantes, qui est
// l'emplacement le plus fiable pour le montant total sur un ticket de caisse.
// Tolère un chiffre de quantité devant ("4 TOTAL 1.71€").
function extractFromTotalContext(text: string): number | null {
  const lines = text.split('\n');
  const totalLineRegex = /(?:\d\s+)?[TJ][O0]TAL/i;

  for (let i = 0; i < lines.length; i++) {
    if (!totalLineRegex.test(lines[i])) continue;

    const searchLines = [lines[i], lines[i + 1] ?? '', lines[i + 2] ?? ''];

    for (const rawLine of searchLines) {
      const line = cleanOCRText(rawLine);
      // Montant à 2 décimales, avec ou sans €
      const match = line.match(/\b(\d{1,4})[.,](\d{2})\b/);
      if (match) {
        const amount = parseFloat(`${match[1]}.${match[2]}`);
        if (amount > 0 && amount <= 10000) return amount;
      }
    }
    break; // On ne considère que le premier bloc "TOTAL" trouvé
  }

  return null;
}

// Compte les occurrences de chaque montant à 2 décimales dans tout le texte.
// Sur un ticket, le montant total apparaît généralement plusieurs fois
// (ligne TOTAL, ligne carte bancaire, récapitulatif TVA/TTC), alors qu'une
// erreur OCR ponctuelle ne se répète pas. Le montant le plus fréquent est
// donc un bon candidat de secours quand la recherche contextuelle échoue.
function findMostFrequentAmount(text: string): number | null {
  const cleaned = cleanOCRText(text);
  const regex = /\b(\d{1,4})[.,](\d{2})\s*€/g;
  const counts = new Map<number, number>();
  let m: RegExpExecArray | null;

  while ((m = regex.exec(cleaned)) !== null) {
    const amount = parseFloat(`${m[1]}.${m[2]}`);
    if (amount <= 0 || amount > 10000) continue;
    counts.set(amount, (counts.get(amount) ?? 0) + 1);
  }

  if (counts.size === 0) return null;

  // En cas d'égalité de fréquence, on préfère le montant rencontré le plus
  // tard dans le texte : sur un ticket, les prix d'articles apparaissent en
  // haut et le total (ou ses répétitions : carte bancaire, TTC) en bas.
  let bestAmount: number | null = null;
  let bestCount = 0;
  for (const [amount, count] of counts) {
    if (count >= bestCount) {
      bestCount = count;
      bestAmount = amount;
    }
  }
  return bestAmount;
}

// Fonction pour extraire le montant d'un texte OCR
export function extractAmountFromOCRText(rawText: string): number | null {
  // 1. Priorité : montant trouvé juste à côté du mot TOTAL (le plus fiable)
  const totalResult = extractFromTotalContext(rawText);
  if (totalResult !== null) return totalResult;

  // 2. Secours : le montant à 2 décimales le plus répété dans le ticket
  //    (le total apparaît souvent plusieurs fois : TOTAL, carte bancaire, TTC)
  const frequentResult = findMostFrequentAmount(rawText);
  if (frequentResult !== null) return frequentResult;

  // 3. Dernier recours : anciens patterns génériques, du plus au moins fiable
  const text = cleanOCRText(rawText);
  const patterns = RECEIPT_PATTERNS.total;

  const matches: {amount: number; priority: number; patternIndex: number; isTotalLine: boolean}[] = [];

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const regexMatch = text.match(pattern);
    if (regexMatch) {
      let amountStr = regexMatch[1] || regexMatch[2];
      if (!amountStr) continue;

      amountStr = amountStr.replace(',', '.').replace(/\s/g, '');
      const amount = parseFloat(amountStr);
      if (!isNaN(amount) && amount > 0) {
        const isTotalLine = i <= 5;
        const originalAmountStr = regexMatch[1] || regexMatch[2];
        const hasDecimals = originalAmountStr.includes('.') || originalAmountStr.includes(',');

        let priority = i;
        if (isTotalLine && hasDecimals) priority = i;
        else if (isTotalLine && !hasDecimals) priority = i + 100;
        else if (!isTotalLine && hasDecimals) priority = i + 50;
        else priority = i + 200;

        matches.push({ amount, priority, patternIndex: i, isTotalLine, hasDecimals });
      }
    }
  }

  if (matches.length === 0) return null;

  matches.sort((a, b) => a.priority - b.priority);
  const reasonableMatches = matches.filter(m => m.amount <= 10000);

  if (reasonableMatches.length > 0) {
    const bestPriority = reasonableMatches[0].priority;
    const bestMatches = reasonableMatches.filter(m => m.priority === bestPriority);

    if (bestMatches.length > 1) {
      const withDecimals = bestMatches.filter(m => m.hasDecimals);
      if (withDecimals.length > 0) return withDecimals[0].amount;
    }

    return reasonableMatches[0].amount;
  }

  return Math.min(...matches.map(m => m.amount));
}

// Fonction pour extraire la date
export function extractDateFromOCRText(text: string): string | null {
  const patterns = RECEIPT_PATTERNS.date;
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

// Fonction pour extraire le nom du magasin
export function extractShopFromOCRText(text: string): string | null {
  const lines = text.split('\n');
  const ignoreKeywords = RECEIPT_PATTERNS.ignoreKeywords;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    // Ignorer les lignes qui contiennent des mots-clés à ignorer
    if (ignoreKeywords.some(keyword => trimmedLine.includes(keyword))) {
      continue;
    }
    
    // Vérifier si la ligne ressemble à un nom de magasin
    for (const pattern of RECEIPT_PATTERNS.shop) {
      const match = trimmedLine.match(pattern);
      if (match) {
        const shopName = match[1].trim();
        // Vérifier que ce n'est pas juste un numéro
        if (!/^\d+$/.test(shopName) && shopName.length > 2 && shopName.length < 100) {
          return shopName;
        }
      }
    }
  }
  
  return null;
}
