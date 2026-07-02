<?php

namespace App\Controller;

use App\Entity\Account;
use App\Repository\AccountRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Serializer\SerializerInterface;

#[Route('/accounts', name: 'account_')]
class AccountController extends AbstractController
{
    public function __construct(private SerializerInterface $serializer) {}

    #[Route('', name: 'index', methods: ['GET'])]
    public function index(AccountRepository $repo): Response
    {
        return $this->json(
            ['accounts' => $repo->findAllOrderedByName()],
            200,
            [],
            ['groups' => ['account:read']]
        );
    }

    #[Route('/new', name: 'new', methods: ['POST'])]
    public function new(Request $request, EntityManagerInterface $em): Response
    {
        $data = json_decode($request->getContent(), true);

        $account = new Account();
        $account->setName($data['name']);
        $account->setCurrency($data['currency'] ?? 'EUR');
        $account->setBalance($data['balance'] ?? '0');

        $em->persist($account);
        $em->flush();

        return $this->json($account, 201, [], ['groups' => ['account:read']]);
    }

    #[Route('/{id}', name: 'show', methods: ['GET'])]
    public function show(Account $account): Response
    {
        return $this->json($account, 200, [], ['groups' => ['account:read']]);
    }

    #[Route('/{id}/edit', name: 'edit', methods: ['POST'])]
    public function edit(Account $account, Request $request, EntityManagerInterface $em): Response
    {
        $data = json_decode($request->getContent(), true);

        $account->setName($data['name']);
        $account->setCurrency($data['currency'] ?? 'EUR');
        $account->setBalance($data['balance'] ?? $account->getBalance());

        $em->flush();

        return $this->json($account, 200, [], ['groups' => ['account:read']]);
    }

    #[Route('/{id}/delete', name: 'delete', methods: ['DELETE'])]
    public function delete(Account $account, EntityManagerInterface $em): Response
    {
        $em->remove($account);
        $em->flush();

        return $this->json(['deleted' => true]);
    }
}
