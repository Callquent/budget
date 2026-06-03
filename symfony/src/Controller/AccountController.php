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
    #[Route('', name: 'index')]
    public function index(AccountRepository $repo): Response
    {
        return $this->render('account/index.html.twig', [
            'accounts' => $repo->findAllOrderedByName(),
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

    #[Route('/{id}/delete', name: 'delete', methods: ['POST'])]
    public function delete(Account $account, Request $request, EntityManagerInterface $em): Response
    {
        if ($this->isCsrfTokenValid('delete-account-'.$account->getId(), $request->request->get('_token'))) {
            $em->remove($account);
            $em->flush();
            $this->addFlash('success', 'Compte supprimé.');
        }
        return $this->redirectToRoute('account_index');
    }
}
