export interface SummaryRow {
  category_name: string;
  planned: number;
  actual: number;
}

export type StatisticsGroupBy = "category" | "subcategory";

export interface ApiData {
  currentYear: number;
  availableYears: number[];
  groupBy: StatisticsGroupBy;
  summary: SummaryRow[];
  plannedChart: Record<string, number>;
  actualChart: Record<string, number>;
  categories: string[];
  plannedMonthly: number[];
  actualMonthly: number[];
  netPlannedMonthly: number[];
  netActualMonthly: number[];
  monthNames: string[];
}

export interface StatisticsViewProps {
  year: string;
}

export interface StatisticsChartProps {
  summary: SummaryRow[];
  plannedChart: Record<string, number>;
  actualChart: Record<string, number>;
  categories: string[];
  plannedMonthly: number[];
  actualMonthly: number[];
  netPlannedMonthly: number[];
  netActualMonthly: number[];
  monthNames: string[];
}
