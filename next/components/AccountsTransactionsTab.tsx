"use client";
import Link from "next/link";
import { AccountRow, formatNumber } from "./types";

interface AccountsTransactionsTabProps {
  byAccount: AccountRow[];
  monthLabel: string;
  year: string;
  month: string;
}

export default function AccountsTransactionsTab({
  byAccount,
  monthLabel,
  year,
  month,
}: AccountsTransactionsTabProps) {
  return (
    <div className="tab-pane fade show active p-3">
      {byAccount.map((row, idx) => {
        const { account, credit, debit, balanceEnd, transactions: accTxs } = row;
        const net = credit - debit;
        const creditTxs = accTxs.filter((t) => t.type === "credit");
        const debitTxs = accTxs.filter((t) => t.type !== "credit");
        return (
          <div className="card mb-3" key={idx}>
            <div className="card-header bg-white d-flex align-items-center justify-content-between py-3">
              <div className="d-flex align-items-center gap-3">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{
                    width: "38px",
                    height: "38px",
                    background: account.type === "credit" ? "#d1fae5" : "#fee2e2",
                  }}
                >
                  <i
                    className={`bi ${account.type === "credit" ? "bi-piggy-bank text-success" : "bi-wallet2 text-danger"} fs-6`}
                  ></i>
                </div>
                <div>
                  <span className="fw-semibold fs-6">{account.name}</span>
                  <span className="text-muted small ms-2">
                    Solde fin {monthLabel} :{" "}
                    <strong className={balanceEnd < 0 ? "text-danger" : "text-dark"}>
                      {formatNumber(balanceEnd)} {account.currency}
                    </strong>
                  </span>
                </div>
              </div>
              <div className="d-flex gap-3 align-items-center">
                {credit > 0 && (
                  <span className="small text-success fw-semibold">
                    <i className="bi bi-arrow-down-circle me-1"></i>+{formatNumber(credit)} €
                  </span>
                )}
                {debit > 0 && (
                  <span className="small text-danger fw-semibold">
                    <i className="bi bi-arrow-up-circle me-1"></i>−{formatNumber(debit)} €
                  </span>
                )}
                <span
                  className={`badge ${net >= 0 ? "bg-success" : "bg-danger"} bg-opacity-10 ${net >= 0 ? "text-success" : "text-danger"} fw-semibold`}
                >
                  Net {net >= 0 ? "+" : ""}{formatNumber(net)} €
                </span>
              </div>
            </div>
            <div className="row g-0">
              <div className="col-md-6 border-end">
                <div className="px-3 py-2 bg-light border-bottom">
                  <span className="small fw-semibold text-success">
                    <i className="bi bi-arrow-down-circle me-1"></i>CRÉDIT — entrées
                  </span>
                </div>
                <table className="table table-sm mb-0">
                  <thead className="table-light">
                    <tr>
                      <th className="ps-3">Date</th>
                      <th>Libellé</th>
                      <th className="text-end pe-3">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creditTxs.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-muted small text-center py-3">
                          Aucune entrée
                        </td>
                      </tr>
                    ) : (
                      <>
                        {creditTxs.map((tx) => (
                          <tr key={tx.id}>
                            <td className="ps-3 text-muted small" style={{ whiteSpace: "nowrap" }}>
                              {tx.transactionDate}
                            </td>
                            <td>
                              <div className="small fw-medium">{tx.label}</div>
                              <span className="badge badge-income" style={{ fontSize: ".65rem" }}>
                                {tx.category.name}
                              </span>
                            </td>
                            <td
                              className="text-end pe-3 text-success fw-semibold small"
                              style={{ whiteSpace: "nowrap" }}
                            >
                              +{formatNumber(tx.amount)} €
                            </td>
                          </tr>
                        ))}
                        <tr className="table-success">
                          <td colSpan={2} className="ps-3 small fw-semibold">
                            Total crédits
                          </td>
                          <td className="text-end pe-3 fw-bold text-success small">
                            +{formatNumber(credit)} €
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="col-md-6">
                <div className="px-3 py-2 bg-light border-bottom">
                  <span className="small fw-semibold text-danger">
                    <i className="bi bi-arrow-up-circle me-1"></i>DÉBIT — sorties
                  </span>
                </div>
                <table className="table table-sm mb-0">
                  <thead className="table-light">
                    <tr>
                      <th className="ps-3">Date</th>
                      <th>Libellé</th>
                      <th className="text-end pe-3">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debitTxs.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-muted small text-center py-3">
                          Aucune sortie
                        </td>
                      </tr>
                    ) : (
                      <>
                        {debitTxs.map((tx) => (
                          <tr key={tx.id}>
                            <td className="ps-3 text-muted small" style={{ whiteSpace: "nowrap" }}>
                              {tx.transactionDate}
                            </td>
                            <td>
                              <div className="small fw-medium">{tx.label}</div>
                              <span
                                className={`badge ${tx.category.transactionType === "expense" ? "badge-expense" : "badge-transfer"}`}
                                style={{ fontSize: ".65rem" }}
                              >
                                {tx.category.name}
                              </span>
                            </td>
                            <td
                              className="text-end pe-3 text-danger fw-semibold small"
                              style={{ whiteSpace: "nowrap" }}
                            >
                              −{formatNumber(tx.amount)} €
                            </td>
                          </tr>
                        ))}
                        <tr className="table-danger">
                          <td colSpan={2} className="ps-3 small fw-semibold">
                            Total débits
                          </td>
                          <td className="text-end pe-3 fw-bold text-danger small">
                            −{formatNumber(debit)} €
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card-footer bg-white d-flex justify-content-between align-items-center py-2">
              <span className="small text-muted">
                {accTxs.length} transaction{accTxs.length > 1 ? "s" : ""}
              </span>
              <Link href={`/transactions/${year}/${month}/new`} className="btn btn-outline-primary btn-sm">
                <i className="bi bi-plus-lg me-1"></i>Ajouter
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
