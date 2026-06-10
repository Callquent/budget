import Link from 'next/link';

// Mock data to match the Twig template structure
// In a real scenario, this would be fetched from an API
const MOCK_DATA = {
  year: 2026,
  currentYear: 2026,
  currentMonth: 6,
  availableYears: [2024, 2025, 2026],
  accounts: [
    { id: 1, name: 'Compte Courant', type: 'checking', balance: 1250.50 },
    { id: 2, name: 'Épargne', type: 'credit', balance: 5000.00 },
  ],
  summary: {
    1: { total_planned: 500 },
    2: { total_planned: 450 },
  },
  accountBalances: {
    1: {
      1: { balance: 1100, credit: 200, debit: 100, balance_projected: 1150, planned_net: 50 },
    },
    2: {
      1: { balance: 4800, credit: 500, debit: 200, balance_projected: 4900, planned_net: 100 },
    }
  }
};

const monthNamesFull = {
  1: 'Janvier', 2: 'Février', 3: 'Mars', 4: 'Avril', 5: 'Mai', 6: 'Juin',
  7: 'Juillet', 8: 'Août', 9: 'Septembre', 10: 'Octobre', 11: 'Novembre', 12: 'Décembre'
};

function formatNumber(num: number) {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

export default function MonthlyBudgetIndex() {
  const { year, currentYear, currentMonth, availableYears, accounts, summary, accountBalances } = MOCK_DATA;

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h1 className="h3 mb-0"><i className="bi bi-calendar3 me-2 text-primary"></i>Budget {year}</h1>
      </div>

      <div className="card mb-4 p-3">
        <div className="d-flex align-items-center gap-2 year-nav flex-wrap">
          <span className="text-muted me-2 small fw-semibold">ANNÉE</span>
          {availableYears.map((y) => (
            <Link
              key={y}
              href={`/budget/${y}`}
              className={`btn btn-sm ${y === year ? 'btn-dark' : 'btn-outline-secondary'}`}
            >
              {y}
              {y === currentYear && <span className="badge bg-primary ms-1" style={{ fontSize: '.6rem' }}>en cours</span>}
            </Link>
          ))}
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-header bg-white d-flex justify-content-between align-items-center">
          <span className="fw-semibold">Récapitulatif annuel {year}</span>
          <span className="text-muted small">Solde fin de mois par compte</span>
        </div>
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead>
              <tr>
                <th style={{ minWidth: '110px' }}>Mois</th>
                {accounts.map((account) => (
                  <th className="text-end" key={account.id} style={{ minWidth: '130px' }}>
                    <span className="d-flex align-items-center justify-content-end gap-1">
                      <i className={`bi ${account.type === 'credit' ? 'bi-piggy-bank text-success' : 'bi-wallet2 text-secondary'} small`}></i>
                      {account.name}
                    </span>
                  </th>
                ))}
                <th className="text-end" style={{ minWidth: '120px' }}>Total</th>
                <th className="text-end" style={{ minWidth: '100px' }}>Budget prévu</th>
                <th></th>
              </tr>
            </thead>
            <tbody >
              {[...Array(12)].map((_, i) => {
                const m = i + 1;
                const budgetRow = summary[m];

                let totalBalance = 0;
                accounts.forEach(account => {
                  const ab = accountBalances[account.id]?.[m];
                  totalBalance += ab ? ab.balance : account.balance;
                });

                return (
                  <tr key={m}>
                    <td >
                      <Link href={`/budget/${year}/${m}`} className="text-decoration-none fw-semibold text-dark">
                        {monthNamesFull[m]}
                        {year === currentYear && m === currentMonth && (
                          <span className="badge bg-primary ms-1" style={{ fontSize: '.6rem' }}>en cours</span>
                        )}
                      </Link>
                    </td>
                    {accounts.map((account) => {
                      const ab = accountBalances[account.id]?.[m];
                      const bal = ab ? ab.balance : account.balance;
                      const credit = ab ? ab.credit : 0;
                      const debit = ab ? ab.debit : 0;
                      const balProjected = ab ? ab.balance_projected : bal;
                      const plannedNet = ab ? ab.planned_net : 0;

                      return (
                        <td className="text-end" key={account.id}>
                          <div className={`fw-semibold ${bal < 0 ? 'text-danger' : ''}`}>
                            {formatNumber(bal)} €
                          </div>
                          {(credit > 0 || debit > 0) && (
                            <div className="text-muted" style={{ fontSize: '.72rem', lineHeight: '1.3' }}>
                              {credit > 0 && <span className="text-success">+{formatNumber(credit)}</span>}
                              {debit > 0 && <span className="text-danger ms-1">−{formatNumber(debit)}</span>}
                            </div>
                          )}
                          {plannedNet !== 0 && (
                            <div className="text-muted fst-italic" style={{ fontSize: '.72rem', lineHeight: '1.4' }} title="Solde projeté avec budget prévu">
                              → <span className={balProjected < 0 ? 'text-danger' : 'text-info'}>{formatNumber(balProjected)} €</span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className={`text-end fw-bold ${totalBalance < 0 ? 'text-danger' : 'text-primary'}`}>
                      {formatNumber(totalBalance)} €
                    </td>
                    <td className="text-end text-muted small">
                      {budgetRow ? `${formatNumber(budgetRow.total_planned)} €` : '—'}
                    </td>
                    <td >
                      <Link href={`/budget/${year}/${m}`} className="btn btn-outline-secondary btn-action" title="Détail">
                        <i className="bi bi-eye"></i>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody >
            <tfoot className="table-light">
              <tr >
                <td className="fw-semibold">Solde actuel</td>
                {accounts.map((account) => (
                  <td className="text-end fw-semibold" key={account.id}>
                    {formatNumber(account.balance)} €
                  </td>
                ))}
                <td className="text-end fw-bold text-primary">
                  {formatNumber(accounts.reduce((sum, acc) => sum + acc.balance, 0))} €
                </td>
                <td colSpan={2}></td>
              </tr >
            </tfoot>
          </table >
        </div >
      </div >
    </>
  );
}
