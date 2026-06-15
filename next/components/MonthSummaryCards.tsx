"use client";
import { formatNumber } from "./types";

interface MonthSummaryCardsProps {
  totalCredit: number;
  totalDebit: number;
}

export default function MonthSummaryCards({ totalCredit, totalDebit }: MonthSummaryCardsProps) {
  const netGlobal = totalCredit - totalDebit;

  return (
    <div className="row g-3 mb-4">
      <div className="col-md-4">
        <div className="card border-0 shadow-sm h-100">
          <div className="card-body d-flex align-items-center gap-3">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
              style={{ width: "44px", height: "44px", background: "#d1fae5" }}
            >
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
            <div
              className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
              style={{ width: "44px", height: "44px", background: "#fee2e2" }}
            >
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
            <div
              className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
              style={{ width: "44px", height: "44px", background: netGlobal >= 0 ? "#dbeafe" : "#fef3c7" }}
            >
              <i className={`bi bi-wallet2 ${netGlobal >= 0 ? "text-primary" : "text-warning"} fs-5`}></i>
            </div>
            <div>
              <div className="small text-muted">Net du mois</div>
              <div className={`fw-bold fs-5 ${netGlobal >= 0 ? "text-primary" : "text-warning"}`}>
                {netGlobal >= 0 ? "+" : ""}{formatNumber(netGlobal)} €
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
