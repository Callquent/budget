"use client";
import Link from 'next/link';

const MOCK_DATA = {
  accounts: [
    { id: 1, name: 'Compte Courant', type: 'debit', balance: 1250.50, currency: '€' },
    { id: 2, name: 'Épargne', type: 'credit', balance: 5000.00, currency: '€' },
    { id: 3, name: 'Cash', type: 'debit', balance: 150.00, currency: '€' },
  ]
};

function formatNumber(num: number) {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

export default function AccountsPage() {
  const { accounts } = MOCK_DATA;

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0"><i className="bi bi-bank me-2 text-primary"></i>Comptes</h1>
        <Link href="/accounts/new" className="btn btn-primary btn-sm">
          <i className="bi bi-plus-lg me-1"></i>Nouveau compte
        </Link>
      </div>

      {accounts.length === 0 ? (
        <div className="alert alert-info">Aucun compte. <Link href="/accounts/new" className="alert-link">En créer un</Link>.</div>
      ) : (
        <div className="row g-3">
          {accounts.map(account => (
            <div className="col-md-4" key={account.id}>
              <div className="card h-100">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <h5 className="card-title mb-1">{account.name}</h5>
                      <span className={`badge ${account.type === 'credit' ? 'bg-success' : 'bg-secondary'}`}>
                        {account.type === 'credit' ? 'Crédit' : 'Débit'}
                      </span>
                    </div>
                    <span className="fs-5 fw-bold text-primary">
                      {formatNumber(account.balance)} {account.currency}
                    </span>
                  </div>
                </div>
                <div className="card-footer bg-transparent d-flex gap-2">
                  <Link href={`/accounts/edit/${account.id}`} className="btn btn-sm btn-outline-primary">
                    <i className="bi bi-pencil me-1"></i>Modifier
                  </Link>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => window.confirm('Supprimer ce compte ?')}>
                    <i className="bi bi-trash me-1"></i>Supprimer
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
