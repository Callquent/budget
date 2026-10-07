"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { SavingsGoalInterface } from "./Savings.interface";

const API = process.env.NEXT_PUBLIC_API_URL;

const FREQUENCY_LABELS: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
  occasional: "One-time",
};

export default function SavingsList() {
  const [goals, setGoals] = useState<SavingsGoalInterface[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch(`${API}/savings`)
      .then((r) => r.json())
      .then((data) => setGoals(data.savingsGoals ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleToggle = async (id: number) => {
    await fetch(`${API}/savings/${id}/toggle`, { method: "POST" });
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this savings goal? Unapproved linked budget lines will be removed too.")) {
      return;
    }
    await fetch(`${API}/savings/${id}/delete`, { method: "POST" });
    load();
  };

  return (
    <div className="row justify-content-center">
      <div className="col-lg-8">
        <div className="d-flex align-items-center justify-content-between mb-4">
          <h1 className="h4 mb-0">Savings goals</h1>
          <Link href="/savings/new" className="btn btn-primary">
            <i className="bi bi-plus-lg me-1"></i>New goal
          </Link>
        </div>

        {loading && <p className="text-muted">Loading…</p>}

        {!loading && goals.length === 0 && (
          <div className="text-muted">
            No savings goals yet — for example a new bike, a car reserve, or
            a garage purchase.
          </div>
        )}

        <div className="d-flex flex-column gap-3">
          {goals.map((goal) => {
            const target = Number(goal.targetAmount);
            const contributed = goal.contributedAmount ?? 0;
            const progress = goal.progressPercentage ?? 0;
            const isActive = goal.status === "active";
            // Marge de 1 centime pour les arrondis décimaux.
            const isAvailable = target > 0 && contributed + 0.01 >= target;

            return (
              <div className="card p-3" key={goal.id}>
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <div className="d-flex align-items-center gap-2">
                      <h2 className="h6 mb-0">{goal.name}</h2>
                      <span
                        className={`badge ${isAvailable ? "bg-primary" : isActive ? "bg-success" : "bg-secondary"}`}
                      >
                        {isAvailable ? "Available" : isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="text-muted small">
                      {FREQUENCY_LABELS[goal.frequency] ?? goal.frequency} ·{" "}
                      {Number(goal.contributionAmount).toFixed(2)} € per period
                    </div>
                  </div>

                  <div className="dropdown">
                    <button
                      type="button"
                      className="btn btn-link text-muted p-1"
                      data-bs-toggle="dropdown"
                      aria-expanded="false"
                      aria-label="Actions"
                    >
                      <i className="bi bi-three-dots-vertical fs-5"></i>
                    </button>
                    <ul className="dropdown-menu dropdown-menu-end">
                      <li>
                        <Link className="dropdown-item" href={`/savings/${goal.id}/edit`}>
                          <i className="bi bi-pencil me-2"></i>Edit
                        </Link>
                      </li>
                      <li>
                        <button
                          type="button"
                          className="dropdown-item"
                          onClick={() => handleToggle(goal.id)}
                        >
                          <i className={`bi ${isActive ? "bi-pause" : "bi-play"} me-2`}></i>
                          {isActive ? "Pause" : "Resume"}
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          className="dropdown-item text-danger"
                          onClick={() => handleDelete(goal.id)}
                        >
                          <i className="bi bi-trash me-2"></i>Delete
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="mt-2">
                  <div className="d-flex justify-content-between mb-1">
                    <span className="fw-semibold">
                      {contributed.toFixed(2)}&nbsp;/&nbsp;{target.toFixed(2)}&nbsp;€
                    </span>
                    <span className="text-muted">{progress.toFixed(0)}%</span>
                  </div>
                  <div className="progress" style={{ height: "8px" }}>
                    <div
                      className="progress-bar bg-success"
                      role="progressbar"
                      style={{ width: `${Math.min(100, progress)}%` }}
                      aria-valuenow={progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
