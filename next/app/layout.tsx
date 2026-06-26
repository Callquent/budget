'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Geist, Geist_Mono } from 'next/font/google';
import Sidebar from '@/components/Sidebar';
import AISearchDrawer from '@/components/AISearchDrawer';
import type { AddBudgetLinePayload } from '@/lib/ai-search';

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
   * Crée une ligne budget via l'endpoint dédié à l'assistant IA.
   * POST /api/ai-search/budget
   *
   * Le payload.category contient le NOM de la catégorie (ex: "Alimentation").
   * On doit d'abord résoudre l'ID via /api/ai-search/context ou le passer directement.
   * Ici on envoie le nom et laisse Symfony faire la résolution.
   */
  const handleAddBudget = useCallback(
    async (payload: AddBudgetLinePayload) => {
      // 1. Résoudre l'ID de la catégorie depuis son nom
      const ctxRes = await fetch('/api/ai-search/context');
      const ctx = await ctxRes.json();
      const cat = (ctx.categories as { id: number; name: string }[]).find(
        (c) => c.name === payload.category,
      );

      if (!cat) {
        throw new Error(`Catégorie introuvable : ${payload.category}`);
      }

      // 2. Créer la ligne budget
      const res = await fetch('/api/ai-search/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId:    cat.id,
          year:          payload.year,
          month:         payload.month,
          plannedAmount: payload.amount.toFixed(2),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Erreur ${res.status}`);
      }

      // 3. Invalider le cache Next.js
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
          apiBase="/api"
        />
      </body>
    </html>
  );
}
