'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { classify } from './parser';
import { buildResponse } from './responseBuilder';
import type {
  AddBudgetLinePayload,
  BudgetContext,
  CategoryData,
  ChatMessage,
} from './types';

const EMPTY_CONTEXT: BudgetContext = {
  transactions: [],
  subscriptions: [],
  accounts: [],
  monthlyBudgets: [],
  categories: [],
};

// ── API fetch ───────────────────────────────────────────────────
// Un seul endpoint Symfony retourne tout le contexte d'un coup :
//   GET /api/ai-search/context
//
// Le contrôleur AiSearchContextController.php sérialise les entités
// en JSON plat (pas d'IRIs, pas de hydra:member).

async function fetchBudgetContext(apiBase = '/api'): Promise<BudgetContext> {
  const res = await fetch(`${apiBase}/ai-search/context`, {
    headers: { Accept: 'application/json' },
    // next.js cache : revalidate toutes les 60 s en production
    // @ts-ignore
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`[useAISearch] Context fetch failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  // Le contrôleur retourne directement { transactions, subscriptions, … }
  // On accepte aussi l'ancien format hydra:member au cas où
  const unwrap = <T>(v: T[] | { 'hydra:member': T[] } | undefined): T[] => {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    return (v as { 'hydra:member': T[] })['hydra:member'] ?? [];
  };

  return {
    transactions:   unwrap(data.transactions),
    subscriptions:  unwrap(data.subscriptions),
    accounts:       unwrap(data.accounts),
    monthlyBudgets: unwrap(data.monthlyBudgets),
    categories:     unwrap(data.categories),
  };
}

// ── Types ───────────────────────────────────────────────────────

export interface UseAISearchOptions {
  apiBase?: string;
  onAddBudget?: (payload: AddBudgetLinePayload) => Promise<void>;
}

export interface UseAISearchReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  contextReady: boolean;
  /** Debug : retourne le contexte chargé (utile en dev) */
  getContext: () => BudgetContext;
  sendMessage: (query: string) => void;
  clearChat: () => void;
  handleFill: (text: string) => void;
  handleFormSubmit: (form: HTMLElement) => void;
}

// ── Hook ────────────────────────────────────────────────────────

export function useAISearch({
  apiBase = '/api',
  onAddBudget,
}: UseAISearchOptions = {}): UseAISearchReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [contextReady, setContextReady] = useState(false);
  const contextRef = useRef<BudgetContext>(EMPTY_CONTEXT);

  // ── Greeting ─────────────────────────────────────────────────
  useEffect(() => {
    setMessages([{
      id: 'greeting',
      role: 'ai',
      html: `Bonjour ! Posez-moi une question en langage naturel :<br>
             <em>« Les courses en février 2026 »</em>, <em>« Mon abonnement TER »</em>,
             <em>« Ajouter budget juillet »</em>…`,
      timestamp: new Date(),
    }]);
  }, []);

  // ── Load context ──────────────────────────────────────────────
  useEffect(() => {
    fetchBudgetContext(apiBase)
      .then((ctx) => {
        contextRef.current = ctx;
        setContextReady(true);

        // En développement : log le contexte pour faciliter le débogage
        if (process.env.NODE_ENV === 'development') {
          console.group('[useAISearch] Contexte chargé');
          console.log('Transactions :', ctx.transactions.length);
          console.log('Subscriptions :', ctx.subscriptions.length);
          console.log('Accounts :', ctx.accounts.length);
          console.log('Budgets :', ctx.monthlyBudgets.length);
          console.log('Catégories :', ctx.categories.length);
          console.log('Sample transaction :', ctx.transactions[0]);
          console.log('Sample subscription :', ctx.subscriptions[0]);
          console.groupEnd();
        }
      })
      .catch((err) => {
        console.error('[useAISearch] Impossible de charger le contexte :', err);
        // On reste opérationnel avec un contexte vide
        setContextReady(true);

        setMessages((prev) => [
          ...prev,
          {
            id: 'ctx-error',
            role: 'ai',
            html: `⚠️ Impossible de charger les données depuis <code>${apiBase}/ai-search/context</code>.<br>
                   Vérifiez que le contrôleur Symfony <code>AiSearchContextController</code> est bien enregistré.`,
            timestamp: new Date(),
          },
        ]);
      });
  }, [apiBase]);

  // ── Send message ──────────────────────────────────────────────
  const sendMessage = useCallback((query: string) => {
    const q = query.trim();
    if (!q) return;

    setMessages((prev) => [...prev, {
      id: `user-${Date.now()}`,
      role: 'user',
      html: q,
      timestamp: new Date(),
    }]);
    setIsLoading(true);

    setTimeout(() => {
      const ctx = contextRef.current;
      const intent = classify(q, ctx.subscriptions, ctx.categories);

      if (process.env.NODE_ENV === 'development') {
        console.log('[useAISearch] Intent:', intent);
      }

      const html = buildResponse(intent, ctx, async (payload) => {
        try {
          await onAddBudget?.(payload);
          // Mise à jour optimiste du contexte local
          const cat: CategoryData | undefined = ctx.categories.find(
            (c) => c.name === payload.category,
          );
          contextRef.current = {
            ...ctx,
            monthlyBudgets: [
              ...ctx.monthlyBudgets,
              {
                id: Date.now(),
                category: cat ?? { name: payload.category, transactionType: 'expense' },
                year: payload.year,
                month: payload.month,
                plannedAmount: payload.amount.toFixed(2),
                actualAmount: '0.00',
              },
            ],
          };
        } catch (err) {
          console.error('[useAISearch] onAddBudget failed:', err);
        }
      });

      setMessages((prev) => [...prev, {
        id: `ai-${Date.now()}`,
        role: 'ai',
        html,
        timestamp: new Date(),
      }]);
      setIsLoading(false);
    }, 480);
  }, [onAddBudget]);

  // ── Fill handler ──────────────────────────────────────────────
  const handleFill = useCallback((_text: string) => {
    // Géré par le composant parent via l'état de l'input
  }, []);

  // ── Form submit (budget add inline) ──────────────────────────
  const handleFormSubmit = useCallback(
    async (form: HTMLElement) => {
      const month = parseInt(form.dataset.month ?? '7', 10);
      const year  = parseInt(form.dataset.year  ?? String(new Date().getFullYear()), 10);
      const category = form.querySelector<HTMLSelectElement>('[name="category"]')?.value ?? '';
      const label    = form.querySelector<HTMLInputElement>('[name="label"]')?.value ?? '';
      const amountRaw = form.querySelector<HTMLInputElement>('[name="amount"]')?.value ?? '0';
      const amount = parseFloat(amountRaw);

      if (!category || isNaN(amount) || amount <= 0) {
        setMessages((prev) => [...prev, {
          id: `err-${Date.now()}`,
          role: 'ai',
          html: '⚠️ Veuillez remplir la catégorie et un montant valide.',
          timestamp: new Date(),
        }]);
        return;
      }

      const payload: AddBudgetLinePayload = { category, amount, month, year };

      try {
        await onAddBudget?.(payload);

        const ctx = contextRef.current;
        const cat = ctx.categories.find((c) => c.name === category);
        contextRef.current = {
          ...ctx,
          monthlyBudgets: [
            ...ctx.monthlyBudgets,
            {
              id: Date.now(),
              category: cat ?? { name: category, transactionType: 'expense' },
              year, month,
              plannedAmount: amount.toFixed(2),
              actualAmount: '0.00',
              label: label || undefined,
            },
          ],
        };

        const moNames: Record<number, string> = {
          1:'janvier',2:'février',3:'mars',4:'avril',5:'mai',6:'juin',
          7:'juillet',8:'août',9:'septembre',10:'octobre',11:'novembre',12:'décembre',
        };
        setMessages((prev) => [...prev, {
          id: `ai-budget-${Date.now()}`,
          role: 'ai',
          html: `✅ Ligne budget créée : <strong>${category}</strong> — ${amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} prévu pour <strong>${moNames[month]} ${year}</strong>.`,
          timestamp: new Date(),
        }]);
      } catch (err) {
        console.error('[useAISearch] handleFormSubmit failed:', err);
        setMessages((prev) => [...prev, {
          id: `err-${Date.now()}`,
          role: 'ai',
          html: `⚠️ Erreur lors de la création du budget : ${err instanceof Error ? err.message : 'erreur inconnue'}`,
          timestamp: new Date(),
        }]);
      }
    },
    [onAddBudget],
  );

  const clearChat = useCallback(() => {
    setMessages([{
      id: 'greeting',
      role: 'ai',
      html: 'Nouvelle conversation. Comment puis-je vous aider ?',
      timestamp: new Date(),
    }]);
  }, []);

  return {
    messages,
    isLoading,
    contextReady,
    getContext: () => contextRef.current,
    sendMessage,
    clearChat,
    handleFill,
    handleFormSubmit,
  };
}
