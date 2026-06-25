'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAISearch } from '../lib/ai-search';
import type { AddBudgetLinePayload, ChatMessage } from '../lib/ai-search';
import '../styles/ai-search.css';

// ── Quick suggestion pills ─────────────────────────────────────

const SUGGESTIONS = [
  '🛒 Les courses en février 2026',
  '💰 Solde restant en décembre 2026',
  '🚆 Mon abonnement TER est-il actif ?',
  '➕ Ajouter budget juillet 2026',
  '📊 Dépenses par catégorie',
  '💳 Mes abonnements actifs',
];

// ── Bubble ─────────────────────────────────────────────────────

function Bubble({
  message,
  onFill,
  onFormSubmit,
}: {
  message: ChatMessage;
  onFill: (text: string) => void;
  onFormSubmit: (form: HTMLElement) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Wire up dynamic buttons that the HTML builder injects
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // data-fill button → fill the input
      const fillBtn = target.closest<HTMLElement>('[data-fill]');
      if (fillBtn?.dataset.fill) {
        onFill(fillBtn.dataset.fill);
        return;
      }

      // data-action="add-budget" submit button
      const submitBtn = target.closest<HTMLElement>('[data-action="add-budget"]');
      if (submitBtn) {
        const form = submitBtn.closest<HTMLElement>('.ais-form');
        if (form) onFormSubmit(form);
      }
    };

    el.addEventListener('click', handleClick);
    return () => el.removeEventListener('click', handleClick);
  }, [onFill, onFormSubmit]);

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
  onAddBudget?: (payload: AddBudgetLinePayload) => Promise<void>;
}

export default function AISearchPanel({ apiBase, onAddBudget }: AISearchPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, isLoading, contextReady, sendMessage, handleFill, handleFormSubmit } =
    useAISearch({ apiBase, onAddBudget });

  // Scroll to bottom on new message
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

  const handleFillAndFocus = useCallback(
    (text: string) => {
      setInputValue(text);
      inputRef.current?.focus();
    },
    [],
  );

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
      </div>

      {/* Chat area */}
      <div className="ais-panel__chat" role="log" aria-live="polite" aria-label="Conversation avec l'assistant budget">
        {messages.map((msg) => (
          <Bubble
            key={msg.id}
            message={msg}
            onFill={handleFillAndFocus}
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
          placeholder="Ex : les courses du mois de février 2026…"
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
