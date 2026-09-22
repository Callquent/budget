<?php

namespace App\Controller;

use App\Repository\BudgetRepository;
use App\Repository\StatisticsRepository;
use App\Support\BudgetLabels;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/statistics', name: 'statistics_')]
class StatisticsController extends AbstractController
{
    #[Route('', name: 'index')]
    #[Route('/{year}', name: 'year', requirements: ['year' => '\d{4}'])]
    public function index(Request $request, BudgetRepository $repo, StatisticsRepository $statisticsRepo, int $year = 0): Response
    {
        $now = new \DateTimeImmutable();
        if ($year === 0) {
            $year = (int) $now->format('Y');
        }

        $groupBy = $request->query->get('groupBy', 'category');
        $summary = $statisticsRepo->findYearlyCategorySummary($year, $groupBy !== 'subcategory');

        $plannedChart = [];
        $actualChart = [];
        $categories = [];

        foreach ($summary as $row) {
            $name = $row['category_name'];
            $categories[] = $name;
            $plannedChart[$name] = (float) $row['planned'];
            $actualChart[$name] = (float) $row['actual'];
        }

        // Totaux mensuels pour l'évolution
        $monthlyTotals = $repo->findYearlyMonthlyTotals($year);
        $plannedMonthly = array_fill(1, 12, 0.0);
        $actualMonthly = array_fill(1, 12, 0.0);

        foreach ($monthlyTotals as $row) {
            $m = (int) $row['month'];
            $plannedMonthly[$m] = (float) $row['planned'];
            $actualMonthly[$m] = (float) $row['actual'];
        }

        // Bilan net mensuel (income - expense) : positif ou négatif par mois.
        // Réutilise findAnnualSummary() (déjà utilisée par la vue budget annuelle)
        // qui calcule directement le solde net planned/actual par mois.
        $netByMonth = array_fill(1, 12, ['planned' => 0.0, 'actual' => 0.0]);
        foreach ($repo->findAnnualSummary($year) as $row) {
            $m = (int) $row['month'];
            $netByMonth[$m] = [
                'planned' => (float) $row['total_planned'],
                'actual'  => (float) $row['total_actual'],
            ];
        }
        $netPlannedMonthly = array_column($netByMonth, 'planned');
        $netActualMonthly  = array_column($netByMonth, 'actual');

        // Évolution mensuelle des revenus, en miroir de celle des dépenses ci-dessus.
        $incomeMonthlyTotals = $statisticsRepo->findYearlyMonthlyTotalsByType($year, 'income');
        $plannedIncomeMonthly = array_fill(1, 12, 0.0);
        $actualIncomeMonthly = array_fill(1, 12, 0.0);

        foreach ($incomeMonthlyTotals as $row) {
            $m = (int) $row['month'];
            $plannedIncomeMonthly[$m] = (float) $row['planned'];
            $actualIncomeMonthly[$m] = (float) $row['actual'];
        }

        $currentYear = (int) $now->format('Y');
        $availableYears = range($currentYear - 2, $currentYear + 1);

        return $this->json([
            'year'               => $year,
            'currentYear'        => $currentYear,
            'availableYears'     => $availableYears,
            'groupBy'            => $groupBy,
            'plannedChart'       => $plannedChart,
            'actualChart'        => $actualChart,
            'categories'         => $categories,
            'summary'            => $summary,
            'plannedMonthly'     => array_values($plannedMonthly),
            'actualMonthly'      => array_values($actualMonthly),
            'netPlannedMonthly'  => array_values($netPlannedMonthly),
            'netActualMonthly'   => array_values($netActualMonthly),
            'plannedIncomeMonthly' => array_values($plannedIncomeMonthly),
            'actualIncomeMonthly'  => array_values($actualIncomeMonthly),
            'monthNames'         => array_values(BudgetLabels::MONTHS),
        ]);
    }

    // Détail mois par mois des budgets d'une catégorie (ou d'une catégorie parente
    // et de ses sous-catégories), utilisé par le clic sur une part du camembert ou
    // une ligne du tableau "Détail par catégorie" côté front.
    #[Route('/{year}/budgets', name: 'budgets', requirements: ['year' => '\d{4}'])]
    public function budgets(Request $request, StatisticsRepository $statisticsRepo, int $year): Response
    {
        $label = $request->query->get('label');
        if (!$label) {
            return $this->json(['error' => 'Le paramètre label est requis.'], 400);
        }

        $groupBy = $request->query->get('groupBy', 'category');
        $budgets = $statisticsRepo->findBudgetsForLabel($year, $label, $groupBy !== 'subcategory');

        return $this->json(['budgets' => $budgets]);
    }
}
