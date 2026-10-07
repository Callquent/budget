"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface SidebarProps {
  onSearch?: (query: string) => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: string;
  exact?: boolean;
}

const NAV_GROUPS: { label: string; icon: string; items: NavItem[] }[] = [
  {
    label: "Pilotage",
    icon: "bi-speedometer2",
    items: [
      { name: "Tableau de bord", href: "/",           icon: "bi-house", exact: true },
      { name: "Budget",          href: "/budget",     icon: "bi-calendar3" },
      { name: "Statistiques",    href: "/statistics", icon: "bi-graph-up-arrow" },
    ],
  },
  {
    label: "Mouvements",
    icon: "bi-arrow-left-right",
    items: [
      { name: "Transactions", href: "/transactions",  icon: "bi-list-ul" },
      { name: "Abonnements",  href: "/subscriptions", icon: "bi-arrow-repeat" },
      { name: "Épargne",      href: "/savings",       icon: "bi-piggy-bank" },
    ],
  },
  {
    label: "Configuration",
    icon: "bi-gear",
    items: [
      { name: "Comptes",    href: "/accounts",   icon: "bi-bank" },
      { name: "Catégories", href: "/categories", icon: "bi-tags" },
    ],
  },
];

// Barre mobile : mêmes 5 entrées qu'avant (la place manque pour les 8).
const MOBILE_HREFS = ["/", "/budget", "/transactions", "/subscriptions", "/accounts"];
const MOBILE_ITEMS = NAV_GROUPS.flatMap((g) => g.items).filter((i) =>
  MOBILE_HREFS.includes(i.href),
);

export default function Sidebar({ onSearch }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  // Sections repliables : seule celle de la page courante est ouverte au départ.
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      NAV_GROUPS.map((g) => [g.label, g.items.some((i) => isActive(i))]),
    ),
  );
  const toggleGroup = (label: string) =>
    setOpen((o) => ({ ...o, [label]: !o[label] }));

  return (
    <>
      {/* ── Sidebar (desktop) ─────────────────────────────────── */}
      <aside
        className="d-none d-md-flex flex-column"
        style={{
          width: "220px",
          minWidth: "220px",
          minHeight: "100vh",
          background: "#111827",
          color: "#e5e7eb",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto",
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: "24px 20px 20px",
            borderBottom: "1px solid rgba(255,255,255,.07)",
          }}
        >
          <Link
            href="/"
            style={{
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <span
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 4px 12px rgba(99,102,241,.4)",
              }}
            >
              <i className="bi bi-wallet2 text-white" style={{ fontSize: "1rem" }}></i>
            </span>
            <span
              style={{
                color: "#fff",
                fontWeight: 700,
                fontSize: "1.05rem",
                letterSpacing: "-.01em",
              }}
            >
              Budget
            </span>
          </Link>
        </div>

        {/* AI Assistant Button */}
        <div style={{ padding: "8px 10px" }}>
          <button
            onClick={() => onSearch?.("")}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              background: "linear-gradient(135deg, rgba(99,102,241,.2) 0%, rgba(139,92,246,.15) 100%)",
              border: "1px solid rgba(99,102,241,.3)",
              borderRadius: "8px",
              padding: "10px 12px",
              color: "#e5e7eb",
              fontSize: ".85rem",
              fontWeight: 500,
              cursor: "pointer",
              outline: "none",
              transition: "all .2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "linear-gradient(135deg, rgba(99,102,241,.3) 0%, rgba(139,92,246,.25) 100%)";
              e.currentTarget.style.borderColor = "rgba(99,102,241,.5)";
              e.currentTarget.style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "linear-gradient(135deg, rgba(99,102,241,.2) 0%, rgba(139,92,246,.15) 100%)";
              e.currentTarget.style.borderColor = "rgba(99,102,241,.3)";
              e.currentTarget.style.color = "#e5e7eb";
            }}
          >
            <i className="bi bi-stars" style={{ fontSize: ".9rem" }}></i>
            <span>Assistant IA</span>
          </button>
        </div>

        {/* Nav */}
        <nav style={{ padding: "12px 10px", flexGrow: 1 }}>
          {NAV_GROUPS.map((group) => {
            const isOpen = !!open[group.label];
            const hasActive = group.items.some((i) => isActive(i));
            return (
              <div key={group.label} style={{ marginBottom: "4px" }}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  aria-expanded={isOpen}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "none",
                    background: "transparent",
                    outline: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: ".875rem",
                    color: hasActive ? "#fff" : "#e5e7eb",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,.05)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <i
                    className={`bi ${group.icon}`}
                    style={{
                      fontSize: "1rem",
                      width: "18px",
                      textAlign: "center",
                      flexShrink: 0,
                      color: hasActive ? "#60a5fa" : "inherit",
                    }}
                  ></i>
                  <span style={{ flexGrow: 1 }}>{group.label}</span>
                  <i
                    className="bi bi-chevron-down"
                    style={{
                      fontSize: ".75rem",
                      color: "#6b7280",
                      transition: "transform .2s ease",
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  ></i>
                </button>

                {isOpen && (
                  <ul style={{ listStyle: "none", padding: 0, margin: "2px 0 0" }}>
                    {group.items.map((item) => {
                      const active = isActive(item);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            style={{
                              display: "block",
                              padding: "8px 12px 8px 40px",
                              borderRadius: "8px",
                              marginBottom: "2px",
                              textDecoration: "none",
                              fontWeight: active ? 600 : 400,
                              fontSize: ".85rem",
                              color: active ? "#fff" : "#9ca3af",
                              background: active
                                ? "linear-gradient(90deg, rgba(59,130,246,.25) 0%, rgba(99,102,241,.15) 100%)"
                                : "transparent",
                              borderLeft: active
                                ? "3px solid #3b82f6"
                                : "3px solid transparent",
                              transition: "all .15s ease",
                            }}
                            onMouseEnter={(e) => {
                              if (!active) {
                                (e.currentTarget as HTMLElement).style.background =
                                  "rgba(255,255,255,.05)";
                                (e.currentTarget as HTMLElement).style.color = "#e5e7eb";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!active) {
                                (e.currentTarget as HTMLElement).style.background =
                                  "transparent";
                                (e.currentTarget as HTMLElement).style.color = "#9ca3af";
                              }
                            }}
                          >
                            <span style={{ opacity: 0.5, marginRight: "8px" }}>–</span>
                            {item.name}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid rgba(255,255,255,.07)",
            fontSize: ".72rem",
            color: "#4b5563",
          }}
        >
          © {new Date().getFullYear()} Budget App
        </div>
      </aside>

      {/* ── Bottom tab bar (mobile) ────────────────────────────── */}
      <nav
        className="d-flex d-md-none"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          background: "#111827",
          borderTop: "1px solid rgba(255,255,255,.08)",
          padding: "6px 0 calc(6px + env(safe-area-inset-bottom))",
          justifyContent: "space-around",
        }}
      >
        {MOBILE_ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "3px",
                textDecoration: "none",
                color: active ? "#60a5fa" : "#6b7280",
                minWidth: "52px",
                padding: "2px 4px",
              }}
            >
              <i className={`bi ${item.icon}`} style={{ fontSize: "1.2rem" }}></i>
              <span style={{ fontSize: ".6rem", fontWeight: active ? 600 : 400 }}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
