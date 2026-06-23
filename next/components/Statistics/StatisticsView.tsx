"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import StatisticsChart from "@/components/Statistics/StatisticsChart";

interface SummaryRow {
  category_name: string;
  planned: number;
  actual: number;
}

interface ApiData {
  currentYear: number;
  availableYears: number[];
  summary: SummaryRow[];
  plannedChart: Record<string, number>;
  actualChart: Record<string, number>;
  categories: string[];
  plannedMonthly: number[];
  actualMonthly: number[];
}

const API = process.env.NEXT_PUBLIC_API_URL;

interface StatisticsViewProps {
  year: string;
}

export default function StatisticsView({ year }: StatisticsViewProps) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/statistics/${year}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading)
    return (
      <div className="d-flex justify-content-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Chargement…</span>
        </div>
      </div>
    );

  if (error)
    return (
      <div className="alert alert-danger d-flex align-items-center gap-2">
        <i className="bi bi-exclamation-triangle-fill"></i>
        Impossible de charger les statistiques : {error}
        <button
          className="btn btn-sm btn-outline-danger ms-auto"
          onClick={fetchData}
        >
          Réessayer
        </button>
      </div>
    );

  if (!data) return null;

  const {
    currentYear,
    availableYears,
    summary,
    plannedChart,
    actualChart,
    categories,
    plannedMonthly,
    actualMonthly,
  } = data;

  return (
    <>
      <div className="d-flex align-items-center gap-2 year-nav mb-4">
        <span className="text-muted me-2 small fw-semibold">ANNÉE</span>
        {availableYears.map((y) => (
          <Link
            key={y}
            href={`/statistics/${y}`}
            className={`btn btn-sm ${y === parseInt(year) ? "btn-dark" : "btn-outline-secondary"}`}
          >
            {y}
            {y === currentYear && (
              <span
                className="badge bg-primary ms-1"
                style={{ fontSize: ".6rem" }}
              >
                en cours
              </span>
            )}
          </Link>
        ))}
      </div>

      <StatisticsChart
        summary={summary}
        plannedChart={plannedChart}
        actualChart={actualChart}
        categories={categories}
        plannedMonthly={plannedMonthly}
        actualMonthly={actualMonthly}
      />
    </>
  );
}
