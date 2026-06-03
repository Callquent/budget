<?php

namespace App\Controller;

use App\Entity\Subscription;
use App\Form\SubscriptionType;
use App\Repository\SubscriptionRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/subscriptions', name: 'subscription_')]
class SubscriptionController extends AbstractController
{
    #[Route('', name: 'index')]
    public function index(SubscriptionRepository $repo): Response
    {
        return $this->render('subscription/index.html.twig', [
            'subscriptions' => $repo->findAllWithRelations(),
        ]);
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
            $this->addFlash('success', 'Abonnement « '.$subscription->getName().' » créé.');
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
            'title'        => 'Modifier « '.$subscription->getName().' »',
            'subscription' => $subscription,
        ]);
    }

    #[Route('/{id}/toggle', name: 'toggle', methods: ['POST'])]
    public function toggle(Subscription $subscription, EntityManagerInterface $em): Response
    {
        $subscription->setStatus(
            $subscription->isActive() ? Subscription::STATUS_INACTIVE : Subscription::STATUS_ACTIVE
        );
        $em->flush();
        $this->addFlash('success', 'Statut modifié.');
        return $this->redirectToRoute('subscription_index');
    }

    #[Route('/{id}/delete', name: 'delete', methods: ['POST'])]
    public function delete(Subscription $subscription, Request $request, EntityManagerInterface $em): Response
    {
        if ($this->isCsrfTokenValid('delete-sub-'.$subscription->getId(), $request->request->get('_token'))) {
            $em->remove($subscription);
            $em->flush();
            $this->addFlash('success', 'Abonnement supprimé.');
        }
        return $this->redirectToRoute('subscription_index');
    }
}
