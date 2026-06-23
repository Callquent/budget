"use client";
import Link from "next/link";
import { useState } from "react";
import { TransactionWithAccount, formatNumber } from "./Transaction.interface";

const API = process.env.NEXT_PUBLIC_API_URL;

interface AllTransactionsTabProps {
  transactions: TransactionWithAccount[];
  totalCredit: number;
  totalDebit: number;
  monthLabel: string;
  year: string;
  month: string;
  onRefresh?: () => void;
}

export default function AllTransactionsTab({
  transactions,
  totalCredit,
  totalDebit,
  monthLabel,
  year,
  month,
  onRefresh,
}: AllTransactionsTabProps) {
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    if (!window.confirm("Supprimer cette transaction ?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API}/transactions/${id}/delete`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      onRefresh?.();
    } catch (e: any) {
      alert(`Erreur lors de la suppression : ${e.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="tab-pane fade show active p-3">
      {transactions.length === 0 ? (
        <div className="alert alert-info m-3 d-flex align-items-center gap-2">
          <i className="bi bi-info-circle fs-5"></i>
          <span>
            Aucune transaction pour {monthLabel} {year}.{" "}
            <Link
              href={`/transactions/${year}/${month}/new`}
              className="alert-link"
            >
              En ajouter une
            </Link>
            .
          </span>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover table-sm mb-0 align-middle">
            <thead>
              <tr>
                <th>Date</th>
                <th>Libellé</th>
                <th>Catégorie</th>
                <th>Compte</th>
                <th className="text-end">Crédit</th>
                <th className="text-end">Débit</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td className="text-muted small">{tx.transactionDate}</td>
                  <td>
                    <span className="fw-medium small">{tx.label}</span>
                    {tx.notes && (
                      <div className="text-muted" style={{ fontSize: ".7rem" }}>
                        {tx.notes}
                      </div>
                    )}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        tx.category.transactionType === "income"
                          ? "badge-income"
                          : tx.category.transactionType === "expense"
                            ? "badge-expense"
                            : "badge-transfer"
                      }`}
                      style={{ fontSize: ".7rem" }}
                    >
                      {tx.category.name}
                    </span>
                  </td>
                  <td className="small text-muted">{tx.account.name}</td>
                  <td
                    className={`text-end small ${tx.type === "credit" ? "text-success fw-semibold" : "text-muted"}`}
                  >
                    {tx.type === "credit"
                      ? `+${formatNumber(tx.amount)} €`
                      : "—"}
                  </td>
                  <td
                    className={`text-end small ${tx.type !== "credit" ? "text-danger fw-semibold" : "text-muted"}`}
                  >
                    {tx.type !== "credit"
                      ? `−${formatNumber(tx.amount)} €`
                      : "—"}
                  </td>
                  <td className="text-end" style={{ whiteSpace: "nowrap" }}>
                    <Link
                      href={`/transactions/edit/${tx.id}`}
                      className="btn btn-outline-primary btn-action me-1"
                    >
                      <i className="bi bi-pencil"></i>
                    </Link>
                    <button
                      className="btn btn-outline-danger btn-action"
                      onClick={() => handleDelete(tx.id)}
                      disabled={deletingId === tx.id}
                    >
                      {deletingId === tx.id ? (
                        <span className="spinner-border spinner-border-sm" />
                      ) : (
                        <i className="bi bi-trash"></i>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="table-light fw-semibold">
              <tr>
                <td colSpan={4}>Total</td>
                <td className="text-end text-success">
                  +{formatNumber(totalCredit)} €
                </td>
                <td className="text-end text-danger">
                  −{formatNumber(totalDebit)} €
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
