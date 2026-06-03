<?php

namespace App\Repository;

use App\Entity\Subscription;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class SubscriptionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Subscription::class);
    }

    public function findActive(): array
    {
        return $this->createQueryBuilder('s')
            ->addSelect('a', 'c')
            ->join('s.account', 'a')
            ->join('s.category', 'c')
            ->where('s.status = :status')
            ->setParameter('status', Subscription::STATUS_ACTIVE)
            ->orderBy('s.name', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Retourne les abonnements actifs dont la période couvre le mois demandé :
     * startDate ≤ dernier jour du mois ET (endDate IS NULL ou endDate ≥ premier jour du mois).
     */
    public function findActiveForPeriod(int $year, int $month): array
    {
        $firstDay = \DateTimeImmutable::createFromFormat('Y-n-j', "$year-$month-1");
        $lastDay  = $firstDay->modify('last day of this month');

        return $this->createQueryBuilder('s')
            ->addSelect('a', 'c')
            ->join('s.account', 'a')
            ->join('s.category', 'c')
            ->where('s.status = :status')
            ->andWhere('s.startDate <= :lastDay')
            ->andWhere('s.endDate IS NULL OR s.endDate >= :firstDay')
            ->setParameter('status', Subscription::STATUS_ACTIVE)
            ->setParameter('firstDay', $firstDay)
            ->setParameter('lastDay', $lastDay)
            ->orderBy('s.name', 'ASC')
            ->getQuery()
            ->getResult();
    }

    public function findAllWithRelations(): array
    {
        return $this->createQueryBuilder('s')
            ->addSelect('a', 'c')
            ->join('s.account', 'a')
            ->join('s.category', 'c')
            ->orderBy('s.status', 'ASC')
            ->addOrderBy('s.name', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
