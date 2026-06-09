<?php

namespace App\Repository;

use App\Entity\MonthlyBudget;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class MonthlyBudgetRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, MonthlyBudget::class);
    }

    /**
     * Récupère tous les postes budgétaires d'un mois donné
     * avec la catégorie chargée en une seule requête.
     */
    public function findByPeriod(int $year, int $month): array
    {
        return $this->createQueryBuilder('mb')
            ->addSelect('c')
            ->join('mb.category', 'c')
            ->where('mb.year = :year')
            ->andWhere('mb.month = :month')
            ->setParameter('year', $year)
            ->setParameter('month', $month)
            ->orderBy('c.name', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Recalcule actualAmount pour toutes les lignes d'un mois
     * à partir des transactions réelles.
     *
     * À appeler après chaque ajout/modification de transaction.
     */
    public function refreshActualAmounts(int $year, int $month): void
    {
        $em = $this->getEntityManager();

        // Pour les recettes (income) : on somme les crédits.
        // Pour les dépenses/virements : on somme les débits.
        // Cela évite de mélanger les deux sens dans actualAmount.
        $em->createQuery(
            'UPDATE App\Entity\MonthlyBudget mb
             SET mb.actualAmount = (
                 SELECT COALESCE(SUM(t.amount), 0)
                 FROM App\Entity\Transaction t
                 JOIN t.category c2
                 WHERE t.category = mb.category
                   AND t.year  = :year
                   AND t.month = :month
                   AND (
                       (c2.transactionType = \'income\'   AND t.type = \'credit\') OR
                       (c2.transactionType = \'expense\'  AND t.type = \'debit\')  OR
                       (c2.transactionType = \'transfer\' AND t.type = \'transfer\')
                   )
             )
             WHERE mb.year = :year AND mb.month = :month'
        )
        ->setParameter('year', $year)
        ->setParameter('month', $month)
        ->execute();
    }

    /**
     * Bilan annuel : planned vs actual par mois.
     */
    public function findAnnualSummary(int $year): array
    {
        $rows = $this->createQueryBuilder('mb')
            ->join('mb.category', 'c')
            ->select(
                'mb.month',
                'c.transactionType AS tx_type',
                'SUM(mb.plannedAmount) AS sum_planned',
                'SUM(mb.actualAmount)  AS sum_actual'
            )
            ->where('mb.year = :year')
            ->setParameter('year', $year)
            ->groupBy('mb.month', 'c.transactionType')
            ->orderBy('mb.month', 'ASC')
            ->getQuery()
            ->getScalarResult();

        // Regrouper par mois en calculant le solde net : income - expense
        $byMonth = [];
        foreach ($rows as $row) {
            $m = (int) $row['month'];
            if (!isset($byMonth[$m])) {
                $byMonth[$m] = ['month' => $m, 'total_planned' => 0.0, 'total_actual' => 0.0];
            }
            $sign = $row['tx_type'] === 'income' ? 1 : ($row['tx_type'] === 'transfer' ? 0 : -1);
            $byMonth[$m]['total_planned'] += $sign * (float) $row['sum_planned'];
            $byMonth[$m]['total_actual']  += $sign * (float) $row['sum_actual'];
        }

        return array_values($byMonth);
    }
}
