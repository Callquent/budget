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
  } = useAISearch({ apiBase, onAddBudget, onAddTransaction, onAddSubscription, onAddCategory });

  // Charger les catégories disponibles
  useEffect(() => {
    if (contextReady) {
      const ctx = getContext();
      const categories = ctx.categories.map(cat => cat.name);
      setAvailableCategories(categories);
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

  // Gère le clic sur "Proposer catégorie" - affiche les catégories dans le chat
  const handleShowCategories = useCallback(() => {
    // Ajouter un message AI avec les boutons de catégories
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    const categoryButtons = availableCategories.map(cat => 
      `<button class="ais-pill" data-select-category="${cat}" style="margin: 4px;">${cat}</button>`
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
    
    addMessage({
      id: `category-selector-${Date.now()}`,
      role: 'ai',
      html,
      timestamp: new Date(),
    });
  }, [availableCategories]);

  // Gère la sélection d'une catégorie - affiche les mois/années
  const handleCategorySelected = useCallback((category: string) => {
    
    // Générer les boutons pour les mois
    const monthButtons = Object.entries(MONTH_NAMES).map(([num, name]) => {
      const monthNum = parseInt(num);
      return `<button class="ais-pill" data-select-period="${category}|${monthNum}|month" style="margin: 4px;">${name}</button>`;
    }).join('');
    
    // Générer les boutons pour les années
    const yearButtons = getAvailableYears().map(year => {
      return `<button class="ais-pill" data-select-period="${category}|${year}|year" style="margin: 4px;">${year}</button>`;
    }).join('');
    
    const html = `
      <div style="margin-bottom: 8px;">
        <strong>Catégorie : ${category}</strong>
      </div>
      <div style="margin-bottom: 8px;">
        <strong>Sélectionnez un mois :</strong>
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;">
        ${monthButtons}
      </div>
      <div style="margin-bottom: 8px;">
        <strong>Ou une année :</strong>
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;">
        ${yearButtons}
      </div>
      <div style="font-size: 12px; color: #666;">
        Cliquez sur un mois et/ou une année pour voir les résultats
      </div>
    `;
    
    addMessage({
      id: `period-selector-${category}-${Date.now()}`,
      role: 'ai',
      html,
      timestamp: new Date(),
    });
  }, []);

  // Gère la sélection d'une période (mois ou année)
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

  // Gère le clic sur les boutons dans les messages
  const handleMessageButtonClick = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // Sélection de catégorie
    const categoryBtn = target.closest<HTMLElement>('[data-select-category]');
    if (categoryBtn?.dataset.selectCategory) {
      handleCategorySelected(categoryBtn.dataset.selectCategory);
      return;
    }
    
    // Sélection de période (mois ou année)
    const periodBtn = target.closest<HTMLElement>('[data-select-period]');
    if (periodBtn?.dataset.selectPeriod) {
      const [category, valueStr, type] = periodBtn.dataset.selectPeriod.split('|');
      const value = parseInt(valueStr);
      handlePeriodSelected(category, value, type as 'month' | 'year');
      return;
    }
  }, [handleCategorySelected, handlePeriodSelected]);

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
