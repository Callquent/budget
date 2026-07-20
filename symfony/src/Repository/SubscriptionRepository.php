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
     * Retourne les abonnements actifs réellement dus sur le mois demandé :
     * startDate ≤ dernier jour du mois ET (endDate IS NULL ou endDate ≥ premier
     * jour du mois) ET le mois correspond bien à leur cadence de fréquence
     * (un abonnement trimestriel n'est dû qu'un mois sur trois, un annuel
     * qu'un mois sur douze — la plage de dates seule ne suffit pas à filtrer
     * ça, sans quoi tout abonnement actif apparaît tous les mois, comme s'il
     * était mensuel).
     */
    public function findActiveForPeriod(int $year, int $month): array
    {
        $firstDay = \DateTimeImmutable::createFromFormat('Y-n-j', "$year-$month-1");
        $lastDay  = $firstDay->modify('last day of this month');

        $candidates = $this->createQueryBuilder('s')
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

        return array_values(array_filter(
            $candidates,
            fn (Subscription $s) => $this->isDueInMonth($s, $year, $month),
        ));
    }

    /**
     * Détermine si un abonnement est dû sur un mois donné, en fonction du
     * nombre de mois écoulés depuis sa date de début :
     * - mensuel      : dû tous les mois
     * - trimestriel  : dû tous les 3 mois depuis le mois de départ
     * - annuel       : dû tous les 12 mois depuis le mois de départ
     * - occasionnel  : dû une seule fois, le mois de départ lui-même
     */
    private function isDueInMonth(Subscription $s, int $year, int $month): bool
    {
        $start = $s->getStartDate();
        $monthsSinceStart = ($year - (int) $start->format('Y')) * 12
            + ($month - (int) $start->format('n'));

        if ($monthsSinceStart < 0) {
            return false;
        }

        return match ($s->getFrequency()) {
            'quarterly'  => $monthsSinceStart % 3 === 0,
            'yearly'     => $monthsSinceStart % 12 === 0,
            'occasional' => $monthsSinceStart === 0,
            default      => true, // 'monthly' et toute valeur inconnue
        };
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
