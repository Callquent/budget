"use client";
import Link from "next/link";
import CategoryList from "@/components/Category/CategoryList";

export default function CategoriesPage() {
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">
          <i className="bi bi-tags me-2 text-primary"></i>Catégories
        </h1>
        <Link href="/categories/new" className="btn btn-primary btn-sm">
          <i className="bi bi-plus-lg me-1"></i>Nouvelle catégorie
        </Link>
      </div>
      <CategoryList />
    </>
  );
}
