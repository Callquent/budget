<?php

namespace App\Controller;

use App\Entity\Budget;
use App\Repository\AccountRepository;
use App\Repository\CategoryRepository;
use App\Service\Ocr\OcrServiceInterface;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/ocr', name: 'ocr_')]
class OcrController extends AbstractController
{
    public function __construct(
        private readonly OcrServiceInterface $ocrService,
        private readonly EntityManagerInterface $em
    ) {}

    /**
     * Analyse une image de ticket pour en extraire le montant total.
     * Route: POST /ocr/analyze
     */
    #[Route('/analyze', name: 'analyze', methods: ['POST'])]
    public function analyze(Request $request): JsonResponse
    {
        /** @var UploadedFile|null $file */
        $file = $request->files->get('file');

        if (!$file) {
            return $this->json(['error' => 'Aucun fichier image n\'a été fourni.'], Response::HTTP_BAD_REQUEST);
        }

        $total = $this->ocrService->extractTotal($file);

        if ($total === null) {
            return $this->json(['error' => 'Impossible d\'extraire le montant total du ticket.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        return $this->json(['total' => $total]);
    }

    /**
     * Importe la ligne de budget après validation du montant et choix des options.
     * Route: POST /ocr/import
     */
    #[Route('/import', name: 'import', methods: ['POST'])]
    public function import(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);

        if (!$data) {
            return $this->json(['error' => 'Corps JSON invalide.'], Response::HTTP_BAD_REQUEST);
        }

        $required = ['total', 'accountId', 'categoryId', 'year', 'month'];
        foreach ($required as $field) {
            if (!isset($data[$field])) {
                return $this->json(['error' => "Le champ '$field' est requis."], Response::HTTP_BAD_REQUEST);
            }
        }

        $budget = new Budget();
        $this->hydrateBudget($budget, $data);

        // Le montant prévu et réalisé sont identiques pour un import OCR
        $budget->setPlannedAmount($data['total']);
        $budget->setActualAmount($data['total']);

        $this->em->persist($budget);
        $this->em->flush();

        return $this->json($budget, Response::HTTP_CREATED, [], ['groups' => ['budget:read', 'account:read', 'category:read']]);
    }

    private function hydrateBudget(Budget $budget, array $data): void
    {
        $categoryRepo = $this->em->getRepository(CategoryRepository::class);
        $accountRepo  = $this->em->getRepository(AccountRepository::class);

        $budget->setLabel($data['label'] ?? 'Import OCR');
        $budget->setCategory($categoryRepo->find($data['categoryId']));
        $budget->setAccount(!empty($data['accountId']) ? $accountRepo->find($data['accountId']) : null);
        $budget->setYear((int) $data['year']);
        $budget->setMonth((int) $data['month']);
    }
}
