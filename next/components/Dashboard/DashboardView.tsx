import Link from "next/link";
import BudgetOverdraftAlert from "./BudgetOverdraftAlert";
import BudgetMonthlyBalance from "./BudgetMonthlyBalance";

interface NavCard {
  href: string;
  icon: string;
  title: string;
  description: string;
  gradient: string;
  shadowColor: string;
}

const NAV_CARDS: NavCard[] = [
  {
    href: "/budget",
    icon: "bi-calendar3",
    title: "Budget",
    description: "Gestion des budgets mensuels et annuels",
    gradient: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
    shadowColor: "rgba(99,102,241,.3)",
  },
  {
    href: "/transactions",
    icon: "bi-list-ul",
    title: "Transactions",
    description: "Historique des opérations financières",
    gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    shadowColor: "rgba(16,185,129,.3)",
  },
  {
    href: "/accounts",
    icon: "bi-wallet2",
    title: "Comptes",
    description: "Gestion des comptes bancaires",
    gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    shadowColor: "rgba(245,158,11,.3)",
  },
  {
    href: "/subscriptions",
    icon: "bi-arrow-repeat",
    title: "Abonnements",
    description: "Suivi des paiements récurrents",
    gradient: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
    shadowColor: "rgba(139,92,246,.3)",
  },
  {
    href: "/statistics",
    icon: "bi-graph-up-arrow",
    title: "Statistiques",
    description: "Analyses et visualisations",
    gradient: "linear-gradient(135deg, #ec4899 0%, #be185d 100%)",
    shadowColor: "rgba(236,72,153,.3)",
  },
  {
    href: "/categories",
    icon: "bi-tags",
    title: "Catégories",
    description: "Classification des dépenses",
    gradient: "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
    shadowColor: "rgba(6,182,212,.3)",
  },
];

export default function DashboardView() {
  return (
    <div className="container-fluid">
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h1 className="h3 mb-0 fw-bold">
          <i className="bi bi-speedometer2 me-2 text-primary"></i>
          Tableau de bord
        </h1>
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
              <h2 className="h5 mb-1 fw-bold">
                Bienvenue sur votre espace financier
              </h2>
              <p className="small text-muted mb-0">
                Gérez vos budgets, suivez vos dépenses et optimisez votre
                situation financière en un seul endroit.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cartes de navigation rapide */}
      <div className="row g-3 mb-4">
        {NAV_CARDS.map((card) => (
          <div className="col-md-4 col-sm-6" key={card.href}>
            <Link
              href={card.href}
              className="card border-0 shadow-sm rounded-3 text-decoration-none text-dark h-100"
              style={{ transition: "transform 0.2s, box-shadow 0.2s" }}
            >
              <div className="card-body d-flex align-items-center gap-3">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{
                    width: "48px",
                    height: "48px",
                    background: card.gradient,
                    boxShadow: `0 4px 12px ${card.shadowColor}`,
                  }}
                >
                  <i className={`bi ${card.icon} text-white fs-4`}></i>
                </div>
                <div>
                  <div className="fw-semibold">{card.title}</div>
                  <div className="small text-muted">{card.description}</div>
                </div>
                <i className="bi bi-chevron-right text-muted ms-auto"></i>
              </div>
            </Link>
          </div>
        ))}
      </div>

      <BudgetOverdraftAlert />

      <BudgetMonthlyBalance />
    </div>
  );
}
