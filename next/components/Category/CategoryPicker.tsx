"use client";
import React, { useEffect, useState } from "react";
import type { CategoryInterface } from "../Category/Category.interface";

const API = process.env.NEXT_PUBLIC_API_URL;

interface CategoryPickerProps {
  grouped: Record<string, CategoryInterface[]>;
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  // Appelé après une création réussie, pour que le parent mette à jour son
  // état `grouped` sans devoir tout recharger depuis l'API.
  onCategoryCreated?: (type: string, category: CategoryInterface) => void;
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
  onCategoryCreated,
}: CategoryPickerProps) {
  // Pour chaque type (income/expense/transfer), id de la catégorie parente
  // actuellement "ouverte" (dont on affiche les sous-catégories). null =
  // on affiche la liste des catégories racines.
  const [openParentId, setOpenParentId] = useState<Record<string, string | null>>({});

  // Création rapide : un seul formulaire de création ouvert à la fois,
  // dans le groupe (type) où l'utilisateur a cliqué sur "+".
  const [creatingType, setCreatingType] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const startCreate = (type: string) => {
    setCreatingType(type);
    setNewName("");
    setCreateError(null);
  };

  const cancelCreate = () => {
    setCreatingType(null);
    setNewName("");
    setCreateError(null);
  };

  const handleCreate = async (
    type: string,
    parentId: string | null,
  ) => {
    const name = newName.trim();
    if (!name) return;

    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch(`${API}/categories/new`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          transactionType: type,
          parentId: parentId ? parseInt(parentId) : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? `Erreur ${res.status}`);
      }
      const created: CategoryInterface = await res.json();
      onCategoryCreated?.(type, created);
      onChange(String(created.id));
      cancelCreate();
    } catch (err: any) {
      setCreateError(err.message ?? "Erreur lors de la création.");
    } finally {
      setCreating(false);
    }
  };

  // Si la valeur sélectionnée est une sous-catégorie (cas de l'édition d'une
  // ligne existante), on ouvre automatiquement son parent pour l'afficher.
  useEffect(() => {
    if (!value) return;
    for (const [type, categories] of Object.entries(grouped)) {
      const selected = categories.find((c) => String(c.id) === value);
      if (selected?.parentId != null) {
        const parentId = String(selected.parentId);
        setOpenParentId((prev) =>
          prev[type] === parentId ? prev : { ...prev, [type]: parentId },
        );
      }
    }
  }, [value, grouped]);

  return (
    <div className="d-flex flex-column gap-2">
      {Object.entries(grouped).map(([type, categories]) => {
        const color = TYPE_COLORS[type] ?? "secondary";
        const label = TYPE_LABELS[type] ?? type;

        const topLevel = categories.filter((c) => c.parentId == null);
        const openId = openParentId[type] ?? null;
        const parent = openId
          ? topLevel.find((c) => String(c.id) === openId)
          : null;
        const children = openId
          ? categories.filter((c) => String(c.parentId) === openId)
          : [];

        // Si le parent ouvert n'a en fait pas de sous-catégorie (données
        // incohérentes / plus d'enfants), on retombe sur la liste racine.
        const visible = parent && children.length > 0 ? children : topLevel;
        const isDrilledDown = parent && children.length > 0;

        return (
          <div key={type}>
            <div className={`text-${color} small fw-semibold mb-1 d-flex align-items-center gap-2`}>
              {isDrilledDown && (
                <button
                  type="button"
                  className="btn btn-sm btn-link p-0 text-decoration-none"
                  onClick={() =>
                    setOpenParentId((prev) => ({ ...prev, [type]: null }))
                  }
                  disabled={disabled}
                >
                  <i className="bi bi-chevron-left"></i>
                </button>
              )}
              <span>
                {label}
                {isDrilledDown && <> — {parent!.name}</>}
              </span>
            </div>
            <div className="d-flex flex-wrap gap-1">
              {visible.map((cat) => {
                const isActive = value === String(cat.id);
                const hasChildren = categories.some(
                  (c) => c.parentId != null && String(c.parentId) === String(cat.id),
                );
                return (
                  <button
                    key={cat.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      if (!isDrilledDown && hasChildren) {
                        setOpenParentId((prev) => ({
                          ...prev,
                          [type]: String(cat.id),
                        }));
                      } else {
                        onChange(String(cat.id));
                      }
                    }}
                    className={`btn btn-sm ${
                      isActive ? `btn-${color}` : `btn-outline-${color}`
                    }`}
                  >
                    {cat.name}
                    {!isDrilledDown && hasChildren && (
                      <i className="bi bi-chevron-right ms-1 small"></i>
                    )}
                  </button>
                );
              })}

              {creatingType === type ? (
                // Volontairement un <div> et non un <form> : ce composant est
                // rendu à l'intérieur du <form> de BudgetForm, et un <form>
                // imbriqué provoque une erreur d'hydratation ainsi qu'un
                // submit natif qui recharge la page au lieu de passer par le
                // handleSubmit React du formulaire parent.
                <div className="d-flex align-items-center gap-1">
                  <input
                    autoFocus
                    type="text"
                    className="form-control form-control-sm"
                    style={{ width: "160px" }}
                    placeholder={
                      isDrilledDown ? "Nom de la sous-catégorie" : "Nom de la catégorie"
                    }
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (newName.trim() && !creating) {
                          handleCreate(type, isDrilledDown ? openId : null);
                        }
                      } else if (e.key === "Escape") {
                        cancelCreate();
                      }
                    }}
                    disabled={creating}
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-success"
                    disabled={creating || !newName.trim()}
                    onClick={() => handleCreate(type, isDrilledDown ? openId : null)}
                  >
                    {creating ? (
                      <span className="spinner-border spinner-border-sm"></span>
                    ) : (
                      <i className="bi bi-check-lg"></i>
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={cancelCreate}
                    disabled={creating}
                  >
                    <i className="bi bi-x-lg"></i>
                  </button>
                </div>
              ) : (
                // Pas de bouton "+" pour le type transfer : une seule
                // catégorie Virement doit exister (voir
                // CategoryRepository::findOrCreateTransferCategory), elle est
                // garantie/créée automatiquement côté backend. En proposer
                // la création manuelle laisserait croire qu'on peut en avoir
                // plusieurs.
                !disabled && type !== "transfer" && (
                  <button
                    type="button"
                    className={`btn btn-sm btn-outline-${color}`}
                    style={{ borderStyle: "dashed" }}
                    onClick={() => startCreate(type)}
                    title={
                      isDrilledDown
                        ? "Nouvelle sous-catégorie"
                        : "Nouvelle catégorie"
                    }
                  >
                    <i className="bi bi-plus-lg"></i>
                  </button>
                )
              )}
            </div>
            {creatingType === type && createError && (
              <div className="text-danger small mt-1">{createError}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
