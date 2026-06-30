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
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<number | ''>('');
  const [selectedYear, setSelectedYear] = useState<number | ''>('');
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

  const handleCategorySuggestionClick = useCallback(() => {
    setShowCategorySuggestions(true);
    setSelectedCategory('');
    setSelectedMonth('');
    setSelectedYear('');
  }, []);

  const handleCategorySelect = useCallback((category: string) => {
    setSelectedCategory(category);
  }, []);

  const handleMonthSelect = useCallback((month: number | '') => {
    setSelectedMonth(month);
  }, []);

  const handleYearSelect = useCallback((year: number | '') => {
    setSelectedYear(year);
  }, []);

  const handleApplySuggestion = useCallback(() => {
    let query = '';
    
    if (selectedCategory) {
      query = selectedCategory;
      
      if (selectedMonth) {
        query += ` ${MONTH_NAMES[selectedMonth]}`;
      }
      
      if (selectedYear) {
        query += ` ${selectedYear}`;
      }
    } else {
      // Si aucune catégorie sélectionnée, proposer toutes les catégories
      if (selectedMonth || selectedYear) {
        query = 'Budget';
        
        if (selectedMonth) {
          query += ` ${MONTH_NAMES[selectedMonth]}`;
        }
        
        if (selectedYear) {
          query += ` ${selectedYear}`;
        }
      } else {
        // Si vraiment rien n'est sélectionné, on affiche toutes les catégories pour le mois courant
        const now = new Date();
        query = `Budget ${MONTH_NAMES[now.getMonth() + 1]} ${now.getFullYear()}`;
      }
    }
    
    if (query) {
      handleFillAndFocus(query);
    }
    
    setShowCategorySuggestions(false);
    setSelectedCategory('');
    setSelectedMonth('');
    setSelectedYear('');
  }, [selectedCategory, selectedMonth, selectedYear, handleFillAndFocus]);

  const handleCancelSuggestion = useCallback(() => {
    setShowCategorySuggestions(false);
    setSelectedCategory('');
    setSelectedMonth('');
    setSelectedYear('');
  }, []);

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showCategorySuggestions) {
        handleCancelSuggestion();
      }
    };
    
    if (showCategorySuggestions) {
      document.addEventListener('keydown', handleEscape);
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showCategorySuggestions, handleCancelSuggestion]);

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
          onClick={handleCategorySuggestionClick}
          disabled={!contextReady || availableCategories.length === 0}
          title={!contextReady ? 'Chargement des données...' : availableCategories.length === 0 ? 'Aucune catégorie disponible' : 'Proposer une catégorie, un mois et/ou une année'}
        >
          🎯 Proposer catégorie...
        </button>
      </div>

      {/* Chat area */}
      <div className="ais-panel__chat" role="log" aria-live="polite" aria-label="Conversation avec l'assistant budget">
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

      {/* Category Suggestion Modal */}
      {showCategorySuggestions && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCancelSuggestion();
            }
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              width: '90%',
              maxWidth: '500px',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
            }}
          >
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 600 }}>
              Proposer une recherche
            </h3>

            {/* Category Selection */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                Catégorie
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => handleCategorySelect(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                }}
              >
                <option value="">Toutes les catégories</option>
                {availableCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            {/* Month and Year Selection */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                  Mois (optionnel)
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => handleMonthSelect(e.target.value ? parseInt(e.target.value) : '')}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                  }}
                >
                  <option value="">Tous les mois</option>
                  {Object.entries(MONTH_NAMES).map(([num, name]) => (
                    <option key={num} value={num}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                  Année (optionnel)
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => handleYearSelect(e.target.value ? parseInt(e.target.value) : '')}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                  }}
                >
                  <option value="">Toutes les années</option>
                  {getAvailableYears().map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Preview */}
            {selectedCategory || selectedMonth || selectedYear ? (
              <div style={{ marginBottom: '20px', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
                <strong style={{ fontSize: '14px' }}>Prévisualisation : </strong>
                <span style={{ color: '#6366f1' }}>
                  {selectedCategory || 'toutes les catégories'}
                  {selectedMonth ? ` ${MONTH_NAMES[selectedMonth]}` : ''}
                  {selectedYear ? ` ${selectedYear}` : ''}
                </span>
              </div>
            ) : null}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleCancelSuggestion}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  background: 'white',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Annuler
              </button>
              <button
                onClick={handleApplySuggestion}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '8px',
                  background: '#6366f1',
                  color: 'white',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Appliquer
              </button>
            </div>
          </div>
        </div>
      )}

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
