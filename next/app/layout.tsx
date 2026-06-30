'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Geist, Geist_Mono } from 'next/font/google';
import Sidebar from '@/components/Sidebar';
import AISearchDrawer from '@/components/AISearchDrawer';
import type {
  AddBudgetLinePayload,
  AddCategoryPayload,
  AddSubscriptionPayload,
  AddTransactionPayload,
} from '@/lib/ai-search';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState<string | undefined>();

  const handleSearch = useCallback((query: string) => {
    setInitialQuery(query);
    setDrawerOpen(true);
  }, []);

  /**
   * Résout l'ID d'une catégorie ou d'un compte depuis son nom,
   * en s'appuyant sur le contexte déjà chargé par l'assistant.
   */
  const resolveIds = useCallback(async (categoryName: string, accountName?: string) => {
    const ctxRes = await fetch('/api/ai-search/context');
    const ctx = await ctxRes.json();
    const category = (ctx.categories as { id: number; name: string }[]).find(
      (c) => c.name === categoryName,
    );
    const account = accountName
      ? (ctx.accounts as { id: number; name: string }[]).find((a) => a.name === accountName)
      : undefined;
    return { categoryId: category?.id, accountId: account?.id };
  }, []);

  // ── Ligne de budget ────────────────────────────────────────────
  const handleAddBudget = useCallback(
    async (payload: AddBudgetLinePayload) => {
      const { categoryId } = await resolveIds(payload.category);
      if (!categoryId) throw new Error(`Catégorie introuvable : ${payload.category}`);

      const res = await fetch('/api/ai-search/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId,
          year: payload.year,
          month: payload.month,
          plannedAmount: payload.amount.toFixed(2),
          label: payload.label,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Erreur ${res.status}`);
      }
      router.refresh();
    },
    [resolveIds, router],
  );

  // ── Transaction ─────────────────────────────────────────────────
  // Utilise le controller existant App\Controller\TransactionController
  // (route /transactions/new — adapte le chemin si différent).
  const handleAddTransaction = useCallback(
    async (payload: AddTransactionPayload) => {
      const { categoryId, accountId } = await resolveIds(payload.category, payload.account);
      if (!categoryId || !accountId) {
        throw new Error('Catégorie ou compte introuvable.');
      }

      const res = await fetch('/transactions/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: payload.label,
          amount: payload.amount.toFixed(2),
          type: payload.type,
          transactionDate: payload.date,
          categoryId,
          accountId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Erreur ${res.status}`);
      }
      router.refresh();
    },
    [resolveIds, router],
  );

  // ── Abonnement ──────────────────────────────────────────────────
  // Utilise le controller existant App\Controller\SubscriptionController
  // (route /subscriptions/new).
  const handleAddSubscription = useCallback(
    async (payload: AddSubscriptionPayload) => {
      const { categoryId, accountId } = await resolveIds(payload.category, payload.account);
      if (!categoryId || !accountId) {
        throw new Error('Catégorie ou compte introuvable.');
      }

      const res = await fetch('/subscriptions/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: payload.name,
          amount: payload.amount.toFixed(2),
          frequency: payload.frequency,
          dayOfMonth: payload.dayOfMonth ?? null,
          startDate: payload.startDate,
          endDate: payload.endDate ?? null,
          categoryId,
          accountId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Erreur ${res.status}`);
      }
      router.refresh();
    },
    [resolveIds, router],
  );

  // ── Catégorie ───────────────────────────────────────────────────
  // Utilise le controller existant App\Controller\CategoryController
  // (route /categories/new).
  const handleAddCategory = useCallback(
    async (payload: AddCategoryPayload) => {
      const res = await fetch('/categories/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: payload.name,
          transactionType: payload.transactionType,
          frequency: payload.frequency,
          description: payload.description ?? null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Erreur ${res.status}`);
      }
      router.refresh();
    },
    [router],
  );

  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"
        />
        <script
          src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"
          async
        ></script>
      </head>
      <body
        className="min-h-full"
        style={{ display: 'flex', background: '#f8fafc' }}
      >
        <Sidebar onSearch={handleSearch} />

        <main style={{ flexGrow: 1, minWidth: 0 }} className="p-4 pb-5 pb-md-4">
          {children}
        </main>

        <AISearchDrawer
          open={drawerOpen}
          initialQuery={initialQuery}
          onClose={() => setDrawerOpen(false)}
          onAddBudget={handleAddBudget}
          onAddTransaction={handleAddTransaction}
          onAddSubscription={handleAddSubscription}
          onAddCategory={handleAddCategory}
          apiBase="/api"
        />
      </body>
    </html>
  );
}
