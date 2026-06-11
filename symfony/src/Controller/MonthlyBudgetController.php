<?php

namespace App\Controller;

use App\Entity\MonthlyBudget;
use App\Entity\Transaction;
use App\Form\MonthlyBudgetType;
use App\Repository\AccountRepository;
use App\Repository\MonthlyBudgetRepository;
use App\Repository\SubscriptionRepository;
use App\Repository\TransactionRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\HttpFoundation\JsonResponse;

#[Route('/', name: 'monthly_budget_')]
class MonthlyBudgetController extends AbstractController
{
    /**
     * Vue annuelle : affiche les 12 mois d'une année.
     * L'année par défaut est l'année courante ou l'année suivante
     * si on est en décembre (pour anticiper).
     */
    #[Route('', name: 'index')]
    #[Route('/{year}', name: 'year', requirements: ['year' => '\d{4}'])]
    public function index(MonthlyBudgetRepository $repo, AccountRepository $accountRepo, TransactionRepository $txRepo, SubscriptionRepository $subRepo, EntityManagerInterface $em, int $year = 0): Response
    {
        $now = new \DateTimeImmutable();

        if ($year === 0) {
            $year = (int) $now->format('Y');
            if ((int) $now->format('n') === 12) {
                $year++;
            }
        }

        // ── Synchronisation abonnements → lignes budgétaires pour toute l'année ──
        // Même logique que dans month() : on crée les lignes manquantes pour chaque
        // mois de l'année, afin que findAnnualSummary() les voie immédiatement
        // sans avoir à visiter chaque page mois.
        $synced = 0;
        for ($m = 1; $m <= 12; $m++) {
            $subscriptions = $subRepo->findActiveForPeriod($year, $m);
            foreach ($subscriptions as $sub) {
                $existing = $repo->findOneBy([
                    'category' => $sub->getCategory(),
                    'account'  => $sub->getAccount(),
                    'year'     => $year,
                    'month'    => $m,
                ]);
                if (!$existing) {
                    $mb = (new MonthlyBudget())
                        ->setCategory($sub->getCategory())
                        ->setAccount($sub->getAccount())
                        ->setYear($year)
                        ->setMonth($m)
                        ->setPlannedAmount((string) $sub->getAmount())
                        ->setActualAmount((string) $sub->getAmount());
                    $em->persist($mb);
                    $synced++;
                }
            }
        }
        if ($synced > 0) {
            $em->flush();
        }

        // Résumé mensuel budget prévu vs réalisé
        $summary = $repo->findAnnualSummary($year);
        $summaryByMonth = [];
        foreach ($summary as $row) {
            $summaryByMonth[(int) $row['month']] = $row;
        }

        // Détail budget par mois
        $budgetsByMonth   = [];
        // [month][account_id|'all'] = ['income' => sum, 'expense' => sum]
        // net = income - expense → à appliquer au solde pour la projection
        $plannedByAccount = [];
        $allBudgets = $repo->createQueryBuilder('mb')
            ->addSelect('c')
            ->join('mb.category', 'c')
            ->where('mb.year = :year')
            ->setParameter('year', $year)
            ->orderBy('mb.month', 'ASC')
            ->addOrderBy('c.name', 'ASC')
            ->getQuery()
            ->getResult();
        foreach ($allBudgets as $mb) {
            $budgetsByMonth[$mb->getMonth()][] = $mb;

            // Exclure les lignes approuvées : elles ont déjà généré une transaction
            // comptée dans account.balance, les inclure causerait un double-comptage.
            if ($mb->isApproved()) {
                continue;
            }

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

        $accounts = $accountRepo->findAllOrderedByName();
        $currentYear = (int) $now->format('Y');
        $availableYears = range($currentYear - 1, $currentYear + 2);

        // ── Soldes cumulés par compte, mois par mois ──────────────────────
        // On part du solde courant de chaque compte (account.balance),
        // puis on recalcule mois par mois en ajoutant/soustrayant les mouvements.

        // 1. Mouvements réels (transactions) agrégés par compte+mois
        $movements = $txRepo->findMonthlyByAccountForYear($year);
        // Indexer : $txMovements[account_id][month] = ['credit'=>…, 'debit'=>…]
        $txMovements = [];
        foreach ($movements as $row) {
            $txMovements[(int)$row['account_id']][(int)$row['month']] = [
                'credit' => (float)$row['credit'],
                'debit'  => (float)$row['debit'],
            ];
        }

        // 2. Abonnements actifs de l'année : on les distribue sur leurs mois
        $allSubs = $subRepo->findActive();
        $subMovements = []; // [account_id][month] = montant débit abonnements
        foreach ($allSubs as $sub) {
            $aid = $sub->getAccount()->getId();
            for ($m = 1; $m <= 12; $m++) {
                $applies = match ($sub->getFrequency()) {
                    'monthly'   => true,
                    'yearly'    => (int)$sub->getStartDate()->format('n') === $m,
                    'quarterly' => ((($m - 1) % 3) === (((int)$sub->getStartDate()->format('n') - 1) % 3)),
                    default     => false,
                };
                // Vérifier que le mois est dans la plage start/end
                $monthDate = \DateTimeImmutable::createFromFormat('Y-n-j', "$year-$m-1");
                $lastOfMonth = $monthDate->modify('last day of this month');
                if ($sub->getStartDate() > $lastOfMonth) $applies = false;
                if ($sub->getEndDate() !== null && $sub->getEndDate() < $monthDate) $applies = false;

                if ($applies) {
                    $subMovements[$aid][$m] = ($subMovements[$aid][$m] ?? 0) + (float)$sub->getAmount();
                }
            }
        }

        // 3. Calcul des soldes cumulés par compte, mois par mois.
        //
        // Logique : account.balance = solde actuel du compte (base de départ).
        // Pour chaque mois on affiche : balance + cumul des transactions de janvier jusqu'à ce mois.
        // Exemple : balance=1200, jan=+1665, fév=+1665
        //   → jan : 1200 + 1665        = 2865
        //   → fév : 1200 + 1665 + 1665 = 4530
        $accountBalances = [];
        $currentMonth   = (int) $now->format('n');
        $currentYearNow = (int) $now->format('Y');

        // Pour les années futures (ex: 2027) :
        // - solde de départ réel   = account.balance + tous les mouvements jusqu'au 31/12/(year-1)
        // - projection de départ   = cumul des planned non approuvés de toute l'année (year-1)
        //   Ces deux valeurs servent de base à janvier de l'année affichée.
        $startingNetByAccount      = []; // mouvements réels cumulés jusqu'à fin (year-1)
        $startingPlannedByAccount  = []; // planned net cumulé sur toute l'année (year-1)

        if ($year > $currentYearNow) {
            // Mouvements réels jusqu'à fin décembre (year-1)
            foreach ($txRepo->findMovementsUpToPeriod($year - 1, 12) as $row) {
                $aid = (int) $row['account_id'];
                $startingNetByAccount[$aid] = (float)$row['credit'] - (float)$row['debit'];
            }

            // Planned net cumulé de l'année (year-1) pour chaque compte
            // On charge les budgets de l'année précédente
            $prevYearBudgets = $repo->createQueryBuilder('mb')
                ->join('mb.category', 'c')
                ->where('mb.year = :y')
                ->setParameter('y', $year - 1)
                ->getQuery()
                ->getResult();

            foreach ($prevYearBudgets as $mb) {
                $aid  = $mb->getAccount()?->getId() ?? 'all';
                $type = $mb->getCategory()->getTransactionType();
                $amt  = (float) $mb->getPlannedAmount();
                if (!isset($startingPlannedByAccount[$aid])) {
                    $startingPlannedByAccount[$aid] = 0.0;
                }
                $startingPlannedByAccount[$aid] += $type === 'income' ? $amt : -$amt;
            }
        }

        foreach ($accounts as $account) {
            $aid     = $account->getId();
            $balance = (float) $account->getBalance() + ($startingNetByAccount[$aid] ?? 0.0);
            // Projection de départ : planned de l'année précédente (pour année future)
            $basePlannedNet = ($startingPlannedByAccount[$aid] ?? 0.0)
                + ($startingPlannedByAccount['all'] ?? 0.0);

            $cumNet        = 0.0;
            $cumPlannedNet = $basePlannedNet;
            for ($m = 1; $m <= 12; $m++) {
                $credit  = $txMovements[$aid][$m]['credit'] ?? 0;
                $debit   = $txMovements[$aid][$m]['debit']  ?? 0;
                $subs    = $subMovements[$aid][$m] ?? 0;
                $cumNet += $credit - $debit;

                // On n'applique le planned que pour les mois >= mois courant.
                // Les mois passés sont déjà reflétés dans account.balance via les transactions.
                // Cela évite qu'un budget annuel (ex: Assurance auto en mars) soit
                // re-projeté sur tous les mois suivants jusqu'en décembre.
                $pAccount = $plannedByAccount[$m][$aid]  ?? ['income' => 0.0, 'expense' => 0.0];
                $pAll     = $plannedByAccount[$m]['all'] ?? ['income' => 0.0, 'expense' => 0.0];
                $isCurrentOrFuture = ($year > $currentYearNow)
                    || ($year === $currentYearNow && $m >= $currentMonth);
                if ($isCurrentOrFuture) {
                    $cumPlannedNet += ($pAccount['income'] + $pAll['income'])
                        - ($pAccount['expense'] + $pAll['expense']);
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

        $accountBalancesJson = [];
        foreach ($accountBalances as $aid => $months) {
            foreach ($months as $m => $ab) {
                $accountBalancesJson[$aid][$m] = $ab;
            }
        }

        $summaryJson = [];
        foreach ($summaryByMonth as $m => $row) {
            $summaryJson[$m] = $row;
        }

        $accountsJson = array_map(fn($a) => [
            'id'      => $a->getId(),
            'name'    => $a->getName(),
            'type'    => $a->getType(),
            'balance' => (float) $a->getBalance(),
        ], $accounts);

        return $this->json([
            'year'            => $year,
            'currentYear'     => $currentYear,
            'currentMonth'    => $currentMonth,
            'availableYears'  => $availableYears,
            'accounts'        => $accountsJson,
            'summary'         => $summaryJson,
            'accountBalances' => $accountBalancesJson,
        ]);
    }

    /**
     * Vue détaillée d'un mois spécifique.
     */
    #[Route('/{year}/{month}', name: 'month', requirements: ['year' => '\d{4}', 'month' => '\d{1,2}'])]
    public function month(MonthlyBudgetRepository $repo, AccountRepository $accountRepo, TransactionRepository $txRepo, SubscriptionRepository $subRepo, EntityManagerInterface $em, int $year, int $month): Response
    {
        $accounts      = $accountRepo->findAllOrderedByName();
        $subscriptions = $subRepo->findActiveForPeriod($year, $month);

        // ── Synchronisation abonnements → lignes budgétaires ─────────────────
        // Pour chaque abonnement actif du mois, on crée une ligne MonthlyBudget
        // si elle n'existe pas encore (détection par category + account + year + month).
        $synced = 0;
        foreach ($subscriptions as $sub) {
            $existing = $repo->findOneBy([
                'category' => $sub->getCategory(),
                'account'  => $sub->getAccount(),
                'year'     => $year,
                'month'    => $month,
            ]);
            if (!$existing) {
                $mb = (new MonthlyBudget())
                    ->setCategory($sub->getCategory())
                    ->setAccount($sub->getAccount())
                    ->setYear($year)
                    ->setMonth($month)
                    ->setPlannedAmount((string) $sub->getAmount())
                    ->setActualAmount((string) $sub->getAmount());
                $em->persist($mb);
                $synced++;
            }
        }
        if ($synced > 0) {
            $em->flush();
        }

        $budgets = $repo->findByPeriod($year, $month);

        // Solde des transactions du mois par compte
        $txByAccount = [];
        foreach ($accounts as $account) {
            $txByAccount[$account->getId()] = ['credit' => 0, 'debit' => 0, 'subs' => 0];
        }
        foreach ($txRepo->findByPeriod($year, $month) as $tx) {
            $aid = $tx->getAccount()->getId();
            if (!isset($txByAccount[$aid])) {
                $txByAccount[$aid] = ['credit' => 0, 'debit' => 0, 'subs' => 0];
            }
            $txByAccount[$aid][$tx->getType()] += (float) $tx->getAmount();
        }
        // Ajouter les abonnements dans les sorties
        foreach ($subscriptions as $sub) {
            $aid = $sub->getAccount()->getId();
            if (!isset($txByAccount[$aid])) {
                $txByAccount[$aid] = ['credit' => 0, 'debit' => 0, 'subs' => 0];
            }
            $txByAccount[$aid]['debit'] += (float) $sub->getAmount();
            $txByAccount[$aid]['subs']  += (float) $sub->getAmount();
        }

        $date      = \DateTimeImmutable::createFromFormat('Y-n', "$year-$month");
        $formatter = new \IntlDateFormatter('fr_FR', \IntlDateFormatter::NONE, \IntlDateFormatter::NONE, null, null, 'MMMM yyyy');

        $months = [
            1 => 'Janvier',
            2 => 'Février',
            3 => 'Mars',
            4 => 'Avril',
            5 => 'Mai',
            6 => 'Juin',
            7 => 'Juillet',
            8 => 'Août',
            9 => 'Septembre',
            10 => 'Octobre',
            11 => 'Novembre',
            12 => 'Décembre',
        ];

        $now = new \DateTimeImmutable();

        $budgetsJson = array_map(fn($mb) => [
            'id'            => $mb->getId(),
            'label'         => $mb->getLabel(),
            'plannedAmount' => (float) $mb->getPlannedAmount(),
            'actualAmount'  => (float) $mb->getActualAmount(),
            'isApproved'    => $mb->isApproved(),
            'approvedAt'    => $mb->getApprovedAt()?->format('d/m/Y'),
            'account'       => $mb->getAccount() ? [
                'id'   => $mb->getAccount()->getId(),
                'name' => $mb->getAccount()->getName(),
            ] : null,
            'category' => [
                'id'              => $mb->getCategory()->getId(),
                'name'            => $mb->getCategory()->getName(),
                'transactionType' => $mb->getCategory()->getTransactionType(),
                'frequency'       => $mb->getCategory()->getFrequency() ?? 'monthly',
            ],
        ], $budgets);

        $accountsJson = array_map(fn($a) => [
            'id'       => $a->getId(),
            'name'     => $a->getName(),
            'type'     => $a->getType(),
            'balance'  => (float) $a->getBalance(),
            'currency' => '€',
        ], $accounts);

        $subsJson = array_map(fn($s) => [
            'id'        => $s->getId(),
            'name'      => $s->getName(),
            'amount'    => (float) $s->getAmount(),
            'frequency' => $s->getFrequency(),
            'account'   => ['name' => $s->getAccount()->getName()],
            'category'  => ['name' => $s->getCategory()->getName()],
        ], $subscriptions);

        $txJson = [];
        foreach ($txByAccount as $aid => $tx) {
            $txJson[$aid] = $tx;
        }

        return $this->json([
            'year'          => $year,
            'month'         => $month,
            'nowYear'       => (int) $now->format('Y'),
            'nowMonth'      => (int) $now->format('n'),
            'periodLabel'   => $formatter->format($date),
            'accounts'      => $accountsJson,
            'txByAccount'   => $txJson,
            'subscriptions' => $subsJson,
            'budgets'       => $budgetsJson,
        ]);
    }

    /**
     * Approuve une ligne budgétaire :
     * crée la transaction correspondante et marque la ligne comme approuvée.
     * Si le compte n'est pas renseigné sur la ligne, on redirige vers l'édition.
     */
    #[Route('/new', name: 'new')]
    public function new(Request $request, EntityManagerInterface $em): Response
    {
        $now = new \DateTimeImmutable();
        $budget = new MonthlyBudget();

        // Pré-remplir depuis ?year=2026&month=11 pour conserver le contexte
        // quand on arrive depuis /budget/2026/11
        $preYear  = (int) ($request->query->get('year',  $now->format('Y')));
        $preMonth = (int) ($request->query->get('month', $now->format('n')));
        $budget->setYear($preYear);
        $budget->setMonth($preMonth);

        $form = $this->createForm(MonthlyBudgetType::class, $budget);
        $form->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            $em->persist($budget);
            $em->flush();
            $this->addFlash('success', 'Ligne budgétaire ajoutée pour ' . $budget->getPeriodLabel() . '.');
            return $this->redirectToRoute('monthly_budget_month', [
                'year'  => $budget->getYear(),
                'month' => $budget->getMonth(),
            ]);
        }

        return $this->render('monthly_budget/form.html.twig', [
            'form'  => $form,
            'title' => 'Nouvelle ligne budgétaire',
        ]);
    }

    #[Route('/{id}/approve', name: 'approve', methods: ['POST'])]
    public function approve(
        MonthlyBudget $budget,
        Request $request,
        EntityManagerInterface $em,
        MonthlyBudgetRepository $budgetRepo
    ): Response {
        if (!$this->isCsrfTokenValid('approve-budget-' . $budget->getId(), $request->request->get('_token'))) {
            $this->addFlash('danger', 'Token invalide.');
            return $this->redirectToRoute('monthly_budget_month', ['year' => $budget->getYear(), 'month' => $budget->getMonth()]);
        }

        if ($budget->isApproved()) {
            $this->addFlash('warning', 'Cette ligne est déjà approuvée.');
            return $this->redirectToRoute('monthly_budget_month', ['year' => $budget->getYear(), 'month' => $budget->getMonth()]);
        }

        // Le compte est obligatoire pour créer une transaction
        if (!$budget->getAccount()) {
            $this->addFlash('warning', 'Veuillez d\'abord associer un compte à cette ligne budgétaire avant d\'approuver.');
            return $this->redirectToRoute('monthly_budget_edit', ['id' => $budget->getId()]);
        }

        // Déterminer le type de transaction selon la catégorie
        $txType = match ($budget->getCategory()->getTransactionType()) {
            'income'   => Transaction::TYPE_CREDIT,
            'transfer' => Transaction::TYPE_TRANSFER,
            default    => Transaction::TYPE_DEBIT,
        };

        // Date = premier jour du mois budgétaire
        $txDate = \DateTimeImmutable::createFromFormat('Y-n-j', $budget->getYear() . '-' . $budget->getMonth() . '-1');

        $transaction = (new Transaction())
            ->setAccount($budget->getAccount())
            ->setCategory($budget->getCategory())
            ->setAmount($budget->getActualAmount())
            ->setType($txType)
            ->setTransactionDate($txDate)
            ->setLabel($budget->getLabel() ?? ($budget->getCategory()->getName() . ' — ' . $budget->getPeriodLabel()));

        $em->persist($transaction);

        // Marquer la ligne comme approuvée.
        // On conserve actualAmount tel quel — ne pas écraser avec plannedAmount.
        // On ne recalcule PAS refreshActualAmounts : chaque ligne gère son propre
        // montant indépendamment des autres lignes de la même catégorie.
        $budget->setApprovedAt(new \DateTimeImmutable());
        $budget->setApprovedTransaction($transaction);

        $em->flush();

        $this->addFlash('success', sprintf(
            '✓ « %s » approuvé — transaction de %s € créée.',
            $budget->getCategory()->getName(),
            number_format((float) $budget->getActualAmount(), 2, ',', ' ')
        ));

        return $this->redirectToRoute('monthly_budget_month', [
            'year'  => $budget->getYear(),
            'month' => $budget->getMonth(),
        ]);
    }

    #[Route('/{id}/unapprove', name: 'unapprove', methods: ['POST'])]
    public function unapprove(
        MonthlyBudget $budget,
        Request $request,
        EntityManagerInterface $em,
        MonthlyBudgetRepository $budgetRepo
    ): Response {
        if (!$this->isCsrfTokenValid('unapprove-budget-' . $budget->getId(), $request->request->get('_token'))) {
            $this->addFlash('danger', 'Token invalide.');
            return $this->redirectToRoute('monthly_budget_month', ['year' => $budget->getYear(), 'month' => $budget->getMonth()]);
        }

        $tx = $budget->getApprovedTransaction();
        if ($tx) {
            $em->remove($tx);
        }

        $budget->setApprovedAt(null);
        $budget->setApprovedTransaction(null);
        // On ne recalcule PAS : le montant réalisé est conservé tel quel.
        $em->flush();

        $this->addFlash('success', 'Approbation annulée. Le montant réalisé est conservé.');
        return $this->redirectToRoute('monthly_budget_month', [
            'year'  => $budget->getYear(),
            'month' => $budget->getMonth(),
        ]);
    }


    #[Route('/{id}/edit', name: 'edit')]
    public function edit(MonthlyBudget $budget, Request $request, EntityManagerInterface $em): Response
    {
        // Ligne verrouillée : affichage lecture seule, pas de soumission possible
        if ($budget->isApproved()) {
            $this->addFlash('warning', 'Cette ligne est verrouillée car elle a été approuvée. Annulez d\'abord l\'approbation pour la modifier.');
            return $this->render('monthly_budget/form.html.twig', [
                'form'   => $this->createForm(MonthlyBudgetType::class, $budget),
                'title'  => 'Budget verrouillé — ' . $budget->getPeriodLabel(),
                'budget' => $budget,
            ]);
        }

        $form = $this->createForm(MonthlyBudgetType::class, $budget);
        $form->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            $em->flush();
            $this->addFlash('success', 'Ligne budgétaire mise à jour.');
            return $this->redirectToRoute('monthly_budget_month', [
                'year'  => $budget->getYear(),
                'month' => $budget->getMonth(),
            ]);
        }

        return $this->render('monthly_budget/form.html.twig', [
            'form'   => $form,
            'title'  => 'Modifier le budget — ' . $budget->getPeriodLabel(),
            'budget' => $budget,
        ]);
    }

    #[Route('/{id}/delete', name: 'delete', methods: ['POST'])]
    public function delete(MonthlyBudget $budget, Request $request, EntityManagerInterface $em): Response
    {
        $year = $budget->getYear();
        if ($this->isCsrfTokenValid('delete-budget-' . $budget->getId(), $request->request->get('_token'))) {
            $em->remove($budget);
            $em->flush();
            $this->addFlash('success', 'Ligne supprimée.');
        }
        return $this->redirectToRoute('monthly_budget_year', ['year' => $year]);
    }

    /**
     * Copie les lignes budgétaires d'un mois vers le mois suivant
     * (pratique pour dupliquer un budget mensuel récurrent).
     */
    #[Route('/{year}/{month}/duplicate', name: 'duplicate', methods: ['POST'])]
    public function duplicate(
        MonthlyBudgetRepository $repo,
        EntityManagerInterface $em,
        int $year,
        int $month
    ): Response {
        $existing = $repo->findByPeriod($year, $month);

        // Calcul du mois cible
        $nextDate = \DateTimeImmutable::createFromFormat('Y-n', "$year-$month")->modify('+1 month');
        $nextYear  = (int) $nextDate->format('Y');
        $nextMonth = (int) $nextDate->format('n');

        $count = 0;
        foreach ($existing as $source) {
            // Ne pas créer de doublon
            $alreadyExists = $repo->findOneBy([
                'category' => $source->getCategory(),
                'year'     => $nextYear,
                'month'    => $nextMonth,
            ]);
            if ($alreadyExists) continue;

            $copy = (new MonthlyBudget())
                ->setCategory($source->getCategory())
                ->setYear($nextYear)
                ->setMonth($nextMonth)
                ->setPlannedAmount($source->getPlannedAmount());
            $em->persist($copy);
            $count++;
        }

        $em->flush();
        $this->addFlash('success', "$count ligne(s) copiée(s) vers le mois suivant.");
        return $this->redirectToRoute('monthly_budget_year', ['year' => $nextYear]);
    }
}
