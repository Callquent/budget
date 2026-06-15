<?php

namespace App\Controller;

use App\Entity\Transaction;
use App\Form\TransactionType;
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

    #[Route('/new', name: 'new')]
    public function new(
        Request $request,
        EntityManagerInterface $em,
        MonthlyBudgetRepository $budgetRepo
    ): Response {
        $transaction = new Transaction();

        // Pré-remplir la date depuis l'URL si on vient d'une vue mois
        $defaultDate = null;
        if ($request->query->get('year') && $request->query->get('month')) {
            $defaultDate = \DateTimeImmutable::createFromFormat(
                'Y-n-j',
                $request->query->get('year') . '-' . $request->query->get('month') . '-1'
            );
        }

        $form = $this->createForm(TransactionType::class, $transaction, [
            'default_date' => $defaultDate ?? new \DateTimeImmutable(),
        ]);
        $form->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            $em->persist($transaction);
            $em->flush();

            // Recalcule le budget réalisé pour le mois concerné
            $budgetRepo->refreshActualAmounts($transaction->getYear(), $transaction->getMonth());

            $this->addFlash('success', sprintf(
                'Transaction « %s » ajoutée (%s %s €).',
                $transaction->getLabel(),
                $transaction->getType() === Transaction::TYPE_CREDIT ? '+' : '−',
                number_format((float) $transaction->getAmount(), 2, ',', ' ')
            ));

            // Retour vers la vue mois si on vient de là
            $ref = $request->query->get('ref');
            if ($ref === 'month') {
                return $this->redirectToRoute('monthly_budget_month', [
                    'year'  => $transaction->getYear(),
                    'month' => $transaction->getMonth(),
                ]);
            }

            return $this->redirectToRoute('transaction_index', [
                'year'  => $transaction->getYear(),
                'month' => $transaction->getMonth(),
            ]);
        }

        return $this->render('transaction/form.html.twig', [
            'form'  => $form,
            'title' => 'Nouvelle transaction',
            'transaction' => null,
        ]);
    }

    #[Route('/{id}/edit', name: 'edit')]
    public function edit(
        Transaction $transaction,
        Request $request,
        EntityManagerInterface $em,
        MonthlyBudgetRepository $budgetRepo
    ): Response {
        $oldYear  = $transaction->getYear();
        $oldMonth = $transaction->getMonth();

        $form = $this->createForm(TransactionType::class, $transaction);
        $form->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            $em->flush();

            // Recalcule l'ancien mois ET le nouveau (si la date a changé)
            $budgetRepo->refreshActualAmounts($oldYear, $oldMonth);
            if ($oldYear !== $transaction->getYear() || $oldMonth !== $transaction->getMonth()) {
                $budgetRepo->refreshActualAmounts($transaction->getYear(), $transaction->getMonth());
            }

            $this->addFlash('success', 'Transaction mise à jour.');
            return $this->redirectToRoute('transaction_index', [
                'year'  => $transaction->getYear(),
                'month' => $transaction->getMonth(),
            ]);
        }

        return $this->render('transaction/form.html.twig', [
            'form'        => $form,
            'title'       => 'Modifier la transaction',
            'transaction' => $transaction,
        ]);
    }

    #[Route('/{id}/delete', name: 'delete', methods: ['POST'])]
    public function delete(
        Transaction $transaction,
        Request $request,
        EntityManagerInterface $em,
        MonthlyBudgetRepository $budgetRepo
    ): Response {
        $year  = $transaction->getYear();
        $month = $transaction->getMonth();

        if ($this->isCsrfTokenValid('delete-tx-' . $transaction->getId(), $request->request->get('_token'))) {
            $em->remove($transaction);
            $em->flush();
            $budgetRepo->refreshActualAmounts($year, $month);
            $this->addFlash('success', 'Transaction supprimée.');
        }

        return $this->redirectToRoute('transaction_index', ['year' => $year, 'month' => $month]);
    }
}
