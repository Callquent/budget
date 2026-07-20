"use client";
import React, { useState } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Pie, Line } from "react-chartjs-2";

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

import type { StatisticsChartProps } from "./Statistics.interface";

function formatNumber(num: number | string) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parseFloat(String(num)) || 0);
}

const CHART_COLORS = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#6366f1",
  "#14b8a6",
  "#94a3b8",
  "#fca5a5",
  "#fde68a",
  "#bbf7d0",
  "#bfdbfe",
];

// MONTHS vient désormais de l'API (props.monthNames), source unique partagée
// avec le backend (App\Support\BudgetLabels) — plus de duplication.

export default function StatisticsChart({
  summary,
  plannedChart,
  actualChart,
  categories,
  plannedMonthly,
  actualMonthly,
  netPlannedMonthly,
  netActualMonthly,
  monthNames,
}: StatisticsChartProps) {
  const [activeTab, setActiveTab] = useState<"dist" | "evo" | "net">("dist");

  // Conversion défensive : les montants peuvent arriver en string (colonnes
  // decimal Doctrine/Symfony). "+" sur des strings concatène au lieu d'additionner
  // (contrairement à "-"), d'où le bug TOTAL NaN corrigé ici.
  const toNum = (v: number | string) => parseFloat(String(v)) || 0;

  const totalPlanned = summary.reduce((s, r) => s + toNum(r.planned), 0);
  const totalActual = summary.reduce((s, r) => s + toNum(r.actual), 0);

  const pieData = (dataObj: Record<string, number | string>) => ({
    labels: categories,
    datasets: [
      {
        data: categories.map((l) => toNum(dataObj[l] ?? 0)),
        backgroundColor: CHART_COLORS,
      },
    ],
  });

  const lineData = {
    labels: monthNames,
    datasets: [
      {
        label: "Prévu",
        data: plannedMonthly,
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        fill: true,
        tension: 0.3,
        borderWidth: 3,
        pointRadius: 4,
      },
      {
        label: "Réalisé",
        data: actualMonthly,
        borderColor: "#10b981",
        backgroundColor: "rgba(16, 185, 129, 0.1)",
        fill: true,
        tension: 0.3,
        borderWidth: 3,
        pointRadius: 4,
      },
    ],
  };

  return (
    <>
      <ul className="nav nav-tabs mb-4" role="tablist">
        <li className="nav-item" role="presentation">
          <button
            className={`nav-link ${activeTab === "dist" ? "active" : ""}`}
            onClick={() => setActiveTab("dist")}
            type="button"
          >
            <i className="bi bi-pie-chart-fill me-2"></i>Répartition
          </button>
        </li>
        <li className="nav-item" role="presentation">
          <button
            className={`nav-link ${activeTab === "evo" ? "active" : ""}`}
            onClick={() => setActiveTab("evo")}
            type="button"
          >
            <i className="bi bi-graph-up me-2"></i>Évolution Mensuelle
          </button>
        </li>
        <li className="nav-item" role="presentation">
          <button
            className={`nav-link ${activeTab === "net" ? "active" : ""}`}
            onClick={() => setActiveTab("net")}
            type="button"
          >
            <i className="bi bi-cash-stack me-2"></i>Bilan Mensuel
          </button>
        </li>
      </ul>

      <div className="tab-content">
        {activeTab === "dist" && (
          <div className="tab-pane fade show active">
            <div className="row g-3 mb-4">
              <div className="col-md-6">
                <div className="card h-100">
                  <div className="card-header bg-white fw-semibold">
                    <i className="bi bi-pie-chart-fill me-2 text-primary"></i>
                    Répartition Prévue (Annuelle)
                  </div>
                  <div className="card-body d-flex justify-content-center">
                    <div
                      style={{
                        maxWidth: "400px",
                        maxHeight: "400px",
                        width: "100%",
                      }}
                    >
                      <Pie
                        data={pieData(plannedChart)}
                        options={{
                          plugins: { legend: { position: "bottom" } },
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-md-6">
                <div className="card h-100">
                  <div className="card-header bg-white fw-semibold">
                    <i className="bi bi-pie-chart-fill me-2 text-success"></i>
                    Répartition Réelle (Annuelle)
                  </div>
                  <div className="card-body d-flex justify-content-center">
                    <div
                      style={{
                        maxWidth: "400px",
                        maxHeight: "400px",
                        width: "100%",
                      }}
                    >
                      <Pie
                        data={pieData(actualChart)}
                        options={{
                          plugins: { legend: { position: "bottom" } },
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header bg-white fw-semibold">
                <i className="bi bi-table me-2 text-primary"></i>Détail par
                catégorie
              </div>
              <div className="table-responsive">
                <table className="table table-hover mb-0 align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>Catégorie</th>
                      <th className="text-end">Total Prévu</th>
                      <th className="text-end">Écart</th>
                      <th className="text-end">Total Réalisé</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((row, idx) => {
                      const variance = toNum(row.planned) - toNum(row.actual);
                      return (
                        <tr key={idx}>
                          <td className="fw-medium">{row.category_name}</td>
                          <td className="text-end text-muted">
                            {formatNumber(row.planned)} €
                          </td>
                          <td
                            className={`text-end ${variance > 0 ? "text-success" : variance < 0 ? "text-danger" : ""}`}
                          >
                            {variance > 0 ? "+" : ""}
                            {formatNumber(variance)} €
                          </td>
                          <td className="text-end">
                            {formatNumber(row.actual)} €
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="table-light fw-bold">
                    <tr>
                      <td>TOTAL</td>
                      <td className="text-end">
                        {formatNumber(totalPlanned)} €
                      </td>
                      <td
                        className={
                          totalPlanned - totalActual !== 0
                            ? totalPlanned - totalActual > 0
                              ? "text-end text-success"
                              : "text-end text-danger"
                            : "text-end"
                        }
                      >
                        {totalPlanned - totalActual > 0 ? "+" : ""}
                        {formatNumber(totalPlanned - totalActual)} €
                      </td>
                      <td className="text-end">
                        {formatNumber(totalActual)} €
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "evo" && (
          <div className="tab-pane fade show active">
            <div className="card">
              <div className="card-header bg-white fw-semibold">
                <i className="bi bi-graph-up me-2 text-primary"></i>
                Évolution des dépenses mensuelles
              </div>
              <div className="card-body" style={{ height: "400px" }}>
                <Line
                  data={lineData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: "top" } },
                    scales: { y: { beginAtZero: true } },
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "net" && (
          <div className="tab-pane fade show active">
            <div className="card">
              <div className="card-header bg-white fw-semibold">
                <i className="bi bi-cash-stack me-2 text-primary"></i>
                Solde net par mois (revenus − dépenses)
              </div>
              <div className="card-body">
                <div className="row g-3">
                  {monthNames.map((name, idx) => {
                    const actualNet = toNum(netActualMonthly[idx] ?? 0);
                    const plannedNet = toNum(netPlannedMonthly[idx] ?? 0);
                    const isPositive = actualNet > 0;
                    const isNegative = actualNet < 0;
                    const bgClass = isPositive
                      ? "bg-success-subtle"
                      : isNegative
                        ? "bg-danger-subtle"
                        : "bg-light";
                    const badgeClass = isPositive
                      ? "bg-success"
                      : isNegative
                        ? "bg-danger"
                        : "bg-secondary";

                    return (
                      <div className="col-md-3 col-sm-6" key={idx}>
                        <div className={`card h-100 border-0 ${bgClass}`}>
                          <div className="card-body text-center py-3">
                            <div className="text-muted small fw-semibold mb-2 text-uppercase">
                              {name}
                            </div>
                            <span
                              className={`badge ${badgeClass} px-3 py-2`}
                              style={{ fontSize: "0.95rem" }}
                            >
                              {isPositive ? "+" : ""}
                              {formatNumber(actualNet)} €
                            </span>
                            <div className="text-muted small mt-2">
                              Prévu : {plannedNet > 0 ? "+" : ""}
                              {formatNumber(plannedNet)} €
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
