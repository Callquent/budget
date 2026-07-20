<?php

namespace App\Controller;

use App\Repository\BudgetRepository;
use App\Support\BudgetLabels;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/statistics', name: 'statistics_')]
class StatisticsController extends AbstractController
{
    #[Route('', name: 'index')]
    #[Route('/{year}', name: 'year', requirements: ['year' => '\d{4}'])]
    public function index(BudgetRepository $repo, int $year = 0): Response
    {
        $now = new \DateTimeImmutable();
        if ($year === 0) {
            $year = (int) $now->format('Y');
        }

        $summary = $repo->findYearlyCategorySummary($year);

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

        $currentYear = (int) $now->format('Y');
        $availableYears = range($currentYear - 2, $currentYear + 1);

        return $this->json([
            'year'           => $year,
            'currentYear'    => $currentYear,
            'availableYears' => $availableYears,
            'plannedChart'   => $plannedChart,
            'actualChart'    => $actualChart,
            'categories'     => $categories,
            'summary'        => $summary,
            'plannedMonthly' => array_values($plannedMonthly),
            'actualMonthly'  => array_values($actualMonthly),
            'monthNames'     => array_values(BudgetLabels::MONTHS),
        ]);
    }
}
