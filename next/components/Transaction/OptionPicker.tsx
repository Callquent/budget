"use client";
import React from "react";

export interface PickerOption {
  value: string;
  label: string;
  color?: string; // Bootstrap color, defaults to "secondary"
}

interface OptionPickerProps {
  options: PickerOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
}

export default function OptionPicker({
  options,
  value,
  onChange,
  disabled = false,
  required = false,
}: OptionPickerProps) {
  return (
    <div className="d-flex flex-wrap gap-1">
      {options.map((opt) => {
        const isActive = value === opt.value;
        const color = opt.color ?? "secondary";
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`btn btn-sm ${isActive ? `btn-${color}` : `btn-outline-${color}`}`}
          >
            {opt.label}
          </button>
        );
      })}
      {required && !value && (
        <div className="w-100 form-text text-danger mt-1">
          <i className="bi bi-exclamation-circle me-1"></i>
          Veuillez faire une sélection.
        </div>
      )}
    </div>
  );
}
