'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAISearch } from '../lib/ai-search';
import type {
  AddBudgetLinePayload,
  AddCategoryPayload,
  AddEntityType,
  AddSubscriptionPayload,
  AddTransactionPayload,
  ChatMessage,
} from '../lib/ai-search';
import '../styles/ai-search.css';

// ── Quick suggestion pills ─────────────────────────────────────

const SUGGESTIONS = [
  '➕ Ajouter…',
];

// Noms des mois en français
const MONTH_NAMES: Record<number, string> = {
  1: 'janvier', 2: 'février', 3: 'mars', 4: 'avril', 5: 'mai', 6: 'juin',
  7: 'juillet', 8: 'août', 9: 'septembre', 10: 'octobre', 11: 'novembre', 12: 'décembre',
};

// Années disponibles (de l'année précédente à 2 ans dans le futur)
const getAvailableYears = (): number[] => {
  const currentYear = new Date().getFullYear();
  return [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
};

// Mappe les data-icon des cartes du menu "ajouter" vers les classes Bootstrap Icons.
// Le HTML généré par responseBuilder.ts utilise des noms d'icônes neutres (sans
// préfixe de librairie) pour rester découplé de bi-/ti-.
const ICON_MAP: Record<string, string> = {
  'arrows-exchange': 'bi-arrow-left-right',
  'refresh': 'bi-arrow-repeat',
  'calendar-stats': 'bi-calendar3',
  'tags': 'bi-tags',
};

// ── Bubble ─────────────────────────────────────────────────────

function Bubble({
  message,
  onFill,
  onAddEntityClick,
  onBackToMenu,
  onFormSubmit,
}: {
  message: ChatMessage;
  onFill: (text: string) => void;
  onAddEntityClick: (entity: AddEntityType, messageId: string) => void;
  onBackToMenu: (messageId: string) => void;
  onFormSubmit: (form: HTMLElement, messageId: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Convertit les <i data-icon="..."> injectés par responseBuilder en
  // vraies icônes Bootstrap Icons après chaque rendu de la bulle.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.querySelectorAll<HTMLElement>('[data-icon]').forEach((icon) => {
      const key = icon.dataset.icon;
      const bsClass = key ? ICON_MAP[key] : undefined;
      if (bsClass) {
        icon.className = `bi ${bsClass}`;
        icon.removeAttribute('data-icon');
      }
    });
  }, [message.html]);

  // Câble tous les boutons dynamiques injectés par le HTML builder
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // 1. data-fill → remplit l'input avec une suggestion
      const fillBtn = target.closest<HTMLElement>('[data-fill]');
      if (fillBtn?.dataset.fill) {
        onFill(fillBtn.dataset.fill);
        return;
      }

      // 2. data-add-entity → clic sur une carte du menu "ajouter"
      const addCard = target.closest<HTMLElement>('[data-add-entity]');
      if (addCard?.dataset.addEntity) {
        onAddEntityClick(addCard.dataset.addEntity as AddEntityType, message.id);
        return;
      }

      // 3. data-action="back-to-menu" → retour au menu d'ajout
      const backBtn = target.closest<HTMLElement>('[data-action="back-to-menu"]');
      if (backBtn) {
        onBackToMenu(message.id);
        return;
      }

      // 4. data-action="add-*" → soumission d'un des 4 formulaires
      const submitBtn = target.closest<HTMLElement>(
        '[data-action="add-transaction"], [data-action="add-subscription"], [data-action="add-budget"], [data-action="add-category"]',
      );
      if (submitBtn) {
        const form = submitBtn.closest<HTMLElement>('.ais-form');
        if (form) onFormSubmit(form, message.id);
        return;
      }
    };

    el.addEventListener('click', handleClick);
    return () => el.removeEventListener('click', handleClick);
  }, [onFill, onAddEntityClick, onBackToMenu, onFormSubmit, message.id]);

  if (message.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', alignItems: 'flex-start' }}>
        <div className="ais-bubble ais-bubble--user">{message.html}</div>
        <div className="ais-avatar ais-avatar--user">Q</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
      <div className="ais-avatar ais-avatar--ai">
        <i className="bi bi-stars" style={{ fontSize: '13px' }} aria-hidden="true"></i>
      </div>
      <div
        ref={ref}
        className="ais-bubble ais-bubble--ai"
        /* Safe: HTML is built by our own responseBuilder, never from user input */
        dangerouslySetInnerHTML={{ __html: message.html }}
      />
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────

export interface AISearchPanelProps {
  apiBase?: string;
  initialQuery?: string;
  onAddBudget?: (payload: AddBudgetLinePayload) => Promise<void>;
  onAddTransaction?: (payload: AddTransactionPayload) => Promise<void>;
  onAddSubscription?: (payload: AddSubscriptionPayload) => Promise<void>;
  onAddCategory?: (payload: AddCategoryPayload) => Promise<void>;
}

export default function AISearchPanel({
  apiBase,
  initialQuery,
  onAddBudget,
  onAddTransaction,
  onAddSubscription,
  onAddCategory,
}: AISearchPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableAccounts, setAvailableAccounts] = useState<{id: number, name: string}[]>([]);
  const [categorySelectors, setCategorySelectors] = useState<Record<string, { messageId: string; originalHtml: string; category?: string }>>({});
  const [accountSelectors, setAccountSelectors] = useState<Record<string, { messageId: string; originalHtml: string; account?: {id: number, name: string}; month?: number; year?: number }>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize input with initialQuery if provided
  useEffect(() => {
    if (initialQuery) {
      setInputValue(initialQuery);
      inputRef.current?.focus();
    }
  }, [initialQuery]);

  const {
    messages,
    isLoading,
    contextReady,
    sendMessage,
    handleAddEntityClick,
    handleBackToMenu,
    handleFormSubmit,
    getContext,
    addMessage,
    updateMessage,
  } = useAISearch({ apiBase, onAddBudget, onAddTransaction, onAddSubscription, onAddCategory });

  // Charger les catégories et comptes disponibles
  useEffect(() => {
    if (contextReady) {
      const ctx = getContext();
      const categories = ctx.categories.map(cat => cat.name);
      const accounts = ctx.accounts.map(acc => ({ id: acc.id, name: acc.name }));
      setAvailableCategories(categories);
      setAvailableAccounts(accounts);
    }
  }, [contextReady]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = useCallback(() => {
    const q = inputValue.trim();
    if (!q || isLoading) return;
    sendMessage(q);
    setInputValue('');
  }, [inputValue, isLoading, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleSend();
    },
    [handleSend],
  );

  const handleFillAndFocus = useCallback((text: string) => {
    setInputValue(text);
    inputRef.current?.focus();
  }, []);

  // Gère le clic sur "Filtrer par catégorie et période" - affiche les catégories dans le chat
  const handleShowCategories = useCallback(() => {
    // Ajouter un message AI avec les boutons de catégories
    const messageId = `category-selector-${Date.now()}`;
    const categoryButtons = availableCategories.map(cat => 
      `<button class="ais-pill" data-select-category="${cat}" data-message-id="${messageId}" style="margin: 4px;">${cat}</button>`
    ).join('');
    
    const html = `
      <div style="margin-bottom: 8px;">
        <strong>Sélectionnez une catégorie :</strong>
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;">
        ${categoryButtons}
      </div>
      <div style="font-size: 12px; color: #666;">
        Puis choisissez un mois et/ou une année
      </div>
    `;
    
    // Stocker l'ID et le HTML original pour pouvoir revenir en arrière
    setCategorySelectors((prev) => ({
      ...prev,
      [messageId]: { messageId, originalHtml: html }
    }));
    
    addMessage({
      id: messageId,
      role: 'ai',
      html,
      timestamp: new Date(),
    });
  }, [availableCategories, setCategorySelectors]);

  // Gère le clic sur "Connaître solde" - affiche les comptes dans le chat
  const handleShowAccounts = useCallback(() => {
    // Ajouter un message AI avec les boutons de comptes
    const messageId = `account-selector-${Date.now()}`;
    const accountButtons = availableAccounts.map(acc => 
      `<button class="ais-pill" data-select-account="${acc.id}" data-message-id="${messageId}" style="margin: 4px;">${acc.name}</button>`
    ).join('');
    
    const html = `
      <div style="margin-bottom: 8px;">
        <strong>Sélectionnez un compte :</strong>
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;">
        ${accountButtons}
      </div>
      <div style="font-size: 12px; color: #666;">
        Puis choisissez un mois et/ou une année
      </div>
    `;
    
    // Stocker l'ID et le HTML original pour pouvoir revenir en arrière
    setAccountSelectors((prev) => ({
      ...prev,
      [messageId]: { messageId, originalHtml: html }
    }));
    
    addMessage({
      id: messageId,
      role: 'ai',
      html,
      timestamp: new Date(),
    });
  }, [availableAccounts, setAccountSelectors]);

  // Gère la sélection d'une catégorie - remplace le message pour afficher les mois/années
  const handleCategorySelected = useCallback((category: string, messageId: string) => {
    // Trouver le sélecteur de catégories correspondant
    const selector = categorySelectors[messageId];
    if (!selector) return;
    
    // Générer les boutons pour les mois
    const monthButtons = Object.entries(MONTH_NAMES).map(([num, name]) => {
      const monthNum = parseInt(num);
      return `<button class="ais-pill" data-select-period="${category}|${monthNum}|month" data-message-id="${messageId}" style="margin: 4px;">${name}</button>`;
    }).join('');
    
    // Générer les boutons pour les années
    const yearButtons = getAvailableYears().map(year => {
      return `<button class="ais-pill" data-select-period="${category}|${year}|year" data-message-id="${messageId}" style="margin: 4px;">${year}</button>`;
    }).join('');
    
    const html = `
      <div style="margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
        <strong>Catégorie : ${category}</strong>
        <button class="ais-pill" data-action="back-to-categories" data-message-id="${messageId}" style="margin: 0;">← Retour</button>
      </div>
      <div style="margin-bottom: 8px;">
        <strong>Sélectionnez un mois et/ou une année :</strong>
      </div>
      <div style="margin-bottom: 8px;">
        <strong>Mois :</strong>
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;">
        ${monthButtons}
      </div>
      <div style="margin-bottom: 8px;">
        <strong>Année :</strong>
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;">
        ${yearButtons}
      </div>
      <div style="font-size: 12px; color: #666;">
        Cliquez sur un mois et/ou une année pour voir les résultats
      </div>
    `;
    
    // Mettre à jour le message existant
    updateMessage(messageId, html);
    
    // Mettre à jour le state pour stocker la catégorie sélectionnée
    setCategorySelectors((prev) => ({
      ...prev,
      [messageId]: { ...prev[messageId], category }
    }));
  }, [categorySelectors, updateMessage]);

  // Gère la sélection d'un compte - remplace le message pour afficher les mois
  const handleAccountSelected = useCallback((accountId: string, messageId: string) => {
    // Trouver le sélecteur de comptes correspondant
    const selector = accountSelectors[messageId];
    if (!selector) return;
    
    // Trouver le compte sélectionné
    const account = availableAccounts.find(acc => acc.id === parseInt(accountId));
    if (!account) return;
    
    // Générer les boutons pour les mois
    const monthButtons = Object.entries(MONTH_NAMES).map(([num, name]) => {
      const monthNum = parseInt(num);
      return `<button class="ais-pill" data-select-account-month="${account.id}|${monthNum}" data-message-id="${messageId}" style="margin: 4px;">${name}</button>`;
    }).join('');
    
    const html = `
      <div style="margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
        <strong>Compte : ${account.name}</strong>
        <button class="ais-pill" data-action="back-to-accounts" data-message-id="${messageId}" style="margin: 0;">← Retour</button>
      </div>
      <div style="margin-bottom: 8px;">
        <strong>Sélectionnez un mois :</strong>
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;">
        ${monthButtons}
      </div>
      <div style="font-size: 12px; color: #666;">
        Puis sélectionnez une année
      </div>
    `;
    
    // Mettre à jour le message existant
    updateMessage(messageId, html);
    
    // Mettre à jour le state pour stocker le compte sélectionné
    setAccountSelectors((prev) => ({
      ...prev,
      [messageId]: { ...prev[messageId], account, month: undefined, year: undefined }
    }));
  }, [availableAccounts, accountSelectors, updateMessage]);

  // Gère le retour aux catégories
  const handleBackToCategories = useCallback((messageId: string) => {
    const selector = categorySelectors[messageId];
    if (selector && selector.originalHtml) {
      // Rétablir le HTML original
      updateMessage(messageId, selector.originalHtml);
      
      // Réinitialiser la catégorie
      setCategorySelectors((prev) => ({
        ...prev,
        [messageId]: { ...prev[messageId], category: undefined }
      }));
    }
  }, [categorySelectors, updateMessage]);

  // Gère le retour aux comptes
  const handleBackToAccounts = useCallback((messageId: string) => {
    const selector = accountSelectors[messageId];
    if (selector && selector.originalHtml) {
      // Rétablir le HTML original
      updateMessage(messageId, selector.originalHtml);
      
      // Réinitialiser le compte
      setAccountSelectors((prev) => ({
        ...prev,
        [messageId]: { ...prev[messageId], account: undefined, month: undefined, year: undefined }
      }));
    }
  }, [accountSelectors, updateMessage]);

  // Gère la sélection d'un mois - remplace le message pour afficher les années
  const handleAccountMonthSelected = useCallback((accountId: string, month: number, messageId: string) => {
    // Trouver le sélecteur de comptes correspondant
    const selector = accountSelectors[messageId];
    if (!selector) return;
    
    // Trouver le compte
    const account = availableAccounts.find(acc => acc.id === parseInt(accountId));
    if (!account) return;
    
    // Capitaliser le nom du mois
    const monthName = MONTH_NAMES[month].charAt(0).toUpperCase() + MONTH_NAMES[month].slice(1);
    
    // Générer les boutons pour les années
    const yearButtons = getAvailableYears().map(year => {
      return `<button class="ais-pill" data-select-account-year="${account.id}|${month}|${year}" data-message-id="${messageId}" style="margin: 4px;">${year}</button>`;
    }).join('');
    
    const html = `
      <div style="margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
        <strong>Compte : ${account.name}</strong>
        <button class="ais-pill" data-action="back-to-accounts" data-message-id="${messageId}" style="margin: 0;">← Retour</button>
      </div>
      <div style="margin-bottom: 8px;">
        <strong>Mois : ${monthName}</strong>
      </div>
      <div style="margin-bottom: 8px;">
        <strong>Sélectionnez une année :</strong>
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;">
        ${yearButtons}
      </div>
      <div style="font-size: 12px; color: #666;">
        Puis validez pour voir le solde
      </div>
    `;
    
    // Mettre à jour le message existant
    updateMessage(messageId, html);
    
    // Mettre à jour le state pour stocker le compte et le mois sélectionnés
    setAccountSelectors((prev) => ({
      ...prev,
      [messageId]: { ...prev[messageId], account, month, year: undefined }
    }));
  }, [availableAccounts, accountSelectors, updateMessage, MONTH_NAMES]);

  // Gère la sélection d'une période (mois ou année) pour les catégories
  const handlePeriodSelected = useCallback((category: string, value: number, type: 'month' | 'year') => {
    // Construire la requête
    let query = category;
    
    if (type === 'month') {
      query += ` ${MONTH_NAMES[value]}`;
    } else {
      query += ` ${value}`;
    }
    
    // Envoyer la requête
    sendMessage(query);
  }, [sendMessage]);

  // Gère la sélection d'une année - affiche directement le solde
  const handleAccountYearSelected = useCallback((accountId: string, month: number, year: number, messageId: string) => {
    // Trouver le compte
    const account = availableAccounts.find(acc => acc.id === parseInt(accountId));
    if (!account) return;
    
    // Capitaliser le nom du mois
    const monthName = MONTH_NAMES[month].charAt(0).toUpperCase() + MONTH_NAMES[month].slice(1);
    
    // Construire la requête : solde [compte] [mois] [année]
    const query = `solde ${account.name} ${monthName} ${year}`;
    
    // Afficher un message de chargement au format cohérent avec BudgetMonthView
    const html = `
      <div style="margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
        <strong>${account.name} ${monthName} ${year}</strong>
        <button class="ais-pill" data-action="back-to-accounts" data-message-id="${messageId}" style="margin: 0;">← Retour</button>
      </div>
      <div style="text-align: center; padding: 20px; color: #666;">
        <i class="bi bi-hourglass-split" style="font-size: 24px; margin-bottom: 8px;"></i>
        <div>Recherche du solde en cours...</div>
      </div>
    `;
    
    // Mettre à jour le message pour montrer la sélection
    updateMessage(messageId, html);
    
    // Mettre à jour le state
    setAccountSelectors((prev) => ({
      ...prev,
      [messageId]: { ...prev[messageId], account, month, year }
    }));
    
    // Envoyer la requête après une légère pause pour permettre la mise à jour de l'UI
    setTimeout(() => {
      sendMessage(query);
    }, 100);
  }, [availableAccounts, sendMessage, updateMessage, MONTH_NAMES]);

  // Gère le clic sur les boutons dans les messages
  const handleMessageButtonClick = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // Sélection de catégorie
    const categoryBtn = target.closest<HTMLElement>('[data-select-category]');
    if (categoryBtn?.dataset.selectCategory && categoryBtn.dataset.messageId) {
      handleCategorySelected(categoryBtn.dataset.selectCategory, categoryBtn.dataset.messageId);
      return;
    }
    
    // Sélection de compte
    const accountBtn = target.closest<HTMLElement>('[data-select-account]');
    if (accountBtn?.dataset.selectAccount && accountBtn.dataset.messageId) {
      handleAccountSelected(accountBtn.dataset.selectAccount, accountBtn.dataset.messageId);
      return;
    }
    
    // Sélection de mois pour un compte
    const accountMonthBtn = target.closest<HTMLElement>('[data-select-account-month]');
    if (accountMonthBtn?.dataset.selectAccountMonth && accountMonthBtn.dataset.messageId) {
      const [accountId, monthStr] = accountMonthBtn.dataset.selectAccountMonth.split('|');
      const month = parseInt(monthStr);
      handleAccountMonthSelected(accountId, month, accountMonthBtn.dataset.messageId);
      return;
    }
    
    // Sélection d'année pour un compte
    const accountYearBtn = target.closest<HTMLElement>('[data-select-account-year]');
    if (accountYearBtn?.dataset.selectAccountYear && accountYearBtn.dataset.messageId) {
      const [accountId, monthStr, yearStr] = accountYearBtn.dataset.selectAccountYear.split('|');
      const month = parseInt(monthStr);
      const year = parseInt(yearStr);
      handleAccountYearSelected(accountId, month, year, accountYearBtn.dataset.messageId);
      return;
    }
    
    // Sélection de période (mois ou année) pour les catégories
    const periodBtn = target.closest<HTMLElement>('[data-select-period]');
    if (periodBtn?.dataset.selectPeriod && periodBtn.dataset.messageId) {
      const [category, valueStr, type] = periodBtn.dataset.selectPeriod.split('|');
      const value = parseInt(valueStr);
      handlePeriodSelected(category, value, type as 'month' | 'year');
      return;
    }
    
    // Bouton Retour vers les catégories
    const backToCategoriesBtn = target.closest<HTMLElement>('[data-action="back-to-categories"]');
    if (backToCategoriesBtn?.dataset.messageId) {
      handleBackToCategories(backToCategoriesBtn.dataset.messageId);
      return;
    }
    
    // Bouton Retour vers les comptes
    const backToAccountsBtn = target.closest<HTMLElement>('[data-action="back-to-accounts"]');
    if (backToAccountsBtn?.dataset.messageId) {
      handleBackToAccounts(backToAccountsBtn.dataset.messageId);
      return;
    }
  }, [handleCategorySelected, handleAccountSelected, handleAccountMonthSelected, handleAccountYearSelected, handlePeriodSelected, handleBackToCategories, handleBackToAccounts]);

  // Ajouter un gestionnaire global pour les clics dans les messages
  const messageContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const container = messageContainerRef.current;
    if (!container) return;
    
    const handleClick = (e: MouseEvent) => handleMessageButtonClick(e);
    container.addEventListener('click', handleClick);
    
    return () => {
      container.removeEventListener('click', handleClick);
    };
  }, [handleMessageButtonClick]);

  return (
    <div className="ais-panel">
      {/* Header */}
      <div className="ais-panel__header">
        <span className="ais-panel__title">
          <i className="bi bi-stars" aria-hidden="true" style={{ color: '#6366f1' }}></i>
          Assistant budget
        </span>
        {!contextReady && (
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Chargement…</span>
        )}
      </div>

      {/* Suggestions */}
      <div className="ais-panel__suggestions">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            className="ais-pill"
            onClick={() => {
              const clean = s.replace(/^[^\w]+/, '').trim();
              sendMessage(clean);
            }}
          >
            {s}
          </button>
        ))}
        <button
          className="ais-pill"
          onClick={handleShowAccounts}
          disabled={!contextReady || availableAccounts.length === 0}
          title={!contextReady ? 'Chargement des données...' : availableAccounts.length === 0 ? 'Aucun compte disponible' : 'Connaître le solde d\'un compte pour un mois ou une année'}
        >
          💰 Connaître solde
        </button>
        <button
          className="ais-pill"
          onClick={handleShowCategories}
          disabled={!contextReady || availableCategories.length === 0}
          title={!contextReady ? 'Chargement des données...' : availableCategories.length === 0 ? 'Aucune catégorie disponible' : 'Filtrer par catégorie, mois et/ou année'}
        >
          🎯 Filtrer par catégorie et période
        </button>
      </div>

      {/* Chat area */}
      <div 
        ref={messageContainerRef}
        className="ais-panel__chat" 
        role="log" 
        aria-live="polite" 
        aria-label="Conversation avec l'assistant budget"
      >
        {messages.map((msg) => (
          <Bubble
            key={msg.id}
            message={msg}
            onFill={handleFillAndFocus}
            onAddEntityClick={handleAddEntityClick}
            onBackToMenu={handleBackToMenu}
            onFormSubmit={handleFormSubmit}
          />
        ))}

        {isLoading && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <div className="ais-avatar ais-avatar--ai">
              <i className="bi bi-stars" style={{ fontSize: '13px' }} aria-hidden="true"></i>
            </div>
            <div className="ais-thinking">
              <span className="ais-dot" />
              <span className="ais-dot" />
              <span className="ais-dot" />
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input row */}
      <div className="ais-panel__input-row">
        <input
          ref={inputRef}
          className="ais-panel__input"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ex : ajouter une transaction…"
          aria-label="Question à l'assistant budget"
          disabled={!contextReady}
          autoComplete="off"
        />
        <button
          className="ais-panel__send"
          onClick={handleSend}
          disabled={!inputValue.trim() || isLoading || !contextReady}
          aria-label="Envoyer"
        >
          <i className="bi bi-send" aria-hidden="true" style={{ fontSize: '14px' }}></i>
          Envoyer
        </button>
      </div>
    </div>
  );
}
