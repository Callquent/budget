<?php

namespace App\Controller;

use App\Entity\Transaction;
use App\Repository\AccountRepository;
use App\Repository\CategoryRepository;
use App\Repository\BudgetRepository;
use App\Repository\TransactionRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Serializer\SerializerInterface;

#[Route('/transactions', name: 'transaction_')]
class TransactionController extends AbstractController
{
    public function __construct(private SerializerInterface $serializer) {}

    #[Route('/{year}/{month}', name: 'by_month', methods: ['GET'], requirements: ['year' => '\d{4}', 'month' => '\d{1,2}'])]
    public function byMonth(
        TransactionRepository $repo,
        AccountRepository $accountRepo,
        int $year,
        int $month
    ): Response {
        $now          = new \DateTimeImmutable();
        $transactions = $repo->findByPeriod($year, $month);
        $accounts     = $accountRepo->findAllOrderedByName();

        $totalCredit  = 0.0;
        $totalDebit   = 0.0;
        $byAccountMap = [];

        foreach ($accounts as $account) {
            $byAccountMap[$account->getId()] = [
                'account'      => $account,
                'credit'       => 0.0,
                'debit'        => 0.0,
                'balanceEnd'   => (float) $account->getBalance(),
                'transactions' => [],
            ];
        }

        foreach ($transactions as $tx) {
            $aid    = $tx->getAccount()->getId();
            $amount = (float) $tx->getAmount();

            if ($tx->getType() === 'credit') {
                $totalCredit += $amount;
                $byAccountMap[$aid]['credit'] += $amount;
                $byAccountMap[$aid]['balanceEnd'] += $amount;
            } else {
                $totalDebit += $amount;
                $byAccountMap[$aid]['debit'] += $amount;
                $byAccountMap[$aid]['balanceEnd'] -= $amount;
            }

            $byAccountMap[$aid]['transactions'][] = $tx;
        }

        return $this->json([
            'year'         => $year,
            'month'        => $month,
            'nowYear'      => (int) $now->format('Y'),
            'nowMonth'     => (int) $now->format('n'),
            'totalCredit'  => $totalCredit,
            'totalDebit'   => $totalDebit,
            'byAccount'    => array_values($byAccountMap),
            'transactions' => $transactions,
        ], 200, [], ['groups' => ['transaction:read', 'account:read', 'category:read']]);
    }

    #[Route('/new', name: 'new', methods: ['POST'])]
    public function new(
        Request $request,
        EntityManagerInterface $em,
        AccountRepository $accountRepo,
        CategoryRepository $categoryRepo,
        BudgetRepository $budgetRepo
    ): Response {
        $data        = json_decode($request->getContent(), true);
        $transaction = new Transaction();
        $this->hydrate($transaction, $data, $accountRepo, $categoryRepo);

        $em->persist($transaction);
        $em->flush();
        $budgetRepo->refreshActualAmounts($transaction->getYear(), $transaction->getMonth());

        return $this->json($transaction, 201, [], ['groups' => ['transaction:read', 'account:read', 'category:read']]);
    }

    #[Route('/{id}', name: 'show', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function show(Transaction $transaction): Response
    {
        return $this->json($transaction, 200, [], ['groups' => ['transaction:read', 'account:read', 'category:read']]);
    }

    #[Route('/{id}/edit', name: 'edit', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function edit(
        Transaction $transaction,
        Request $request,
        EntityManagerInterface $em,
        AccountRepository $accountRepo,
        CategoryRepository $categoryRepo,
        BudgetRepository $budgetRepo
    ): Response {
        $oldYear  = $transaction->getYear();
        $oldMonth = $transaction->getMonth();

        $data = json_decode($request->getContent(), true);
        $this->hydrate($transaction, $data, $accountRepo, $categoryRepo);
        $em->flush();

        $budgetRepo->refreshActualAmounts($oldYear, $oldMonth);
        if ($oldYear !== $transaction->getYear() || $oldMonth !== $transaction->getMonth()) {
            $budgetRepo->refreshActualAmounts($transaction->getYear(), $transaction->getMonth());
        }

        return $this->json($transaction, 200, [], ['groups' => ['transaction:read', 'account:read', 'category:read']]);
    }

    #[Route('/{id}/delete', name: 'delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function delete(
        Transaction $transaction,
        EntityManagerInterface $em,
        BudgetRepository $budgetRepo
    ): Response {
        $year  = $transaction->getYear();
        $month = $transaction->getMonth();

        $em->remove($transaction);
        $em->flush();
        $budgetRepo->refreshActualAmounts($year, $month);

        return $this->json(['year' => $year, 'month' => $month]);
    }

    private function hydrate(
        Transaction $tx,
        array $data,
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
        if (isset($data['type']))   { $tx->setType($data['type']); }
        if (isset($data['amount'])) { $tx->setAmount((string) $data['amount']); }
        if (array_key_exists('label', $data)) { $tx->setLabel($data['label'] ?: ''); }
        if (array_key_exists('notes', $data)) { $tx->setNotes($data['notes'] ?: null); }
    }
}
