<?php

namespace App\Entity;

use App\Repository\SavingsGoalRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: SavingsGoalRepository::class)]
class SavingsGoal
{
    public const STATUS_ACTIVE    = 'active';
    public const STATUS_INACTIVE  = 'inactive';
    public const STATUS_COMPLETED = 'completed';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['savings_goal:read'])]
    private ?int $id = null;

    #[ORM\Column(type: 'string', length: 255)]
    #[Groups(['savings_goal:read'])]
    private string $name;

    #[ORM\ManyToOne(targetEntity: Account::class)]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['savings_goal:read', 'account:read'])]
    private ?Account $account = null;

    // Catégorie dédiée recommandée par objectif (ex: "Épargne vélo" plutôt
    // qu'une catégorie "Épargne" partagée) : BudgetRepository::refreshActualAmounts()
    // agrège les transactions par catégorie+mois sans distinguer la source
    // (abonnement / objectif d'épargne / saisie manuelle), donc partager une
    // catégorie entre plusieurs objectifs mélangerait leur progression réelle.
    #[ORM\ManyToOne(targetEntity: Category::class)]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['savings_goal:read', 'category:read'])]
    private ?Category $category = null;

    #[ORM\Column(type: 'decimal', precision: 10, scale: 2)]
    #[Groups(['savings_goal:read'])]
    private string $targetAmount;

    // Montant mis de côté à chaque échéance (chaque mois / trimestre / année,
    // ou une seule fois pour 'occasional'). Devient plannedAmount ET
    // actualAmount de la ligne monthly_budget générée — l'actualAmount réel
    // est ensuite recalculé normalement par BudgetRepository::refreshActualAmounts()
    // à partir des vraies transactions de la catégorie.
    #[ORM\Column(type: 'decimal', precision: 10, scale: 2)]
    #[Groups(['savings_goal:read'])]
    private string $contributionAmount;

    // 'monthly' | 'quarterly' | 'yearly' | 'occasional' — mêmes valeurs que
    // Subscription::$frequency, pour réutiliser la même logique
    // d'échéance dans SavingsGoalRepository::isDueInMonth().
    #[ORM\Column(type: 'string', length: 20)]
    #[Groups(['savings_goal:read'])]
    private string $frequency = 'monthly';

    #[ORM\Column(type: 'string', length: 20)]
    #[Groups(['savings_goal:read'])]
    private string $status = self::STATUS_ACTIVE;

    #[ORM\Column(type: 'datetime_immutable')]
    #[Groups(['savings_goal:read'])]
    private \DateTimeImmutable $startDate;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    #[Groups(['savings_goal:read'])]
    private ?\DateTimeImmutable $endDate = null;

    #[ORM\Column(type: 'smallint', nullable: true)]
    #[Groups(['savings_goal:read'])]
    private ?int $dayOfMonth = null;

    #[ORM\Column(type: 'text', nullable: true)]
    #[Groups(['savings_goal:read'])]
    private ?string $notes = null;

    public function getId(): ?int { return $this->id; }

    public function getName(): string { return $this->name; }
    public function setName(string $name): static { $this->name = $name; return $this; }

    public function getAccount(): ?Account { return $this->account; }
    public function setAccount(?Account $account): static { $this->account = $account; return $this; }

    public function getCategory(): ?Category { return $this->category; }
    public function setCategory(?Category $category): static { $this->category = $category; return $this; }

    public function getTargetAmount(): string { return $this->targetAmount; }
    public function setTargetAmount(string $amount): static { $this->targetAmount = $amount; return $this; }

    public function getContributionAmount(): string { return $this->contributionAmount; }
    public function setContributionAmount(string $amount): static { $this->contributionAmount = $amount; return $this; }

    public function getFrequency(): string { return $this->frequency; }
    public function setFrequency(string $frequency): static { $this->frequency = $frequency; return $this; }

    public function getStatus(): string { return $this->status; }
    public function setStatus(string $status): static { $this->status = $status; return $this; }

    public function isActive(): bool { return $this->status === self::STATUS_ACTIVE; }

    public function getStartDate(): \DateTimeImmutable { return $this->startDate; }
    public function setStartDate(\DateTimeImmutable $date): static { $this->startDate = $date; return $this; }

    public function getEndDate(): ?\DateTimeImmutable { return $this->endDate; }
    public function setEndDate(?\DateTimeImmutable $date): static { $this->endDate = $date; return $this; }

    public function getDayOfMonth(): ?int { return $this->dayOfMonth; }
    public function setDayOfMonth(?int $day): static { $this->dayOfMonth = $day; return $this; }

    public function getNotes(): ?string { return $this->notes; }
    public function setNotes(?string $notes): static { $this->notes = $notes; return $this; }
}
