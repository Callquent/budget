import StatisticsView from "@/components/StatisticsView";

export default async function StatisticsPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h1 className="h3 mb-0">
          <i className="bi bi-graph-up-arrow me-2 text-primary"></i>
          Statistiques Budget {year}
        </h1>
      </div>

      <StatisticsView year={year} />
    </>
  );
}
