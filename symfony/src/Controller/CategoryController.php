<?php

namespace App\Controller;

use App\Entity\Category;
use App\Repository\CategoryRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/categories', name: 'category_')]
class CategoryController extends AbstractController
{
    #[Route('', name: 'index', methods: ['GET'])]
    public function index(CategoryRepository $repo): Response
    {
        $categories = $repo->findBy([], ['transactionType' => 'ASC', 'name' => 'ASC']);

        // Regrouper par type, en sérialisant chaque catégorie
        $grouped = [];
        foreach ($categories as $cat) {
            $grouped[$cat->getTransactionType()][] = $this->serialize($cat);
        }

        return $this->json(['grouped' => $grouped]);
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

        return $this->json($this->serialize($category), 201);
    }

    #[Route('/{id}', name: 'show', methods: ['GET'])]
    public function show(Category $category): Response
    {
        return $this->json($this->serialize($category));
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

        return $this->json($this->serialize($category));
    }

    #[Route('/{id}/delete', name: 'delete', methods: ['DELETE'])]
    public function delete(Category $category, EntityManagerInterface $em): Response
    {
        $em->remove($category);
        $em->flush();

        return $this->json(['deleted' => true]);
    }

    private function serialize(Category $c): array
    {
        return [
            'id'              => $c->getId(),
            'name'            => $c->getName(),
            'transactionType' => $c->getTransactionType(),
            'frequency'       => $c->getFrequency(),
            'description'     => $c->getDescription(),
        ];
    }
}
