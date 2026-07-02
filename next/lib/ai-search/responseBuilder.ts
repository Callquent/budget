import { MONTH_NAMES } from './parser';
import type {
  AddBudgetLinePayload,
  AddCategoryPayload,
  AddEntityHandlers,
  AddEntityType,
  AddSubscriptionPayload,
  AddTransactionPayload,
  BudgetContext,
  CategoryData,
  ParsedIntent,
  SubscriptionData,
} from './types';

// ── Helpers ────────────────────────────────────────────────────

function fmt(n: number | string): string {
  return parseFrenchNumber(n).toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  });
}

/**
 * Parse un nombre formaté en français (ex: "1 568,55 €" ou "1568,55")
 * en un nombre JavaScript.
 */
export function parseFrenchNumber(value: string | number): number {
  if (typeof value === 'number') return value;
  
  const s = String(value).trim();
  
  // Retirer le symbole euro et les espaces
  const withoutEuro = s.replace(/€/g, '').replace(/\s+/g, '');
  
  // Remplacer la virgule par un point pour parseFloat
  const normalized = withoutEuro.replace(/,/g, '.');
  
  const result = parseFloat(normalized);
  return isNaN(result) ? 0 : result;
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

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Reproduit exactement le calcul de `planned_net` du backend
 * (BudgetController::index) :
 *  - on ne compte QUE le montant prévu (pas prévu − réalisé) : une fois
 *    une ligne "approuvée", elle est considérée comme déjà réalisée et
 *    donc déjà présente dans le solde réel (account.balance) → on
 *    l'exclut pour ne pas la compter deux fois ;
 *  - une ligne de budget sans compte assigné (`account` absent) s'applique
 *    à TOUS les comptes (équivalent du bucket "all" côté backend) ;
 *  - on cumule le prévu du mois courant jusqu'au mois ciblé inclus (pas
 *    seulement le mois ciblé) pour l'année en cours ; pour une année
 *    future, on cumule depuis janvier ; pour une année passée, il n'y a
 *    plus rien "à venir" donc le résultat est 0.
 */
function computePlannedNet(
  ctx: BudgetContext,
  mo: number,
  yr: number,
  accountName?: string,
): number {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  let fromMonth: number;
  const toMonth = mo;

  if (yr < currentYear) {
    return 0;
  } else if (yr === currentYear) {
    if (mo < currentMonth) return 0;
    fromMonth = currentMonth;
  } else {
    fromMonth = 1;
  }

  return ctx.monthlyBudgets
    .filter(
      (b) =>
        !b.isApproved &&
        b.year === yr &&
        b.month >= fromMonth &&
        b.month <= toMonth &&
        (!accountName || !b.account || b.account.name === accountName),
    )
    .reduce((sum, b) => {
      const planned = parseFrenchNumber(b.plannedAmount);
      const sign = b.category.transactionType === 'income' ? 1 : -1;
      return sum + sign * planned;
    }, 0);
}

/**
 * `account.balance` (renvoyé par /ai-search/context) est un solde de
 * référence figé — pas le solde "à jour". Le backend (BudgetController)
 * reconstruit le solde réel comme : solde de référence + mouvements
 * réels (crédit − débit) de l'année en cours, du mois 1 jusqu'au mois
 * courant inclus. On reproduit ce calcul ici pour éviter d'afficher un
 * solde de départ obsolète.
 */
function computeLiveBalance(
  ctx: BudgetContext,
  accountName: string,
): number {
  const account = ctx.accounts.find((a) => a.name === accountName);
  if (!account) return 0;

  const baseline = parseFrenchNumber(account.balance);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const cumNet = ctx.transactions
    .filter(
      (t) =>
        t.account.name === accountName &&
        t.year === currentYear &&
        t.month <= currentMonth,
    )
    .reduce(
      (sum, t) =>
        sum + (t.type === 'credit' ? 1 : -1) * parseFrenchNumber(t.amount),
      0,
    );

  return baseline + cumNet;
}

function computeLiveTotalBalance(ctx: BudgetContext): number {
  return ctx.accounts.reduce(
    (sum, a) => sum + computeLiveBalance(ctx, a.name),
    0,
  );
}

// ── Intent handlers : lecture ──────────────────────────────────

function handleTransactionsCategory(
  intent: Extract<ParsedIntent, { intent: 'transactions_category' }>,
  ctx: BudgetContext,
): string {
  const { category, month: mo, year: yr } = intent;

  const txs = ctx.transactions.filter(
    (t) =>
      t.category.name === category &&
      (mo == null || t.month === mo) &&
      (yr == null || t.year === yr),
  );

  const periodLabel = monthLabel(mo, yr);

  if (!txs.length) {
    return `Aucune transaction <em>${category.toLowerCase()}</em> trouvée${periodLabel ? ` en ${periodLabel}` : ''}.`;
  }

  const total = txs.reduce((s, t) => s + parseFrenchNumber(t.amount), 0);

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
    Transactions <strong>${category}</strong>${periodLabel ? ` en ${periodLabel}` : ''} :
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
  const { filter, month: mo, year: yr } = intent;
  const label = monthLabel(mo, yr);
  
  // Filter subscriptions
  let list = ctx.subscriptions;
  
  if (filter) {
    list = list.filter((s) => s.status === filter);
  }
  
  // Si mois/année spécifiés, filtrer les abonnements actifs à cette période
  if (mo && yr) {
    list = list.filter((s) => {
      const start = new Date(s.startDate);
      const end = s.endDate ? new Date(s.endDate) : null;
      const targetDate = new Date(yr, mo - 1, 1);
      
      // Abonnement actif si :
      // - date de début <= période ciblée
      // - (pas de date de fin) OU (date de fin >= période ciblée)
      // - statut est actif
      return s.status === 'active' && 
             start <= targetDate && 
             (end === null || end >= targetDate);
    });
  }

  // Calculer le total mensuel parmi les abonnements filtrés
  const monthlyTotal = list
    .filter((s) => s.frequency === 'monthly')
    .reduce((s, a) => s + parseFrenchNumber(a.amount), 0);

  const periodLabel = label ? ` ${label}` : '';
  
  if (list.length === 0) {
    return `Aucun abonnement${filter ? ` ${filter}` : ''}${periodLabel} trouvé.`;
  }

  const rows = list
    .map(
      (s) => `
      <div class="ais-row">
        <span>${s.name} ${badge(s.status)}</span>
        <span class="ais-amount ais-amount--debit">${fmt(s.amount)}/${s.frequency === 'monthly' ? 'm' : s.frequency === 'yearly' ? 'an' : s.frequency}</span>
      </div>`,
    )
    .join('');

  return `
    <div class="ais-card">
      <div class="ais-card__label">Abonnements${periodLabel}${filter ? ` (${filter})` : ''} (${list.length})</div>
      ${rows}
      ${
        list.length > 0 && filter !== 'inactive'
          ? `<div class="ais-row ais-row--total">
              <span>Total mensuel</span>
              <span class="ais-amount ais-amount--debit">−${fmt(monthlyTotal)}/mois</span>
            </div>`
          : ''
      }
    </div>`;
}

function handleBalanceCurrent(intent: Extract<ParsedIntent, { intent: 'balance_current' }>, ctx: BudgetContext): string {
  const { account: accountName } = intent;
  
  if (accountName) {
    // Filtrer par compte spécifique
    const account = ctx.accounts.find(a => a.name === accountName);
    if (!account) {
      return `⚠️ Compte "${accountName}" non trouvé.`;
    }
    
    const balance = computeLiveBalance(ctx, account.name);
    const color = balance >= 0 ? '#0a3622' : '#842029';
    
    return `
      <div class="ais-card">
        <div class="ais-card__label">${account.name}</div>
        <div style="font-weight: 700; font-size: .95rem; color: ${color};">
          ${fmt(balance)}
        </div>
        <div class="ais-card__hint">
          <em>Solde à jour pour ce compte.</em>
        </div>
      </div>`;
  }
  
  // Sans compte spécifié, afficher tous les comptes
  const rows = ctx.accounts
    .map(
      (a) => `
      <div class="ais-row">
        <span>${a.name}</span>
        <span class="ais-amount">${fmt(computeLiveBalance(ctx, a.name))}</span>
      </div>`,
    )
    .join('');

  const total = computeLiveTotalBalance(ctx);
  const totalColor = total >= 0 ? '#0a3622' : '#842029';

  return `
    Soldes actuels de vos comptes :
    <div class="ais-card" style="margin-top:8px">
      ${rows}
      <div class="ais-row ais-row--total">
        <span><strong>Total :</strong></span>
        <span style="font-weight: 700; color: ${totalColor};">${fmt(total)}</span>
      </div>
    </div>`;
}

function handleBalanceForecast(
  intent: Extract<ParsedIntent, { intent: 'balance_forecast' }>,
  ctx: BudgetContext,
): string {
  const { month: mo, year: yr, account: accountName } = intent;
  const moName = MONTH_NAMES[mo];

  if (accountName) {
    // Filtrer par compte spécifique
    const account = ctx.accounts.find(a => a.name === accountName);
    if (!account) {
      return `⚠️ Compte "${accountName}" non trouvé.`;
    }
    
    const currentBalance = computeLiveBalance(ctx, account.name);

    // Reste à réaliser du budget prévu pour ce mois précis (même logique
    // que "Solde projeté" dans BudgetMonthView : prévu − réalisé, par
    // catégorie, pour ce compte).
    const plannedNet = computePlannedNet(ctx, mo, yr, accountName);
    const projected = currentBalance + plannedNet;

    const projectedColor = projected >= 0 ? '#055160' : '#842029';
    const currentColor = currentBalance >= 0 ? '#0a3622' : '#842029';

    return `
    <div class="ais-card">
      <div class="ais-card__label">${account.name} ${moName} ${yr}</div>
      <div style="font-weight: 700; font-size: .95rem; color: ${currentColor};">
        ${fmt(currentBalance)}
      </div>
      ${plannedNet !== 0 ? `
      <div style="margin-top: 8px; padding-top: 4px; border-top: 1px solid rgba(0,0,0,.10);">
        <div style="font-size: .68rem; color: #adb5bd; margin-bottom: 1px; text-align: right;">
          Estimation prévue du solde en fin de mois
        </div>
        <div style="font-size: .82rem; font-weight: 600; color: ${projectedColor}; text-align: right;">
          ${fmt(projected)}
        </div>
      </div>` : ''}
      <div class="ais-card__hint">
        <em>Projection basée sur le budget prévu restant pour ${moName} ${yr}</em>
      </div>
    </div>`;
  }

  // Sans compte spécifié, calculer pour tous les comptes
  const currentTotal = computeLiveTotalBalance(ctx);

  // Reste à réaliser du budget prévu pour ce mois précis, tous comptes
  // confondus (même logique que "Solde projeté" dans BudgetMonthView).
  const plannedNet = computePlannedNet(ctx, mo, yr);
  const projected = currentTotal + plannedNet;

  const projectedColor = projected >= 0 ? '#055160' : '#842029';
  const currentColor = currentTotal >= 0 ? '#0a3622' : '#842029';

  return `
    <div class="ais-card">
      <div class="ais-card__label">Solde global en ${moName} ${yr}</div>
      <div style="font-weight: 700; font-size: .95rem; color: ${currentColor};">
        ${fmt(currentTotal)}
      </div>
      ${plannedNet !== 0 ? `
      <div style="margin-top: 8px; padding-top: 4px; border-top: 1px solid rgba(0,0,0,.10);">
        <div style="font-size: .68rem; color: #adb5bd; margin-bottom: 1px; text-align: right;">
          Estimation prévue du solde en fin de mois
        </div>
        <div style="font-size: .82rem; font-weight: 600; color: ${projectedColor}; text-align: right;">
          ${fmt(projected)}
        </div>
      </div>` : ''}
      <div class="ais-card__hint">
        <em>Projection basée sur le budget prévu restant pour ${moName} ${yr} (tous comptes confondus)</em>
      </div>
    </div>`;
}

function handleBudgetMonth(intent: BaseIntentWithPeriod, ctx: BudgetContext): string {
  const { month: mo, year: yr } = intent;

  const budgets = ctx.monthlyBudgets.filter(
    (b) => (mo == null || b.month === mo) && (yr == null || b.year === yr),
  );

  const label = monthLabel(mo, yr);

  if (!budgets.length) {
    return `
      Aucun budget trouvé${label ? ` pour ${label}` : ''}.
      <button class="ais-pill" data-fill="Ajouter budget">➕ Créer un budget →</button>`;
  }

  const rows = budgets
    .map((b) => {
      const actual = parseFrenchNumber(b.actualAmount);
      const planned = parseFrenchNumber(b.plannedAmount);
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

function handleExpensesSummary(intent: BaseIntentWithPeriod, ctx: BudgetContext): string {
  const { month: mo, year: yr } = intent;

  const txs = ctx.transactions.filter(
    (t) =>
      t.category.transactionType === 'expense' &&
      (mo == null || t.month === mo) &&
      (yr == null || t.year === yr),
  );

  const byCat: Record<string, number> = {};
  txs.forEach((t) => {
    byCat[t.category.name] = (byCat[t.category.name] ?? 0) + parseFrenchNumber(t.amount);
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

// ── Category Data Handler ───────────────────────────────────────

function handleCategoryData(
  intent: Extract<ParsedIntent, { intent: 'category_data' }>,
  ctx: BudgetContext,
): string {
  const { category, month: mo, year: yr } = intent;
  const label = monthLabel(mo, yr);
  
  // Find the actual category object
  const cat = ctx.categories.find(c => c.name.toLowerCase() === category.toLowerCase());
  const catName = cat?.name ?? category;
  
  let htmlParts: string[] = [];
  const period = label ? ` ${label}` : '';

  // 1. Transactions for this category
  const txs = ctx.transactions.filter(
    (t) => 
      t.category.name.toLowerCase() === category.toLowerCase() &&
      (mo == null || t.month === mo) &&
      (yr == null || t.year === yr),
  );

  if (txs.length > 0) {
    const txTotal = txs.reduce((s, t) => s + parseFrenchNumber(t.amount), 0);
    const rows = txs
      .map((t) => `
        <div class="ais-row">
          <span>${t.label}</span>
          <span class="ais-amount ais-amount--${t.type}">${fmt(t.amount)}</span>
        </div>`)
      .join('');
    
    htmlParts.push(`
      <div class="ais-card">
        <div class="ais-card__label">Transactions${period} (${txs.length})</div>
        ${rows}
        <div class="ais-row ais-row--total">
          <span>Total</span>
          <span class="ais-amount">${fmt(txTotal)}</span>
        </div>
      </div>`);
  }

  // 2. Budgets for this category
  const budgets = ctx.monthlyBudgets.filter(
    (b) => 
      b.category.name.toLowerCase() === category.toLowerCase() &&
      (mo == null || b.month === mo) &&
      (yr == null || b.year === yr),
  );

  if (budgets.length > 0) {
    const rows = budgets
      .map((b) => {
        const planned = parseFrenchNumber(b.plannedAmount);
        const actual = parseFrenchNumber(b.actualAmount);
        const pct = planned > 0 ? Math.min(Math.round((actual / planned) * 100), 100) : 0;
        const color = pct > 100 ? '#E24B4A' : pct > 75 ? '#EF9F27' : '#1D9E75';
        return `
          <div class="ais-budget-line">
            <div class="ais-row">
              <span>${b.label || catName}</span>
              <span class="ais-amount">${fmt(actual)} / ${fmt(planned)}</span>
            </div>
            <div class="ais-progress">
              <div class="ais-progress__fill" style="width:${pct}%;background:${color}"></div>
            </div>
          </div>`;
      })
      .join('');
    
    htmlParts.push(`
      <div class="ais-card">
        <div class="ais-card__label">Budget${period}</div>
        ${rows}
      </div>`);
  }

  // 3. Subscriptions for this category
  const subs = ctx.subscriptions.filter(
    (s) => 
      s.category.name.toLowerCase() === category.toLowerCase() &&
      s.status === 'active'
  );

  if (subs.length > 0) {
    const subTotal = subs.reduce((s, sub) => s + parseFrenchNumber(sub.amount), 0);
    const rows = subs
      .map((s) => `
        <div class="ais-row">
          <span>${s.name}</span>
          <span class="ais-amount ais-amount--debit">${fmt(s.amount)}/${s.frequency === 'monthly' ? 'mois' : s.frequency === 'yearly' ? 'an' : s.frequency}</span>
        </div>`)
      .join('');
    
    htmlParts.push(`
      <div class="ais-card">
        <div class="ais-card__label">Abonnements actifs (${subs.length})</div>
        ${rows}
        <div class="ais-row ais-row--total">
          <span>Total</span>
          <span class="ais-amount ais-amount--debit">${fmt(subTotal)}/mois</span>
        </div>
      </div>`);
  }

  // If no data found
  if (htmlParts.length === 0) {
    return `Aucune donnée trouvée pour <strong>${catName}</strong>${period}.`;
  }

  return htmlParts.join('\n');
}

// ── Intent handlers : ajout (menu + 4 formulaires) ──────────────

/**
 * Carte cliquable pour le menu "Que souhaitez-vous ajouter ?".
 * Chaque carte déclenche un data-action que le composant host écoute
 * pour rafficher le bon formulaire dans la même bulle.
 */
function addMenuCard(entity: AddEntityType, icon: string, name: string, desc: string): string {
  return `
    <button class="ais-add-card" data-add-entity="${entity}">
      <i class="ais-add-card__icon" data-icon="${icon}"></i>
      <div class="ais-add-card__name">${name}</div>
      <div class="ais-add-card__desc">${desc}</div>
    </button>`;
}

function handleAddMenu(
  intent: Extract<ParsedIntent, { intent: 'add_menu' }>,
  ctx: BudgetContext,
): string {
  // Si l'entité est déjà déterminée par le NLP (ex: "ajouter un abonnement"),
  // on saute directement au formulaire correspondant.
  if (intent.entity) {
    return renderAddForm(intent.entity, ctx, intent.month, intent.year);
  }

  return `
    <div style="font-weight: 600; margin-bottom: 8px; color: var(--color-text-primary, #111827);">Que souhaitez-vous ajouter ?</div>
    <div class="ais-add-menu">
      ${addMenuCard('transaction', 'arrows-exchange', 'Transaction', 'Crédit ou débit')}
      ${addMenuCard('subscription', 'refresh', 'Abonnement', 'Récurrent mensuel/annuel')}
      ${addMenuCard('budget', 'calendar-stats', 'Ligne budget', 'Prévu pour un mois')}
      ${addMenuCard('category', 'tags', 'Catégorie', 'Classer les opérations')}
    </div>`;
}

/**
 * Affiche le formulaire de création pour une entité donnée.
 * Exporté pour que le composant host puisse l'appeler quand l'utilisateur
 * clique sur une carte du menu (sans repasser par le NLP).
 */
export function renderAddForm(
  entity: AddEntityType,
  ctx: BudgetContext,
  mo?: number | null,
  yr?: number | null,
): string {
  switch (entity) {
    case 'transaction':
      return formTransaction(ctx, mo, yr);
    case 'subscription':
      return formSubscription(ctx);
    case 'budget':
      return formBudget(ctx, mo, yr);
    case 'category':
      return formCategory();
    default:
      return '';
  }
}

function formTransaction(ctx: BudgetContext, mo?: number | null, yr?: number | null): string {
  const now = new Date();
  const defDate = mo && yr
    ? `${yr}-${String(mo).padStart(2, '0')}-${String(Math.min(now.getDate(), 28)).padStart(2, '0')}`
    : todayISO();

  const categoryOptions = ctx.categories
    .map((c) => `<option value="${c.name}">${c.name}</option>`)
    .join('');
  const accountOptions = ctx.accounts
    .map((a) => `<option value="${a.name}">${a.name}</option>`)
    .join('');

  return `
    <div class="ais-card">
      <div class="ais-card__label">Nouvelle transaction</div>
      <div class="ais-form" data-type="transaction">
        <div class="ais-form__row2">
          <label class="ais-form__label">Libellé
            <input class="ais-form__input" name="label" placeholder="Ex : Courses Carrefour" />
          </label>
          <label class="ais-form__label">Montant (€)
            <input class="ais-form__input" type="number" name="amount" step="0.01" min="0" placeholder="0.00" />
          </label>
        </div>
        <div class="ais-form__row2">
          <label class="ais-form__label">Type
            <select class="ais-form__select" name="type">
              <option value="debit">Débit (dépense)</option>
              <option value="credit">Crédit (revenu)</option>
            </select>
          </label>
          <label class="ais-form__label">Date
            <input class="ais-form__input" type="date" name="date" value="${defDate}" />
          </label>
        </div>
        <label class="ais-form__label">Catégorie
          <select class="ais-form__select" name="category">${categoryOptions}</select>
        </label>
        <label class="ais-form__label">Compte
          <select class="ais-form__select" name="account">${accountOptions}</select>
        </label>
        <button class="ais-form__submit" data-action="add-transaction">
          ✚ Créer la transaction
        </button>
        <button class="ais-form__back" data-action="back-to-menu">← Retour</button>
      </div>
    </div>`;
}

function formSubscription(ctx: BudgetContext): string {
  const categoryOptions = ctx.categories
    .filter((c) => c.transactionType === 'expense')
    .map((c) => `<option value="${c.name}">${c.name}</option>`)
    .join('');
  const accountOptions = ctx.accounts
    .map((a) => `<option value="${a.name}">${a.name}</option>`)
    .join('');

  return `
    <div class="ais-card">
      <div class="ais-card__label">Nouvel abonnement</div>
      <div class="ais-form" data-type="subscription">
        <div class="ais-form__row2">
          <label class="ais-form__label">Nom
            <input class="ais-form__input" name="name" placeholder="Ex : Netflix" />
          </label>
          <label class="ais-form__label">Montant (€)
            <input class="ais-form__input" type="number" name="amount" step="0.01" min="0" placeholder="0.00" />
          </label>
        </div>
        <div class="ais-form__row2">
          <label class="ais-form__label">Fréquence
            <select class="ais-form__select" name="frequency">
              <option value="monthly">Mensuel</option>
              <option value="yearly">Annuel</option>
              <option value="quarterly">Trimestriel</option>
            </select>
          </label>
          <label class="ais-form__label">Jour du mois
            <input class="ais-form__input" type="number" name="dayOfMonth" min="1" max="31" placeholder="Ex : 5" />
          </label>
        </div>
        <div class="ais-form__row2">
          <label class="ais-form__label">Date début
            <input class="ais-form__input" type="date" name="startDate" value="${todayISO()}" />
          </label>
          <label class="ais-form__label">Date fin (optionnel)
            <input class="ais-form__input" type="date" name="endDate" />
          </label>
        </div>
        <label class="ais-form__label">Catégorie
          <select class="ais-form__select" name="category">${categoryOptions}</select>
        </label>
        <label class="ais-form__label">Compte
          <select class="ais-form__select" name="account">${accountOptions}</select>
        </label>
        <button class="ais-form__submit" data-action="add-subscription">
          ✚ Créer l'abonnement
        </button>
        <button class="ais-form__back" data-action="back-to-menu">← Retour</button>
      </div>
    </div>`;
}

function formBudget(ctx: BudgetContext, mo?: number | null, yr?: number | null): string {
  const now = new Date();
  const defMonth = mo ?? now.getMonth() + 1;
  const defYear = yr ?? now.getFullYear();

  const monthOptions = Object.entries(MONTH_NAMES)
    .map(([k, v]) => `<option value="${k}"${parseInt(k) === defMonth ? ' selected' : ''}>${v}</option>`)
    .join('');
  const categoryOptions = ctx.categories
    .filter((c) => c.transactionType === 'expense')
    .map((c) => `<option value="${c.name}">${c.name}</option>`)
    .join('');

  return `
    <div class="ais-card">
      <div class="ais-card__label">Nouvelle ligne budget</div>
      <div class="ais-form" data-type="budget">
        <div class="ais-form__row2">
          <label class="ais-form__label">Mois
            <select class="ais-form__select" name="month">${monthOptions}</select>
          </label>
          <label class="ais-form__label">Année
            <input class="ais-form__input" type="number" name="year" value="${defYear}" min="2020" max="2035" />
          </label>
        </div>
        <label class="ais-form__label">Catégorie
          <select class="ais-form__select" name="category">${categoryOptions}</select>
        </label>
        <label class="ais-form__label">Libellé (optionnel)
          <input class="ais-form__input" name="label" placeholder="Ex : Vacances été" />
        </label>
        <label class="ais-form__label">Montant prévu (€)
          <input class="ais-form__input" type="number" name="amount" step="0.01" min="0" placeholder="200.00" />
        </label>
        <button class="ais-form__submit" data-action="add-budget">
          ✚ Créer la ligne budget
        </button>
        <button class="ais-form__back" data-action="back-to-menu">← Retour</button>
      </div>
    </div>`;
}

function formCategory(): string {
  return `
    <div class="ais-card">
      <div class="ais-card__label">Nouvelle catégorie</div>
      <div class="ais-form" data-type="category">
        <label class="ais-form__label">Nom
          <input class="ais-form__input" name="name" placeholder="Ex : Santé" />
        </label>
        <div class="ais-form__row2">
          <label class="ais-form__label">Type d'opération
            <select class="ais-form__select" name="transactionType">
              <option value="expense">Dépense</option>
              <option value="income">Revenu</option>
              <option value="transfer">Virement</option>
            </select>
          </label>
          <label class="ais-form__label">Fréquence
            <select class="ais-form__select" name="frequency">
              <option value="monthly">Mensuelle</option>
              <option value="occasional">Occasionnelle</option>
              <option value="yearly">Annuelle</option>
              <option value="quarterly">Trimestrielle</option>
            </select>
          </label>
        </div>
        <label class="ais-form__label">Description (optionnel)
          <input class="ais-form__input" name="description" placeholder="Ex : Médecin, pharmacie…" />
        </label>
        <button class="ais-form__submit" data-action="add-category">
          ✚ Créer la catégorie
        </button>
        <button class="ais-form__back" data-action="back-to-menu">← Retour</button>
      </div>
    </div>`;
}

// ── Workaround pour le type de période partagé ─────────────────

type BaseIntentWithPeriod = { month?: number | null; year?: number | null };

// ── Dispatcher principal ────────────────────────────────────────

export function buildResponse(
  intent: ParsedIntent,
  ctx: BudgetContext,
  handlers?: AddEntityHandlers,
): string {
  switch (intent.intent) {
    case 'transactions_category':
      return handleTransactionsCategory(intent, ctx);
    case 'subscription_status':
      return handleSubscriptionStatus(intent, ctx);
    case 'subscriptions_list':
      return handleSubscriptionsList(intent, ctx);
    case 'balance_current':
      return handleBalanceCurrent(intent, ctx);
    case 'balance_forecast':
      return handleBalanceForecast(intent, ctx);
    case 'budget_month':
      return handleBudgetMonth(intent, ctx);
    case 'category_data':
      return handleCategoryData(intent, ctx);
    case 'budget_add':
      return renderAddForm('budget', ctx, intent.month, intent.year);
    case 'add_menu':
      return handleAddMenu(intent, ctx);
    case 'expenses_summary':
      return handleExpensesSummary(intent, ctx);
    case 'categories_summary':
      return handleCategoriesSummary(ctx);
    case 'unknown':
    default:
      return `
        Je ne comprends pas encore cette question. Essayez par exemple :<br>
        • <em>« Course juin 2026 »</em> (affiche les transactions/budgets)<br>
        • <em>« Vacances juillet 2026 »</em><br>
        • <em>« Abonnement janvier 2027 »</em><br>
        • <em>« Mon abonnement TER est-il actif ? »</em><br>
        • <em>« Solde restant en décembre 2026 »</em><br>
        • <em>« Ajouter une transaction »</em>`;
  }
}
