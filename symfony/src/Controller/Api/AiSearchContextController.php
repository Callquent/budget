<?php

namespace App\Controller\Api;

use App\Repository\AccountRepository;
use App\Repository\CategoryRepository;
use App\Repository\MonthlyBudgetRepository;
use App\Repository\SubscriptionRepository;
use App\Repository\TransactionRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

/**
 * Fournit au moteur NLP frontend toutes les données nécessaires
 * en un seul appel, sérialisées de façon plate (pas d'IRIs API Platform).
 *
 * Route : GET /api/ai-search/context
 */
#[Route('/api/ai-search', name: 'api_ai_search_')]
class AiSearchContextController extends AbstractController
{
    public function __construct(
        private readonly TransactionRepository    $transactionRepo,
        private readonly SubscriptionRepository   $subscriptionRepo,
        private readonly AccountRepository        $accountRepo,
        private readonly MonthlyBudgetRepository  $budgetRepo,
        private readonly CategoryRepository       $categoryRepo,
    ) {}

    /**
     * Retourne le contexte complet pour le moteur NLP.
     *
     * Query params optionnels :
     *   - tx_months : nombre de mois de transactions à inclure (défaut 12)
     */
    #[Route('/context', name: 'context', methods: ['GET'])]
    public function context(Request $request): JsonResponse
    {
        $txMonths = max(1, min(36, (int) ($request->query->get('tx_months', 12))));

        // ── Transactions (N derniers mois) ─────────────────────────────
        $transactions = $this->buildTransactions($txMonths);

        // ── Abonnements ────────────────────────────────────────────────
        $subscriptions = $this->buildSubscriptions();

        // ── Comptes ────────────────────────────────────────────────────
        $accounts = $this->buildAccounts();

        // ── Budgets mensuels (année en cours + précédente) ─────────────
        $budgets = $this->buildBudgets();

        // ── Catégories ─────────────────────────────────────────────────
        $categories = $this->buildCategories();

        return $this->json([
            'transactions'   => $transactions,
            'subscriptions'  => $subscriptions,
            'accounts'       => $accounts,
            'monthlyBudgets' => $budgets,
            'categories'     => $categories,
        ]);
    }

    // ── Builders privés ────────────────────────────────────────────────

    private function buildTransactions(int $months): array
    {
        $now      = new \DateTimeImmutable();
        $fromDate = $now->modify("-{$months} months");
        $fromYear  = (int) $fromDate->format('Y');
        $fromMonth = (int) $fromDate->format('n');
        $toYear    = (int) $now->format('Y');
        $toMonth   = (int) $now->format('n');

        // On agrège toutes les transactions de tous les comptes sur la plage
        $all = [];
        $accounts = $this->accountRepo->findAllOrderedByName();
        foreach ($accounts as $account) {
            $txs = $this->transactionRepo->findByAccountAndRange(
                $account->getId(),
                $fromYear, $fromMonth,
                $toYear, $toMonth,
            );
            foreach ($txs as $t) {
                $all[] = [
                    'id'              => $t->getId(),
                    'label'           => $t->getLabel(),
                    'amount'          => $t->getAmount(),
                    'type'            => $t->getType(),
                    'transactionDate' => $t->getTransactionDate()->format('Y-m-d'),
                    'year'            => $t->getYear(),
                    'month'           => $t->getMonth(),
                    'category' => [
                        'id'              => $t->getCategory()->getId(),
                        'name'            => $t->getCategory()->getName(),
                        'transactionType' => $t->getCategory()->getTransactionType(),
                    ],
                    'account' => [
                        'id'   => $t->getAccount()->getId(),
                        'name' => $t->getAccount()->getName(),
                    ],
                ];
            }
        }

        // Trier par date décroissante
        usort($all, fn($a, $b) => strcmp($b['transactionDate'], $a['transactionDate']));

        return $all;
    }

    private function buildSubscriptions(): array
    {
        $subs = $this->subscriptionRepo->findAllWithRelations();
        $result = [];
        foreach ($subs as $s) {
            $result[] = [
                'id'         => $s->getId(),
                'name'       => $s->getName(),
                'amount'     => $s->getAmount(),
                'frequency'  => $s->getFrequency(),
                'status'     => $s->getStatus(),
                'startDate'  => $s->getStartDate()->format('Y-m-d'),
                'endDate'    => $s->getEndDate()?->format('Y-m-d'),
                'notes'      => $s->getNotes(),
                'category'   => [
                    'name'            => $s->getCategory()->getName(),
                    'transactionType' => $s->getCategory()->getTransactionType(),
                ],
                'account'    => [
                    'id'   => $s->getAccount()->getId(),
                    'name' => $s->getAccount()->getName(),
                ],
            ];
        }
        return $result;
    }

    private function buildAccounts(): array
    {
        $accounts = $this->accountRepo->findAllOrderedByName();
        $result = [];
        foreach ($accounts as $a) {
            $result[] = [
                'id'       => $a->getId(),
                'name'     => $a->getName(),
                'type'     => $a->getType(),
                'balance'  => $a->getBalance(),
                'currency' => $a->getCurrency(),
            ];
        }
        return $result;
    }

    private function buildBudgets(): array
    {
        $now       = new \DateTimeImmutable();
        $thisYear  = (int) $now->format('Y');
        $prevYear  = $thisYear - 1;

        // On prend l'année courante + la précédente
        $result = [];
        foreach ([$prevYear, $thisYear] as $year) {
            for ($month = 1; $month <= 12; $month++) {
                $lines = $this->budgetRepo->findByPeriod($year, $month);
                foreach ($lines as $b) {
                    $result[] = [
                        'id'            => $b->getId(),
                        'year'          => $b->getYear(),
                        'month'         => $b->getMonth(),
                        'plannedAmount' => $b->getPlannedAmount(),
                        'actualAmount'  => $b->getActualAmount(),
                        'label'         => $b->getLabel(),
                        'isApproved'    => $b->isApproved(),
                        'category' => [
                            'name'            => $b->getCategory()->getName(),
                            'transactionType' => $b->getCategory()->getTransactionType(),
                        ],
                        'account' => $b->getAccount() ? [
                            'id'   => $b->getAccount()->getId(),
                            'name' => $b->getAccount()->getName(),
                        ] : null,
                    ];
                }
            }
        }
        return $result;
    }

    private function buildCategories(): array
    {
        // On prend toutes les catégories (income + expense + transfer)
        $cats   = array_merge(
            $this->categoryRepo->findByTransactionType('income'),
            $this->categoryRepo->findByTransactionType('expense'),
            $this->categoryRepo->findByTransactionType('transfer'),
        );
        $result = [];
        foreach ($cats as $c) {
            $result[] = [
                'id'              => $c->getId(),
                'name'            => $c->getName(),
                'transactionType' => $c->getTransactionType(),
                'frequency'       => $c->getFrequency(),
            ];
        }
        return $result;
    }
}
