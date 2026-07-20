"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL;

interface OverdraftForecast {
  month: number;
  monthLabel: string;
  accountName: string;
  amount: number;
  otherAccountsCount: number;
}

function fmt(num: number) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export default function BudgetOverdraftAlert() {
  const [forecast, setForecast] = useState<OverdraftForecast | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const year = new Date().getFullYear();
        const res = await fetch(`${API}/budget/${year}`, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: YearData = await res.json();
        if (cancelled) return;

        const { accounts, accountBalances, currentMonth, monthNames } = data;

        // Un découvert est un état PAR COMPTE : un compte bien approvisionné
        // ne doit pas "compenser" un autre compte qui passe en négatif dans
        // un total agrégé. On cherche donc, mois par mois à partir du mois
        // en cours, le premier compte dont le solde projeté devient négatif.
        outer: for (let m = currentMonth; m <= 12; m++) {
          const negativeAccounts = accounts.filter((a) => {
            const ab = accountBalances[a.id]?.[m];
            const value = ab?.balance_projected ?? ab?.balance ?? a.balance;
            return Number(value) < 0;
          });

          if (negativeAccounts.length > 0) {
            const worst = negativeAccounts.reduce((min, a) => {
              const ab = accountBalances[a.id]?.[m];
              const value = Number(
                ab?.balance_projected ?? ab?.balance ?? a.balance,
              );
              const minAb = accountBalances[min.id]?.[m];
              const minValue = Number(
                minAb?.balance_projected ?? minAb?.balance ?? min.balance,
              );
              return value < minValue ? a : min;
            }, negativeAccounts[0]);

            const worstAb = accountBalances[worst.id]?.[m];
            const worstValue = Number(
              worstAb?.balance_projected ?? worstAb?.balance ?? worst.balance,
            );

            setForecast({
              month: m,
              monthLabel: monthNames[m],
              accountName: worst.name,
              amount: worstValue,
              otherAccountsCount: negativeAccounts.length - 1,
            });
            break outer;
          }
        }
      } catch (e) {
        // L'alerte est une amélioration, pas une donnée critique du dashboard :
        // on n'affiche rien, mais on log pour pouvoir diagnostiquer.
        console.error("BudgetOverdraftAlert: échec du chargement", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !forecast) return null;

  return (
    <div className="alert alert-danger border-0 shadow-sm d-flex align-items-center gap-3 rounded-3 mb-4">
      <i className="bi bi-exclamation-triangle-fill fs-4 flex-shrink-0"></i>
      <div>
        <div className="fw-semibold">
          Vous serez à découvert sur « {forecast.accountName} » en{" "}
          {forecast.monthLabel.toLowerCase()}
          {forecast.otherAccountsCount > 0 &&
            ` (et ${forecast.otherAccountsCount} autre${forecast.otherAccountsCount > 1 ? "s" : ""} compte${forecast.otherAccountsCount > 1 ? "s" : ""})`}
        </div>
        <div className="small text-danger-emphasis">
          Solde prévisionnel estimé : {fmt(forecast.amount)} €
        </div>
      </div>
    </div>
  );
}
