<?php

namespace App\Controller;

use App\Entity\MonthlyBudget;
use App\Repository\AccountRepository;
use App\Repository\CategoryRepository;
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
        CategoryRepository $categoryRepo
    ): Response {
        $data = json_decode($request->getContent(), true);

        // Validation des données
        if (!isset($data['amount']) || !is_numeric($data['amount']) || (float) $data['amount'] <= 0) {
            return $this->json(['error' => 'Le montant est requis et doit être supérieur à 0'], 400);
        }

        if (!isset($data['year']) || !isset($data['month'])) {
            return $this->json(['error' => 'L\'année et le mois sont requis'], 400);
        }

        if (!isset($data['categoryId']) || !is_numeric($data['categoryId'])) {
            return $this->json(['error' => 'La catégorie est requise'], 400);
        }

        if (!isset($data['accountId']) || !is_numeric($data['accountId'])) {
            return $this->json(['error' => 'Le compte est requis'], 400);
        }

        // Données du ticket
        $amount = (float) $data['amount'];
        $year = (int) $data['year'];
        $month = (int) $data['month'];

        $account = $accountRepo->find((int) $data['accountId']);
        if (!$account) {
            return $this->json(['error' => 'Compte invalide'], 400);
        }

        $category = $categoryRepo->find((int) $data['categoryId']);
        if (!$category || $category->getTransactionType() !== 'expense') {
            return $this->json(['error' => 'Catégorie invalide'], 400);
        }


        // Chaque ticket scanné crée toujours sa propre ligne de budget,
        // avec son propre montant (prévu = réalisé = montant du ticket).
        // On ne réutilise jamais une ligne existante : sinon plusieurs
        // tickets de la même catégorie/mois se retrouveraient regroupés
        // sur une seule ligne.
        $budget = new MonthlyBudget();
        $budget->setLabel($data['label'] ?? 'Ticket de caisse');
        $budget->setCategory($category);
        $budget->setAccount($account);
        $budget->setYear($year);
        $budget->setMonth($month);
        $budget->setPlannedAmount((string) $amount);
        $budget->setActualAmount((string) $amount);
        $em->persist($budget);

        $em->flush();

        return $this->json($budget, 201, [], ['groups' => ['budget:read', 'account:read', 'category:read']]);
    }
}
