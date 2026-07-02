"use client";
import React from "react";
import type { AccountInterface } from "./Account.interface";

interface AccountPickerProps {
  accounts: AccountInterface[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  required?: boolean;
}

function formatNumber(num: number) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export default function AccountPicker({
  accounts,
  value,
  onChange,
  disabled = false,
  required = false,
}: AccountPickerProps) {
  return (
    <div>
      <div className="row g-2">
        {accounts.map((acc) => {
          const isActive = value === String(acc.id);
          return (
            <div className="col-md-4 col-6" key={acc.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(String(acc.id))}
                className="w-100 text-start p-0 border-0 bg-transparent"
                style={{ outline: "none" }}
              >
                <div
                  className="card h-100"
                  style={{
                    borderWidth: "2px",
                    borderColor: isActive ? "var(--bs-primary)" : "var(--bs-border-color)",
                    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                    boxShadow: isActive ? "0 0 0 3px rgba(var(--bs-primary-rgb), 0.15)" : "none",
                    opacity: disabled ? 0.6 : 1,
                    cursor: disabled ? "not-allowed" : "pointer",
                  }}
                >
                  <div className="card-body py-2 px-3">
                    <div className="fw-semibold small mb-1">{acc.name}</div>
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="fw-bold text-primary" style={{ fontSize: "0.8rem" }}>
                        {acc.balance != null
                          ? `${formatNumber(parseFloat(String(acc.balance)))} ${acc.currency ?? "€"}`
                          : acc.currency ?? "€"}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </div>
      {required && !value && (
        <div className="form-text text-danger mt-1">
          <i className="bi bi-exclamation-circle me-1"></i>
          Veuillez sélectionner un compte.
        </div>
      )}
    </div>
  );
}
