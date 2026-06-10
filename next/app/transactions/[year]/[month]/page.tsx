"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { use } from 'react';

// ... (MOCK_DATA inchangé, conserve le tien)
const MOCK_DATA = {
  monthLabel: 'juin',
  nowYear: 2026,
  nowMonth: 6,
  months: {
    1: 'Janvier', 2: 'Février', 3: 'Mars', 4: 'Avril', 5: 'Mai', 6: 'Juin',
    7: 'Juillet', 8: 'Août', 9: 'Septembre', 10: 'Octobre', 11: 'Novembre', 12: 'Décembre'
  } as Record<number, string>,
  totalCredit: 2500.00,
  totalDebit: 1200.00,
  byAccount: [
    {
      account: { id: 1, name: 'Compte Courant', type: 'checking', currency: '€', balance: 1250.50 },
      credit: 2000, debit: 800, balanceEnd: 1450.50,
      transactions: [
        { id: 101, transactionDate: '2026-06-01', label: 'Salarie', type: 'credit', amount: 2000, category: { name: 'Salaire', transactionType: 'income' }, notes: 'Virement mensuel' },
        { id: 102, transactionDate: '2026-06-05', label: 'Loyer', type: 'debit', amount: 700, category: { name: 'Logement', transactionType: 'expense' }, notes: '' },
        { id: 103, transactionDate: '2026-06-10', label: 'Courses', type: 'debit', amount: 100, category: { name: 'Alimentation', transactionType: 'expense' }, notes: '' },
      ]
    },
    {
      account: { id: 2, name: 'Épargne', type: 'credit', currency: '€', balance: 5000.00 },
      credit: 500, debit: 400, balanceEnd: 5100.00,
      transactions: [
        { id: 201, transactionDate: '2026-06-02', label: 'Intérêts', type: 'credit', amount: 500, category: { name: 'Revenus', transactionType: 'income' }, notes: '' },
        { id: 202, transactionDate: '2026-06-15', label: 'Virement vers courant', type: 'debit', amount: 400, category: { name: 'Transfert', transactionType: 'transfer' }, notes: '' },
      ]
    }
  ],
  transactions: [
    { id: 101, transactionDate: '2026-06-01', label: 'Salarie', type: 'credit', amount: 2000, category: { name: 'Salaire', transactionType: 'income' }, account: { name: 'Compte Courant' }, notes: 'Virement mensuel' },
    { id: 102, transactionDate: '2026-06-05', label: 'Loyer', type: 'debit', amount: 700, category: { name: 'Logement', transactionType: 'expense' }, account: { name: 'Compte Courant' }, notes: '' },
    { id: 103, transactionDate: '2026-06-10', label: 'Courses', type: 'debit', amount: 100, category: { name: 'Alimentation', transactionType: 'expense' }, account: { name: 'Compte Courant' }, notes: '' },
    { id: 201, transactionDate: '2026-06-02', label: 'Intérêts', type: 'credit', amount: 500, category: { name: 'Revenus', transactionType: 'income' }, account: { name: 'Épargne' }, notes: '' },
    { id: 202, transactionDate: '2026-06-15', label: 'Virement vers courant', type: 'debit', amount: 400, category: { name: 'Transfert', transactionType: 'transfer' }, account: { name: 'Épargne' }, notes: '' },
  ]
};

function formatNumber(num: number) {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

// Le reste du composant est identique à ton original —
// seul le type de `params` change (Promise en Next.js 15)
export default function TransactionsPage({ params }: { params: Promise<{ year: string; month: string }> }) {
  const { year, month } = use(params); // ← unwrap async params
  const [activeTab, setActiveTab] = useState<'accounts' | 'all'>('accounts');
  const { monthLabel, nowYear, nowMonth, months, totalCredit, totalDebit, byAccount, transactions } = MOCK_DATA;
  const netGlobal = totalCredit - totalDebit;

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h1 className="h3 mb-0">
          <i className="bi bi-list-ul me-2 text-primary"></i>Transactions
        </h1>
        <Link href={`/transactions/${year}/${month}/new`} className="btn btn-primary btn-sm">
          <i className="bi bi-plus-lg me-1"></i>Nouvelle transaction
        </Link>
      </div>

      <div className="card mb-4 p-3">
        <div className="d-flex align-items-center gap-3 flex-wrap">
          <div className="d-flex align-items-center gap-2">
            <label className="text-muted small fw-semibold mb-0">MOIS</label>
            <select
              className="form-select form-select-sm"
              style={{ width: 'auto' }}
              value={month}
              onChange={(e) => window.location.href = `/transactions/${year}/${e.target.value}`}
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
              value={year}
              onChange={(e) => window.location.href = `/transactions/${e.target.value}/${month}`}
            >
              {Array.from({ length: 4 }, (_, i) => nowYear - 2 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="ms-auto d-flex gap-2">
            <Link href={`/transactions/${year}/${parseInt(month) - 1}`} className="btn btn-outline-secondary btn-sm">
              <i className="bi bi-chevron-left"></i>
            </Link>
            <Link href={`/transactions/${nowYear}/${nowMonth}`} className="btn btn-outline-secondary btn-sm">
              Aujourd&apos;hui
            </Link>
            <Link href={`/transactions/${year}/${parseInt(month) + 1}`} className="btn btn-outline-secondary btn-sm">
              <i className="bi bi-chevron-right"></i>
            </Link>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body d-flex align-items-center gap-3">
              <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '44px', height: '44px', background: '#d1fae5' }}>
                <i className="bi bi-arrow-down-circle text-success fs-5"></i>
              </div>
              <div>
                <div className="small text-muted">Total crédits</div>
                <div className="fw-bold fs-5 text-success">+{formatNumber(totalCredit)} €</div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body d-flex align-items-center gap-3">
              <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '44px', height: '44px', background: '#fee2e2' }}>
                <i className="bi bi-arrow-up-circle text-danger fs-5"></i>
              </div>
              <div>
                <div className="small text-muted">Total débits</div>
                <div className="fw-bold fs-5 text-danger">−{formatNumber(totalDebit)} €</div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body d-flex align-items-center gap-3">
              <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '44px', height: '44px', background: netGlobal >= 0 ? '#dbeafe' : '#fef3c7' }}>
                <i className={`bi bi-wallet2 ${netGlobal >= 0 ? 'text-primary' : 'text-warning'} fs-5`}></i>
              </div>
              <div>
                <div className="small text-muted">Net du mois</div>
                <div className={`fw-bold fs-5 ${netGlobal >= 0 ? 'text-primary' : 'text-warning'}`}>
                  {netGlobal >= 0 ? '+' : ''}{formatNumber(netGlobal)} €
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ul className="nav nav-tabs mb-0" role="tablist">
        <li className="nav-item" role="presentation">
          <button className={`nav-link ${activeTab === 'accounts' ? 'active' : ''}`} onClick={() => setActiveTab('accounts')} type="button">
            <i className="bi bi-bank me-1"></i>Comptes
            <span className="badge bg-secondary ms-1">{byAccount.length}</span>
          </button>
        </li>
        <li className="nav-item" role="presentation">
          <button className={`nav-link ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')} type="button">
            <i className="bi bi-pencil-square me-1"></i>Toutes les transactions
            <span className="badge bg-secondary ms-1">{transactions.length}</span>
          </button>
        </li>
      </ul>

      <div className="tab-content border border-top-0 rounded-bottom bg-white p-0 mb-4">
        {activeTab === 'accounts' && (
          <div className="tab-pane fade show active p-3">
            {byAccount.map((row, idx) => {
              const { account, credit, debit, balanceEnd, transactions: accTxs } = row;
              const net = credit - debit;
              const creditTxs = accTxs.filter(t => t.type === 'credit');
              const debitTxs = accTxs.filter(t => t.type !== 'credit');
              return (
                <div className="card mb-3" key={idx}>
                  <div className="card-header bg-white d-flex align-items-center justify-content-between py-3">
                    <div className="d-flex align-items-center gap-3">
                      <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{ width: '38px', height: '38px', background: account.type === 'credit' ? '#d1fae5' : '#fee2e2' }}>
                        <i className={`bi ${account.type === 'credit' ? 'bi-piggy-bank text-success' : 'bi-wallet2 text-danger'} fs-6`}></i>
                      </div>
                      <div>
                        <span className="fw-semibold fs-6">{account.name}</span>
                        <span className="text-muted small ms-2">
                          Solde fin {monthLabel} : <strong className={balanceEnd < 0 ? 'text-danger' : 'text-dark'}>{formatNumber(balanceEnd)} {account.currency}</strong>
                        </span>
                      </div>
                    </div>
                    <div className="d-flex gap-3 align-items-center">
                      {credit > 0 && <span className="small text-success fw-semibold"><i className="bi bi-arrow-down-circle me-1"></i>+{formatNumber(credit)} €</span>}
                      {debit > 0 && <span className="small text-danger fw-semibold"><i className="bi bi-arrow-up-circle me-1"></i>−{formatNumber(debit)} €</span>}
                      <span className={`badge ${net >= 0 ? 'bg-success' : 'bg-danger'} bg-opacity-10 ${net >= 0 ? 'text-success' : 'text-danger'} fw-semibold`}>
                        Net {net >= 0 ? '+' : ''}{formatNumber(net)} €
                      </span>
                    </div>
                  </div>
                  <div className="row g-0">
                    <div className="col-md-6 border-end">
                      <div className="px-3 py-2 bg-light border-bottom"><span className="small fw-semibold text-success"><i className="bi bi-arrow-down-circle me-1"></i>CRÉDIT — entrées</span></div>
                      <table className="table table-sm mb-0">
                        <thead className="table-light"><tr><th className="ps-3">Date</th><th>Libellé</th><th className="text-end pe-3">Montant</th></tr></thead>
                        <tbody>
                          {creditTxs.length === 0 ? (
                            <tr><td colSpan={3} className="text-muted small text-center py-3">Aucune entrée</td></tr>
                          ) : (
                            <>{creditTxs.map(tx => (
                              <tr key={tx.id}>
                                <td className="ps-3 text-muted small" style={{ whiteSpace: 'nowrap' }}>{tx.transactionDate}</td>
                                <td><div className="small fw-medium">{tx.label}</div><span className="badge badge-income" style={{ fontSize: '.65rem' }}>{tx.category.name}</span></td>
                                <td className="text-end pe-3 text-success fw-semibold small" style={{ whiteSpace: 'nowrap' }}>+{formatNumber(tx.amount)} €</td>
                              </tr>
                            ))}
                            <tr className="table-success"><td colSpan={2} className="ps-3 small fw-semibold">Total crédits</td><td className="text-end pe-3 fw-bold text-success small">+{formatNumber(credit)} €</td></tr>
                            </>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="col-md-6">
                      <div className="px-3 py-2 bg-light border-bottom"><span className="small fw-semibold text-danger"><i className="bi bi-arrow-up-circle me-1"></i>DÉBIT — sorties</span></div>
                      <table className="table table-sm mb-0">
                        <thead className="table-light"><tr><th className="ps-3">Date</th><th>Libellé</th><th className="text-end pe-3">Montant</th></tr></thead>
                        <tbody>
                          {debitTxs.length === 0 ? (
                            <tr><td colSpan={3} className="text-muted small text-center py-3">Aucune sortie</td></tr>
                          ) : (
                            <>{debitTxs.map(tx => (
                              <tr key={tx.id}>
                                <td className="ps-3 text-muted small" style={{ whiteSpace: 'nowrap' }}>{tx.transactionDate}</td>
                                <td><div className="small fw-medium">{tx.label}</div><span className={`badge ${tx.category.transactionType === 'expense' ? 'badge-expense' : 'badge-transfer'}`} style={{ fontSize: '.65rem' }}>{tx.category.name}</span></td>
                                <td className="text-end pe-3 text-danger fw-semibold small" style={{ whiteSpace: 'nowrap' }}>−{formatNumber(tx.amount)} €</td>
                              </tr>
                            ))}
                            <tr className="table-danger"><td colSpan={2} className="ps-3 small fw-semibold">Total débits</td><td className="text-end pe-3 fw-bold text-danger small">−{formatNumber(debit)} €</td></tr>
                            </>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="card-footer bg-white d-flex justify-content-between align-items-center py-2">
                    <span className="small text-muted">{accTxs.length} transaction{accTxs.length > 1 ? 's' : ''}</span>
                    <Link href={`/transactions/${year}/${month}/new`} className="btn btn-outline-primary btn-sm"><i className="bi bi-plus-lg me-1"></i>Ajouter</Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'all' && (
          <div className="tab-pane fade show active p-3">
            {transactions.length === 0 ? (
              <div className="alert alert-info m-3 d-flex align-items-center gap-2">
                <i className="bi bi-info-circle fs-5"></i>
                <span>Aucune transaction pour {monthLabel} {year}. <Link href={`/transactions/${year}/${month}/new`} className="alert-link">En ajouter une</Link>.</span>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover table-sm mb-0 align-middle">
                  <thead>
                    <tr><th>Date</th><th>Libellé</th><th>Catégorie</th><th>Compte</th><th className="text-end">Crédit</th><th className="text-end">Débit</th><th></th></tr>
                  </thead>
                  <tbody>
                    {transactions.map(tx => (
                      <tr key={tx.id}>
                        <td className="text-muted small">{tx.transactionDate}</td>
                        <td><span className="fw-medium small">{tx.label}</span>{tx.notes && <div className="text-muted" style={{ fontSize: '.7rem' }}>{tx.notes}</div>}</td>
                        <td><span className={`badge ${tx.category.transactionType === 'income' ? 'badge-income' : (tx.category.transactionType === 'expense' ? 'badge-expense' : 'badge-transfer')}`} style={{ fontSize: '.7rem' }}>{tx.category.name}</span></td>
                        <td className="small text-muted">{tx.account.name}</td>
                        <td className={`text-end small ${tx.type === 'credit' ? 'text-success fw-semibold' : 'text-muted'}`}>{tx.type === 'credit' ? `+${formatNumber(tx.amount)} €` : '—'}</td>
                        <td className={`text-end small ${tx.type !== 'credit' ? 'text-danger fw-semibold' : 'text-muted'}`}>{tx.type !== 'credit' ? `−${formatNumber(tx.amount)} €` : '—'}</td>
                        <td className="text-end" style={{ whiteSpace: 'nowrap' }}>
                          <Link href={`/transactions/edit/${tx.id}`} className="btn btn-outline-primary btn-action me-1"><i className="bi bi-pencil"></i></Link>
                          <button className="btn btn-outline-danger btn-action" onClick={() => window.confirm('Supprimer cette transaction ?')}><i className="bi bi-trash"></i></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="table-light fw-semibold">
                    <tr>
                      <td colSpan={4}>Total</td>
                      <td className="text-end text-success">+{formatNumber(totalCredit)} €</td>
                      <td className="text-end text-danger">−{formatNumber(totalDebit)} €</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
