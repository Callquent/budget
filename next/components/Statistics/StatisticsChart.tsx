"use client";
import React, { useState, useEffect } from "react";
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

interface CategoryGroup {
  label: string;
  categories: string[];
}

const GROUPS_STORAGE_KEY = "statistics-category-groups";

// Calcule, pour le graphique de répartition uniquement, le libellé à afficher
// pour chaque catégorie brute en tenant compte des groupes définis par l'utilisateur
// (le tableau "Détail par catégorie" reste inchangé, catégorie par catégorie).
function buildCategoryToLabel(categories: string[], groups: CategoryGroup[]) {
  const categoryToLabel: Record<string, string> = {};
  const groupedLabels: string[] = [];
  const seen = new Set<string>();

  categories.forEach((cat) => {
    const groupEntry = groups.find((g) => g.categories.includes(cat));
    const label = groupEntry ? groupEntry.label : cat;
    categoryToLabel[cat] = label;
    if (!seen.has(label)) {
      seen.add(label);
      groupedLabels.push(label);
    }
  });

  return { categoryToLabel, groupedLabels };
}

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
  const [activeTab, setActiveTab] = useState<"dist" | "evo">("dist");

  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [newGroupLabel, setNewGroupLabel] = useState("");
  const [showGroupPanel, setShowGroupPanel] = useState(false);

  // Chargement des groupes définis par l'utilisateur (persistés en local, par navigateur).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(GROUPS_STORAGE_KEY);
      if (saved) setGroups(JSON.parse(saved));
    } catch (e) {
      console.error("Lecture des groupes de catégories impossible", e);
    } finally {
      setGroupsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!groupsLoaded) return;
    try {
      window.localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups));
    } catch (e) {
      console.error("Sauvegarde des groupes de catégories impossible", e);
    }
  }, [groups, groupsLoaded]);

  function toggleCatSelection(cat: string) {
    setSelectedCats((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  }

  function createGroup() {
    const label = newGroupLabel.trim();
    if (!label || selectedCats.length < 2) return;
    setGroups((prev) => [...prev, { label, categories: selectedCats }]);
    setSelectedCats([]);
    setNewGroupLabel("");
  }

  function removeGroup(label: string) {
    setGroups((prev) => prev.filter((g) => g.label !== label));
  }

  // Catégories déjà utilisées dans un groupe existant, pour éviter les doublons.
  const groupedCategoriesSet = new Set(groups.flatMap((g) => g.categories));

  // Conversion défensive : les montants peuvent arriver en string (colonnes
  // decimal Doctrine/Symfony). "+" sur des strings concatène au lieu d'additionner
  // (contrairement à "-"), d'où le bug TOTAL NaN corrigé ici.
  const toNum = (v: number | string) => parseFloat(String(v)) || 0;

  const totalPlanned = summary.reduce((s, r) => s + toNum(r.planned), 0);
  const totalActual = summary.reduce((s, r) => s + toNum(r.actual), 0);

  const { categoryToLabel, groupedLabels } = buildCategoryToLabel(categories, groups);

  // Même regroupement que pour le camembert, appliqué au tableau de détail :
  // les lignes des catégories fusionnées sont sommées sous le libellé du groupe.
  const groupedSummary = groupedLabels.map((label) => {
    const rows = summary.filter((r) => categoryToLabel[r.category_name] === label);
    return {
      category_name: label,
      planned: rows.reduce((s, r) => s + toNum(r.planned), 0),
      actual: rows.reduce((s, r) => s + toNum(r.actual), 0),
    };
  });

  const pieData = (dataObj: Record<string, number | string>) => {
    const groupedValues: Record<string, number> = {};
    categories.forEach((cat) => {
      const label = categoryToLabel[cat];
      groupedValues[label] = (groupedValues[label] ?? 0) + toNum(dataObj[cat] ?? 0);
    });

    return {
      labels: groupedLabels,
      datasets: [
        {
          data: groupedLabels.map((l) => groupedValues[l] ?? 0),
          backgroundColor: CHART_COLORS,
        },
      ],
    };
  };

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

  const netLineData = {
    labels: monthNames,
    datasets: [
      {
        label: "Bilan prévu",
        data: netPlannedMonthly.map(toNum),
        borderColor: "#8b5cf6",
        backgroundColor: "rgba(139, 92, 246, 0.1)",
        fill: true,
        tension: 0.3,
        borderWidth: 3,
        pointRadius: 4,
      },
      {
        label: "Bilan réalisé",
        data: netActualMonthly.map(toNum),
        borderColor: "#ec4899",
        backgroundColor: "rgba(236, 72, 153, 0.1)",
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
            <div className="card mb-4">
              <div
                className="card-header bg-white fw-semibold d-flex align-items-center justify-content-between"
                role="button"
                onClick={() => setShowGroupPanel((v) => !v)}
              >
                <span>
                  <i className="bi bi-diagram-3 me-2 text-primary"></i>
                  Regrouper des catégories
                  {groups.length > 0 && (
                    <span className="badge bg-primary ms-2">{groups.length}</span>
                  )}
                </span>
                <i className={`bi bi-chevron-${showGroupPanel ? "up" : "down"}`}></i>
              </div>
              {showGroupPanel && (
                <div className="card-body">
                  {groups.length > 0 && (
                    <div className="d-flex flex-wrap gap-2 mb-3">
                      {groups.map((g) => (
                        <span
                          key={g.label}
                          className="badge bg-light text-dark border d-flex align-items-center gap-2 py-2 px-3"
                        >
                          <span>
                            <strong>{g.label}</strong> ({g.categories.join(", ")})
                          </span>
                          <i
                            className="bi bi-x-circle text-danger"
                            role="button"
                            onClick={() => removeGroup(g.label)}
                          ></i>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="row g-3 align-items-start">
                    <div className="col-md-7">
                      <div className="small text-muted fw-semibold mb-2">
                        Sélectionner au moins 2 catégories à fusionner
                      </div>
                      <div
                        className="d-flex flex-wrap gap-2"
                        style={{ maxHeight: "180px", overflowY: "auto" }}
                      >
                        {categories.map((cat) => {
                          const alreadyGrouped = groupedCategoriesSet.has(cat);
                          return (
                            <button
                              key={cat}
                              type="button"
                              disabled={alreadyGrouped}
                              className={`btn btn-sm ${
                                selectedCats.includes(cat)
                                  ? "btn-primary"
                                  : "btn-outline-secondary"
                              }`}
                              onClick={() => toggleCatSelection(cat)}
                              title={
                                alreadyGrouped
                                  ? "Déjà incluse dans un groupe existant"
                                  : ""
                              }
                            >
                              {cat}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="col-md-5">
                      <div className="small text-muted fw-semibold mb-2">
                        Nom du groupe affiché sur le graphique
                      </div>
                      <div className="input-group">
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Ex : Abonnements"
                          value={newGroupLabel}
                          onChange={(e) => setNewGroupLabel(e.target.value)}
                        />
                        <button
                          className="btn btn-primary"
                          type="button"
                          disabled={selectedCats.length < 2 || !newGroupLabel.trim()}
                          onClick={createGroup}
                        >
                          <i className="bi bi-plus-lg me-1"></i>Créer
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

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
                    {groupedSummary.map((row, idx) => {
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
            <div className="card mb-4">
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

            <div className="card">
              <div className="card-header bg-white fw-semibold">
                <i className="bi bi-cash-stack me-2 text-primary"></i>
                Bilan mensuel (revenus − dépenses)
              </div>
              <div className="card-body" style={{ height: "400px" }}>
                <Line
                  data={netLineData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: "top" } },
                    scales: { y: { beginAtZero: false } },
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
