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
  ArcElement, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler
);

interface StatisticsChartProps {
  summary: { category_name: string; planned: number; actual: number }[];
  plannedChart: Record<string, number>;
  actualChart: Record<string, number>;
  categories: string[];
  plannedMonthly: number[];
  actualMonthly: number[];
}

function formatNumber(num: number) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

const CHART_COLORS = [
  "#3b82f6","#ef4444","#10b981","#f59e0b","#8b5cf6",
  "#ec4899","#06b6d4","#f97316","#6366f1","#14b8a6",
  "#94a3b8","#fca5a5","#fde68a","#bbf7d0","#bfdbfe",
];

const MONTHS = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];

export default function StatisticsChart({
  summary,
  plannedChart,
  actualChart,
  categories,
  plannedMonthly,
  actualMonthly,
}: StatisticsChartProps) {
  const [activeTab, setActiveTab] = useState<"dist" | "evo">("dist");

  const totalPlanned = summary.reduce((s, r) => s + r.planned, 0);
  const totalActual = summary.reduce((s, r) => s + r.actual, 0);

  const pieData = (dataObj: Record<string, number>) => ({
    labels: categories,
    datasets: [{
      data: categories.map((l) => dataObj[l] || 0),
      backgroundColor: CHART_COLORS,
    }],
  });

  const lineData = {
    labels: MONTHS,
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
                    <div style={{ maxWidth: "400px", maxHeight: "400px", width: "100%" }}>
                      <Pie data={pieData(plannedChart)} options={{ plugins: { legend: { position: "bottom" } } }} />
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
                    <div style={{ maxWidth: "400px", maxHeight: "400px", width: "100%" }}>
                      <Pie data={pieData(actualChart)} options={{ plugins: { legend: { position: "bottom" } } }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header bg-white fw-semibold">
                <i className="bi bi-table me-2 text-primary"></i>Détail par catégorie
              </div>
              <div className="table-responsive">
                <table className="table table-hover mb-0 align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>Catégorie</th>
                      <th className="text-end">Total Prévu</th>
                      <th className="text-end">Total Réalisé</th>
                      <th className="text-end">Écart</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((row, idx) => {
                      const variance = row.planned - row.actual;
                      return (
                        <tr key={idx}>
                          <td className="fw-medium">{row.category_name}</td>
                          <td className="text-end text-muted">{formatNumber(row.planned)} €</td>
                          <td className="text-end">{formatNumber(row.actual)} €</td>
                          <td className={`text-end ${variance > 0 ? "text-success" : variance < 0 ? "text-danger" : ""}`}>
                            {variance > 0 ? "+" : ""}{formatNumber(variance)} €
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="table-light fw-bold">
                    <tr>
                      <td>TOTAL</td>
                      <td className="text-end">{formatNumber(totalPlanned)} €</td>
                      <td className="text-end">{formatNumber(totalActual)} €</td>
                      <td className="text-end">{formatNumber(totalPlanned - totalActual)} €</td>
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
      </div>
    </>
  );
}
