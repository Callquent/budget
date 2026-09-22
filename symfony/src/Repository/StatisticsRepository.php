<?php

namespace App\Repository;

use App\Entity\Budget;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class StatisticsRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Budget::class);
    }

    /**
     * Récupère le total prévu et réalisé par catégorie pour une année donnée.
     * Uniquement pour les dépenses. Les sous-catégories sont regroupées sous
     * leur catégorie parente (ex: "Abonnement internet" + "Abonnement mobile"
     * -> "Abonnements"). Les catégories sans parent restent inchangées.
     */
    public function findYearlyCategorySummary(int $year, bool $groupByParent = true): array
    {
        $rows = $this->createQueryBuilder('mb')
            ->select(
                'c.name as category_name',
                'parent.name as parent_name',
                'SUM(mb.plannedAmount) as planned',
                'SUM(mb.actualAmount) as actual'
            )
            ->join('mb.category', 'c')
            ->leftJoin('c.parent', 'parent')
            ->where('mb.year = :year')
            ->andWhere('c.transactionType = :type')
            ->setParameter('year', $year)
            ->setParameter('type', 'expense')
            ->groupBy('c.id')
            ->addGroupBy('parent.id')
            ->getQuery()
            ->getResult();

        if (!$groupByParent) {
            $result = array_map(static fn(array $row): array => [
                'category_name' => $row['category_name'],
                'planned'        => (float) $row['planned'],
                'actual'         => (float) $row['actual'],
            ], $rows);

            usort($result, static fn($a, $b) => strcasecmp($a['category_name'], $b['category_name']));

            return $result;
        }

        $grouped = [];
        foreach ($rows as $row) {
            $label = $row['parent_name'] ?? $row['category_name'];
            if (!isset($grouped[$label])) {
                $grouped[$label] = ['category_name' => $label, 'planned' => 0.0, 'actual' => 0.0];
            }
            $grouped[$label]['planned'] += (float) $row['planned'];
            $grouped[$label]['actual']  += (float) $row['actual'];
        }

        ksort($grouped, SORT_STRING | SORT_FLAG_CASE);

        return array_values($grouped);
    }

    /**
     * Totaux mensuels prévus/réalisés pour un type de transaction donné
     * (income ou expense). Utilisée pour l'évolution mensuelle des revenus,
     * en miroir de celle des dépenses.
     */
    public function findYearlyMonthlyTotalsByType(int $year, string $type): array
    {
        return $this->createQueryBuilder('mb')
            ->select(
                'mb.month as month',
                'SUM(mb.plannedAmount) as planned',
                'SUM(mb.actualAmount) as actual'
            )
            ->join('mb.category', 'c')
            ->where('mb.year = :year')
            ->andWhere('c.transactionType = :type')
            ->setParameter('year', $year)
            ->setParameter('type', $type)
            ->groupBy('mb.month')
            ->getQuery()
            ->getResult();
    }

    /**
     * Liste des budgets mois par mois pour une catégorie donnée. Si celle-ci
     * regroupe des sous-catégories (label = nom d'une catégorie parente) et que
     * $groupByParent est vrai, inclut aussi les budgets de ses enfants — même
     * logique de regroupement que findYearlyCategorySummary().
     */
    public function findBudgetsForLabel(int $year, string $label, bool $groupByParent = true): array
    {
        $qb = $this->createQueryBuilder('mb')
            ->select(
                'c.name as category_name',
                'mb.label as label',
                'mb.month as month',
                'mb.plannedAmount as planned',
                'mb.actualAmount as actual',
                'mb.approvedAt as approvedAt'
            )
            ->join('mb.category', 'c')
            ->leftJoin('c.parent', 'parent')
            ->where('mb.year = :year')
            ->andWhere('c.transactionType = :type')
            ->setParameter('year', $year)
            ->setParameter('type', 'expense')
            ->setParameter('label', $label);

        if ($groupByParent) {
            $qb->andWhere('(parent.name = :label) OR (parent.name IS NULL AND c.name = :label)');
        } else {
            $qb->andWhere('c.name = :label');
        }

        $rows = $qb->orderBy('c.name', 'ASC')->addOrderBy('mb.month', 'ASC')->getQuery()->getResult();

        return array_map(static fn(array $row): array => [
            'category_name' => $row['category_name'],
            'label'          => $row['label'],
            'month'          => (int) $row['month'],
            'planned'        => (float) $row['planned'],
            'actual'         => (float) $row['actual'],
            'approved'       => $row['approvedAt'] !== null,
        ], $rows);
    }
}