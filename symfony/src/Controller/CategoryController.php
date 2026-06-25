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

        $frequencies = array_map(
            fn($label, $value) => ['value' => $value, 'label' => $label],
            array_keys(CategoryType::getFrequencyChoices()),
            CategoryType::getFrequencyChoices()
        );

        return $this->json(compact('transactionTypes', 'frequencies'));
    }

    #[Route('/new', name: 'new', methods: ['POST'])]
    public function new(Request $request, EntityManagerInterface $em): Response
    {
        $data = json_decode($request->getContent(), true);

        $category = new Category();
        $category->setName($data['name']);
        $category->setTransactionType($data['transactionType']);
        $category->setFrequency($data['frequency']);
        $category->setDescription($data['description'] ?? null);

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
    public function edit(Category $category, Request $request, EntityManagerInterface $em): Response
    {
        $data = json_decode($request->getContent(), true);

        $category->setName($data['name']);
        $category->setTransactionType($data['transactionType']);
        $category->setFrequency($data['frequency']);
        $category->setDescription($data['description'] ?? null);

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
}
