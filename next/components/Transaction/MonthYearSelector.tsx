"use client";
import Link from "next/link";

interface MonthYearSelectorProps {
  year: string;
  month: string;
  nowYear: number;
  nowMonth: number;
  months: Record<number, string>;
}

export default function MonthYearSelector({
  year,
  month,
  nowYear,
  nowMonth,
  months,
}: MonthYearSelectorProps) {
  return (
    <div className="card mb-4 p-3">
      <div className="d-flex align-items-center gap-3 flex-wrap">
        <div className="d-flex align-items-center gap-2">
          <label className="text-muted small fw-semibold mb-0">MOIS</label>
          <select
            className="form-select form-select-sm"
            style={{ width: "auto" }}
            value={month}
            onChange={(e) =>
              (window.location.href = `/transactions/${year}/${e.target.value}`)
            }
          >
            {Object.entries(months).map(([num, name]) => (
              <option key={num} value={num}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="d-flex align-items-center gap-2">
          <label className="text-muted small fw-semibold mb-0">ANNÉE</label>
          <select
            className="form-select form-select-sm"
            style={{ width: "auto" }}
            value={year}
            onChange={(e) =>
              (window.location.href = `/transactions/${e.target.value}/${month}`)
            }
          >
            {Array.from({ length: 4 }, (_, i) => nowYear - 2 + i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="ms-auto d-flex gap-2">
          <Link
            href={`/transactions/${year}/${parseInt(month) - 1}`}
            className="btn btn-outline-secondary btn-sm"
          >
            <i className="bi bi-chevron-left"></i>
          </Link>
          <Link
            href={`/transactions/${nowYear}/${nowMonth}`}
            className="btn btn-outline-secondary btn-sm"
          >
            Aujourd&apos;hui
          </Link>
          <Link
            href={`/transactions/${year}/${parseInt(month) + 1}`}
            className="btn btn-outline-secondary btn-sm"
          >
            <i className="bi bi-chevron-right"></i>
          </Link>
        </div>
      </div>
    </div>
  );
}
