<?php

namespace App\Controller;

use App\Entity\Transaction;
use App\Repository\AccountRepository;
use App\Repository\CategoryRepository;
use App\Repository\MonthlyBudgetRepository;
use App\Repository\TransactionRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/transactions', name: 'transaction_')]
class TransactionController extends AbstractController
{
    /**
     * Liste des transactions avec filtres mois/compte/catégorie.
     */
    #[Route('', name: 'index')]
    public function index(
        Request $request,
        TransactionRepository $repo,
        AccountRepository $accountRepo,
        CategoryRepository $categoryRepo
    ): Response {
        $now   = new \DateTimeImmutable();
        $year  = (int) $request->query->get('year',  $now->format('Y'));
        $month = (int) $request->query->get('month', $now->format('n'));

        $transactions = $repo->findByPeriod($year, $month);

        // Mouvements cumulés par compte JUSQU'AU mois affiché inclus
        // Solde fin mois M = balance_de_base + net(jan..M)
        $cumulativeMovements = $repo->findMovementsUpToPeriod($year, $month);
        $cumulativeByAccount = [];
        foreach ($cumulativeMovements as $row) {
            $cumulativeByAccount[(int)$row['account_id']] = [
                'net' => (float)$row['credit'] - (float)$row['debit'],
            ];
        }

        // Totaux du mois en cours (uniquement ce mois)
        $totalCredit = 0.0;
        $totalDebit  = 0.0;

        // Totaux par compte + solde fin de mois
        $byAccount = [];
        foreach ($accountRepo->findAllOrderedByName() as $acc) {
            $aid               = $acc->getId();
            $cumulativeNet     = $cumulativeByAccount[$aid]['net'] ?? 0.0;
            // Solde fin du mois affiché = solde de base + tous les mouvements jusqu'à ce mois
            $balanceEndOfMonth = (float)$acc->getBalance() + $cumulativeNet;

            $byAccount[$aid] = [
                'account'     => $acc,
                'credit'      => 0.0,
                'debit'       => 0.0,
                'balance_end' => $balanceEndOfMonth,
            ];
        }

        foreach ($transactions as $tx) {
            if ($tx->getType() === Transaction::TYPE_CREDIT) {
                $totalCredit += (float) $tx->getAmount();
            } else {
                $totalDebit += (float) $tx->getAmount();
            }
            $aid = $tx->getAccount()->getId();
            if (!isset($byAccount[$aid])) {
                $cumulativeNet = $cumulativeByAccount[$aid]['net'] ?? 0.0;
                $byAccount[$aid] = [
                    'account'     => $tx->getAccount(),
                    'credit'      => 0.0,
                    'debit'       => 0.0,
                    'balance_end' => (float)$tx->getAccount()->getBalance() + $cumulativeNet,
                ];
            }
            $byAccount[$aid][$tx->getType() === Transaction::TYPE_CREDIT ? 'credit' : 'debit'] += (float) $tx->getAmount();
        }

        // Listes pour les filtres
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

        // Regroupement des transactions par account_id (fait en PHP, pas en Twig)
        $txByAccountId = [];
        foreach ($transactions as $tx) {
            $txByAccountId[$tx->getAccount()->getId()][] = $tx;
        }

        return $this->render('transaction/index.html.twig', [
            'transactions'  => $transactions,
            'year'          => $year,
            'month'         => $month,
            'month_label'   => $months[$month] ?? '',
            'months'        => $months,
            'accounts'      => $accountRepo->findAllOrderedByName(),
            'by_account'    => $byAccount,
            'tx_by_account_id' => $txByAccountId,
            'total_credit'  => $totalCredit,
            'total_debit'   => $totalDebit,
        ]);
    }

    #[Route('/{year}/{month}', name: 'by_month', methods: ['GET'], requirements: ['year' => '\d{4}', 'month' => '\d{1,2}'])]
    public function byMonth(
        TransactionRepository $repo,
        AccountRepository $accountRepo,
        int $year,
        int $month
    ): Response {
        $now = new \DateTimeImmutable();
        $transactions = $repo->findByPeriod($year, $month);
        $accounts = $accountRepo->findAllOrderedByName();

        $totalCredit = 0.0;
        $totalDebit  = 0.0;
        $byAccountMap = [];

        foreach ($accounts as $account) {
            $byAccountMap[$account->getId()] = [
                'account'      => [
                    'id'       => $account->getId(),
                    'name'     => $account->getName(),
                    'type'     => $account->getType(),
                    'currency' => '€',
                    'balance'  => (float) $account->getBalance(),
                ],
                'credit'       => 0.0,
                'debit'        => 0.0,
                'balanceEnd'   => (float) $account->getBalance(),
                'transactions' => [],
            ];
        }

        $txAll = [];
        foreach ($transactions as $tx) {
            $aid    = $tx->getAccount()->getId();
            $amount = (float) $tx->getAmount();
            $type   = $tx->getType(); // 'credit' ou 'debit'

            if ($type === 'credit') {
                $totalCredit += $amount;
                $byAccountMap[$aid]['credit'] += $amount;
                $byAccountMap[$aid]['balanceEnd'] += $amount;
            } else {
                $totalDebit += $amount;
                $byAccountMap[$aid]['debit'] += $amount;
                $byAccountMap[$aid]['balanceEnd'] -= $amount;
            }

            $txData = [
                'id'              => $tx->getId(),
                'transactionDate' => $tx->getTransactionDate()->format('Y-m-d'),
                'label'           => $tx->getLabel(),
                'type'            => $type,
                'amount'          => $amount,
                'notes'           => $tx->getNotes(),
                'category'        => [
                    'name'            => $tx->getCategory()->getName(),
                    'transactionType' => $tx->getCategory()->getTransactionType(),
                ],
                'account'         => ['name' => $tx->getAccount()->getName()],
            ];

            $byAccountMap[$aid]['transactions'][] = $txData;
            $txAll[] = $txData;
        }

        return $this->json([
            'year'         => $year,
            'month'        => $month,
            'nowYear'      => (int) $now->format('Y'),
            'nowMonth'     => (int) $now->format('n'),
            'totalCredit'  => $totalCredit,
            'totalDebit'   => $totalDebit,
            'byAccount'    => array_values($byAccountMap),
            'transactions' => $txAll,
        ]);
    }

    #[Route('/new', name: 'new', methods: ['POST'])]
    public function new(
        Request $request,
        EntityManagerInterface $em,
        AccountRepository $accountRepo,
        CategoryRepository $categoryRepo,
        MonthlyBudgetRepository $budgetRepo
    ): Response {
        $data = json_decode($request->getContent(), true);

        $transaction = new Transaction();
        $this->hydrate($transaction, $data, $em, $accountRepo, $categoryRepo);

        $em->persist($transaction);
        $em->flush();

        $budgetRepo->refreshActualAmounts($transaction->getYear(), $transaction->getMonth());

        return $this->json($this->serializeTransaction($transaction), 201);
    }

    #[Route('/{id}', name: 'show', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function show(Transaction $transaction): Response
    {
        return $this->json($this->serializeTransaction($transaction));
    }

    #[Route('/{id}/edit', name: 'edit', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function edit(
        Transaction $transaction,
        Request $request,
        EntityManagerInterface $em,
        AccountRepository $accountRepo,
        CategoryRepository $categoryRepo,
        MonthlyBudgetRepository $budgetRepo
    ): Response {
        $oldYear  = $transaction->getYear();
        $oldMonth = $transaction->getMonth();

        $data = json_decode($request->getContent(), true);
        $this->hydrate($transaction, $data, $em, $accountRepo, $categoryRepo);

        $em->flush();

        // Recalcule l'ancien mois ET le nouveau si la date a changé
        $budgetRepo->refreshActualAmounts($oldYear, $oldMonth);
        if ($oldYear !== $transaction->getYear() || $oldMonth !== $transaction->getMonth()) {
            $budgetRepo->refreshActualAmounts($transaction->getYear(), $transaction->getMonth());
        }

        return $this->json($this->serializeTransaction($transaction));
    }

    #[Route('/{id}/delete', name: 'delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function delete(
        Transaction $transaction,
        EntityManagerInterface $em,
        MonthlyBudgetRepository $budgetRepo
    ): Response {
        $year  = $transaction->getYear();
        $month = $transaction->getMonth();

        $em->remove($transaction);
        $em->flush();
        $budgetRepo->refreshActualAmounts($year, $month);

        return $this->json(['year' => $year, 'month' => $month]);
    }

    // -------------------------------------------------------------------------
    // Helpers privés
    // -------------------------------------------------------------------------

    private function hydrate(
        Transaction $tx,
        array $data,
        EntityManagerInterface $em,
        AccountRepository $accountRepo,
        CategoryRepository $categoryRepo
    ): void {
        if (!empty($data['transactionDate'])) {
            $tx->setTransactionDate(new \DateTimeImmutable($data['transactionDate']));
        }
        if (!empty($data['accountId'])) {
            $tx->setAccount($accountRepo->find((int) $data['accountId']));
        }
        if (!empty($data['categoryId'])) {
            $tx->setCategory($categoryRepo->find((int) $data['categoryId']));
        }
        if (isset($data['type'])) {
            $tx->setType($data['type']);
        }
        if (isset($data['amount'])) {
            $tx->setAmount((string) $data['amount']);
        }
        if (array_key_exists('label', $data)) {
            $tx->setLabel($data['label'] ?: null);
        }
        if (array_key_exists('notes', $data)) {
            $tx->setNotes($data['notes'] ?: null);
        }
    }

    private function serializeTransaction(Transaction $tx): array
    {
        return [
            'id'              => $tx->getId(),
            'transactionDate' => $tx->getTransactionDate()->format('Y-m-d'),
            'label'           => $tx->getLabel(),
            'notes'           => $tx->getNotes(),
            'type'            => $tx->getType(),
            'amount'          => (float) $tx->getAmount(),
            'year'            => $tx->getYear(),
            'month'           => $tx->getMonth(),
            'accountId'       => $tx->getAccount()?->getId(),
            'accountName'     => $tx->getAccount()?->getName(),
            'categoryId'      => $tx->getCategory()?->getId(),
            'categoryName'    => $tx->getCategory()?->getName(),
            'categoryType'    => $tx->getCategory()?->getTransactionType(),
        ];
    }
}
