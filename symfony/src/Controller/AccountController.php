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

    #[Route('/new', name: 'new')]
    public function new(Request $request, EntityManagerInterface $em): Response
    {
        $account = new Account();
        $form = $this->createForm(AccountType::class, $account);
        $form->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            $em->persist($account);
            $em->flush();
            $this->addFlash('success', 'Compte « '.$account->getName().' » créé.');
            return $this->redirectToRoute('account_index');
        }

        return $this->render('account/form.html.twig', [
            'form'  => $form,
            'title' => 'Nouveau compte',
        ]);
    }

    #[Route('/{id}/edit', name: 'edit')]
    public function edit(Account $account, Request $request, EntityManagerInterface $em): Response
    {
        $form = $this->createForm(AccountType::class, $account);
        $form->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            $em->flush();
            $this->addFlash('success', 'Compte mis à jour.');
            return $this->redirectToRoute('account_index');
        }

        return $this->render('account/form.html.twig', [
            'form'    => $form,
            'title'   => 'Modifier « '.$account->getName().' »',
            'account' => $account,
        ]);
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
