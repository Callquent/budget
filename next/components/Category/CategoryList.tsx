"use client";
import React, { Fragment as ReactFragment, useState, useEffect } from "react";
import Link from "next/link";
import type { CategoryInterface } from "./Category.interface";

interface ApiResponse {
  grouped: Record<string, CategoryInterface[]>;
}

const API = process.env.NEXT_PUBLIC_API_URL;

const typeLabels = {
  income: "Recettes",
  expense: "Dépenses",
  transfer: "Virements",
};
const typeColors = {
  income: "success",
  expense: "danger",
  transfer: "primary",
};
const freqLabels = {
  monthly: "Mensuelle",
  yearly: "Annuelle",
  quarterly: "Trimestrielle",
  occasional: "Occasionnelle",
};

export default function CategoryList() {
  const [grouped, setGrouped] = useState<Record<string, CategoryInterface[]>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/categories`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data: ApiResponse = await res.json();
      setGrouped(data.grouped);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Supprimer « ${name} » ?`)) return;
    try {
      const res = await fetch(`${API}/categories/${id}/delete`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`${res.status} — ${body}`);
      }
      fetchCategories();
    } catch (e: any) {
      alert(`Erreur lors de la suppression : ${e.message}`);
    }
  };

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
        Impossible de charger les catégories : {error}
        <button
          className="btn btn-sm btn-outline-danger ms-auto"
          onClick={() => window.location.reload()}
        >
          Réessayer
        </button>
      </div>
    );

  if (Object.keys(grouped).length === 0)
    return (
      <div className="alert alert-info">
        Aucune catégorie.{" "}
        <Link href="/categories/new" className="alert-link">
          En ajouter une
        </Link>
        .
      </div>
    );

  return (
    <>
      {Object.entries(grouped).map(([type, categories]) => (
        <ReactFragment key={type}>
          <h5
            className={`text-${typeColors[type as keyof typeof typeColors] || "secondary"} mt-4 mb-3`}
          >
            <i
              className="bi bi-circle-fill me-2"
              style={{ fontSize: ".6rem", verticalAlign: "middle" }}
            ></i>
            {typeLabels[type as keyof typeof typeLabels] || type}
          </h5>
          <div className="card mb-3">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Nom</th>
                    <th>Fréquence</th>
                    <th>Description</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr key={category.id}>
                      <td className="fw-medium">{category.name}</td>
                      <td>
                        <span className={`badge badge-${category.frequency}`}>
                          {freqLabels[
                            category.frequency as keyof typeof freqLabels
                          ] || category.frequency}
                        </span>
                      </td>
                      <td className="text-muted small">
                        {category.description || "—"}
                      </td>
                      <td className="text-end">
                        <Link
                          href={`/categories/edit/${category.id}`}
                          className="btn btn-outline-primary btn-action me-1"
                        >
                          <i className="bi bi-pencil"></i>
                        </Link>
                        <button
                          className="btn btn-outline-danger btn-action"
                          onClick={() =>
                            handleDelete(category.id, category.name)
                          }
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </ReactFragment>
      ))}
    </>
  );
}
