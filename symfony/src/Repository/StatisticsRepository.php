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
}