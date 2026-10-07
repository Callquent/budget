<?php

namespace App\Repository;

use App\Entity\Budget;
use App\Entity\SavingsGoal;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\Persistence\ManagerRegistry;

class SavingsGoalRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, SavingsGoal::class);
    }

    public function findActive(): array
    {
        return $this->createQueryBuilder('g')
            ->addSelect('a', 'c')
            ->join('g.account', 'a')
            ->join('g.category', 'c')
            ->where('g.status = :status')
            ->setParameter('status', SavingsGoal::STATUS_ACTIVE)
            ->orderBy('g.name', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Objectifs actifs dont une contribution est due sur le mois demandé.
     * Même logique que SubscriptionRepository::findActiveForPeriod() —
     * voir les commentaires là-bas pour le détail du filtrage par plage de
     * dates puis par cadence de fréquence.
     */
    public function findActiveForPeriod(int $year, int $month): array
    {
        $firstDay = \DateTimeImmutable::createFromFormat('Y-n-j', "$year-$month-1")->setTime(0, 0);
        $lastDay  = $firstDay->modify('last day of this month');

        $qb = $this->createQueryBuilder('g');

        $candidates = $qb
            ->addSelect('a', 'c')
            ->join('g.account', 'a')
            ->join('g.category', 'c')
            ->where('g.status = :status')
            ->andWhere('g.startDate <= :lastDay')
            ->andWhere($qb->expr()->orX(
                'g.endDate IS NULL',
                'g.endDate >= :firstDay'
            ))
            ->setParameter('status', SavingsGoal::STATUS_ACTIVE)
            ->setParameter('firstDay', $firstDay)
            ->setParameter('lastDay', $lastDay)
            ->orderBy('g.name', 'ASC')
            ->getQuery()
            ->getResult();

        return array_values(array_filter(
            $candidates,
            fn (SavingsGoal $g) => $this->isDueInMonth($g, $year, $month),
        ));
    }

    /**
     * Identique à SubscriptionRepository::isDueInMonth() : monthly = tous
     * les mois, quarterly = tous les 3 mois depuis le départ, yearly = tous
     * les 12 mois, occasional = une seule fois, le mois de départ.
     */
    private function isDueInMonth(SavingsGoal $g, int $year, int $month): bool
    {
        $start = $g->getStartDate();
        $monthsSinceStart = ($year - (int) $start->format('Y')) * 12
            + ($month - (int) $start->format('n'));

        if ($monthsSinceStart < 0) {
            return false;
        }

        return match ($g->getFrequency()) {
            'quarterly'  => $monthsSinceStart % 3 === 0,
            'yearly'     => $monthsSinceStart % 12 === 0,
            'occasional' => $monthsSinceStart === 0,
            default      => true, // 'monthly' et toute valeur inconnue
        };
    }

    /**
     * Crée les lignes monthly_budget pour les contributions dues sur le
     * mois donné (création uniquement, ne touche pas aux lignes existantes).
     * Ne flush pas — même contrat que SubscriptionRepository::syncBudgetLines().
     *
     * Contrairement à syncBudgetLines() côté abonnements, on vérifie
     * l'existence via sourceSavingsGoal plutôt que catégorie+compte+période :
     * Budget::$label participe à la contrainte d'unicité (uniq_budget_period
     * inclut désormais label), et category+account+year+month seuls peuvent
     * matcher une ligne saisie à la main sans lien avec cet objectif.
     */
    public function syncBudgetLines(EntityManagerInterface $em, BudgetRepository $budgetRepo, int $year, int $month): int
    {
        $synced = 0;
        foreach ($this->findActiveForPeriod($year, $month) as $goal) {
            $exists = $budgetRepo->findOneBy([
                'sourceSavingsGoal' => $goal,
                'year'              => $year,
                'month'             => $month,
            ]);
            if ($exists) {
                continue;
            }

            $em->persist((new Budget())
                ->setCategory($goal->getCategory())
                ->setAccount($goal->getAccount())
                ->setYear($year)
                ->setMonth($month)
                ->setLabel($goal->getName())
                ->setPlannedAmount((string) $goal->getContributionAmount())
                ->setActualAmount((string) $goal->getContributionAmount())
                ->setSourceSavingsGoal($goal));
            $synced++;
        }

        return $synced;
    }

    /**
     * Répercute les modifications d'un objectif (nom, montant, compte,
     * catégorie, fréquence, dates, statut) sur ses lignes monthly_budget
     * déjà générées — syncBudgetLines() ne fait que créer, jamais mettre à
     * jour, donc sans ça une ligne garde les valeurs de sa création.
     *
     * Périmètre volontairement limité : lignes NON approuvées, du mois
     * courant et des mois futurs. Une ligne approuvée est verrouillée (elle
     * a généré une vraie transaction), et l'historique passé n'est pas
     * réécrit. Une ligne qui n'est plus due (fréquence/dates changées,
     * objectif désactivé) est supprimée ; les nouvelles échéances sont
     * créées par la prochaine synchro. Ne flush pas.
     */
    public function refreshLinkedBudgetLines(EntityManagerInterface $em, BudgetRepository $budgetRepo, SavingsGoal $goal): void
    {
        $now          = new \DateTimeImmutable();
        $currentYear  = (int) $now->format('Y');
        $currentMonth = (int) $now->format('n');

        foreach ($budgetRepo->findBy(['sourceSavingsGoal' => $goal]) as $mb) {
            if ($mb->isApproved()) {
                continue;
            }

            $isPast = $mb->getYear() < $currentYear
                || ($mb->getYear() === $currentYear && $mb->getMonth() < $currentMonth);
            if ($isPast) {
                continue;
            }

            if (!$this->isDueForPeriod($goal, $mb->getYear(), $mb->getMonth())) {
                $em->remove($mb);
                continue;
            }

            $mb->setLabel($goal->getName())
                ->setCategory($goal->getCategory())
                ->setAccount($goal->getAccount())
                ->setPlannedAmount((string) $goal->getContributionAmount())
                ->setActualAmount((string) $goal->getContributionAmount());
        }
    }

    /**
     * Version unitaire de findActiveForPeriod() : statut actif, plage de
     * dates couvrant le mois, et mois conforme à la cadence de fréquence.
     */
    public function isDueForPeriod(SavingsGoal $g, int $year, int $month): bool
    {
        if (!$g->isActive()) {
            return false;
        }

        $firstDay = \DateTimeImmutable::createFromFormat('Y-n-j', "$year-$month-1")->setTime(0, 0);
        $lastDay  = $firstDay->modify('last day of this month');

        if ($g->getStartDate() > $lastDay) {
            return false;
        }
        if ($g->getEndDate() !== null && $g->getEndDate() < $firstDay) {
            return false;
        }

        return $this->isDueInMonth($g, $year, $month);
    }

    public function syncBudgetLinesForYear(EntityManagerInterface $em, BudgetRepository $budgetRepo, int $year): int
    {
        $synced = 0;
        for ($m = 1; $m <= 12; $m++) {
            $synced += $this->syncBudgetLines($em, $budgetRepo, $year, $m);
        }

        return $synced;
    }

    /**
     * Somme des actualAmount de toutes les lignes monthly_budget liées à cet
     * objectif, toutes périodes et tous statuts d'approbation confondus.
     * actualAmount est déjà recalculé à partir des vraies transactions par
     * BudgetRepository::refreshActualAmounts(), donc ce total reflète
     * l'argent réellement mis de côté, pas seulement ce qui était prévu.
     */
    public function getContributedAmount(SavingsGoal $goal): float
    {
        $result = $this->getEntityManager()->createQuery(
            'SELECT COALESCE(SUM(mb.actualAmount), 0)
             FROM App\Entity\Budget mb
             WHERE mb.sourceSavingsGoal = :goal'
        )
        ->setParameter('goal', $goal)
        ->getSingleScalarResult();

        return (float) $result;
    }

    public function findAllWithRelations(): array
    {
        return $this->createQueryBuilder('g')
            ->addSelect('a', 'c')
            ->join('g.account', 'a')
            ->join('g.category', 'c')
            ->orderBy('g.status', 'ASC')
            ->addOrderBy('g.name', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
