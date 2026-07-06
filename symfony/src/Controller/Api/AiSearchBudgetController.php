<?php

namespace App\Controller\Api;

use App\Entity\Budget;
use App\Repository\AccountRepository;
use App\Repository\CategoryRepository;
use App\Repository\BudgetRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

/**
 * POST /api/ai-search/budget
 *
 * Crée une nouvelle ligne de budget mensuel depuis l'assistant IA.
 * Body JSON :
 * {
 *   "categoryId": 3,
 *   "year": 2026,
 *   "month": 7,
 *   "plannedAmount": "200.00",
 *   "label": "Optionnel",
 *   "accountId": 1   // optionnel
 * }
 */
#[Route('/api/ai-search', name: 'api_ai_search_')]
class AiSearchBudgetController extends AbstractController
{
    public function __construct(
        private readonly CategoryRepository      $categoryRepo,
        private readonly AccountRepository       $accountRepo,
        private readonly BudgetRepository $budgetRepo,
        private readonly EntityManagerInterface  $em,
    ) {}

    #[Route('/budget', name: 'budget_add', methods: ['POST'])]
    public function addBudget(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);

        if (!$data) {
            return $this->json(['error' => 'Corps JSON invalide.'], Response::HTTP_BAD_REQUEST);
        }

        // ── Validation ─────────────────────────────────────────────────

        $categoryId    = $data['categoryId'] ?? null;
        $year          = isset($data['year'])  ? (int) $data['year']  : null;
        $month         = isset($data['month']) ? (int) $data['month'] : null;
        $plannedAmount = $data['plannedAmount'] ?? null;

        if (!$categoryId || !$year || !$month || $plannedAmount === null) {
            return $this->json([
                'error' => 'Champs obligatoires manquants : categoryId, year, month, plannedAmount.',
            ], Response::HTTP_BAD_REQUEST);
        }

        if ($month < 1 || $month > 12) {
            return $this->json(['error' => 'Mois invalide (1-12).'], Response::HTTP_BAD_REQUEST);
        }

        if ((float) $plannedAmount < 0) {
            return $this->json(['error' => 'Le montant prévu doit être positif.'], Response::HTTP_BAD_REQUEST);
        }

        // ── Récupération des entités ────────────────────────────────────

        $category = $this->categoryRepo->find($categoryId);
        if (!$category) {
            return $this->json(['error' => "Catégorie introuvable (id={$categoryId})."], Response::HTTP_NOT_FOUND);
        }

        $account = null;
        if (!empty($data['accountId'])) {
            $account = $this->accountRepo->find((int) $data['accountId']);
            if (!$account) {
                return $this->json(['error' => "Compte introuvable (id={$data['accountId']})."], Response::HTTP_NOT_FOUND);
            }
        }

        // ── Vérification doublon ────────────────────────────────────────

        $label = isset($data['label']) && $data['label'] !== '' ? $data['label'] : null;

        $existing = $this->budgetRepo->findOneBy([
            'category' => $category,
            'year'     => $year,
            'month'    => $month,
            'label'    => $label,
        ]);

        if ($existing) {
            return $this->json([
                'error' => "Une ligne budget existe déjà pour {$category->getName()} — {$month}/{$year}.",
                'existing' => [
                    'id'            => $existing->getId(),
                    'plannedAmount' => $existing->getPlannedAmount(),
                ],
            ], Response::HTTP_CONFLICT);
        }

        // ── Création ────────────────────────────────────────────────────

        $budget = new Budget();
        $budget->setCategory($category);
        $budget->setYear($year);
        $budget->setMonth($month);
        $budget->setPlannedAmount(number_format((float) $plannedAmount, 2, '.', ''));
        $budget->setLabel($label);

        if ($account) {
            $budget->setAccount($account);
        }

        $this->em->persist($budget);
        $this->em->flush();

        return $this->json([
            'id'            => $budget->getId(),
            'categoryId'    => $category->getId(),
            'categoryName'  => $category->getName(),
            'year'          => $budget->getYear(),
            'month'         => $budget->getMonth(),
            'plannedAmount' => $budget->getPlannedAmount(),
            'actualAmount'  => $budget->getActualAmount(),
            'label'         => $budget->getLabel(),
        ], Response::HTTP_CREATED);
    }
}
