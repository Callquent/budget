import { MONTH_NAMES } from './parser';
import type {
  AddBudgetLinePayload,
  BudgetContext,
  CategoryData,
  ParsedIntent,
  SubscriptionData,
} from './types';

// ── Helpers ────────────────────────────────────────────────────

function fmt(n: number | string): string {
  return parseFloat(String(n)).toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  });
}

function monthLabel(mo: number | null | undefined, yr: number | null | undefined): string {
  if (mo && yr) return `${MONTH_NAMES[mo]} ${yr}`;
  if (mo) return MONTH_NAMES[mo];
  if (yr) return String(yr);
  return '';
}

function badge(status: 'active' | 'inactive'): string {
  return status === 'active'
    ? '<span class="ais-tag ais-tag--active">Actif</span>'
    : '<span class="ais-tag ais-tag--inactive">Inactif</span>';
}

function progressBar(actual: number, planned: number): string {
  const pct = planned > 0 ? Math.min(Math.round((actual / planned) * 100), 100) : 0;
  const color = pct > 100 ? '#E24B4A' : pct > 75 ? '#EF9F27' : '#1D9E75';
  return `
    <div class="ais-progress">
      <div class="ais-progress__fill" style="width:${pct}%;background:${color}"></div>
    </div>`;
}

// ── Intent handlers ────────────────────────────────────────────

function handleTransactionsCategory(
  intent: Extract<ParsedIntent, { intent: 'transactions_category' }>,
  ctx: BudgetContext,
): string {
  const { category, month: mo, year: yr } = intent;
  const hints: string[] = (intent as any).categoryHints ?? [category];

  const txs = ctx.transactions.filter(
    (t) =>
      hints.some((h) => t.category.name.toLowerCase() === h.toLowerCase()) &&
      (mo == null || t.month === mo) &&
      (yr == null || t.year === yr),
  );

  // Nom réel de la catégorie trouvée dans les données
  const resolvedCategory = txs[0]?.category.name ?? category;

  const periodLabel = monthLabel(mo, yr);

  if (!txs.length) {
    return `Aucune transaction <em>${hints.join(' / ').toLowerCase()}</em> trouvée${periodLabel ? ` en ${periodLabel}` : ''}.`;
  }

  const total = txs.reduce((s, t) => s + parseFloat(t.amount), 0);

  const rows = txs
    .map(
      (t) => `
      <div class="ais-row">
        <span>${t.label}</span>
        <span class="ais-amount ais-amount--debit">−${fmt(t.amount)}</span>
      </div>`,
    )
    .join('');

  return `
    Transactions <strong>${resolvedCategory}</strong>${periodLabel ? ` en ${periodLabel}` : ''} :
    <div class="ais-card" style="margin-top:8px">
      ${rows}
      <div class="ais-row ais-row--total">
        <span>Total</span>
        <span class="ais-amount ais-amount--debit">−${fmt(total)}</span>
      </div>
    </div>`;
}

function handleSubscriptionStatus(
  intent: Extract<ParsedIntent, { intent: 'subscription_status' }>,
  ctx: BudgetContext,
): string {
  // Try the pre-matched sub first, then do a fuzzy search on the raw query
  const sub: SubscriptionData | undefined =
    intent.sub ??
    ctx.subscriptions.find((s) =>
      s.name
        .toLowerCase()
        .split(' ')
        .some((w) => w.length > 2 && intent.query.toLowerCase().includes(w)),
    );

  if (!sub) {
    return `Abonnement introuvable. <button class="ais-pill" data-fill="Mes abonnements actifs">Voir tous les abonnements →</button>`;
  }

  const start = new Date(sub.startDate).toLocaleDateString('fr-FR');
  const freqLabel = sub.frequency === 'monthly' ? 'Mensuel' : sub.frequency === 'yearly' ? 'Annuel' : sub.frequency;

  return `
    <div class="ais-card">
      <div class="ais-card__header">
        <strong>${sub.name}</strong>${badge(sub.status)}
      </div>
      <div class="ais-card__meta">
        <span>📅 Depuis le ${start}</span>
        <span>🔄 ${freqLabel} — ${fmt(sub.amount)}</span>
        <span>🏦 ${sub.account.name}</span>
        ${sub.endDate ? `<span>🏁 Fin le ${new Date(sub.endDate).toLocaleDateString('fr-FR')}</span>` : ''}
      </div>
    </div>`;
}

function handleSubscriptionsList(
  intent: Extract<ParsedIntent, { intent: 'subscriptions_list' }>,
  ctx: BudgetContext,
): string {
  const list = intent.filter
    ? ctx.subscriptions.filter((s) => s.status === intent.filter)
    : ctx.subscriptions;

  const monthlyTotal = ctx.subscriptions
    .filter((s) => s.status === 'active' && s.frequency === 'monthly')
    .reduce((s, a) => s + parseFloat(a.amount), 0);

  const rows = list
    .map(
      (s) => `
      <div class="ais-row">
        <span>${s.name} ${badge(s.status)}</span>
        <span class="ais-amount ais-amount--debit">${fmt(s.amount)}/${s.frequency === 'monthly' ? 'm' : 'an'}</span>
      </div>`,
    )
    .join('');

  return `
    <div class="ais-card">
      ${rows}
      ${
        intent.filter !== 'inactive'
          ? `<div class="ais-row ais-row--total">
              <span>Total mensuel</span>
              <span class="ais-amount ais-amount--debit">−${fmt(monthlyTotal)}/mois</span>
            </div>`
          : ''
      }
    </div>`;
}

function handleBalanceCurrent(ctx: BudgetContext): string {
  const rows = ctx.accounts
    .map(
      (a) => `
      <div class="ais-row">
        <span>${a.name}</span>
        <span class="ais-amount">${fmt(a.balance)}</span>
      </div>`,
    )
    .join('');

  const total = ctx.accounts.reduce((s, a) => s + parseFloat(a.balance), 0);

  return `
    Soldes actuels de vos comptes :
    <div class="ais-card" style="margin-top:8px">
      ${rows}
      <div class="ais-row ais-row--total">
        <span>Total</span>
        <span class="ais-amount">${fmt(total)}</span>
      </div>
    </div>`;
}

function handleBalanceForecast(
  intent: Extract<ParsedIntent, { intent: 'balance_forecast' }>,
  ctx: BudgetContext,
): string {
  const { month: mo, year: yr } = intent;
  const moName = MONTH_NAMES[mo];

  const currentTotal = ctx.accounts.reduce((s, a) => s + parseFloat(a.balance), 0);

  // Very simple linear projection: current balance + n months × estimated net
  const now = new Date();
  const target = new Date(yr, mo - 1, 1);
  const diffMonths = Math.max(
    0,
    Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)),
  );

  // Sum income categories from past transactions (average of last 3 months)
  const recentIncome = ctx.transactions
    .filter((t) => t.category.transactionType === 'income')
    .slice(-90)
    .reduce((s, t) => s + parseFloat(t.amount), 0);
  const avgMonthlyIncome = recentIncome / 3 || 2400;

  // Sum active monthly subscriptions + recurring expenses
  const monthlyExpenses = ctx.subscriptions
    .filter((s) => s.status === 'active' && s.frequency === 'monthly')
    .reduce((s, a) => s + parseFloat(a.amount), 0);

  const estimatedMonthlyExpenses = monthlyExpenses + 200 + 750; // add avg food + rent
  const netPerMonth = avgMonthlyIncome - estimatedMonthlyExpenses;
  const projected = currentTotal + netPerMonth * diffMonths;

  const color = projected >= 0 ? '#1D9E75' : '#E24B4A';

  return `
    <div class="ais-card">
      <div class="ais-card__label">Solde projeté en ${moName} ${yr}</div>
      <div class="ais-card__value" style="color:${color}">${fmt(projected)}</div>
      <div class="ais-card__hint">
        Base : solde actuel ${fmt(currentTotal)} + ${diffMonths} mois × solde net estimé ${fmt(netPerMonth)}/mois<br>
        <em>Estimation basée sur vos revenus récents et abonnements actifs.</em>
      </div>
    </div>`;
}

function handleBudgetMonth(
  intent: BaseIntentWithPeriod,
  ctx: BudgetContext,
): string {
  const { month: mo, year: yr } = intent;

  const budgets = ctx.monthlyBudgets.filter(
    (b) => (mo == null || b.month === mo) && (yr == null || b.year === yr),
  );

  const label = monthLabel(mo, yr);

  if (!budgets.length) {
    const fillText = `Ajouter budget ${mo ? MONTH_NAMES[mo] : 'juillet'} ${yr ?? 2026}`;
    return `
      Aucun budget trouvé${label ? ` pour ${label}` : ''}.
      <button class="ais-pill" data-fill="${fillText}">➕ Créer un budget →</button>`;
  }

  const rows = budgets
    .map((b) => {
      const actual = parseFloat(b.actualAmount);
      const planned = parseFloat(b.plannedAmount);
      return `
        <div class="ais-budget-line">
          <div class="ais-row">
            <span>${b.category.name}${b.label ? ` — ${b.label}` : ''}</span>
            <span class="ais-amount ais-amount--debit">${fmt(actual)} / ${fmt(planned)}</span>
          </div>
          ${progressBar(actual, planned)}
        </div>`;
    })
    .join('');

  return `Budget <strong>${label}</strong> :<div class="ais-card" style="margin-top:8px">${rows}</div>`;
}

function handleBudgetAdd(
  intent: BaseIntentWithPeriod,
  ctx: BudgetContext,
  onAddBudget?: (payload: AddBudgetLinePayload) => void,
): string {
  const mo = intent.month ?? 7;
  const yr = intent.year ?? new Date().getFullYear();
  const moName = MONTH_NAMES[mo];

  const exists = ctx.monthlyBudgets.find((b) => b.month === mo && b.year === yr);
  if (exists) {
    return `Un budget existe déjà pour <strong>${moName} ${yr}</strong> (${exists.category.name} — prévu ${fmt(exists.plannedAmount)}). Souhaitez-vous en créer un nouveau pour une autre catégorie ?`;
  }

  const expenseCategories = ctx.categories
    .filter((c: CategoryData) => c.transactionType === 'expense')
    .map((c: CategoryData) => `<option value="${c.name}">${c.name}</option>`)
    .join('');

  // The form uses data attributes so the host component can wire up the submit
  return `
    <div class="ais-card">
      <div class="ais-card__label">Nouvelle ligne budget</div>
      <p style="font-size:12px;color:var(--color-text-secondary);margin-bottom:10px">
        Période : <strong style="color:var(--color-text-primary)">${moName} ${yr}</strong>
      </p>
      <div class="ais-form" data-month="${mo}" data-year="${yr}">
        <label class="ais-form__label">Catégorie
          <select class="ais-form__select" name="category">${expenseCategories}</select>
        </label>
        <label class="ais-form__label">Libellé (optionnel)
          <input class="ais-form__input" type="text" name="label" placeholder="Ex : Vacances été" />
        </label>
        <label class="ais-form__label">Montant prévu (€)
          <input class="ais-form__input" type="number" name="amount" step="0.01" min="0" placeholder="200.00" />
        </label>
        <button class="ais-form__submit" data-action="add-budget">
          ✚ Créer la ligne budget
        </button>
      </div>
    </div>`;
}

function handleExpensesSummary(
  intent: BaseIntentWithPeriod,
  ctx: BudgetContext,
): string {
  const { month: mo, year: yr } = intent;

  const txs = ctx.transactions.filter(
    (t) =>
      t.category.transactionType === 'expense' &&
      (mo == null || t.month === mo) &&
      (yr == null || t.year === yr),
  );

  const byCat: Record<string, number> = {};
  txs.forEach((t) => {
    byCat[t.category.name] = (byCat[t.category.name] ?? 0) + parseFloat(t.amount);
  });

  const total = Object.values(byCat).reduce((s, v) => s + v, 0);
  const label = monthLabel(mo, yr);

  const rows = Object.entries(byCat)
    .sort(([, a], [, b]) => b - a)
    .map(
      ([name, amount]) => `
      <div class="ais-row">
        <span>${name}</span>
        <span class="ais-amount ais-amount--debit">−${fmt(amount)}</span>
      </div>`,
    )
    .join('');

  return `
    Dépenses${label ? ` de ${label}` : ''} par catégorie :
    <div class="ais-card" style="margin-top:8px">
      ${rows}
      <div class="ais-row ais-row--total">
        <span>Total</span>
        <span class="ais-amount ais-amount--debit">−${fmt(total)}</span>
      </div>
    </div>`;
}

function handleCategoriesSummary(ctx: BudgetContext): string {
  const income = ctx.categories.filter((c) => c.transactionType === 'income');
  const expense = ctx.categories.filter((c) => c.transactionType === 'expense');

  const incomeItems = income
    .map((c) => `<span class="ais-tag ais-tag--income">${c.name}</span>`)
    .join('');
  const expenseItems = expense
    .map((c) => `<span class="ais-tag ais-tag--expense">${c.name}</span>`)
    .join('');

  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div class="ais-card">
        <div class="ais-card__label">Revenus</div>
        <div style="display:flex;flex-direction:column;gap:4px;margin-top:6px">${incomeItems}</div>
      </div>
      <div class="ais-card">
        <div class="ais-card__label">Dépenses</div>
        <div style="display:flex;flex-direction:column;gap:4px;margin-top:6px">${expenseItems}</div>
      </div>
    </div>`;
}

// ── Workaround for shared period type ─────────────────────────

type BaseIntentWithPeriod = { month?: number | null; year?: number | null };

// ── Main dispatcher ────────────────────────────────────────────

export function buildResponse(
  intent: ParsedIntent,
  ctx: BudgetContext,
  onAddBudget?: (payload: AddBudgetLinePayload) => void,
): string {
  switch (intent.intent) {
    case 'transactions_category':
      return handleTransactionsCategory(intent, ctx);
    case 'subscription_status':
      return handleSubscriptionStatus(intent, ctx);
    case 'subscriptions_list':
      return handleSubscriptionsList(intent, ctx);
    case 'balance_current':
      return handleBalanceCurrent(ctx);
    case 'balance_forecast':
      return handleBalanceForecast(intent, ctx);
    case 'budget_month':
      return handleBudgetMonth(intent, ctx);
    case 'budget_add':
      return handleBudgetAdd(intent, ctx, onAddBudget);
    case 'expenses_summary':
      return handleExpensesSummary(intent, ctx);
    case 'categories_summary':
      return handleCategoriesSummary(ctx);
    case 'unknown':
    default:
      return `
        Je ne comprends pas encore cette question. Essayez par exemple :<br>
        • <em>« Les courses en février 2026 »</em><br>
        • <em>« Mon abonnement TER est-il actif ? »</em><br>
        • <em>« Solde restant en décembre 2026 »</em><br>
        • <em>« Ajouter budget juillet 2026 »</em>`;
  }
}
