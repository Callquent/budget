<?php

namespace App\Repository;

use App\Entity\Budget;
use App\Entity\Subscription;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\ORM\EntityManagerInterface;
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
        // setTime(0, 0) est indispensable : createFromFormat() sans partie
        // horaire hérite de l'heure courante, ce qui décale les comparaisons
        // avec startDate/endDate (stockées à minuit) selon l'heure d'exécution.
        $firstDay = \DateTimeImmutable::createFromFormat('Y-n-j', "$year-$month-1")->setTime(0, 0);
        $lastDay  = $firstDay->modify('last day of this month');

        $qb = $this->createQueryBuilder('s');

        $candidates = $qb
            ->addSelect('a', 'c')
            ->join('s.account', 'a')
            ->join('s.category', 'c')
            ->where('s.status = :status')
            ->andWhere('s.startDate <= :lastDay')
            // orX() explicite : passer la chaîne 'a OR b' à andWhere() ne la
            // parenthèse pas, ce qui produit
            // '... AND s.startDate <= :lastDay AND s.endDate IS NULL OR s.endDate >= :firstDay'
            // — le OR reprend alors la main sur les filtres précédents
            // (statut, startDate) et fausse le jeu de résultats.
            ->andWhere($qb->expr()->orX(
                's.endDate IS NULL',
                's.endDate >= :firstDay'
            ))
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

    /**
     * Synchronise les abonnements actifs d'un mois donné vers des lignes de
     * budget (création uniquement — ne touche pas aux lignes existantes).
     * Ne flush pas : à la charge de l'appelant, pour pouvoir grouper le
     * flush sur plusieurs mois (voir syncBudgetLinesForYear()).
     */
    public function syncBudgetLines(EntityManagerInterface $em, BudgetRepository $budgetRepo, int $year, int $month): int
    {
        $synced = 0;
        foreach ($this->findActiveForPeriod($year, $month) as $sub) {
            $exists = $budgetRepo->findOneBy([
                'category' => $sub->getCategory(),
                'account'  => $sub->getAccount(),
                'year'     => $year,
                'month'    => $month,
            ]);
            if ($exists) {
                continue;
            }

            $em->persist((new Budget())
                ->setCategory($sub->getCategory())
                ->setAccount($sub->getAccount())
                ->setYear($year)
                ->setMonth($month)
                ->setPlannedAmount((string) $sub->getAmount())
                ->setActualAmount((string) $sub->getAmount())
                ->setSourceSubscription($sub));
            $synced++;
        }

        return $synced;
    }

    /**
     * Idem syncBudgetLines() mais pour les 12 mois d'une année.
     */
    public function syncBudgetLinesForYear(EntityManagerInterface $em, BudgetRepository $budgetRepo, int $year): int
    {
        $synced = 0;
        for ($m = 1; $m <= 12; $m++) {
            $synced += $this->syncBudgetLines($em, $budgetRepo, $year, $m);
        }

        return $synced;
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
