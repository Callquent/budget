import Link from "next/link";
import StatisticsChart from "@/components/StatisticsChart";

const MOCK_DATA = {
  currentYear: 2026,
  availableYears: [2024, 2025, 2026],
  summary: [
    { category_name: "Loyer",        planned: 12000, actual: 12000 },
    { category_name: "Alimentation", planned: 4000,  actual: 4200  },
    { category_name: "Loisirs",      planned: 2000,  actual: 1800  },
    { category_name: "Salaire",      planned: 25000, actual: 25000 },
  ],
  plannedChart:   { Loyer: 12000, Alimentation: 4000, Loisirs: 2000 },
  actualChart:    { Loyer: 12000, Alimentation: 4200, Loisirs: 1800 },
  categories:     ["Loyer", "Alimentation", "Loisirs"],
  plannedMonthly: [1000,1000,1000,1000,1000,1000,1000,1000,1000,1000,1000,1000],
  actualMonthly:  [1000,1100,900,1000,1050,950,1000,1100,800,1000,1000,1000],
};

export default async function StatisticsPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;
  const { currentYear, availableYears, summary, plannedChart, actualChart, categories, plannedMonthly, actualMonthly } = MOCK_DATA;

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h1 className="h3 mb-0">
          <i className="bi bi-graph-up-arrow me-2 text-primary"></i>
          Statistiques Budget {year}
        </h1>
        <div className="d-flex align-items-center gap-2 year-nav">
          <span className="text-muted me-2 small fw-semibold">ANNÉE</span>
          {availableYears.map((y) => (
            <Link
              key={y}
              href={`/statistics/${y}`}
              className={`btn btn-sm ${y === parseInt(year) ? "btn-dark" : "btn-outline-secondary"}`}
            >
              {y}
              {y === currentYear && (
                <span className="badge bg-primary ms-1" style={{ fontSize: ".6rem" }}>
                  en cours
                </span>
              )}
            </Link>
          ))}
        </div>
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
