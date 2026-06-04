<?php

namespace App\Repository;

use App\Entity\Transaction;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class TransactionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Transaction::class);
    }

    /**
     * Toutes les transactions d'un mois donné, toutes catégories.
     *
     * Exemple : findByPeriod(2025, 3) → mars 2025
     */
    public function findByPeriod(int $year, int $month): array
    {
        return $this->createQueryBuilder('t')
            ->addSelect('a', 'c')
            ->join('t.account', 'a')
            ->join('t.category', 'c')
            ->where('t.year = :year')
            ->andWhere('t.month = :month')
            ->setParameter('year', $year)
            ->setParameter('month', $month)
            ->orderBy('t.transactionDate', 'DESC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Vue mensuelle sur une année complète.
     * Retourne un tableau [ ['year'=>2025,'month'=>3,'total_credit'=>…,'total_debit'=>…], … ]
     */
    public function findMonthlySummaryByYear(int $year): array
    {
        return $this->createQueryBuilder('t')
            ->select(
                't.year',
                't.month',
                "SUM(CASE WHEN t.type = 'credit' THEN t.amount ELSE 0 END) AS total_credit",
                "SUM(CASE WHEN t.type = 'debit'  THEN t.amount ELSE 0 END) AS total_debit",
                'COUNT(t.id) AS nb_transactions'
            )
            ->where('t.year = :year')
            ->setParameter('year', $year)
            ->groupBy('t.year', 't.month')
            ->orderBy('t.month', 'ASC')
            ->getQuery()
            ->getScalarResult();
    }

    /**
     * Dépenses par catégorie pour un mois donné.
     */
    public function findByPeriodGroupedByCategory(int $year, int $month): array
    {
        return $this->createQueryBuilder('t')
            ->select('c.name AS category', 'c.transactionType', "SUM(t.amount) AS total")
            ->join('t.category', 'c')
            ->where('t.year = :year')
            ->andWhere('t.month = :month')
            ->setParameter('year', $year)
            ->setParameter('month', $month)
            ->groupBy('c.id')
            ->orderBy('total', 'DESC')
            ->getQuery()
            ->getScalarResult();
    }

    /**
     * Mouvements agrégés par compte et par mois pour une année entière.
     * Retourne : [ ['account_id'=>1, 'month'=>6, 'credit'=>1600, 'debit'=>200], … ]
     * Utilisé pour calculer les soldes cumulés mois par mois dans le récap annuel.
     */
    public function findMonthlyByAccountForYear(int $year): array
    {
        return $this->createQueryBuilder('t')
            ->select(
                'IDENTITY(t.account) AS account_id',
                't.month',
                "SUM(CASE WHEN t.type = 'credit' THEN t.amount ELSE 0 END) AS credit",
                "SUM(CASE WHEN t.type = 'debit'  THEN t.amount ELSE 0 END) AS debit"
            )
            ->where('t.year = :year')
            ->setParameter('year', $year)
            ->groupBy('t.account', 't.month')
            ->orderBy('t.month', 'ASC')
            ->getQuery()
            ->getScalarResult();
    }

    /**
     * Transactions d'un compte sur une plage de mois.
     * Exemple : du mois 3/2025 au mois 5/2026
     */
    public function findByAccountAndRange(int $accountId, int $fromYear, int $fromMonth, int $toYear, int $toMonth): array
    {
        return $this->createQueryBuilder('t')
            ->join('t.account', 'a')
            ->join('t.category', 'c')
            ->where('a.id = :accountId')
            ->andWhere('(t.year * 100 + t.month) >= :from')
            ->andWhere('(t.year * 100 + t.month) <= :to')
            ->setParameter('accountId', $accountId)
            ->setParameter('from', $fromYear * 100 + $fromMonth)
            ->setParameter('to', $toYear * 100 + $toMonth)
            ->orderBy('t.transactionDate', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
