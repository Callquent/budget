'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { classify } from './parser';
import { buildResponse, renderAddForm } from './responseBuilder';
import type {
  AddBudgetLinePayload,
  AddCategoryPayload,
  AddEntityType,
  AddSubscriptionPayload,
  AddTransactionPayload,
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

async function fetchBudgetContext(apiBase = '/api'): Promise<BudgetContext> {
  const res = await fetch(`${apiBase}/ai-search/context`, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`[useAISearch] Context fetch failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

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

// ── Options & return type ────────────────────────────────────────

export interface UseAISearchOptions {
  apiBase?: string;
  onAddBudget?: (payload: AddBudgetLinePayload) => Promise<void>;
  onAddTransaction?: (payload: AddTransactionPayload) => Promise<void>;
  onAddSubscription?: (payload: AddSubscriptionPayload) => Promise<void>;
  onAddCategory?: (payload: AddCategoryPayload) => Promise<void>;
}

export interface UseAISearchReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  contextReady: boolean;
  getContext: () => BudgetContext;
  sendMessage: (query: string) => void;
  clearChat: () => void;
  /** Ajoute un message directement (pour les sélecteurs interactifs) */
  addMessage: (message: ChatMessage) => void;
  /** Met à jour un message existant */
  updateMessage: (messageId: string, newHtml: string) => void;
  /** L'utilisateur a cliqué sur une carte du menu "ajouter" → affiche le bon formulaire. */
  handleAddEntityClick: (entity: AddEntityType, messageId: string) => void;
  /** L'utilisateur clique sur "← Retour" dans un formulaire → réaffiche le menu. */
  handleBackToMenu: (messageId: string) => void;
  /** Soumission de n'importe lequel des 4 formulaires inline. */
  handleFormSubmit: (form: HTMLElement, messageId: string) => void;
}

// ── Helpers de mise à jour de message ────────────────────────────

const MONTH_NAMES_FR: Record<number, string> = {
  1:'janvier',2:'février',3:'mars',4:'avril',5:'mai',6:'juin',
  7:'juillet',8:'août',9:'septembre',10:'octobre',11:'novembre',12:'décembre',
};

const ADD_MENU_HTML = `
  <div style="font-weight: 600; margin-bottom: 8px; color: var(--color-text-primary, #111827);">Que souhaitez-vous ajouter ?</div>
  <div class="ais-add-menu">
    <button class="ais-add-card" data-add-entity="transaction">
      <i class="ais-add-card__icon" data-icon="arrows-exchange"></i>
      <div class="ais-add-card__name">Transaction</div>
      <div class="ais-add-card__desc">Crédit ou débit</div>
    </button>
    <button class="ais-add-card" data-add-entity="subscription">
      <i class="ais-add-card__icon" data-icon="refresh"></i>
      <div class="ais-add-card__name">Abonnement</div>
      <div class="ais-add-card__desc">Récurrent mensuel/annuel</div>
    </button>
    <button class="ais-add-card" data-add-entity="budget">
      <i class="ais-add-card__icon" data-icon="calendar-stats"></i>
      <div class="ais-add-card__name">Ligne budget</div>
      <div class="ais-add-card__desc">Prévu pour un mois</div>
    </button>
    <button class="ais-add-card" data-add-entity="category">
      <i class="ais-add-card__icon" data-icon="tags"></i>
      <div class="ais-add-card__name">Catégorie</div>
      <div class="ais-add-card__desc">Classer les opérations</div>
    </button>
  </div>`;

// ── Hook ────────────────────────────────────────────────────────

export function useAISearch({
  apiBase = '/api',
  onAddBudget,
  onAddTransaction,
  onAddSubscription,
  onAddCategory,
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
             <em>« Ajouter… »</em>…`,
      timestamp: new Date(),
    }]);
  }, []);

  // ── Load context ──────────────────────────────────────────────
  useEffect(() => {
    fetchBudgetContext(apiBase)
      .then((ctx) => {
        contextRef.current = ctx;
        setContextReady(true);
      })
      .catch((err) => {
        console.error('[useAISearch] Impossible de charger le contexte :', err);
        setContextReady(true);
        setMessages((prev) => [
          ...prev,
          {
            id: `ctx-error-${Date.now()}`,
            role: 'ai',
            html: `⚠️ Impossible de charger les données depuis <code>${apiBase}/ai-search/context</code>.`,
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

      const html = buildResponse(intent, ctx);

      setMessages((prev) => [...prev, {
        id: `ai-${Date.now()}`,
        role: 'ai',
        html,
        timestamp: new Date(),
      }]);
      setIsLoading(false);
    }, 480);
  }, []);

  // ── Clic sur une carte du menu "ajouter" ────────────────────────
  const handleAddEntityClick = useCallback((entity: AddEntityType, messageId: string) => {
    const ctx = contextRef.current;
    const html = renderAddForm(entity, ctx);

    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, html } : m)),
    );
  }, []);

  // ── Bouton "Retour" dans un formulaire ──────────────────────────
  const handleBackToMenu = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, html: ADD_MENU_HTML } : m)),
    );
  }, []);

  // ── Soumission de formulaire (les 4 types) ──────────────────────
  const handleFormSubmit = useCallback(
    async (form: HTMLElement, messageId: string) => {
      const type = form.dataset.type as 'transaction' | 'subscription' | 'budget' | 'category' | undefined;
      if (!type) return;

      const vals: Record<string, string> = {};
      form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[name]').forEach((el) => {
        vals[el.name] = el.value;
      });

      const setMsg = (html: string) => {
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, html } : m)));
      };

      try {
        if (type === 'transaction') {
          if (!vals.label || !vals.amount || parseFloat(vals.amount) <= 0) {
            setMsg('⚠️ Libellé et montant sont requis.');
            return;
          }
          const payload: AddTransactionPayload = {
            label: vals.label,
            amount: parseFloat(vals.amount),
            type: vals.type as 'credit' | 'debit',
            date: vals.date,
            category: vals.category,
            account: vals.account,
          };
          await onAddTransaction?.(payload);
          const sign = payload.type === 'debit' ? '−' : '+';
          setMsg(`✅ Transaction créée : <strong>${payload.label}</strong> · ${sign}${payload.amount.toFixed(2)} € · ${payload.category} · ${payload.account}`);

        } else if (type === 'subscription') {
          if (!vals.name || !vals.amount || parseFloat(vals.amount) <= 0) {
            setMsg('⚠️ Nom et montant sont requis.');
            return;
          }
          const payload: AddSubscriptionPayload = {
            name: vals.name,
            amount: parseFloat(vals.amount),
            frequency: vals.frequency as AddSubscriptionPayload['frequency'],
            dayOfMonth: vals.dayOfMonth ? parseInt(vals.dayOfMonth, 10) : undefined,
            startDate: vals.startDate,
            endDate: vals.endDate || undefined,
            category: vals.category,
            account: vals.account,
          };
          await onAddSubscription?.(payload);
          const freqLabel = { monthly: 'mensuel', yearly: 'annuel', quarterly: 'trimestriel', occasional: 'occasionnel' }[payload.frequency] ?? payload.frequency;
          setMsg(`✅ Abonnement créé : <strong>${payload.name}</strong> · ${payload.amount.toFixed(2)} €/${freqLabel} · ${payload.category}`);

        } else if (type === 'budget') {
          if (!vals.amount || parseFloat(vals.amount) <= 0) {
            setMsg('⚠️ Le montant prévu est requis.');
            return;
          }
          const month = parseInt(vals.month, 10);
          const year = parseInt(vals.year, 10);
          const payload: AddBudgetLinePayload = {
            category: vals.category,
            amount: parseFloat(vals.amount),
            month,
            year,
            label: vals.label || undefined,
          };
          await onAddBudget?.(payload);

          // Mise à jour optimiste du contexte local
          const ctx = contextRef.current;
          const cat = ctx.categories.find((c) => c.name === payload.category);
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
                label: payload.label,
              },
            ],
          };

          setMsg(`✅ Ligne budget créée : <strong>${payload.category}</strong> · ${payload.amount.toFixed(2)} € prévu pour <strong>${MONTH_NAMES_FR[month]} ${year}</strong>`);

        } else if (type === 'category') {
          if (!vals.name) {
            setMsg('⚠️ Le nom de la catégorie est requis.');
            return;
          }
          const payload: AddCategoryPayload = {
            name: vals.name,
            transactionType: vals.transactionType as AddCategoryPayload['transactionType'],
            frequency: vals.frequency as AddCategoryPayload['frequency'],
            description: vals.description || undefined,
          };
          await onAddCategory?.(payload);

          const ctx = contextRef.current;
          contextRef.current = {
            ...ctx,
            categories: [
              ...ctx.categories,
              { id: Date.now(), name: payload.name, transactionType: payload.transactionType, frequency: payload.frequency },
            ],
          };

          const typeLabel = { expense: 'Dépense', income: 'Revenu', transfer: 'Virement' }[payload.transactionType];
          setMsg(`✅ Catégorie créée : <strong>${payload.name}</strong> · ${typeLabel}`);
        }
      } catch (err) {
        console.error('[useAISearch] handleFormSubmit failed:', err);
        setMsg(`⚠️ Erreur lors de la création : ${err instanceof Error ? err.message : 'erreur inconnue'}`);
      }
    },
    [onAddBudget, onAddTransaction, onAddSubscription, onAddCategory],
  );

  const clearChat = useCallback(() => {
    setMessages([{
      id: 'greeting',
      role: 'ai',
      html: 'Nouvelle conversation. Comment puis-je vous aider ?',
      timestamp: new Date(),
    }]);
  }, []);

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const updateMessage = useCallback((messageId: string, newHtml: string) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, html: newHtml } : msg))
    );
  }, []);

  return {
    messages,
    isLoading,
    contextReady,
    getContext: () => contextRef.current,
    sendMessage,
    clearChat,
    addMessage,
    updateMessage,
    handleAddEntityClick,
    handleBackToMenu,
    handleFormSubmit,
  };
}
