"use client";
import React, { use } from 'react';
import Link from 'next/link';

const MOCK_DATA = {
  periodLabel: 'juin 2026',
  year: 2026,
  month: 6,
  nowYear: 2026,
  nowMonth: 6,
  months: {
    1: 'Janvier', 2: 'Février', 3: 'Mars', 4: 'Avril', 5: 'Mai', 6: 'Juin',
    7: 'Juillet', 8: 'Août', 9: 'Septembre', 10: 'Octobre', 11: 'Novembre', 12: 'Décembre'
  },
  accounts: [
    { id: 1, name: 'Compte Courant', type: 'checking', balance: 1250.50, currency: '€' },
    { id: 2, name: 'Épargne', type: 'credit', balance: 5000.00, currency: '€' },
  ],
  txByAccount: {
    1: { credit: 2500, debit: 1200, subs: 100 },
    2: { credit: 500, debit: 0, subs: 0 },
  },
  subscriptions: [
    { id: 1, name: 'Netflix', amount: 13.49, frequency: 'monthly', account: { name: 'Compte Courant' }, category: { name: 'Loisirs' } },
    { id: 2, name: 'Amazon Prime', amount: 6.99, frequency: 'monthly', account: { name: 'Compte Courant' }, category: { name: 'Loisirs' } },
  ],
  budgets: [
    {
      id: 1,
      plannedAmount: 500,
      actualAmount: 480,
      isApproved: true,
      approvedAt: '2026-06-01',
      account: { name: 'Compte Courant' },
      category: { name: 'Courses', transactionType: 'expense', frequency: 'monthly' },
      label: 'Alimentation'
    },
    {
      id: 2,
      plannedAmount: 1000,
      actualAmount: 1050,
      isApproved: false,
      account: { name: 'Compte Courant' },
      category: { name: 'Loyer', transactionType: 'expense', frequency: 'monthly' },
      label: ''
    },
    {
      id: 3,
      plannedAmount: 2000,
      actualAmount: 2000,
      isApproved: true,
      approvedAt: '2026-06-01',
      account: { name: 'Compte Courant' },
      category: { name: 'Salaire', transactionType: 'income', frequency: 'monthly' },
      label: 'Principal'
    },
  ]
};

function formatNumber(num: number) {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

export default function BudgetMonthPage({ params }: { params: Promise<{ year: string, month: string }> }) {
  const { year: yearParam, month: monthParam } = use(params);
  const year = parseInt(yearParam);
  const month = parseInt(monthParam);
  const { periodLabel, nowYear, nowMonth, months, accounts, txByAccount, subscriptions, budgets } = MOCK_DATA;

  const freqLabels: Record<string, string> = {
    monthly: 'mensuelle',
    yearly: 'annuelle',
    quarterly: 'trimestrielle',
    occasional: 'occasionnel'
  };

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <Link href={`/budget/${year}`} className="text-muted text-decoration-none small">
            <i className="bi bi-chevron-left"></i> Budget {year}
          </Link>
          <h1 className="h3 mb-0 mt-1">Budget prévisionnel — {periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1)}</h1>
        </div>
        <div className="d-flex gap-2">
          <Link href={`/budget/${year}/${month}/new`} className="btn btn-primary btn-sm">
            <i className="bi bi-plus-lg me-1"></i>Nouvelle ligne
          </Link>
          <button className="btn btn-outline-secondary btn-sm" onClick={() => window.confirm('Copier ces lignes vers le mois suivant ?')}>
            <i className="bi bi-copy me-1"></i>Dupliquer →
          </button>
        </div>
      </div>

      <div className="card mb-4 p-3">
        <form className="d-flex align-items-center gap-3 flex-wrap">
          <div className="d-flex align-items-center gap-2">
            <label className="text-muted small fw-semibold mb-0">MOIS</label>
            <select
              className="form-select form-select-sm"
              style={{ width: 'auto' }}
              defaultValue={month}
              onChange={(e) => window.location.href = `/budget/${year}/${e.target.value}`}
            >
              {Object.entries(months).map(([num, name]) => (
                <option key={num} value={num}>{name}</option>
              ))}
            </select>
          </div>
          <div className="d-flex align-items-center gap-2">
            <label className="text-muted small fw-semibold mb-0">ANNÉE</label>
            <select
              className="form-select form-select-sm"
              style={{ width: 'auto' }}
              defaultValue={year}
              onChange={(e) => window.location.href = `/budget/${e.target.value}/${month}`}
            >
              {Array.from({ length: 4 }, (_, i) => nowYear - 2 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="ms-auto d-flex gap-2">
            <Link href={`/budget/${year}/${month - 1}`} className="btn btn-outline-secondary btn-sm">
              <i className="bi bi-chevron-left"></i>
            </Link>
            <Link href={`/budget/${nowYear}/${nowMonth}`} className="btn btn-outline-secondary btn-sm">
              Aujourd'hui
            </Link>
            <Link href={`/budget/${year}/${month + 1}`} className="btn btn-outline-secondary btn-sm">
              <i className="bi bi-chevron-right"></i>
            </Link>
          </div>
        </form>
      </div>

      <div className="row g-3 mb-4">
        {accounts.map((account) => {
          const aid = account.id;
          const data = txByAccount[aid] || { credit: 0, debit: 0, subs: 0 };
          const { credit, debit, subs } = data;
          const net = credit - debit;

          return (
            <div className="col-md-4 col-sm-6" key={aid}>
              <div className="card h-100 border-0 shadow-sm">
                <div className="card-body">
                  <div className="d-flex align-items-center gap-3 mb-3">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width: '40px', height: '40px', background: account.type === 'credit' ? '#d1fae5' : '#fee2e2' }}
                    >
                      <i className={`bi ${account.type === 'credit' ? 'bi-piggy-bank text-success' : 'bi-wallet2 text-danger'} fs-5`}></i>
                    </div>
                    <div>
                      <div className="fw-semibold">{account.name}</div>
                      <div className="small text-muted">Solde actuel : <strong>{formatNumber(account.balance)} {account.currency}</strong></div>
                    </div>
                  </div>
                  {(credit > 0 || debit > 0) ? (
                    <>
                      <div className="d-flex justify-content-between small mb-1">
                        <span className="text-success"><i className="bi bi-arrow-down-circle me-1"></i>Entrées</span>
                        <span className="fw-medium text-success">+{formatNumber(credit)} €</span>
                      </div>
                      <div className="d-flex justify-content-between small mb-1">
                        <span className="text-danger"><i className="bi bi-arrow-up-circle me-1"></i>Sorties</span>
                        <span className="fw-medium text-danger">-{formatNumber(debit - subs)} €</span>
                      </div>
                      {subs > 0 && (
                        <div className="d-flex justify-content-between small mb-1">
                          <span className="text-warning"><i className="bi bi-arrow-repeat me-1"></i>Abonnements</span>
                          <span className="fw-medium text-warning">-{formatNumber(subs)} €</span>
                        </div>
                      )}
                      <div className="border-top pt-2 mt-1 d-flex justify-content-between small fw-semibold">
                        <span>Net du mois</span>
                        <span className={net >= 0 ? 'text-success' : 'text-danger'}>
                          {net > 0 ? '+' : ''}{formatNumber(net)} €
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="text-muted small text-center py-1">Aucun mouvement ce mois</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {subscriptions.length > 0 && (
        <div className="card mb-4">
          <div className="card-header bg-white d-flex justify-content-between align-items-center">
            <span className="fw-semibold">
              <i className="bi bi-arrow-repeat me-2 text-primary"></i>Abonnements actifs ce mois
            </span>
            <span className="badge bg-primary">{subscriptions.length}</span>
          </div>
          <div className="table-responsive">
            <table className="table table-sm table-hover mb-0">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Compte</th>
                  <th>Catégorie</th>
                  <th>Fréquence</th>
                  <th className="text-end">Montant</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((sub) => (
                  <tr key={sub.id}>
                    <td className="fw-medium">{sub.name}</td>
                    <td>{sub.account.name}</td>
                    <td><span className="badge badge-expense">{sub.category.name}</span></td>
                    <td><span className={`badge badge-${sub.frequency}`}>{freqLabels[sub.frequency] || sub.frequency}</span></td>
                    <td className="text-end fw-semibold text-danger">-{formatNumber(sub.amount)} €</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="table-light fw-semibold">
                <tr>
                  <td colSpan={4}>Total abonnements</td>
                  <td className="text-end text-danger">
                    -{formatNumber(subscriptions.reduce((sum, sub) => sum + sub.amount, 0))} €
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {budgets.length > 0 && (
        <div className="card">
          <div className="card-header bg-white fw-semibold">
            <i className="bi bi-clipboard-check me-2 text-primary"></i>Budget prévisionnel
          </div>
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th>Catégorie</th>
                  <th>Fréquence</th>
                  <th>Compte</th>
                  <th className="text-end">Prévu</th>
                  <th className="text-end">Écart</th>
                  <th className="text-end">Réalisé</th>
                  <th style={{ width: '110px' }}>Avancement</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {budgets.map((budget) => {
                  const variance = budget.plannedAmount - budget.actualAmount;
                  const pct = budget.plannedAmount > 0 ? Math.round((budget.actualAmount / budget.plannedAmount) * 100) : 0;

                  return (
                    <tr key={budget.id} className={budget.isApproved ? 'table-success bg-opacity-50' : ''}>
                      <td>
                        <span className="fw-medium">{budget.category.name}</span>
                        {budget.label && <span className="text-muted small"> — {budget.label}</span>}
                        <span className={`badge ms-1 ${budget.category.transactionType === 'income' ? 'badge-income' : (budget.category.transactionType === 'expense' ? 'badge-expense' : 'badge-transfer')}`}>
                          {budget.category.transactionType === 'income' ? 'recette' : (budget.category.transactionType === 'expense' ? 'dépense' : 'virement')}
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge-${budget.category.frequency}`}>
                          {freqLabels[budget.category.frequency] || budget.category.frequency}
                        </span>
                      </td>
                      <td className="small text-muted">
                        {budget.account ? budget.account.name : <span className="text-warning"><i className="bi bi-exclamation-triangle me-1"></i>Non défini</span>}
                      </td>
                      <td className="text-end text-muted">{formatNumber(budget.plannedAmount)} €</td>
                      <td className={`text-end ${variance > 0 ? 'text-success' : (variance < 0 ? 'text-danger' : '')}`}>
                        {variance > 0 ? '+' : ''}{formatNumber(variance)} €
                      </td>
                      <td className="text-end">{formatNumber(budget.actualAmount)} €</td>
                      <td>
                        {budget.plannedAmount > 0 && (
                          <>
                            <div className="progress">
                              <div
                                className={`progress-bar ${pct > 100 ? 'bg-danger' : (pct > 80 ? 'bg-warning' : 'bg-success')}`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              ></div>
                            </div>
                            <small className="text-muted">{pct} %</small>
                          </>
                        )}
                      </td>
                      <td>
                        {budget.isApproved ? (
                          <>
                            <span className="badge bg-success">
                              <i className="bi bi-check-circle me-1"></i>Approuvé
                            </span>
                            {budget.approvedAt && (
                              <div className="text-muted" style={{ fontSize: '.7rem' }}>
                                {budget.approvedAt}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="badge bg-secondary bg-opacity-25 text-secondary">En attente</span>
                        )}
                      </td>
                      <td className="text-end" style={{ whiteSpace: 'nowrap' }}>
                        {!budget.isApproved ? (
                          <button className="btn btn-success btn-action me-1" title="Approuver → créer transaction" onClick={() => window.confirm(`Approuver « ${budget.category.name} » et créer la transaction de ${budget.actualAmount} € ?`)}>
                            <i className="bi bi-check-lg"></i>
                          </button>
                        ) : (
                          <button className="btn btn-outline-warning btn-action me-1" title="Annuler l'approbation" onClick={() => window.confirm('Annuler l\'approbation et supprimer la transaction ?')}>
                            <i className="bi bi-x-lg"></i>
                          </button>
                        )}
                        <Link href={`/budget/${year}/${month}/edit/${budget.id}`} className="btn btn-outline-primary btn-action me-1">
                          <i className="bi bi-pencil"></i>
                        </Link>
                        {!budget.isApproved && (
                          <button className="btn btn-outline-danger btn-action" onClick={() => window.confirm('Supprimer cette ligne ?')}>
                            <i className="bi bi-trash"></i>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="table-light fw-semibold">
                <tr>
                  <td colSpan={3}>Solde net (recettes − dépenses)</td>
                  <td className="text-end text-success">
                    +{formatNumber(budgets.filter(b => b.category.transactionType === 'income').reduce((s, b) => s + b.plannedAmount, 0) - budgets.filter(b => b.category.transactionType === 'expense').reduce((s, b) => s + b.plannedAmount, 0))} €
                  </td>
                  <td className="text-end text-success">
                    +{formatNumber(budgets.reduce((s, b) => s + (b.plannedAmount - b.actualAmount), 0))} €
                  </td>
                  <td className="text-end text-success">
                    +{formatNumber(budgets.filter(b => b.category.transactionType === 'income').reduce((s, b) => s + b.actualAmount, 0) - budgets.filter(b => b.category.transactionType === 'expense').reduce((s, b) => s + b.actualAmount, 0))} €
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
