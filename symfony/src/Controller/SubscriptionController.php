<?php

namespace App\Controller;

use App\Entity\Subscription;
use App\Repository\MonthlyBudgetRepository;
use App\Repository\SubscriptionRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/subscriptions', name: 'subscription_')]
class SubscriptionController extends AbstractController
{
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
    #[Route('/new', name: 'new', methods: ['POST'])]
    public function new(Request $request, EntityManagerInterface $em): Response
    {
        $data = json_decode($request->getContent(), true);

        $subscription = new Subscription();
        $this->hydrate($subscription, $data, $em);

        $em->persist($subscription);
        $em->flush();

        return $this->json($this->serialize($subscription), 201, [], ['groups' => ['subscription:read']]);
    }

    #[Route('/{id}', name: 'show', methods: ['GET'])]
    public function show(Subscription $subscription): Response
    {
        return $this->json($subscription, 200, [], ['groups' => ['subscription:read']]);
    }

    #[Route('/{id}/edit', name: 'edit', methods: ['POST'])]
    public function edit(Subscription $subscription, Request $request, EntityManagerInterface $em): Response
    {
        $data = json_decode($request->getContent(), true);

        $this->hydrate($subscription, $data, $em);
        $em->flush();

        return $this->json($subscription, 200, [], ['groups' => ['subscription:read']]);
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
    public function delete(Subscription $subscription, EntityManagerInterface $em): Response
    {
        $em->remove($subscription);
        $em->flush();

        return $this->json(['deleted' => true]);
    }

    private function hydrate(Subscription $subscription, array $data, EntityManagerInterface $em): void
    {
        $accountRepo  = $em->getRepository(\App\Entity\Account::class);
        $categoryRepo = $em->getRepository(\App\Entity\Category::class);

        $subscription->setName($data['name']);
        $subscription->setAmount($data['amount']);
        $subscription->setFrequency($data['frequency']);
        $subscription->setStatus($data['status'] ?? Subscription::STATUS_ACTIVE);
        $subscription->setStartDate(new \DateTimeImmutable($data['startDate']));
        $subscription->setEndDate(isset($data['endDate']) && $data['endDate'] ? new \DateTimeImmutable($data['endDate']) : null);
        $subscription->setDayOfMonth($data['dayOfMonth'] ?? null);
        $subscription->setNotes($data['notes'] ?? null);
        $subscription->setAccount($accountRepo->find($data['accountId']));
        $subscription->setCategory($categoryRepo->find($data['categoryId']));
    }

    private function serialize(Subscription $s): array
    {
        return [
            'id'         => $s->getId(),
            'name'       => $s->getName(),
            'amount'     => $s->getAmount(),
            'frequency'  => $s->getFrequency(),
            'status'     => $s->getStatus(),
            'startDate'  => $s->getStartDate()->format('Y-m-d'),
            'endDate'    => $s->getEndDate()?->format('Y-m-d'),
            'dayOfMonth' => $s->getDayOfMonth(),
            'notes'      => $s->getNotes(),
            'account'    => ['id' => $s->getAccount()->getId(), 'name' => $s->getAccount()->getName()],
            'category'   => ['id' => $s->getCategory()->getId(), 'name' => $s->getCategory()->getName()],
        ];
    }
}
