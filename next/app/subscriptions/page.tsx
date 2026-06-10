"use client";

import React from 'react';
import Link from 'next/link';

const MOCK_DATA = {
  subscriptions: [
    { id: 1, name: 'Netflix', amount: 13.49, frequency: 'monthly', status: 'active', account: { name: 'Compte Courant' }, category: { name: 'Loisirs' }, startDate: '2023-01-01', endDate: null },
    { id: 2, name: 'Amazon Prime', amount: 6.99, frequency: 'monthly', status: 'active', account: { name: 'Compte Courant' }, category: { name: 'Loisirs' }, startDate: '2023-06-01', endDate: null },
    { id: 3, name: 'Assurance Auto', amount: 600, frequency: 'yearly', status: 'active', account: { name: 'Compte Courant' }, category: { name: 'Assurance' }, startDate: '2024-01-01', endDate: null },
    { id: 4, name: 'Gym', amount: 30, frequency: 'monthly', status: 'inactive', account: { name: 'Compte Courant' }, category: { name: 'Sante' }, startDate: '2022-01-01', endDate: '2023-12-31' },
  ]
};

const freqLabels = { monthly: 'Mensuel', yearly: 'Annuel', quarterly: 'Trimestriel', occasional: 'Occasionnel' };

function formatNumber(num: number) {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

export default function SubscriptionsPage() {
  const { subscriptions } = MOCK_DATA;
  const active = subscriptions.filter(s => s.status === 'active');
  const inactive = subscriptions.filter(s => s.status === 'inactive');

  const monthlyTotal = active.reduce((sum, s) => {
    if (s.frequency === 'monthly') return sum + s.amount;
    if (s.frequency === 'yearly') return sum + (s.amount / 12);
    if (s.frequency === 'quarterly') return sum + (s.amount / 3);
    return sum;
  }, 0);

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0"><i className="bi bi-arrow-repeat me-2 text-primary"></i>Abonnements</h1>
        <Link href="/subscriptions/new" className="btn btn-primary btn-sm">
          <i className="bi bi-plus-lg me-1"></i>Nouvel abonnement
        </Link>
      </div>

      {subscriptions.length === 0 ? (
        <div className="alert alert-info">
          Aucun abonnement. <Link href="/subscriptions/new" className="alert-link">En ajouter un</Link>.
        </div>
      ) : (
        <>
          <div className="alert alert-light border mb-4 d-flex align-items-center gap-3">
            <i className="bi bi-info-circle text-primary fs-5"></i>
            <span>Coût mensuel estimé (abonnements actifs) : <strong className="fw-bold">{formatNumber(monthlyTotal)} €</strong></span>
          </div>

          <div className="card mb-4">
            <div className="card-header bg-white">
              <span className="fw-semibold">Actifs</span>
              <span className="badge bg-success ms-2">{active.length}</span>
            </div>
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Compte</th>
                    <th>Catégorie</th>
                    <th>Fréquence</th>
                    <th className="text-end">Montant</th>
                    <th>Début</th>
                    <th>Fin</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {active.length === 0 ? (
                    <tr><td colSpan={8} className="text-muted text-center py-3">Aucun abonnement actif.</td></tr>
                  ) : (
                    active.map(sub => (
                      <tr key={sub.id}>
                        <td className="fw-medium">{sub.name}</td>
                        <td>{sub.account.name}</td>
                        <td><span className="badge badge-expense">{sub.category.name}</span></td>
                        <td><span className={`badge badge-${sub.frequency}`}>{freqLabels[sub.frequency] || sub.frequency}</span></td>
                        <td className="text-end fw-semibold">{formatNumber(sub.amount)} €</td>
                        <td className="text-muted small">{sub.startDate}</td>
                        <td className="text-muted small">{sub.endDate || '∞'}</td>
                        <td className="text-end">
                          <Link href={`/subscriptions/edit/${sub.id}`} className="btn btn-outline-primary btn-action me-1">
                            <i className="bi bi-pencil"></i>
                          </Link>
                          <button className="btn btn-outline-warning btn-action me-1" title="Désactiver">
                            <i className="bi bi-pause"></i>
                          </button>
                          <button className="btn btn-outline-danger btn-action" onClick={() => window.confirm('Supprimer cet abonnement ?')}>
                            <i className="bi bi-trash"></i>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {inactive.length > 0 && (
            <div className="card">
              <div className="card-header bg-white">
                <span className="fw-semibold text-muted">Inactifs</span>
                <span className="badge bg-secondary ms-2">{inactive.length}</span>
              </div>
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Nom</th><th>Compte</th><th>Catégorie</th><th>Fréquence</th>
                      <th className="text-end">Montant</th><th></th>
                    </tr>
                  </thead>
                  <tbody className="text-muted">
                    {inactive.map(sub => (
                      <tr key={sub.id}>
                        <td>{sub.name}</td>
                        <td>{sub.account.name}</td>
                        <td>{sub.category.name}</td>
                        <td>{freqLabels[sub.frequency] || sub.frequency}</td>
                        <td className="text-end">{formatNumber(sub.amount)} €</td>
                        <td className="text-end">
                          <Link href={`/subscriptions/edit/${sub.id}`} className="btn btn-outline-secondary btn-action me-1">
                            <i className="bi bi-pencil"></i>
                          </Link>
                          <button className="btn btn-outline-success btn-action me-1" title="Réactiver">
                            <i className="bi bi-play"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
