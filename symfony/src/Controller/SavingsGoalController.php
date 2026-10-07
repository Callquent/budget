<?php

namespace App\Controller;

use App\Entity\SavingsGoal;
use App\Repository\BudgetRepository;
use App\Repository\SavingsGoalRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Serializer\SerializerInterface;

#[Route('/savings', name: 'savings_')]
class SavingsGoalController extends AbstractController
{
    private const GROUPS = ['savings_goal:read', 'account:read', 'category:read'];

    public function __construct(private SerializerInterface $serializer) {}

    #[Route('', name: 'index', methods: ['GET'])]
    public function index(SavingsGoalRepository $repo): Response
    {
        $goals = array_map(
            fn (SavingsGoal $g) => $this->withProgress($g, $repo),
            $repo->findAllWithRelations(),
        );

        return $this->json(['savingsGoals' => $goals]);
    }

    #[Route('/new', name: 'new', methods: ['POST'])]
    public function new(Request $request, EntityManagerInterface $em, SavingsGoalRepository $repo): Response
    {
        $data = json_decode($request->getContent(), true);
        $goal = new SavingsGoal();
        $this->hydrate($goal, $data, $em);

        $em->persist($goal);
        $em->flush();

        return $this->json($this->withProgress($goal, $repo), 201);
    }

    #[Route('/{id}', name: 'show', methods: ['GET'])]
    public function show(SavingsGoal $savingsGoal, SavingsGoalRepository $repo): Response
    {
        return $this->json($this->withProgress($savingsGoal, $repo));
    }

    #[Route('/{id}/edit', name: 'edit', methods: ['POST'])]
    public function edit(SavingsGoal $savingsGoal, Request $request, EntityManagerInterface $em, SavingsGoalRepository $repo, BudgetRepository $budgetRepo): Response
    {
        $data = json_decode($request->getContent(), true);
        $this->hydrate($savingsGoal, $data, $em);

        // Répercute le changement sur les lignes budget déjà générées
        // (mois courant et futurs, non approuvées) — sinon elles gardent
        // l'ancien nom / montant / compte / catégorie.
        $repo->refreshLinkedBudgetLines($em, $budgetRepo, $savingsGoal);

        $em->flush();

        return $this->json($this->withProgress($savingsGoal, $repo));
    }

    #[Route('/{id}/toggle', name: 'toggle', methods: ['POST'])]
    public function toggle(SavingsGoal $savingsGoal, EntityManagerInterface $em, BudgetRepository $budgetRepo, SavingsGoalRepository $repo): Response
    {
        $wasActive = $savingsGoal->isActive();

        $savingsGoal->setStatus(
            $wasActive ? SavingsGoal::STATUS_INACTIVE : SavingsGoal::STATUS_ACTIVE
        );

        if ($wasActive) {
            // Même règle que SubscriptionController::toggle() : on ne retire
            // que les lignes générées automatiquement pour CET objectif et
            // pas encore approuvées — jamais une ligne approuvée (historique)
            // ni une ligne saisie à la main.
            foreach ($budgetRepo->findBy(['sourceSavingsGoal' => $savingsGoal]) as $mb) {
                if (!$mb->isApproved()) {
                    $em->remove($mb);
                }
            }
        }

        $em->flush();

        return $this->json($this->withProgress($savingsGoal, $repo));
    }

    // L'objectif a atteint son montant cible (même total que celui affiché :
    // getContributedAmount) : on le marque "utilisable" (STATUS_COMPLETED).
    // Il n'est plus synchronisé (findActiveForPeriod ne retient que les
    // actifs) ; les lignes budget déjà créées sont conservées, leur total est
    // plafonné à targetAmount par la synchro.
    #[Route('/{id}/use', name: 'use', methods: ['POST'])]
    public function use(SavingsGoal $savingsGoal, EntityManagerInterface $em, SavingsGoalRepository $repo): Response
    {
        // Marge de 1 centime pour les arrondis décimaux.
        if ($repo->getContributedAmount($savingsGoal) + 0.01 < (float) $savingsGoal->getTargetAmount()) {
            return $this->json(['error' => "Le montant cible n'est pas encore atteint."], 422);
        }

        $savingsGoal->setStatus(SavingsGoal::STATUS_COMPLETED);
        $em->flush();

        return $this->json($this->withProgress($savingsGoal, $repo));
    }

    #[Route('/{id}/delete', name: 'delete', methods: ['POST'])]
    public function delete(SavingsGoal $savingsGoal, EntityManagerInterface $em, BudgetRepository $budgetRepo): Response
    {
        foreach ($budgetRepo->findBy(['sourceSavingsGoal' => $savingsGoal]) as $mb) {
            if (!$mb->isApproved()) {
                $em->remove($mb);
            }
        }

        $em->remove($savingsGoal);
        $em->flush();

        return $this->json(['deleted' => true]);
    }

    /**
     * Fusionne l'objectif sérialisé avec les champs de progression calculés
     * à la volée (jamais persistés : dérivés des lignes Budget liées).
     */
    private function withProgress(SavingsGoal $goal, SavingsGoalRepository $repo): array
    {
        $contributed = $repo->getContributedAmount($goal);
        $target      = (float) $goal->getTargetAmount();

        $serialized = json_decode(
            $this->serializer->serialize($goal, 'json', ['groups' => self::GROUPS]),
            true,
        );

        return $serialized + [
            'contributedAmount'  => $contributed,
            'remainingAmount'    => max(0, $target - $contributed),
            'progressPercentage' => $target > 0 ? min(100, round($contributed / $target * 100, 1)) : 0,
        ];
    }

    private function hydrate(SavingsGoal $goal, array $data, EntityManagerInterface $em): void
    {
        $accountRepo  = $em->getRepository(\App\Entity\Account::class);
        $categoryRepo = $em->getRepository(\App\Entity\Category::class);

        $goal->setName($data['name']);
        $goal->setTargetAmount((string) $data['targetAmount']);
        $goal->setContributionAmount((string) $data['contributionAmount']);
        $goal->setFrequency($data['frequency']);
        $goal->setStatus($data['status'] ?? SavingsGoal::STATUS_ACTIVE);
        $goal->setStartDate(new \DateTimeImmutable($data['startDate']));
        $goal->setEndDate(!empty($data['endDate']) ? new \DateTimeImmutable($data['endDate']) : null);
        $goal->setDayOfMonth(!empty($data['dayOfMonth']) ? (int) $data['dayOfMonth'] : null);
        $goal->setNotes($data['notes'] ?? null);
        $goal->setAccount($accountRepo->find($data['accountId']));
        $goal->setCategory($categoryRepo->find($data['categoryId']));
    }
}
