<?php

namespace App\Controller;

use App\Entity\MonthlyBudget;
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
    public function index(MonthlyBudgetRepository $repo, AccountRepository $accountRepo, int $year = 0): Response
    {
        $now = new \DateTimeImmutable();

        // Année par défaut : année courante.
        // En décembre, on bascule sur l'année suivante pour la planification.
        if ($year === 0) {
            $year = (int) $now->format('Y');
            if ((int) $now->format('n') === 12) {
                $year++;
            }
        }

        // Résumé mensuel prévu vs réalisé
        $summary = $repo->findAnnualSummary($year);
        $summaryByMonth = [];
        foreach ($summary as $row) {
            $summaryByMonth[(int) $row['month']] = $row;
        }

        // Détail par mois (toutes les lignes)
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

        // Années disponibles pour la navigation
        $currentYear = (int) $now->format('Y');
        $availableYears = range($currentYear - 1, $currentYear + 2);

        return $this->render('monthly_budget/index.html.twig', [
            'year'            => $year,
            'current_year'    => $currentYear,
            'available_years' => $availableYears,
            'summary'         => $summaryByMonth,
            'budgets'         => $budgetsByMonth,
            'accounts'        => $accountRepo->findAllOrderedByName(),
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
            $txByAccount[$account->getId()] = [
                'credit' => 0,
                'debit'  => 0,
            ];
        }
        foreach ($txRepo->findByPeriod($year, $month) as $tx) {
            $aid = $tx->getAccount()->getId();
            if (!isset($txByAccount[$aid])) {
                $txByAccount[$aid] = ['credit' => 0, 'debit' => 0];
            }
            $txByAccount[$aid][$tx->getType()] += (float) $tx->getAmount();
        }

        $date      = \DateTimeImmutable::createFromFormat('Y-n', "$year-$month");
        $formatter = new \IntlDateFormatter('fr_FR', \IntlDateFormatter::NONE, \IntlDateFormatter::NONE, null, null, 'MMMM yyyy');

        return $this->render('monthly_budget/month.html.twig', [
            'year'           => $year,
            'month'          => $month,
            'period_label'   => $formatter->format($date),
            'budgets'        => $budgets,
            'accounts'       => $accounts,
            'tx_by_account'  => $txByAccount,
            'subscriptions'  => $subscriptions,
        ]);
    }

    #[Route('/new', name: 'new')]
    public function new(Request $request, EntityManagerInterface $em): Response
    {
        $now = new \DateTimeImmutable();
        $budget = new MonthlyBudget();
        $budget->setYear((int) $now->format('Y'));
        $budget->setMonth((int) $now->format('n'));

        $form = $this->createForm(MonthlyBudgetType::class, $budget, [
            'default_year'  => (int) $now->format('Y'),
            'default_month' => (int) $now->format('n'),
        ]);
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

    #[Route('/{id}/edit', name: 'edit')]
    public function edit(MonthlyBudget $budget, Request $request, EntityManagerInterface $em): Response
    {
        $form = $this->createForm(MonthlyBudgetType::class, $budget);
        $form->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            $em->flush();
            $this->addFlash('success', 'Ligne budgétaire mise à jour.');
            return $this->redirectToRoute('monthly_budget_year', ['year' => $budget->getYear()]);
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
