<?php

namespace App\Controller;

use App\Entity\MonthlyBudget;
use App\Entity\Transaction;
use App\Repository\AccountRepository;
use App\Repository\MonthlyBudgetRepository;
use App\Repository\SubscriptionRepository;
use App\Repository\TransactionRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Serializer\SerializerInterface;

#[Route('/budget', name: 'monthly_budget_')]
class BudgetController extends AbstractController
{
    public function __construct(private SerializerInterface $serializer) {}

    // ─── Vue annuelle ─────────────────────────────────────────────────────────

    #[Route('', name: 'index')]
    #[Route('/{year}', name: 'year', requirements: ['year' => '\d{4}'])]
    public function index(
        MonthlyBudgetRepository $repo,
        AccountRepository $accountRepo,
        TransactionRepository $txRepo,
        SubscriptionRepository $subRepo,
        EntityManagerInterface $em,
        int $year = 0
    ): Response {
        $now = new \DateTimeImmutable();
        if ($year === 0) {
            $year = (int) $now->format('Y');
            if ((int) $now->format('n') === 12) $year++;
        }

        // Synchronisation abonnements → lignes budgétaires pour toute l'année
        $synced = 0;
        for ($m = 1; $m <= 12; $m++) {
            foreach ($subRepo->findActiveForPeriod($year, $m) as $sub) {
                if (!$repo->findOneBy(['category' => $sub->getCategory(), 'account' => $sub->getAccount(), 'year' => $year, 'month' => $m])) {
                    $em->persist((new MonthlyBudget())
                        ->setCategory($sub->getCategory())->setAccount($sub->getAccount())
                        ->setYear($year)->setMonth($m)
                        ->setPlannedAmount((string) $sub->getAmount())
                        ->setActualAmount((string) $sub->getAmount()));
                    $synced++;
                }
            }
        }
        if ($synced > 0) $em->flush();

        // Résumé mensuel
        $summaryByMonth = [];
        foreach ($repo->findAnnualSummary($year) as $row) {
            $summaryByMonth[(int) $row['month']] = $row;
        }

        // Budget planifié par compte et par mois (pour projection)
        $plannedByAccount = [];
        $allBudgets = $repo->createQueryBuilder('mb')
            ->addSelect('c')->join('mb.category', 'c')
            ->where('mb.year = :year')->setParameter('year', $year)
            ->orderBy('mb.month', 'ASC')->addOrderBy('c.name', 'ASC')
            ->getQuery()->getResult();

        foreach ($allBudgets as $mb) {
            if ($mb->isApproved()) continue;
            $m   = $mb->getMonth();
            $aid = $mb->getAccount()?->getId() ?? 'all';
            $type = $mb->getCategory()->getTransactionType();
            if (!isset($plannedByAccount[$m][$aid])) {
                $plannedByAccount[$m][$aid] = ['income' => 0.0, 'expense' => 0.0];
            }
            if ($type === 'income') {
                $plannedByAccount[$m][$aid]['income'] += (float) $mb->getPlannedAmount();
            } else {
                $plannedByAccount[$m][$aid]['expense'] += (float) $mb->getPlannedAmount();
            }
        }

        $accounts       = $accountRepo->findAllOrderedByName();
        $currentYear    = (int) $now->format('Y');
        $currentMonth   = (int) $now->format('n');
        $availableYears = range($currentYear - 1, $currentYear + 2);

        // Mouvements réels par compte+mois
        $txMovements = [];
        foreach ($txRepo->findMonthlyByAccountForYear($year) as $row) {
            $txMovements[(int)$row['account_id']][(int)$row['month']] = [
                'credit' => (float)$row['credit'],
                'debit'  => (float)$row['debit'],
            ];
        }

        // Abonnements actifs distribués par mois
        $subMovements = [];
        foreach ($subRepo->findActive() as $sub) {
            $aid = $sub->getAccount()->getId();
            for ($m = 1; $m <= 12; $m++) {
                $applies = match ($sub->getFrequency()) {
                    'monthly'   => true,
                    'yearly'    => (int)$sub->getStartDate()->format('n') === $m,
                    'quarterly' => ((($m - 1) % 3) === (((int)$sub->getStartDate()->format('n') - 1) % 3)),
                    default     => false,
                };
                $monthDate   = \DateTimeImmutable::createFromFormat('Y-n-j', "$year-$m-1");
                $lastOfMonth = $monthDate->modify('last day of this month');
                if ($sub->getStartDate() > $lastOfMonth) $applies = false;
                if ($sub->getEndDate() !== null && $sub->getEndDate() < $monthDate) $applies = false;
                if ($applies) {
                    $subMovements[$aid][$m] = ($subMovements[$aid][$m] ?? 0) + (float)$sub->getAmount();
                }
            }
        }

        // Soldes cumulés de base pour années futures
        $startingNetByAccount     = [];
        $startingPlannedByAccount = [];
        if ($year > $currentYear) {
            foreach ($txRepo->findMovementsUpToPeriod($year - 1, 12) as $row) {
                $startingNetByAccount[(int) $row['account_id']] = (float)$row['credit'] - (float)$row['debit'];
            }
            foreach ($repo->createQueryBuilder('mb')->join('mb.category', 'c')->where('mb.year = :y')->setParameter('y', $year - 1)->getQuery()->getResult() as $mb) {
                $aid  = $mb->getAccount()?->getId() ?? 'all';
                $amt  = (float) $mb->getPlannedAmount();
                $startingPlannedByAccount[$aid] = ($startingPlannedByAccount[$aid] ?? 0.0)
                    + ($mb->getCategory()->getTransactionType() === 'income' ? $amt : -$amt);
            }
        }

        // Calcul des soldes mois par mois
        $accountBalances = [];
        foreach ($accounts as $account) {
            $aid            = $account->getId();
            $balance        = (float) $account->getBalance() + ($startingNetByAccount[$aid] ?? 0.0);
            $basePlannedNet = ($startingPlannedByAccount[$aid] ?? 0.0) + ($startingPlannedByAccount['all'] ?? 0.0);
            $cumNet         = 0.0;
            $cumPlannedNet  = $basePlannedNet;

            for ($m = 1; $m <= 12; $m++) {
                $credit  = $txMovements[$aid][$m]['credit'] ?? 0;
                $debit   = $txMovements[$aid][$m]['debit']  ?? 0;
                $subs    = $subMovements[$aid][$m] ?? 0;
                $cumNet += $credit - $debit;

                $pAccount = $plannedByAccount[$m][$aid]  ?? ['income' => 0.0, 'expense' => 0.0];
                $pAll     = $plannedByAccount[$m]['all'] ?? ['income' => 0.0, 'expense' => 0.0];
                $isCurrentOrFuture = ($year > $currentYear) || ($year === $currentYear && $m >= $currentMonth);
                if ($isCurrentOrFuture) {
                    $cumPlannedNet += ($pAccount['income'] + $pAll['income']) - ($pAccount['expense'] + $pAll['expense']);
                }

                $accountBalances[$aid][$m] = [
                    'balance'           => $balance + $cumNet,
                    'balance_projected' => $balance + $cumNet + $cumPlannedNet,
                    'credit'            => $credit,
                    'debit'             => $debit,
                    'subs'              => $subs,
                    'planned_net'       => $cumPlannedNet,
                ];
            }
        }

        return $this->json([
            'year'            => $year,
            'currentYear'     => $currentYear,
            'currentMonth'    => $currentMonth,
            'availableYears'  => $availableYears,
            'accounts'        => $accounts,
            'summary'         => $summaryByMonth,
            'accountBalances' => $accountBalances,
        ], 200, [], ['groups' => ['account:read']]);
    }

    // ─── Vue mois ─────────────────────────────────────────────────────────────

    #[Route('/{year}/{month}', name: 'month', requirements: ['year' => '\d{4}', 'month' => '\d{1,2}'])]
    public function month(
        MonthlyBudgetRepository $repo,
        AccountRepository $accountRepo,
        TransactionRepository $txRepo,
        SubscriptionRepository $subRepo,
        EntityManagerInterface $em,
        int $year,
        int $month
    ): Response {
        $accounts      = $accountRepo->findAllOrderedByName();
        $subscriptions = $subRepo->findActiveForPeriod($year, $month);

        // Synchronisation abonnements → lignes budgétaires
        $synced = 0;
        foreach ($subscriptions as $sub) {
            if (!$repo->findOneBy(['category' => $sub->getCategory(), 'account' => $sub->getAccount(), 'year' => $year, 'month' => $month])) {
                $em->persist((new MonthlyBudget())
                    ->setCategory($sub->getCategory())->setAccount($sub->getAccount())
                    ->setYear($year)->setMonth($month)
                    ->setPlannedAmount((string) $sub->getAmount())
                    ->setActualAmount((string) $sub->getAmount()));
                $synced++;
            }
        }
        if ($synced > 0) $em->flush();

        $budgets = $repo->findByPeriod($year, $month);

        // Mouvements du mois par compte
        $txByAccount = [];
        foreach ($accounts as $account) {
            $txByAccount[$account->getId()] = ['credit' => 0, 'debit' => 0, 'subs' => 0];
        }
        foreach ($txRepo->findByPeriod($year, $month) as $tx) {
            $aid = $tx->getAccount()->getId();
            if (!isset($txByAccount[$aid])) $txByAccount[$aid] = ['credit' => 0, 'debit' => 0, 'subs' => 0];
            $txByAccount[$aid][$tx->getType()] += (float) $tx->getAmount();
        }
        foreach ($subscriptions as $sub) {
            $aid = $sub->getAccount()->getId();
            if (!isset($txByAccount[$aid])) $txByAccount[$aid] = ['credit' => 0, 'debit' => 0, 'subs' => 0];
            $txByAccount[$aid]['debit'] += (float) $sub->getAmount();
            $txByAccount[$aid]['subs']  += (float) $sub->getAmount();
        }

        $now    = new \DateTimeImmutable();
        $months = [1=>'Janvier',2=>'Février',3=>'Mars',4=>'Avril',5=>'Mai',6=>'Juin',
                   7=>'Juillet',8=>'Août',9=>'Septembre',10=>'Octobre',11=>'Novembre',12=>'Décembre'];

        return $this->json([
            'year'          => $year,
            'month'         => $month,
            'nowYear'       => (int) $now->format('Y'),
            'nowMonth'      => (int) $now->format('n'),
            'periodLabel'   => ($months[$month] ?? '') . ' ' . $year,
            'accounts'      => $accounts,
            'txByAccount'   => $txByAccount,
            'subscriptions' => $subscriptions,
            'budgets'       => $budgets,
        ], 200, [], ['groups' => ['budget:month', 'budget:read', 'account:read', 'category:read', 'subscription:read']]);
    }

    // ─── CRUD ─────────────────────────────────────────────────────────────────

    #[Route('/new', name: 'new', methods: ['POST'])]
    public function new(Request $request, EntityManagerInterface $em): Response
    {
        $data   = json_decode($request->getContent(), true);
        $budget = new MonthlyBudget();
        $this->hydrate($budget, $data, $em);

        $em->persist($budget);
        $em->flush();

        return $this->json($budget, 201, [], ['groups' => ['budget:read', 'account:read', 'category:read'], \Symfony\Component\Serializer\Normalizer\DateTimeNormalizer::FORMAT_KEY => 'Y-m-d']);
    }

    #[Route('/{id}', name: 'show', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function show(MonthlyBudget $budget): Response
    {
        return $this->json($budget, 200, [], ['groups' => ['budget:read', 'account:read', 'category:read'], \Symfony\Component\Serializer\Normalizer\DateTimeNormalizer::FORMAT_KEY => 'Y-m-d']);
    }

    #[Route('/{id}/edit', name: 'edit', methods: ['POST'])]
    public function edit(MonthlyBudget $budget, Request $request, EntityManagerInterface $em): Response
    {
        if ($budget->isApproved()) {
            return $this->json(['error' => 'Ligne verrouillée car approuvée.'], 409);
        }

        $data = json_decode($request->getContent(), true);
        $this->hydrate($budget, $data, $em);
        $em->flush();

        return $this->json($budget, 200, [], ['groups' => ['budget:read', 'account:read', 'category:read'], \Symfony\Component\Serializer\Normalizer\DateTimeNormalizer::FORMAT_KEY => 'Y-m-d']);
    }

    #[Route('/{id}/approve', name: 'approve', methods: ['POST'])]
    public function approve(MonthlyBudget $budget, EntityManagerInterface $em): Response
    {
        if ($budget->isApproved()) {
            return $this->json(['error' => 'Cette ligne est déjà approuvée.'], 409);
        }
        if (!$budget->getAccount()) {
            return $this->json(['error' => "Veuillez d'abord associer un compte à cette ligne budgétaire avant d'approuver."], 422);
        }

        $txType = match ($budget->getCategory()->getTransactionType()) {
            'income'   => Transaction::TYPE_CREDIT,
            'transfer' => Transaction::TYPE_CREDIT,
            default    => Transaction::TYPE_DEBIT,
        };

        $txDate = \DateTimeImmutable::createFromFormat('Y-n-j', $budget->getYear() . '-' . $budget->getMonth() . '-1');

        $transaction = (new Transaction())
            ->setAccount($budget->getAccount())
            ->setCategory($budget->getCategory())
            ->setAmount($budget->getActualAmount())
            ->setType($txType)
            ->setTransactionDate($txDate)
            ->setLabel($budget->getLabel() ?? ($budget->getCategory()->getName() . ' — ' . $budget->getPeriodLabel()));

        $em->persist($transaction);
        $budget->setApprovedAt(new \DateTimeImmutable());
        $budget->setApprovedTransaction($transaction);
        $em->flush();

        return $this->json($budget, 200, [], ['groups' => ['budget:read', 'account:read', 'category:read'], \Symfony\Component\Serializer\Normalizer\DateTimeNormalizer::FORMAT_KEY => 'Y-m-d']);
    }

    #[Route('/{id}/unapprove', name: 'unapprove', methods: ['POST'])]
    public function unapprove(MonthlyBudget $budget, EntityManagerInterface $em): Response
    {
        $tx = $budget->getApprovedTransaction();
        if ($tx) $em->remove($tx);

        $budget->setApprovedAt(null);
        $budget->setApprovedTransaction(null);
        $em->flush();

        return $this->json($budget, 200, [], ['groups' => ['budget:read', 'account:read', 'category:read'], \Symfony\Component\Serializer\Normalizer\DateTimeNormalizer::FORMAT_KEY => 'Y-m-d']);
    }

    #[Route('/{id}/delete', name: 'delete', methods: ['POST'])]
    public function delete(MonthlyBudget $budget, EntityManagerInterface $em): Response
    {
        $em->remove($budget);
        $em->flush();

        return $this->json(['deleted' => true]);
    }

    #[Route('/{year}/{month}/duplicate', name: 'duplicate', methods: ['POST'])]
    public function duplicate(MonthlyBudgetRepository $repo, EntityManagerInterface $em, int $year, int $month): Response
    {
        $nextDate  = \DateTimeImmutable::createFromFormat('Y-n', "$year-$month")->modify('+1 month');
        $nextYear  = (int) $nextDate->format('Y');
        $nextMonth = (int) $nextDate->format('n');
        $count     = 0;

        foreach ($repo->findByPeriod($year, $month) as $source) {
            if ($repo->findOneBy(['category' => $source->getCategory(), 'year' => $nextYear, 'month' => $nextMonth])) continue;
            $em->persist((new MonthlyBudget())
                ->setCategory($source->getCategory())
                ->setYear($nextYear)->setMonth($nextMonth)
                ->setPlannedAmount($source->getPlannedAmount()));
            $count++;
        }

        $em->flush();

        return $this->json(['duplicated' => $count, 'year' => $nextYear, 'month' => $nextMonth]);
    }

    private function hydrate(MonthlyBudget $budget, array $data, EntityManagerInterface $em): void
    {
        $categoryRepo = $em->getRepository(\App\Entity\Category::class);
        $accountRepo  = $em->getRepository(\App\Entity\Account::class);

        $budget->setLabel($data['label'] ?? null);
        $budget->setCategory($categoryRepo->find($data['categoryId']));
        $budget->setAccount(!empty($data['accountId']) ? $accountRepo->find($data['accountId']) : null);
        $budget->setYear((int) $data['year']);
        $budget->setMonth((int) $data['month']);
        $budget->setPlannedAmount((string) $data['plannedAmount']);
        $budget->setActualAmount((string) ($data['actualAmount'] ?? $data['plannedAmount']));
    }
}
