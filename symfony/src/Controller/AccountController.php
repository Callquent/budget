<?php

namespace App\Controller;

use App\Entity\Account;
use App\Form\AccountType;
use App\Repository\AccountRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/accounts', name: 'account_')]
class AccountController extends AbstractController
{
    #[Route('', name: 'index', methods: ['GET'])]
    public function index(AccountRepository $repo): Response
    {
        $accounts = $repo->findAllOrderedByName();

        return $this->json([
            'accounts' => array_map(
                fn(Account $a) => $this->serialize($a),
                $accounts
            ),
        ]);
    }

    #[Route('/new', name: 'new', methods: ['POST'])]
    public function new(Request $request, EntityManagerInterface $em): Response
    {
        $data = json_decode($request->getContent(), true);

        $account = new Account();
        $account->setName($data['name']);
        $account->setType($data['type']);
        $account->setCurrency($data['currency'] ?? 'EUR');
        $account->setBalance($data['balance'] ?? '0');

        $em->persist($account);
        $em->flush();

        return $this->json($this->serialize($account), 201);
    }

    #[Route('/{id}', name: 'show', methods: ['GET'])]
    public function show(Account $account): Response
    {
        return $this->json($this->serialize($account));
    }

    #[Route('/{id}/edit', name: 'edit', methods: ['POST'])]
    public function edit(Account $account, Request $request, EntityManagerInterface $em): Response
    {
        $data = json_decode($request->getContent(), true);

        $account->setName($data['name']);
        $account->setType($data['type']);
        $account->setCurrency($data['currency'] ?? 'EUR');
        $account->setBalance($data['balance'] ?? $account->getBalance());

        $em->flush();

        return $this->json($this->serialize($account));
    }

    #[Route('/{id}/delete', name: 'delete', methods: ['DELETE'])]
    public function delete(Account $account, EntityManagerInterface $em): Response
    {
        $em->remove($account);
        $em->flush();

        return $this->json(['deleted' => true]);
    }

    private function serialize(Account $a): array
    {
        return [
            'id'       => $a->getId(),
            'name'     => $a->getName(),
            'type'     => $a->getType(),
            'currency' => $a->getCurrency(),
            'balance'  => $a->getBalance(),
        ];
    }
}
