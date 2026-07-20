<?php

namespace App\Controller;

use App\Entity\Account;
use App\Entity\Budget;
use App\Entity\Category;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/ocr', name: 'ocr_')]
class OcrController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $em
    ) {}

    /**
     * Crée une ligne de budget à partir d'un ticket scanné côté client
     * (montant, compte et catégorie déjà validés par l'utilisateur dans le popup OCR).
     * Route: POST /ocr/receipt
     */
    #[Route('/receipt', name: 'receipt', methods: ['POST'])]
    public function receipt(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);

        if (!$data) {
            return $this->json(['error' => 'Corps JSON invalide.'], Response::HTTP_BAD_REQUEST);
        }

        $required = ['amount', 'accountId', 'categoryId', 'year', 'month'];
        foreach ($required as $field) {
            if (!isset($data[$field])) {
                return $this->json(['error' => "Le champ '$field' est requis."], Response::HTTP_BAD_REQUEST);
            }
        }

        $budget = new Budget();
        $this->hydrateBudget($budget, $data);

        // Le montant prévu et réalisé sont identiques pour un import OCR
        $budget->setPlannedAmount((string) $data['amount']);
        $budget->setActualAmount((string) $data['amount']);

        $this->em->persist($budget);
        $this->em->flush();

        return $this->json($budget, Response::HTTP_CREATED, [], ['groups' => ['budget:read', 'account:read', 'category:read']]);
    }

    private function hydrateBudget(Budget $budget, array $data): void
    {
        $categoryRepo = $this->em->getRepository(Category::class);
        $accountRepo  = $this->em->getRepository(Account::class);

        $budget->setLabel($data['label'] ?? 'Ticket de caisse');
        $budget->setCategory($categoryRepo->find($data['categoryId']));
        $budget->setAccount(!empty($data['accountId']) ? $accountRepo->find($data['accountId']) : null);
        $budget->setYear((int) $data['year']);
        $budget->setMonth((int) $data['month']);
    }
}
