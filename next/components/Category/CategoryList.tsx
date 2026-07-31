"use client";
import React, { Fragment as ReactFragment, useState, useEffect } from "react";
import Link from "next/link";
import type { CategoryInterface, CategoryApiResponse } from "./Category.interface";

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

interface CategoryNode extends CategoryInterface {
  children: CategoryNode[];
}

function buildTree(categories: CategoryInterface[]): CategoryNode[] {
  const byId = new Map<number, CategoryNode>();
  categories.forEach((c) => byId.set(c.id, { ...c, children: [] }));

  const roots: CategoryNode[] = [];
  categories.forEach((c) => {
    const node = byId.get(c.id)!;
    const parent = c.parentId != null ? byId.get(c.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

// Aplatit l'arbre en ordre préfixe (parent immédiatement suivi de ses enfants)
// pour un rendu simple en lignes de tableau, avec la profondeur pour l'indentation.
function flattenTree(nodes: CategoryNode[], depth = 0): { node: CategoryNode; depth: number }[] {
  return nodes.flatMap((node) => [
    { node, depth },
    ...flattenTree(node.children, depth + 1),
  ]);
}

export default function CategoryList() {
  const [grouped, setGrouped] = useState<Record<string, CategoryInterface[]>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/categories`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data: CategoryApiResponse = await res.json();
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

  const moveCategory = async (id: number, parentId: number | null) => {
    try {
      const res = await fetch(`${API}/categories/${id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erreur ${res.status}`);
      }
      fetchCategories();
    } catch (e: any) {
      alert(`Déplacement impossible : ${e.message}`);
    }
  };

  const handleDragStart = (e: React.DragEvent, id: number) => {
    e.dataTransfer.setData("text/plain", String(id));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOverRow = (e: React.DragEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(id);
  };

  const handleDropOnRow = (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverId(null);
    const draggedId = Number(e.dataTransfer.getData("text/plain"));
    if (!draggedId || draggedId === targetId) return;
    moveCategory(draggedId, targetId);
  };

  // Déposer en dehors d'une ligne précise (zone vide du tableau, ou pied de carte)
  // remonte la catégorie au premier niveau.
  const handleDropToRoot = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverId(null);
    const draggedId = Number(e.dataTransfer.getData("text/plain"));
    if (!draggedId) return;
    moveCategory(draggedId, null);
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

  // La catégorie Virement est auto-provisionnée côté backend (voir
  // CategoryRepository::findOrCreateTransferCategory) et n'a pas vocation à
  // être gérée ici : elle reste utilisable partout ailleurs (ex : le picker
  // de /budget/.../new), juste masquée de cette page de gestion.
  const manageableGrouped = Object.fromEntries(
    Object.entries(grouped).filter(([type]) => type !== "transfer"),
  );

  if (Object.keys(manageableGrouped).length === 0)
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
      {Object.entries(manageableGrouped).map(([type, categories]) => {
        const rows = flattenTree(buildTree(categories));
        return (
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
                    <th>Description</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody onDragOver={(e) => e.preventDefault()} onDrop={handleDropToRoot}>
                  {rows.map(({ node: category, depth }) => (
                    <tr
                      key={category.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, category.id)}
                      onDragOver={(e) => handleDragOverRow(e, category.id)}
                      onDragLeave={() => setDragOverId(null)}
                      onDrop={(e) => handleDropOnRow(e, category.id)}
                      className={dragOverId === category.id ? "table-primary" : ""}
                      style={{ cursor: "grab" }}
                    >
                      <td
                        className="fw-medium"
                        style={{ paddingLeft: `${0.75 + depth * 1.5}rem` }}
                      >
                        <i className="bi bi-grip-vertical text-muted me-2"></i>
                        {depth > 0 && (
                          <i className="bi bi-arrow-return-right text-muted me-1"></i>
                        )}
                        {category.name}
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
            <div
              className="card-footer text-muted small text-center py-2"
              style={{ opacity: 0.7 }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDropToRoot}
            >
              Déposer ici pour remettre une catégorie au premier niveau
            </div>
          </div>
        </ReactFragment>
        );
      })}
    </>
  );
}
