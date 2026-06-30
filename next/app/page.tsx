import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="container-fluid">
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h1 className="h3 mb-0 fw-bold">
          <i className="bi bi-speedometer2 me-2 text-primary"></i>
          Tableau de bord
        </h1>
      </div>

      {/* Cartes de navigation rapide */}
      <div className="row g-3 mb-4">
        <div className="col-md-4 col-sm-6">
          <Link
            href="/budget"
            className="card border-0 shadow-sm rounded-3 text-decoration-none text-dark h-100"
            style={{ transition: "transform 0.2s, box-shadow 0.2s" }}
          >
            <div className="card-body d-flex align-items-center gap-3">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                style={{
                  width: "48px",
                  height: "48px",
                  background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
                  boxShadow: "0 4px 12px rgba(99,102,241,.3)",
                }}
              >
                <i className="bi bi-calendar3 text-white fs-4"></i>
              </div>
              <div>
                <div className="fw-semibold">Budget</div>
                <div className="small text-muted">Gestion des budgets mensuels et annuels</div>
              </div>
              <i className="bi bi-chevron-right text-muted ms-auto"></i>
            </div>
          </Link>
        </div>

        <div className="col-md-4 col-sm-6">
          <Link
            href="/transactions"
            className="card border-0 shadow-sm rounded-3 text-decoration-none text-dark h-100"
            style={{ transition: "transform 0.2s, box-shadow 0.2s" }}
          >
            <div className="card-body d-flex align-items-center gap-3">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                style={{
                  width: "48px",
                  height: "48px",
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  boxShadow: "0 4px 12px rgba(16,185,129,.3)",
                }}
              >
                <i className="bi bi-list-ul text-white fs-4"></i>
              </div>
              <div>
                <div className="fw-semibold">Transactions</div>
                <div className="small text-muted">Historique des opérations financières</div>
              </div>
              <i className="bi bi-chevron-right text-muted ms-auto"></i>
            </div>
          </Link>
        </div>

        <div className="col-md-4 col-sm-6">
          <Link
            href="/accounts"
            className="card border-0 shadow-sm rounded-3 text-decoration-none text-dark h-100"
            style={{ transition: "transform 0.2s, box-shadow 0.2s" }}
          >
            <div className="card-body d-flex align-items-center gap-3">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                style={{
                  width: "48px",
                  height: "48px",
                  background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                  boxShadow: "0 4px 12px rgba(245,158,11,.3)",
                }}
              >
                <i className="bi bi-wallet2 text-white fs-4"></i>
              </div>
              <div>
                <div className="fw-semibold">Comptes</div>
                <div className="small text-muted">Gestion des comptes bancaires</div>
              </div>
              <i className="bi bi-chevron-right text-muted ms-auto"></i>
            </div>
          </Link>
        </div>

        <div className="col-md-4 col-sm-6">
          <Link
            href="/subscriptions"
            className="card border-0 shadow-sm rounded-3 text-decoration-none text-dark h-100"
            style={{ transition: "transform 0.2s, box-shadow 0.2s" }}
          >
            <div className="card-body d-flex align-items-center gap-3">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                style={{
                  width: "48px",
                  height: "48px",
                  background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
                  boxShadow: "0 4px 12px rgba(139,92,246,.3)",
                }}
              >
                <i className="bi bi-arrow-repeat text-white fs-4"></i>
              </div>
              <div>
                <div className="fw-semibold">Abonnements</div>
                <div className="small text-muted">Suivi des paiements récurrents</div>
              </div>
              <i className="bi bi-chevron-right text-muted ms-auto"></i>
            </div>
          </Link>
        </div>

        <div className="col-md-4 col-sm-6">
          <Link
            href="/statistics"
            className="card border-0 shadow-sm rounded-3 text-decoration-none text-dark h-100"
            style={{ transition: "transform 0.2s, box-shadow 0.2s" }}
          >
            <div className="card-body d-flex align-items-center gap-3">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                style={{
                  width: "48px",
                  height: "48px",
                  background: "linear-gradient(135deg, #ec4899 0%, #be185d 100%)",
                  boxShadow: "0 4px 12px rgba(236,72,153,.3)",
                }}
              >
                <i className="bi bi-graph-up-arrow text-white fs-4"></i>
              </div>
              <div>
                <div className="fw-semibold">Statistiques</div>
                <div className="small text-muted">Analyses et visualisations</div>
              </div>
              <i className="bi bi-chevron-right text-muted ms-auto"></i>
            </div>
          </Link>
        </div>

        <div className="col-md-4 col-sm-6">
          <Link
            href="/categories"
            className="card border-0 shadow-sm rounded-3 text-decoration-none text-dark h-100"
            style={{ transition: "transform 0.2s, box-shadow 0.2s" }}
          >
            <div className="card-body d-flex align-items-center gap-3">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                style={{
                  width: "48px",
                  height: "48px",
                  background: "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
                  boxShadow: "0 4px 12px rgba(6,182,212,.3)",
                }}
              >
                <i className="bi bi-tags text-white fs-4"></i>
              </div>
              <div>
                <div className="fw-semibold">Catégories</div>
                <div className="small text-muted">Classification des dépenses</div>
              </div>
              <i className="bi bi-chevron-right text-muted ms-auto"></i>
            </div>
          </Link>
        </div>
      </div>

      {/* Section Bienvenue */}
      <div className="card mb-4 border-0 shadow-sm rounded-3">
        <div className="card-body">
          <div className="d-flex align-items-center gap-3">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
              style={{
                width: "56px",
                height: "56px",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                boxShadow: "0 4px 15px rgba(102,126,234,.4)",
              }}
            >
              <i className="bi bi-speedometer2 text-white fs-4"></i>
            </div>
            <div>
              <h2 className="h5 mb-1 fw-bold">Bienvenue sur votre espace financier</h2>
              <p className="small text-muted mb-0">
                Gérez vos budgets, suivez vos dépenses et optimisez votre situation financière 
                en un seul endroit.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions rapides */}
      <div className="card border-0 shadow-sm rounded-3">
        <div className="card-header bg-white border-bottom d-flex justify-content-between align-items-center py-3 rounded-top-3">
          <span className="fw-semibold">
            <i className="bi bi-lightning-charge me-2 text-primary"></i>
            Actions rapides
          </span>
        </div>
        <div className="card-body">
          <div className="d-flex flex-wrap gap-2">
            <Link
              href="/budget"
              className="btn btn-outline-primary btn-sm rounded-pill px-3"
            >
              <i className="bi bi-calendar3 me-1"></i>Voir le budget
            </Link>
            <Link
              href="/transactions"
              className="btn btn-outline-primary btn-sm rounded-pill px-3"
            >
              <i className="bi bi-list-ul me-1"></i>Voir les transactions
            </Link>
            <Link
              href="/subscriptions"
              className="btn btn-outline-primary btn-sm rounded-pill px-3"
            >
              <i className="bi bi-arrow-repeat me-1"></i>Vérifier les abonnements
            </Link>
            <Link
              href="/statistics"
              className="btn btn-outline-primary btn-sm rounded-pill px-3"
            >
              <i className="bi bi-graph-up-arrow me-1"></i>Voir les statistiques
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

