<?php

namespace App\Controller;

use App\Entity\Transaction;
use App\Repository\AccountRepository;
use App\Repository\CategoryRepository;
use App\Repository\MonthlyBudgetRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/ocr', name: 'ocr_')]
class OcrController extends AbstractController
{
    #[Route('/receipt', name: 'receipt_from_ocr', methods: ['POST'])]
    public function receiptFromOcr(
        Request $request,
        EntityManagerInterface $em,
        AccountRepository $accountRepo,
        CategoryRepository $categoryRepo,
        MonthlyBudgetRepository $budgetRepo
    ): Response {
        $data = json_decode($request->getContent(), true);
        
        // Validation des données
        if (!isset($data['amount']) || !is_numeric($data['amount']) || (float) $data['amount'] <= 0) {
            return $this->json(['error' => 'Le montant est requis et doit être supérieur à 0'], 400);
        }
        
        if (!isset($data['year']) || !isset($data['month'])) {
            return $this->json(['error' => 'L\'année et le mois sont requis'], 400);
        }
        
        // Créer la transaction
        $transaction = new Transaction();
        $amount = (float) $data['amount'];
        $year = (int) $data['year'];
        $month = (int) $data['month'];
        
        // Définir la date comme le premier jour du mois si non spécifiée
        $dateStr = $data['transactionDate'] ?? "{$year}-{$month}-01";
        $transaction->setTransactionDate(new \DateTimeImmutable($dateStr));
        
        // Trouver un compte par défaut (le premier disponible)
        $defaultAccount = $accountRepo->findOneBy([]);
        if (!$defaultAccount) {
            return $this->json(['error' => 'Aucun compte trouvé'], 400);
        }
        $transaction->setAccount($defaultAccount);
        
        // Trouver une catégorie par défaut pour les dépenses (ex: "Courses")
        $defaultCategory = $categoryRepo->findOneBy([
            'transactionType' => 'expense',
            'name' => 'Courses'
        ]) ?? $categoryRepo->findOneBy(['transactionType' => 'expense']);
        
        if (!$defaultCategory) {
            $defaultCategory = $categoryRepo->findOneBy([]);
        }
        $transaction->setCategory($defaultCategory);
        
        // Définir les autres champs
        $transaction->setAmount((string) $amount);
        $transaction->setType('debit'); // Par défaut, c'est une dépense
        $transaction->setLabel($data['label'] ?? 'Ticket de caisse');
        $transaction->setNotes($data['notes'] ?? null);
        
        $em->persist($transaction);
        $em->flush();
        $budgetRepo->refreshActualAmounts($transaction->getYear(), $transaction->getMonth());

        return $this->json($transaction, 201, [], ['groups' => ['transaction:read', 'account:read', 'category:read']]);
    }
}
