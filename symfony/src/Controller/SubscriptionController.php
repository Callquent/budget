<?php

namespace App\Controller;

use App\Entity\Subscription;
use App\Repository\BudgetRepository;
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
    public function __construct(private SerializerInterface $serializer) {}

    #[Route('', name: 'index', methods: ['GET'])]
    public function index(SubscriptionRepository $repo): Response
    {
        return $this->json(
            ['subscriptions' => $repo->findAllWithRelations()],
            200,
            [],
            ['groups' => ['subscription:read', 'account:read', 'category:read']]
        );
    }

    #[Route('/new', name: 'new', methods: ['POST'])]
    public function new(Request $request, EntityManagerInterface $em): Response
    {
        $data         = json_decode($request->getContent(), true);
        $subscription = new Subscription();
        $this->hydrate($subscription, $data, $em);

        $em->persist($subscription);
        $em->flush();

        return $this->json($subscription, 201, [], ['groups' => ['subscription:read', 'account:read', 'category:read']]);
    }

    #[Route('/{id}', name: 'show', methods: ['GET'])]
    public function show(Subscription $subscription): Response
    {
        return $this->json($subscription, 200, [], ['groups' => ['subscription:read', 'account:read', 'category:read']]);
    }

    #[Route('/{id}/edit', name: 'edit', methods: ['POST'])]
    public function edit(Subscription $subscription, Request $request, EntityManagerInterface $em): Response
    {
        $data = json_decode($request->getContent(), true);
        $this->hydrate($subscription, $data, $em);
        $em->flush();

        return $this->json($subscription, 200, [], ['groups' => ['subscription:read', 'account:read', 'category:read']]);
    }

    #[Route('/{id}/toggle', name: 'toggle', methods: ['POST'])]
    public function toggle(Subscription $subscription, EntityManagerInterface $em, BudgetRepository $budgetRepo): Response
    {
        $wasActive = $subscription->isActive();

        $subscription->setStatus(
            $wasActive ? Subscription::STATUS_INACTIVE : Subscription::STATUS_ACTIVE
        );

        if ($wasActive) {
            $removed = 0;
            foreach ($budgetRepo->findBy(['category' => $subscription->getCategory(), 'account' => $subscription->getAccount()]) as $mb) {
                if (!$mb->isApproved()) {
                    $em->remove($mb);
                    $removed++;
                }
            }
            if ($removed > 0) {
                $this->addFlash('info', sprintf('%d ligne(s) budgétaire(s) non approuvée(s) supprimée(s).', $removed));
            }
        }

        $em->flush();

        return $this->json($subscription, 200, [], ['groups' => ['subscription:read', 'account:read', 'category:read']]);
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
}
