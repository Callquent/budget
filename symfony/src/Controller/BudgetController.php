<?php

namespace App\Controller;

use App\Entity\Budget;
use App\Entity\Subscription;
use App\Entity\Transaction;
use App\Repository\AccountRepository;
use App\Repository\BudgetRepository;
use App\Repository\SubscriptionRepository;
use App\Repository\TransactionRepository;
use App\Support\BudgetLabels;
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
        BudgetRepository $repo,
        AccountRepository $accountRepo,
        TransactionRepository $txRepo,
        SubscriptionRepository $subRepo,
        EntityManagerInterface $em,
        int $year = 0
    ): Response {
        $now  = new \DateTimeImmutable();
        $year = $this->resolveYear($now, $year);

        // Synchronisation abonnements → lignes budgétaires pour toute l'année
        $synced = $subRepo->syncBudgetLinesForYear($em, $repo, $year);
        if ($synced > 0) $em->flush();

        $summaryByMonth = $this->buildAnnualSummaryByMonth($repo, $year);
        $plannedTotals  = $this->buildPlannedTotals($repo, $year);

        $accounts       = $accountRepo->findAllOrderedByName();
        $currentYear    = (int) $now->format('Y');
        $currentMonth   = (int) $now->format('n');
        $availableYears = range($currentYear - 1, $currentYear + 2);

        $txMovements  = $this->buildTransactionMovements($txRepo, $year);
        $subMovements = $this->buildSubscriptionMovements($subRepo, $year);
        $starting     = $this->buildStartingBalances($repo, $txRepo, $year, $currentYear);

        $accountBalances = $this->buildAccountBalances(
            $accounts,
            $year,
            $currentYear,
            $currentMonth,
            $txMovements,
            $subMovements,
            $plannedTotals,
            $starting
        );

        return $this->json([
            'year'            => $year,
            'currentYear'     => $currentYear,
            'currentMonth'    => $currentMonth,
            'availableYears'  => $availableYears,
            'accounts'        => $accounts,
            'summary'         => $summaryByMonth,
            'accountBalances' => $accountBalances,
            'monthNames'      => BudgetLabels::MONTHS,
        ], 200, [], ['groups' => ['account:read']]);
    }

    // Année demandée dans l'URL, ou année "courante" par défaut — sachant
    // qu'en décembre on bascule directement sur l'année suivante (la vue
    // annuelle sert surtout à préparer le budget à venir).
    private function resolveYear(\DateTimeImmutable $now, int $year): int
    {
        if ($year !== 0) {
            return $year;
        }

        $year = (int) $now->format('Y');
        if ((int) $now->format('n') === 12) {
            $year++;
        }

        return $year;
    }

    // Résumé mensuel (planned vs actual, net) indexé par mois.
    private function buildAnnualSummaryByMonth(BudgetRepository $repo, int $year): array
    {
        $summaryByMonth = [];
        foreach ($repo->findAnnualSummary($year) as $row) {
            $summaryByMonth[(int) $row['month']] = $row;
        }

        return $summaryByMonth;
    }

    /**
     * Agrège toutes les lignes de budget de l'année par compte et par mois.
     *
     * - plannedByAccount    : lignes NON approuvées uniquement (projection future)
     * - allPlannedByAccount : TOUTES les lignes (calcul du "month_planned_net" complet)
     * - approvalByAccount   : compteurs [total, approved] par compte/mois
     */
    private function buildPlannedTotals(BudgetRepository $repo, int $year): array
    {
        $plannedByAccount    = [];
        $allPlannedByAccount = [];
        $approvalByAccount   = [];

        $applyEntry = function (int $m, $aid, bool $isCredit, float $amount, bool $approved) use (&$allPlannedByAccount, &$approvalByAccount) {
            if (!isset($approvalByAccount[$m][$aid])) {
                $approvalByAccount[$m][$aid] = ['total' => 0, 'approved' => 0];
            }
            $approvalByAccount[$m][$aid]['total']++;
            if ($approved) $approvalByAccount[$m][$aid]['approved']++;

            if (!isset($allPlannedByAccount[$m][$aid])) {
                $allPlannedByAccount[$m][$aid] = ['income' => 0.0, 'expense' => 0.0];
            }
            if ($isCredit) {
                $allPlannedByAccount[$m][$aid]['income'] += $amount;
            } else {
                $allPlannedByAccount[$m][$aid]['expense'] += $amount;
            }
        };

        $allBudgets = $repo->createQueryBuilder('mb')
            ->addSelect('c')->join('mb.category', 'c')
            ->where('mb.year = :year')->setParameter('year', $year)
            ->orderBy('mb.month', 'ASC')->addOrderBy('c.name', 'ASC')
            ->getQuery()->getResult();

        foreach ($allBudgets as $mb) {
            $m            = $mb->getMonth();
            $categoryType = $mb->getCategory()->getTransactionType();
            $amount       = (float) $mb->getPlannedAmount();
            $approved     = $mb->isApproved();

            if ($categoryType === 'transfer' && $mb->getDestinationAccount()) {
                // Une seule ligne, mais un impact sur DEUX comptes : sortie
                // (débit) sur account, entrée (crédit) sur destinationAccount.
                $srcAid = $mb->getAccount()?->getId() ?? 'all';
                $dstAid = $mb->getDestinationAccount()->getId();
                $applyEntry($m, $srcAid, false, $amount, $approved);
                $applyEntry($m, $dstAid, true, $amount, $approved);
            } else {
                $aid      = $mb->getAccount()?->getId() ?? 'all';
                $isCredit = $categoryType === 'income';
                $applyEntry($m, $aid, $isCredit, $amount, $approved);
            }

            // Seulement non-approuvés pour la projection cumulative
            if ($approved) continue;

            if ($categoryType === 'transfer' && $mb->getDestinationAccount()) {
                $srcAid = $mb->getAccount()?->getId() ?? 'all';
                $dstAid = $mb->getDestinationAccount()->getId();
                if (!isset($plannedByAccount[$m][$srcAid])) {
                    $plannedByAccount[$m][$srcAid] = ['income' => 0.0, 'expense' => 0.0];
                }
                $plannedByAccount[$m][$srcAid]['expense'] += $amount;
                if (!isset($plannedByAccount[$m][$dstAid])) {
                    $plannedByAccount[$m][$dstAid] = ['income' => 0.0, 'expense' => 0.0];
                }
                $plannedByAccount[$m][$dstAid]['income'] += $amount;
            } else {
                $aid = $mb->getAccount()?->getId() ?? 'all';
                if (!isset($plannedByAccount[$m][$aid])) {
                    $plannedByAccount[$m][$aid] = ['income' => 0.0, 'expense' => 0.0];
                }
                if ($categoryType === 'income') {
                    $plannedByAccount[$m][$aid]['income'] += $amount;
                } else {
                    $plannedByAccount[$m][$aid]['expense'] += $amount;
                }
            }
        }

        return [
            'plannedByAccount'    => $plannedByAccount,
            'allPlannedByAccount' => $allPlannedByAccount,
            'approvalByAccount'   => $approvalByAccount,
        ];
    }

    // Mouvements réels (crédit/débit) par compte et par mois.
    private function buildTransactionMovements(TransactionRepository $txRepo, int $year): array
    {
        $txMovements = [];
        foreach ($txRepo->findMonthlyByAccountForYear($year) as $row) {
            $txMovements[(int) $row['account_id']][(int) $row['month']] = [
                'credit' => (float) $row['credit'],
                'debit'  => (float) $row['debit'],
            ];
        }

        return $txMovements;
    }

    // Abonnements actifs distribués par compte et par mois.
    // On réutilise findActiveForPeriod() — la même source que la
    // synchronisation abonnements → lignes budgétaires — plutôt que de
    // redupliquer ici les règles de fréquence : une version locale
    // ignorait silencieusement les fréquences 'occasional' (default =>
    // false), d'où des abonnements absents des estimations.
    private function buildSubscriptionMovements(SubscriptionRepository $subRepo, int $year): array
    {
        $subMovements = [];
        for ($m = 1; $m <= 12; $m++) {
            foreach ($subRepo->findActiveForPeriod($year, $m) as $sub) {
                $aid = $sub->getAccount()->getId();
                $subMovements[$aid][$m] = ($subMovements[$aid][$m] ?? 0) + (float) $sub->getAmount();
            }
        }

        return $subMovements;
    }

    // Soldes cumulés de base (réel + planifié) hérités de l'année
    // précédente — uniquement nécessaire pour une année future.
    private function buildStartingBalances(BudgetRepository $repo, TransactionRepository $txRepo, int $year, int $currentYear): array
    {
        $startingNetByAccount     = [];
        $startingPlannedByAccount = [];

        if ($year <= $currentYear) {
            return ['net' => $startingNetByAccount, 'planned' => $startingPlannedByAccount];
        }

        foreach ($txRepo->findMovementsUpToPeriod($year - 1, 12) as $row) {
            $startingNetByAccount[(int) $row['account_id']] = (float) $row['credit'] - (float) $row['debit'];
        }

        foreach ($repo->createQueryBuilder('mb')->join('mb.category', 'c')->where('mb.year = :y')->setParameter('y', $year - 1)->getQuery()->getResult() as $mb) {
            $amt = (float) $mb->getPlannedAmount();
            if ($mb->getCategory()->getTransactionType() === 'transfer' && $mb->getDestinationAccount()) {
                $srcAid = $mb->getAccount()?->getId() ?? 'all';
                $dstAid = $mb->getDestinationAccount()->getId();
                $startingPlannedByAccount[$srcAid] = ($startingPlannedByAccount[$srcAid] ?? 0.0) - $amt;
                $startingPlannedByAccount[$dstAid] = ($startingPlannedByAccount[$dstAid] ?? 0.0) + $amt;
            } else {
                $aid = $mb->getAccount()?->getId() ?? 'all';
                $startingPlannedByAccount[$aid] = ($startingPlannedByAccount[$aid] ?? 0.0)
                    + ($mb->getCategory()->getTransactionType() === 'income' ? $amt : -$amt);
            }
        }

        return ['net' => $startingNetByAccount, 'planned' => $startingPlannedByAccount];
    }

    // Calcule, pour chaque compte et chaque mois, le solde réel cumulé et
    // le solde projeté (réel + planifié non approuvé), ainsi que quelques
    // indicateurs annexes (mouvements du mois, statut d'approbation).
    private function buildAccountBalances(
        array $accounts,
        int $year,
        int $currentYear,
        int $currentMonth,
        array $txMovements,
        array $subMovements,
        array $plannedTotals,
        array $starting
    ): array {
        ['plannedByAccount' => $plannedByAccount, 'allPlannedByAccount' => $allPlannedByAccount, 'approvalByAccount' => $approvalByAccount] = $plannedTotals;
        ['net' => $startingNetByAccount, 'planned' => $startingPlannedByAccount] = $starting;

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

                $apAll     = $allPlannedByAccount[$m]['all'] ?? ['income' => 0.0, 'expense' => 0.0];
                $apAccount = $allPlannedByAccount[$m][$aid] ?? ['income' => 0.0, 'expense' => 0.0];
                $monthPlannedNet = ($apAccount['income'] + $apAll['income']) - ($apAccount['expense'] + $apAll['expense']);

                // Comptage approbations : budgets liés au compte + budgets sans compte ('all')
                $apvAccount = $approvalByAccount[$m][$aid] ?? ['total' => 0, 'approved' => 0];
                $apvAll     = $approvalByAccount[$m]['all'] ?? ['total' => 0, 'approved' => 0];
                $totalBudgets    = $apvAccount['total'] + $apvAll['total'];
                $approvedBudgets = $apvAccount['approved'] + $apvAll['approved'];
                $allApvAccount   = $totalBudgets > 0 && $totalBudgets === $approvedBudgets;

                $accountBalances[$aid][$m] = [
                    'balance'             => $balance + $cumNet,
                    'balance_projected'   => $balance + $cumNet + $cumPlannedNet,
                    'credit'              => $credit,
                    'debit'              => $debit,
                    'subs'               => $subs,
                    'planned_net'         => $cumPlannedNet,
                    'month_planned_net'   => $monthPlannedNet,
                    'month_all_approved'  => $allApvAccount,
                ];
            }
        }

        return $accountBalances;
    }

    // ─── Vue mois ─────────────────────────────────────────────────────────────

    #[Route('/{year}/{month}', name: 'month', requirements: ['year' => '\d{4}', 'month' => '\d{1,2}'])]
    public function month(
        BudgetRepository $repo,
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
        $synced = $subRepo->syncBudgetLines($em, $repo, $year, $month);
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

        $now = new \DateTimeImmutable();

        return $this->json([
            'year'            => $year,
            'month'           => $month,
            'nowYear'         => (int) $now->format('Y'),
            'nowMonth'        => (int) $now->format('n'),
            'periodLabel'     => (BudgetLabels::MONTHS[$month] ?? '') . ' ' . $year,
            'accounts'        => $accounts,
            'txByAccount'     => $txByAccount,
            'subscriptions'   => $subscriptions,
            'budgets'         => $budgets,
            'monthNames'      => BudgetLabels::MONTHS,
            'frequencyLabels' => BudgetLabels::FREQUENCIES,
        ], 200, [], ['groups' => ['budget:month', 'budget:read', 'account:read', 'category:read', 'subscription:read']]);
    }

    // ─── CRUD ─────────────────────────────────────────────────────────────────

    #[Route('/new', name: 'new', methods: ['POST'])]
    public function new(Request $request, EntityManagerInterface $em): Response
    {
        $data   = json_decode($request->getContent(), true);
        $budget = new Budget();
        $this->hydrate($budget, $data, $em);

        if (!$budget->getAccount()) {
            return $this->json(['error' => 'Un compte est requis.'], 422);
        }

        if (
            $budget->getDestinationAccount()
            && $budget->getAccount()
            && $budget->getDestinationAccount()->getId() === $budget->getAccount()->getId()
        ) {
            return $this->json(['error' => 'Le compte expéditeur et le compte destinataire doivent être différents.'], 422);
        }

        $em->persist($budget);
        $em->flush();

        return $this->json($budget, 201, [], ['groups' => ['budget:read', 'account:read', 'category:read'], \Symfony\Component\Serializer\Normalizer\DateTimeNormalizer::FORMAT_KEY => 'Y-m-d']);
    }

    #[Route('/{id}', name: 'show', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function show(Budget $budget): Response
    {
        return $this->json($budget, 200, [], ['groups' => ['budget:read', 'account:read', 'category:read'], \Symfony\Component\Serializer\Normalizer\DateTimeNormalizer::FORMAT_KEY => 'Y-m-d']);
    }

    #[Route('/{id}/edit', name: 'edit', methods: ['POST'])]
    public function edit(Budget $budget, Request $request, EntityManagerInterface $em): Response
    {
        if ($budget->isApproved()) {
            return $this->json(['error' => 'Ligne verrouillée car approuvée.'], 409);
        }

        $data = json_decode($request->getContent(), true);
        $this->hydrate($budget, $data, $em);

        if (!$budget->getAccount()) {
            return $this->json(['error' => 'Un compte est requis.'], 422);
        }

        if (
            $budget->getDestinationAccount()
            && $budget->getAccount()
            && $budget->getDestinationAccount()->getId() === $budget->getAccount()->getId()
        ) {
            return $this->json(['error' => 'Le compte expéditeur et le compte destinataire doivent être différents.'], 422);
        }

        $em->flush();

        return $this->json($budget, 200, [], ['groups' => ['budget:read', 'account:read', 'category:read'], \Symfony\Component\Serializer\Normalizer\DateTimeNormalizer::FORMAT_KEY => 'Y-m-d']);
    }

    #[Route('/{id}/convert-to-subscription', name: 'convert_to_subscription', methods: ['POST'])]
    public function convertToSubscription(Budget $budget, Request $request, EntityManagerInterface $em): Response
    {
        // Une ligne déjà générée par (ou déjà liée à) un abonnement ne peut
        // pas en générer un second : ça créerait deux abonnements qui se
        // disputeraient la même ligne budgétaire lors des prochaines synchros.
        if ($budget->getSourceSubscription()) {
            return $this->json(['error' => 'Cette ligne est déjà liée à un abonnement.'], 409);
        }

        if (!$budget->getAccount()) {
            return $this->json(['error' => "Un compte est requis pour créer un abonnement."], 422);
        }

        // Un abonnement ne porte qu'un seul compte (pas de destinationAccount) :
        // une ligne de virement n'a donc pas d'équivalent abonnement possible.
        if ($budget->getCategory()->getTransactionType() === 'transfer') {
            return $this->json(['error' => "Une ligne de virement ne peut pas être convertie en abonnement."], 422);
        }

        $data      = json_decode($request->getContent(), true) ?? [];
        $frequency = $data['frequency'] ?? 'monthly';

        // Le mois de la ligne budgétaire devient le mois de départ de
        // l'abonnement (setTime(0,0) pour rester cohérent avec le reste
        // de l'app — voir SubscriptionRepository::findActiveForPeriod()).
        $startDate = \DateTimeImmutable::createFromFormat('Y-n-j', $budget->getYear() . '-' . $budget->getMonth() . '-1')
            ->setTime(0, 0);

        $subscription = (new Subscription())
            ->setName($data['name'] ?? ($budget->getLabel() ?? $budget->getCategory()->getName()))
            ->setAmount($budget->getPlannedAmount())
            ->setFrequency($frequency)
            ->setStatus(Subscription::STATUS_ACTIVE)
            ->setStartDate($startDate)
            ->setEndDate(!empty($data['endDate']) ? new \DateTimeImmutable($data['endDate']) : null)
            ->setDayOfMonth(!empty($data['dayOfMonth']) ? (int) $data['dayOfMonth'] : null)
            ->setNotes($data['notes'] ?? null)
            ->setAccount($budget->getAccount())
            ->setCategory($budget->getCategory());

        $em->persist($subscription);

        // On lie la ligne existante à l'abonnement fraîchement créé : la
        // prochaine synchro (SubscriptionRepository::syncBudgetLines) la
        // reconnaîtra comme déjà existante pour ce mois et ne créera pas
        // de doublon.
        $budget->setSourceSubscription($subscription);

        $em->flush();

        return $this->json($subscription, 201, [], ['groups' => ['subscription:read', 'account:read', 'category:read']]);
    }

    #[Route('/{id}/approve', name: 'approve', methods: ['POST'])]
    public function approve(Budget $budget, EntityManagerInterface $em): Response
    {
        if ($budget->isApproved()) {
            return $this->json(['error' => 'Cette ligne est déjà approuvée.'], 409);
        }
        if (!$budget->getAccount()) {
            return $this->json(['error' => "Veuillez d'abord associer un compte à cette ligne budgétaire avant d'approuver."], 422);
        }

        $categoryType = $budget->getCategory()->getTransactionType();
        $txDate = \DateTimeImmutable::createFromFormat('Y-n-j', $budget->getYear() . '-' . $budget->getMonth() . '-1');
        $label  = $budget->getLabel() ?? ($budget->getCategory()->getName() . ' — ' . $budget->getPeriodLabel());

        if ($categoryType === 'transfer') {
            if (!$budget->getDestinationAccount()) {
                return $this->json(['error' => "Veuillez indiquer le compte destinataire de ce virement avant d'approuver."], 422);
            }

            // Une ligne de virement génère deux transactions : sortie
            // (débit) sur le compte expéditeur, entrée (crédit) sur le
            // compte destinataire.
            $debitTx = (new Transaction())
                ->setAccount($budget->getAccount())
                ->setCategory($budget->getCategory())
                ->setAmount($budget->getActualAmount())
                ->setType(Transaction::TYPE_DEBIT)
                ->setTransactionDate($txDate)
                ->setLabel($label);

            $creditTx = (new Transaction())
                ->setAccount($budget->getDestinationAccount())
                ->setCategory($budget->getCategory())
                ->setAmount($budget->getActualAmount())
                ->setType(Transaction::TYPE_CREDIT)
                ->setTransactionDate($txDate)
                ->setLabel($label);

            $em->persist($debitTx);
            $em->persist($creditTx);
            $budget->setApprovedTransaction($debitTx);
            $budget->setApprovedDestinationTransaction($creditTx);
        } else {
            $txType = $categoryType === 'income' ? Transaction::TYPE_CREDIT : Transaction::TYPE_DEBIT;

            $transaction = (new Transaction())
                ->setAccount($budget->getAccount())
                ->setCategory($budget->getCategory())
                ->setAmount($budget->getActualAmount())
                ->setType($txType)
                ->setTransactionDate($txDate)
                ->setLabel($label);

            $em->persist($transaction);
            $budget->setApprovedTransaction($transaction);
        }

        $budget->setApprovedAt(new \DateTimeImmutable());
        $em->flush();

        return $this->json($budget, 200, [], ['groups' => ['budget:read', 'account:read', 'category:read'], \Symfony\Component\Serializer\Normalizer\DateTimeNormalizer::FORMAT_KEY => 'Y-m-d']);
    }

    #[Route('/{id}/unapprove', name: 'unapprove', methods: ['POST'])]
    public function unapprove(Budget $budget, EntityManagerInterface $em): Response
    {
        $tx = $budget->getApprovedTransaction();
        if ($tx) $em->remove($tx);

        $dstTx = $budget->getApprovedDestinationTransaction();
        if ($dstTx) $em->remove($dstTx);

        $budget->setApprovedAt(null);
        $budget->setApprovedTransaction(null);
        $budget->setApprovedDestinationTransaction(null);
        $em->flush();

        return $this->json($budget, 200, [], ['groups' => ['budget:read', 'account:read', 'category:read'], \Symfony\Component\Serializer\Normalizer\DateTimeNormalizer::FORMAT_KEY => 'Y-m-d']);
    }

    #[Route('/{id}/delete', name: 'delete', methods: ['POST'])]
    public function delete(Budget $budget, EntityManagerInterface $em): Response
    {
        $em->remove($budget);
        $em->flush();

        return $this->json(['deleted' => true]);
    }

    #[Route('/{year}/{month}/duplicate', name: 'duplicate', methods: ['POST'])]
    public function duplicate(BudgetRepository $repo, EntityManagerInterface $em, int $year, int $month): Response
    {
        $nextDate  = \DateTimeImmutable::createFromFormat('Y-n', "$year-$month")->modify('+1 month');
        $nextYear  = (int) $nextDate->format('Y');
        $nextMonth = (int) $nextDate->format('n');
        $count     = 0;

        foreach ($repo->findByPeriod($year, $month) as $source) {
            if ($repo->findOneBy(['category' => $source->getCategory(), 'year' => $nextYear, 'month' => $nextMonth])) continue;
            $em->persist((new Budget())
                ->setCategory($source->getCategory())
                ->setAccount($source->getAccount())
                ->setDestinationAccount($source->getDestinationAccount())
                ->setYear($nextYear)->setMonth($nextMonth)
                ->setPlannedAmount($source->getPlannedAmount()));
            $count++;
        }

        $em->flush();

        return $this->json(['duplicated' => $count, 'year' => $nextYear, 'month' => $nextMonth]);
    }

    private function hydrate(Budget $budget, array $data, EntityManagerInterface $em): void
    {
        $categoryRepo = $em->getRepository(\App\Entity\Category::class);
        $accountRepo  = $em->getRepository(\App\Entity\Account::class);

        $budget->setLabel($data['label'] ?? null);
        $budget->setCategory($categoryRepo->find($data['categoryId']));
        $budget->setAccount(!empty($data['accountId']) ? $accountRepo->find($data['accountId']) : null);
        $budget->setDestinationAccount(!empty($data['destinationAccountId']) ? $accountRepo->find($data['destinationAccountId']) : null);
        $budget->setYear((int) $data['year']);
        $budget->setMonth((int) $data['month']);
        $budget->setPlannedAmount((string) $data['plannedAmount']);
        $budget->setActualAmount((string) ($data['actualAmount'] ?? $data['plannedAmount']));
    }}
