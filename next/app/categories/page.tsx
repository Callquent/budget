"use client";
import React, { Fragment as ReactFragment } from 'react';
import Link from 'next/link';

const MOCK_DATA = {
  grouped: {
    income: [
      { id: 1, name: 'Salaire', frequency: 'monthly', description: 'Revenu principal' },
      { id: 2, name: 'Dividendes', frequency: 'quarterly', description: 'Investissements' },
    ],
    expense: [
      { id: 3, name: 'Loyer', frequency: 'monthly', description: 'Logement' },
      { id: 4, name: 'Courses', frequency: 'monthly', description: 'Alimentation' },
      { id: 5, name: 'Sante', frequency: 'occasional', description: 'Pharmacie, médecin' },
    ],
    transfer: [
      { id: 6, name: 'Épargne', frequency: 'monthly', description: 'Virement vers livret' },
    ]
  }
};

const typeLabels = { income: 'Recettes', expense: 'Dépenses', transfer: 'Virements' };
const typeColors = { income: 'success', expense: 'danger', transfer: 'primary' };
const freqLabels = { monthly: 'Mensuelle', yearly: 'Annuelle', quarterly: 'Trimestrielle', occasional: 'Occasionnelle' };

export default function CategoriesPage() {
  const { grouped } = MOCK_DATA;

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0"><i className="bi bi-tags me-2 text-primary"></i>Catégories</h1>
        <Link href="/categories/new" className="btn btn-primary btn-sm">
          <i className="bi bi-plus-lg me-1"></i>Nouvelle catégorie
        </Link>
      </div>

      {Object.entries(grouped).map(([type, categories]) => (
        <ReactFragment key={type}>
          <h5 className={`text-${typeColors[type] || 'secondary'} mt-4 mb-3`}>
            <i className="bi bi-circle-fill me-2" style={{ fontSize: '.6rem', verticalAlign: 'middle' }}></i>
            {typeLabels[type] || type}
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
                  {categories.map(category => (
                    <tr key={category.id}>
                      <td className="fw-medium">{category.name}</td>
                      <td>
                        <span className={`badge badge-${category.frequency}`}>
                          {freqLabels[category.frequency] || category.frequency}
                        </span>
                      </td>
                      <td className="text-muted small">{category.description || '—'}</td>
                      <td className="text-end">
                        <Link href={`/categories/edit/${category.id}`} className="btn btn-outline-primary btn-action me-1">
                          <i className="bi bi-pencil"></i>
                        </Link>
                        <button className="btn btn-outline-danger btn-action" onClick={() => window.confirm(`Supprimer « ${category.name} » ?`)}>
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
