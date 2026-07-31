<?php

namespace App\Controller;

use App\Entity\Category;
use App\Form\CategoryType;
use App\Repository\CategoryRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Serializer\SerializerInterface;

#[Route('/categories', name: 'category_')]
class CategoryController extends AbstractController
{
    public function __construct(private SerializerInterface $serializer) {}

    #[Route('', name: 'index', methods: ['GET'])]
    public function index(CategoryRepository $repo): Response
    {
        // Auto-provisioning : garantit qu'une catégorie Virement existe
        // toujours, sans action manuelle de l'utilisateur.
        $repo->findOrCreateTransferCategory();

        $categories = $repo->findBy([], ['transactionType' => 'ASC', 'name' => 'ASC']);

        $grouped = [];
        foreach ($categories as $cat) {
            $grouped[$cat->getTransactionType()][] = $cat;
        }

        return $this->json(['grouped' => $grouped], 200, [], ['groups' => ['category:read']]);
    }

    #[Route('/options', name: 'options', methods: ['GET'])]
    public function options(): Response
    {
        $transactionTypes = array_map(
            fn($label, $value) => ['value' => $value, 'label' => $label],
            array_keys(CategoryType::getTransactionTypeChoices()),
            CategoryType::getTransactionTypeChoices()
        );

        return $this->json(compact('transactionTypes'));
    }

    #[Route('/new', name: 'new', methods: ['POST'])]
    public function new(Request $request, EntityManagerInterface $em, CategoryRepository $repo): Response
    {
        $data = json_decode($request->getContent(), true);

        if ($error = $this->validatePayload($data)) {
            return $this->json(['error' => $error], 400);
        }

        if ($error = $this->assertTransferUnique($data['transactionType'], $repo, null)) {
            return $this->json(['error' => $error], 409);
        }

        $category = new Category();
        $category->setName(trim($data['name']));
        $category->setTransactionType($data['transactionType']);
        $category->setDescription($data['description'] ?? null);

        try {
            $category->setParent($this->resolveParent($data['parentId'] ?? null, $repo, $category));
        } catch (\InvalidArgumentException $e) {
            return $this->json(['error' => $e->getMessage()], 400);
        }

        $em->persist($category);
        $em->flush();

        return $this->json($category, 201, [], ['groups' => ['category:read']]);
    }

    #[Route('/{id}', name: 'show', methods: ['GET'])]
    public function show(Category $category): Response
    {
        return $this->json($category, 200, [], ['groups' => ['category:read']]);
    }

    #[Route('/{id}/edit', name: 'edit', methods: ['POST'])]
    public function edit(Category $category, Request $request, EntityManagerInterface $em, CategoryRepository $repo): Response
    {
        $data = json_decode($request->getContent(), true);

        if ($error = $this->validatePayload($data)) {
            return $this->json(['error' => $error], 400);
        }

        if ($error = $this->assertTransferUnique($data['transactionType'], $repo, $category)) {
            return $this->json(['error' => $error], 409);
        }

        $category->setName(trim($data['name']));
        $category->setTransactionType($data['transactionType']);
        $category->setDescription($data['description'] ?? null);

        if (array_key_exists('parentId', $data)) {
            try {
                $category->setParent($this->resolveParent($data['parentId'], $repo, $category));
            } catch (\InvalidArgumentException $e) {
                return $this->json(['error' => $e->getMessage()], 400);
            }
        }

        $em->flush();

        return $this->json($category, 200, [], ['groups' => ['category:read']]);
    }

    // Endpoint dédié au drag & drop de /categories : déplace une catégorie sous une autre
    // (ou la remonte au premier niveau si parentId est null), sans toucher au reste de ses champs.
    #[Route('/{id}/move', name: 'move', methods: ['POST'])]
    public function move(Category $category, Request $request, EntityManagerInterface $em, CategoryRepository $repo): Response
    {
        $data = json_decode($request->getContent(), true);

        try {
            $category->setParent($this->resolveParent($data['parentId'] ?? null, $repo, $category));
        } catch (\InvalidArgumentException $e) {
            return $this->json(['error' => $e->getMessage()], 400);
        }

        $em->flush();

        return $this->json($category, 200, [], ['groups' => ['category:read']]);
    }

    #[Route('/{id}/delete', name: 'delete', methods: ['DELETE'])]
    public function delete(Category $category, EntityManagerInterface $em): Response
    {
        $em->remove($category);
        $em->flush();

        return $this->json(['deleted' => true]);
    }

    // Valide le payload JSON reçu sur /new et /{id}/edit : json_decode qui échoue
    // ou renvoie autre chose qu'un tableau (payload absent/malformé), nom vide,
    // et type de transaction hors de l'énumération attendue.
    private function validatePayload(mixed $data): ?string
    {
        if (!is_array($data)) {
            return 'Requête invalide.';
        }

        if (!isset($data['name']) || !is_string($data['name']) || trim($data['name']) === '') {
            return 'Le nom de la catégorie est obligatoire.';
        }

        $validTypes = [Category::TYPE_INCOME, Category::TYPE_EXPENSE, Category::TYPE_TRANSFER];
        if (!isset($data['transactionType']) || !in_array($data['transactionType'], $validTypes, true)) {
            return 'Type de transaction invalide.';
        }

        return null;
    }

    // Empêche qu'une deuxième catégorie de type Virement voie le jour, que ce
    // soit via /new ou via /{id}/edit (en changeant le type d'une catégorie
    // existante vers "transfer"). Une seule catégorie Virement doit exister
    // — voir CategoryRepository::findOrCreateTransferCategory, qui la
    // retrouve par transactionType et suppose son unicité.
    private function assertTransferUnique(string $transactionType, CategoryRepository $repo, ?Category $current): ?string
    {
        if ($transactionType !== Category::TYPE_TRANSFER) {
            return null;
        }

        $existing = $repo->findOneBy(['transactionType' => Category::TYPE_TRANSFER]);
        if ($existing && $existing->getId() !== $current?->getId()) {
            return 'Une catégorie de virement existe déjà, elle ne peut pas être dupliquée.';
        }

        return null;
    }

    // Résout et valide la catégorie parente : refuse un parent inexistant, une catégorie
    // comme parente d'elle-même, ou un de ses propres descendants (créerait une boucle).
    private function resolveParent(?int $parentId, CategoryRepository $repo, Category $category): ?Category
    {
        if ($parentId === null) {
            return null;
        }

        if ($parentId === $category->getId()) {
            throw new \InvalidArgumentException('Une catégorie ne peut pas être sa propre sous-catégorie.');
        }

        $parent = $repo->find($parentId);
        if (!$parent) {
            throw new \InvalidArgumentException('Catégorie parente introuvable.');
        }

        if ($category->getId() !== null) {
            $ancestor = $parent;
            while ($ancestor !== null) {
                if ($ancestor->getId() === $category->getId()) {
                    throw new \InvalidArgumentException('Déplacement impossible : créerait une boucle.');
                }
                $ancestor = $ancestor->getParent();
            }
        }

        return $parent;
    }
}
