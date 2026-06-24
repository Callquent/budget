"use client";
import React from "react";
import type { CategoryInterface } from "../Category/Category.interface";

interface CategoryPickerProps {
  grouped: Record<string, CategoryInterface[]>;
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  income: "Recettes",
  expense: "Dépenses",
  transfer: "Virements",
};

const TYPE_COLORS: Record<string, string> = {
  income: "success",
  expense: "danger",
  transfer: "primary",
};

export default function CategoryPicker({
  grouped,
  value,
  onChange,
  disabled = false,
}: CategoryPickerProps) {
  return (
    <div className="d-flex flex-column gap-2">
      {Object.entries(grouped).map(([type, categories]) => {
        const color = TYPE_COLORS[type] ?? "secondary";
        const label = TYPE_LABELS[type] ?? type;

        return (
          <div key={type}>
            <div className={`text-${color} small fw-semibold mb-1`}>
              {label}
            </div>
            <div className="d-flex flex-wrap gap-1">
              {categories.map((cat) => {
                const isActive = value === String(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(String(cat.id))}
                    className={`btn btn-sm ${
                      isActive
                        ? `btn-${color}`
                        : `btn-outline-${color}`
                    }`}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
