<?php

namespace App\Controller;

use App\Entity\Subscription;
use App\Form\SubscriptionType;
use App\Repository\MonthlyBudgetRepository;
use App\Repository\SubscriptionRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Serializer\SerializerInterface;

#[Route('/subscriptions', name: 'subscription_')]
class SubscriptionController extends AbstractController
{
    public function __construct(
        private SerializerInterface $serializer,
    ) {}

    #[Route('', name: 'index', methods: ['GET'])]
    public function index(SubscriptionRepository $repo): Response
    {
        $subscriptions = $repo->findAllWithRelations();

        return $this->json(
            ['subscriptions' => $subscriptions],
            200,
            [],
            ['groups' => ['subscription:read']]
        );
    }
    #[Route('/new', name: 'new')]
    public function new(Request $request, EntityManagerInterface $em): Response
    {
        $subscription = new Subscription();
        $subscription->setStartDate(new \DateTimeImmutable());

        $form = $this->createForm(SubscriptionType::class, $subscription);
        $form->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            $em->persist($subscription);
            $em->flush();
            $this->addFlash('success', 'Abonnement « ' . $subscription->getName() . ' » créé.');
            return $this->redirectToRoute('subscription_index');
        }

        return $this->render('subscription/form.html.twig', [
            'form'  => $form,
            'title' => 'Nouvel abonnement',
        ]);
    }

    #[Route('/{id}/edit', name: 'edit')]
    public function edit(Subscription $subscription, Request $request, EntityManagerInterface $em): Response
    {
        $form = $this->createForm(SubscriptionType::class, $subscription);
        $form->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            $em->flush();
            $this->addFlash('success', 'Abonnement mis à jour.');
            return $this->redirectToRoute('subscription_index');
        }

        return $this->render('subscription/form.html.twig', [
            'form'         => $form,
            'title'        => 'Modifier « ' . $subscription->getName() . ' »',
            'subscription' => $subscription,
        ]);
    }

    #[Route('/{id}/toggle', name: 'toggle', methods: ['POST'])]
    public function toggle(Subscription $subscription, EntityManagerInterface $em, MonthlyBudgetRepository $budgetRepo): Response
    {
        $wasActive = $subscription->isActive();

        $subscription->setStatus(
            $wasActive ? Subscription::STATUS_INACTIVE : Subscription::STATUS_ACTIVE
        );

        // Si on désactive : supprimer les lignes budgétaires non approuvées liées à cet abonnement
        if ($wasActive) {
            $linkedBudgets = $budgetRepo->findBy([
                'category' => $subscription->getCategory(),
                'account'  => $subscription->getAccount(),
            ]);
            $removed = 0;
            foreach ($linkedBudgets as $mb) {
                if (!$mb->isApproved()) {
                    $em->remove($mb);
                    $removed++;
                }
            }
            if ($removed > 0) {
                $this->addFlash('info', sprintf(
                    '%d ligne(s) budgétaire(s) non approuvée(s) supprimée(s).',
                    $removed
                ));
            }
        }

        $em->flush();
        $this->addFlash('success', 'Statut modifié.');
        return $this->redirectToRoute('subscription_index');
    }

    #[Route('/{id}/delete', name: 'delete', methods: ['POST'])]
    public function delete(Subscription $subscription, Request $request, EntityManagerInterface $em): Response
    {
        if ($this->isCsrfTokenValid('delete-sub-' . $subscription->getId(), $request->request->get('_token'))) {
            $em->remove($subscription);
            $em->flush();
            $this->addFlash('success', 'Abonnement supprimé.');
        }
        return $this->redirectToRoute('subscription_index');
    }
}
