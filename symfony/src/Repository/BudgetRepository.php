<?php

namespace App\Repository;

use App\Entity\Budget;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class BudgetRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Budget::class);
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

        // Pour les recettes (income) : on somme les crédits (peu importe le
        // compte — une ligne sans compte assigné représente "tous comptes").
        // Pour les dépenses (expense) : on somme les débits, même logique.
        // Pour les virements (transfer) : il FAUT distinguer par compte, sinon
        // débit (compte expéditeur) et crédit (compte destinataire) se
        // mélangeraient. La transaction sur mb.account est un débit, celle
        // sur mb.destinationAccount un crédit — voir BudgetController::approve().
        // Transaction n'a jamais de type='transfer' (seulement credit/debit),
        // d'où cette distinction par compte plutôt que par un type inexistant.
        $em->createQuery(
            'UPDATE App\Entity\Budget mb
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
                       (c2.transactionType = \'transfer\' AND t.type = \'debit\'  AND t.account = mb.account) OR
                       (c2.transactionType = \'transfer\' AND t.type = \'credit\' AND t.account = mb.destinationAccount)
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

    /**
     * Récupère le total prévu et réalisé par catégorie pour une année donnée.
     * Uniquement pour les dépenses.
     */
    public function findYearlyCategorySummary(int $year): array
    {
        return $this->createQueryBuilder('mb')
            ->select('c.name as category_name', 'SUM(mb.plannedAmount) as planned', 'SUM(mb.actualAmount) as actual')
            ->join('mb.category', 'c')
            ->where('mb.year = :year')
            ->andWhere('c.transactionType = :type')
            ->setParameter('year', $year)
            ->setParameter('type', 'expense')
            ->groupBy('c.id')
            ->orderBy('c.name', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Récupère les totaux prévus et réalisés par mois pour une année donnée.
     * Uniquement pour les dépenses.
     */
    public function findYearlyMonthlyTotals(int $year): array
    {
        return $this->createQueryBuilder('mb')
            ->select('mb.month', 'SUM(mb.plannedAmount) as planned', 'SUM(mb.actualAmount) as actual')
            ->join('mb.category', 'c')
            ->where('mb.year = :year')
            ->andWhere('c.transactionType = :type')
            ->setParameter('year', $year)
            ->setParameter('type', 'expense')
            ->groupBy('mb.month')
            ->orderBy('mb.month', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
