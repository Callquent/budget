'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { classify } from './parser';
import { buildResponse } from './responseBuilder';
import type {
  AddBudgetLinePayload,
  BudgetContext,
  ChatMessage,
} from './types';

// ── Default empty context ──────────────────────────────────────

const EMPTY_CONTEXT: BudgetContext = {
  transactions: [],
  subscriptions: [],
  accounts: [],
  monthlyBudgets: [],
  categories: [],
};

// ── API fetch helpers ──────────────────────────────────────────

/**
 * Fetch all data needed by the NLP engine in parallel.
 * Each endpoint uses Symfony's serializer groups.
 *
 * Replace the base URL / paths to match your actual routing.
 */
async function fetchBudgetContext(apiBase = '/api'): Promise<BudgetContext> {
  const [transactions, subscriptions, accounts, monthlyBudgets, categories] =
    await Promise.all([
      fetch(`${apiBase}/transactions?limit=500`).then((r) => r.json()),
      fetch(`${apiBase}/subscriptions`).then((r) => r.json()),
      fetch(`${apiBase}/accounts`).then((r) => r.json()),
      fetch(`${apiBase}/monthly-budgets`).then((r) => r.json()),
      fetch(`${apiBase}/categories`).then((r) => r.json()),
    ]);

  return {
    // Unwrap paginated Symfony responses (member array) or plain arrays
    transactions: transactions['hydra:member'] ?? transactions ?? [],
    subscriptions: subscriptions['hydra:member'] ?? subscriptions ?? [],
    accounts: accounts['hydra:member'] ?? accounts ?? [],
    monthlyBudgets: monthlyBudgets['hydra:member'] ?? monthlyBudgets ?? [],
    categories: categories['hydra:member'] ?? categories ?? [],
  };
}

// ── Hook ───────────────────────────────────────────────────────

export interface UseAISearchOptions {
  /** Base URL of your Symfony JSON API. Defaults to '/api'. */
  apiBase?: string;
  /**
   * Called after the user confirms a budget-add action from the chat form.
   * The host component is responsible for making the POST request and
   * updating the context / invalidating SWR / router.refresh().
   */
  onAddBudget?: (payload: AddBudgetLinePayload) => Promise<void>;
}

export interface UseAISearchReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  contextReady: boolean;
  sendMessage: (query: string) => void;
  clearChat: () => void;
  /** Call this when the user clicks a data-fill button inside a bubble. */
  handleFill: (text: string) => void;
  /** Call this when the user submits a data-action="add-budget" form inside a bubble. */
  handleFormSubmit: (form: HTMLElement) => void;
}

export function useAISearch({
  apiBase = '/api',
  onAddBudget,
}: UseAISearchOptions = {}): UseAISearchReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [contextReady, setContextReady] = useState(false);
  const contextRef = useRef<BudgetContext>(EMPTY_CONTEXT);
  const fillCallbackRef = useRef<((text: string) => void) | null>(null);

  // ── Load context once on mount ───────────────────────────────
  useEffect(() => {
    fetchBudgetContext(apiBase)
      .then((ctx) => {
        contextRef.current = ctx;
        setContextReady(true);
      })
      .catch((err) => {
        console.error('[useAISearch] Failed to load budget context:', err);
        // Fallback: keep EMPTY_CONTEXT so the hook still works
        setContextReady(true);
      });
  }, [apiBase]);

  // ── Greet on first load ──────────────────────────────────────
  useEffect(() => {
    setMessages([
      {
        id: 'greeting',
        role: 'ai',
        html: `Bonjour ! Je suis votre assistant budget. Posez-moi une question en langage naturel :<br>
               <em>« Les courses en février 2026 »</em>, <em>« Mon abonnement TER »</em>,
               <em>« Ajouter budget juillet »</em>…`,
        timestamp: new Date(),
      },
    ]);
  }, []);

  // ── Send a message ───────────────────────────────────────────
  const sendMessage = useCallback((query: string) => {
    const q = query.trim();
    if (!q) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      html: q,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // Small artificial delay for UX, then process synchronously
    setTimeout(() => {
      const ctx = contextRef.current;
      const intent = classify(q, ctx.subscriptions);
      const html = buildResponse(intent, ctx, async (payload) => {
        try {
          await onAddBudget?.(payload);
          // Optimistically update the local context
          contextRef.current = {
            ...ctx,
            monthlyBudgets: [
              ...ctx.monthlyBudgets,
              {
                id: Date.now(),
                category: ctx.categories.find((c) => c.name === payload.category) ?? {
                  name: payload.category,
                  transactionType: 'expense',
                },
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

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'ai',
        html,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMsg]);
      setIsLoading(false);
    }, 500);
  }, [onAddBudget]);

  // ── Fill handler (called from bubble button clicks) ──────────
  const handleFill = useCallback((text: string) => {
    // The component decides what to do with the filled text
    // (e.g., put it in the input, or send directly).
    // We expose this so the parent can wire up <input> focus.
    fillCallbackRef.current?.(text);
  }, []);

  // ── Form submit handler ──────────────────────────────────────
  const handleFormSubmit = useCallback(
    async (form: HTMLElement) => {
      const month = parseInt(form.dataset.month ?? '7', 10);
      const year = parseInt(form.dataset.year ?? String(new Date().getFullYear()), 10);
      const category = (form.querySelector<HTMLSelectElement>('[name="category"]'))?.value ?? '';
      const label = (form.querySelector<HTMLInputElement>('[name="label"]'))?.value ?? undefined;
      const amountRaw = (form.querySelector<HTMLInputElement>('[name="amount"]'))?.value ?? '0';
      const amount = parseFloat(amountRaw);

      if (!category || isNaN(amount) || amount <= 0) {
        sendMessage(`[Erreur] Veuillez remplir la catégorie et le montant.`);
        return;
      }

      const payload: AddBudgetLinePayload = { category, amount, month, year };

      try {
        await onAddBudget?.(payload);

        // Update local context
        const ctx = contextRef.current;
        contextRef.current = {
          ...ctx,
          monthlyBudgets: [
            ...ctx.monthlyBudgets,
            {
              id: Date.now(),
              category: ctx.categories.find((c) => c.name === category) ?? {
                name: category,
                transactionType: 'expense',
              },
              year,
              month,
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

        const aiMsg: ChatMessage = {
          id: `ai-budget-${Date.now()}`,
          role: 'ai',
          html: `✅ Ligne budget créée : <strong>${category}</strong> — ${amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} prévu pour <strong>${moNames[month]} ${year}</strong>.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      } catch (err) {
        console.error('[useAISearch] handleFormSubmit failed:', err);
      }
    },
    [onAddBudget, sendMessage],
  );

  const clearChat = useCallback(() => {
    setMessages([
      {
        id: 'greeting',
        role: 'ai',
        html: 'Nouvelle conversation. Comment puis-je vous aider ?',
        timestamp: new Date(),
      },
    ]);
  }, []);

  return {
    messages,
    isLoading,
    contextReady,
    sendMessage,
    clearChat,
    handleFill,
    handleFormSubmit,
  };
}
