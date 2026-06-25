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

  const handleAddBudget = useCallback(
    async (payload: AddBudgetLinePayload) => {
      const res = await fetch('/api/monthly-budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: `/api/categories/${payload.category}`,
          plannedAmount: payload.amount.toFixed(2),
          year: payload.year,
          month: payload.month,
        }),
      });

      if (!res.ok) throw new Error(`Failed to create budget line: ${res.statusText}`);

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

        <main
          style={{ flexGrow: 1, minWidth: 0 }}
          className="p-4 pb-5 pb-md-4"
        >
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
