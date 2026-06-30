'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import type {
  AddBudgetLinePayload,
  AddCategoryPayload,
  AddSubscriptionPayload,
  AddTransactionPayload,
} from '../lib/ai-search';

// Lazy-load the panel so it doesn't bloat the initial JS bundle
const AISearchPanel = dynamic(() => import('./AISearchPanel'), { ssr: false });

interface AISearchDrawerProps {
  open: boolean;
  initialQuery?: string;
  onClose: () => void;
  onAddBudget?: (payload: AddBudgetLinePayload) => Promise<void>;
  onAddTransaction?: (payload: AddTransactionPayload) => Promise<void>;
  onAddSubscription?: (payload: AddSubscriptionPayload) => Promise<void>;
  onAddCategory?: (payload: AddCategoryPayload) => Promise<void>;
  apiBase?: string;
}

export default function AISearchDrawer({
  open,
  initialQuery,
  onClose,
  onAddBudget,
  onAddTransaction,
  onAddSubscription,
  onAddCategory,
  apiBase,
}: AISearchDrawerProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Trap body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1200,
          background: 'rgba(0,0,0,.45)',
          backdropFilter: 'blur(2px)',
        }}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Assistant budget"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 1201,
          width: 'min(480px, 100vw)',
          background: 'var(--color-background-primary, #fff)',
          boxShadow: '-4px 0 24px rgba(0,0,0,.18)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Drawer header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '0.5px solid var(--color-border-tertiary)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <i className="bi bi-stars text-white" style={{ fontSize: '13px' }}></i>
            </span>
            <span style={{ fontWeight: 500, fontSize: '15px', color: 'var(--color-text-primary)' }}>
              Assistant budget
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
              borderRadius: '6px',
              transition: 'background .15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-background-secondary)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            <i className="bi bi-x-lg" style={{ fontSize: '16px' }}></i>
          </button>
        </div>

        {/* Panel */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <AISearchPanel
            apiBase={apiBase}
            onAddBudget={onAddBudget}
            onAddTransaction={onAddTransaction}
            onAddSubscription={onAddSubscription}
            onAddCategory={onAddCategory}
            initialQuery={initialQuery}
          />
        </div>
      </div>
    </>
  );
}
