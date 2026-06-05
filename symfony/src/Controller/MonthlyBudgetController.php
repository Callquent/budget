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

#[Route('/budget', name: 'monthly_budget_')]
class MonthlyBudgetController extends AbstractController
{
    /**
     * Vue annuelle : affiche les 12 mois d'une année.
     * L'année par défaut est l'année courante ou l'année suivante
     * si on est en décembre (pour anticiper).
     */
    #[Route('', name: 'index')]
    #[Route('/{year}', name: 'year', requirements: ['year' => '\d{4}'])]
    public function index(MonthlyBudgetRepository $repo, AccountRepository $accountRepo, TransactionRepository $txRepo, SubscriptionRepository $subRepo, int $year = 0): Response
    {
        $now = new \DateTimeImmutable();

        if ($year === 0) {
            $year = (int) $now->format('Y');
            if ((int) $now->format('n') === 12) {
                $year++;
            }
        }

        // Résumé mensuel budget prévu vs réalisé
        $summary = $repo->findAnnualSummary($year);
        $summaryByMonth = [];
        foreach ($summary as $row) {
            $summaryByMonth[(int) $row['month']] = $row;
        }

        // Détail budget par mois
        $budgetsByMonth = [];
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

        // 3. Calcul des soldes cumulés : on part du solde actuel et on remonte/avance mois par mois.
        // Stratégie : solde[mois] = balance du compte + sum(crédits 1..mois) - sum(débits 1..mois) - sum(abonnements 1..mois)
        // Pour chaque mois on calcule le solde de fin de mois.
        $accountBalances = []; // [account_id][month] = solde fin de mois
        foreach ($accounts as $account) {
            $aid = $account->getId();
            $runningBalance = (float)$account->getBalance();

            // On calcule d'abord le solde de DÉBUT d'année (avant janvier de $year)
            // en soustrayant tous les mouvements de l'année depuis le solde actuel
            // (le solde actuel = état à aujourd'hui, donc on enlève les mois futurs et on garde les passés)
            // Approche plus simple : on affiche le solde de fin de mois en accumulant depuis janvier.

            // Solde de départ = balance actuelle (représente l'état courant, on l'utilise tel quel)
            // et on projette les mouvements mois par mois.
            $balance = (float)$account->getBalance();

            // Déterminer les mouvements déjà inclus dans balance (mois passés vs futurs)
            // Pour simplifier : on affiche simplement balance + mouvements cumulés depuis janvier du $year
            // C'est la vision "si le solde actuel est la référence aujourd'hui, voici ce que ça donne mois par mois"

            // Calculer le total annuel des transactions pour repartir du solde de début d'année
            $totalYearCredit = 0.0;
            $totalYearDebit  = 0.0;
            $totalYearSubs   = 0.0;
            for ($m = 1; $m <= 12; $m++) {
                $totalYearCredit += $txMovements[$aid][$m]['credit'] ?? 0;
                $totalYearDebit  += $txMovements[$aid][$m]['debit']  ?? 0;
                $totalYearSubs   += $subMovements[$aid][$m] ?? 0;
            }
            // Solde de début d'année estimé
            $startBalance = $balance - $totalYearCredit + $totalYearDebit + $totalYearSubs;

            $cumBalance = $startBalance;
            for ($m = 1; $m <= 12; $m++) {
                $credit = $txMovements[$aid][$m]['credit'] ?? 0;
                $debit  = $txMovements[$aid][$m]['debit']  ?? 0;
                $subs   = $subMovements[$aid][$m] ?? 0;
                $cumBalance = $cumBalance + $credit - $debit - $subs;
                $accountBalances[$aid][$m] = [
                    'balance' => $cumBalance,
                    'credit'  => $credit,
                    'debit'   => $debit + $subs,
                    'subs'    => $subs,
                ];
            }
        }

        return $this->render('monthly_budget/index.html.twig', [
            'year'             => $year,
            'current_year'     => $currentYear,
            'available_years'  => $availableYears,
            'summary'          => $summaryByMonth,
            'budgets'          => $budgetsByMonth,
            'accounts'         => $accounts,
            'account_balances' => $accountBalances,
        ]);
    }

    /**
     * Vue détaillée d'un mois spécifique.
     */
    #[Route('/{year}/{month}', name: 'month', requirements: ['year' => '\d{4}', 'month' => '\d{1,2}'])]
    public function month(MonthlyBudgetRepository $repo, AccountRepository $accountRepo, TransactionRepository $txRepo, SubscriptionRepository $subRepo, int $year, int $month): Response
    {
        $budgets       = $repo->findByPeriod($year, $month);
        $accounts      = $accountRepo->findAllOrderedByName();
        $subscriptions = $subRepo->findActiveForPeriod($year, $month);

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
            1 => 'Janvier', 2 => 'Février',  3 => 'Mars',      4 => 'Avril',
            5 => 'Mai',      6 => 'Juin',     7 => 'Juillet',   8 => 'Août',
            9 => 'Septembre',10 => 'Octobre', 11 => 'Novembre', 12 => 'Décembre',
        ];

        return $this->render('monthly_budget/month.html.twig', [
            'year'           => $year,
            'month'          => $month,
            'period_label'   => $formatter->format($date),
            'budgets'        => $budgets,
            'accounts'       => $accounts,
            'tx_by_account'  => $txByAccount,
            'subscriptions'  => $subscriptions,
            'months'         => $months,
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
        $year = (int) $request->query->get('year', $now->format('Y'));
        $month = (int) $request->query->get('month', $now->format('n'));

        $budget = new MonthlyBudget();
        $budget->setYear($year);
        $budget->setMonth($month);

        $form = $this->createForm(MonthlyBudgetType::class, $budget);
        $form->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            $em->persist($budget);
            $em->flush();
            $this->addFlash('success', 'Ligne budgétaire ajoutée pour ' . $budget->getPeriodLabel() . '.');
            return $this->redirectToRoute('monthly_budget_year', ['year' => $budget->getYear()]);
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
            ->setLabel($budget->getCategory()->getName() . ' — ' . $budget->getPeriodLabel());

        $em->persist($transaction);

        // Marquer la ligne comme approuvée
        $budget->setApprovedAt(new \DateTimeImmutable());
        $budget->setApprovedTransaction($transaction);
        $budget->setActualAmount($budget->getPlannedAmount());

        $em->flush();

        // Recalcule tous les actualAmount du mois
        $budgetRepo->refreshActualAmounts($budget->getYear(), $budget->getMonth());

        $this->addFlash('success', sprintf(
            '✓ « %s » approuvé — transaction de %s € créée.',
            $budget->getCategory()->getName(),
            number_format((float) $budget->getPlannedAmount(), 2, ',', ' ')
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
        $em->flush();

        $this->addFlash('success', 'Approbation annulée, transaction supprimée.');
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
