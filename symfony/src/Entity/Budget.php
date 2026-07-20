<?php

namespace App\Entity;

use App\Repository\BudgetRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: BudgetRepository::class)]
#[ORM\Table(name: 'monthly_budget')]
#[ORM\UniqueConstraint(name: 'uniq_budget_period', columns: ['category_id', 'year', 'month', 'label'])]
#[ORM\Index(columns: ['year', 'month'], name: 'idx_budget_period')]
class Budget
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['budget:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Category::class, inversedBy: 'budgets')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['budget:read', 'budget:month'])]
    private ?Category $category = null;

    #[ORM\Column(type: 'string', length: 255, nullable: true)]
    #[Groups(['budget:read', 'budget:month'])]
    private ?string $label = null;

    #[ORM\ManyToOne(targetEntity: Account::class)]
    #[ORM\JoinColumn(nullable: true)]
    #[Groups(['budget:read', 'budget:month'])]
    private ?Account $account = null;

    #[ORM\ManyToOne(targetEntity: Account::class)]
    #[ORM\JoinColumn(nullable: true)]
    #[Groups(['budget:read', 'budget:month'])]
    private ?Account $destinationAccount = null;

    #[ORM\Column(type: 'smallint')]
    #[Groups(['budget:read', 'budget:month'])]
    private int $year;

    #[ORM\Column(type: 'smallint')]
    #[Groups(['budget:read', 'budget:month'])]
    private int $month;

    #[ORM\Column(type: 'decimal', precision: 10, scale: 2, options: ['default' => '0.00'])]
    #[Groups(['budget:read', 'budget:month'])]
    private string $plannedAmount = '0.00';

    #[ORM\Column(type: 'decimal', precision: 10, scale: 2, options: ['default' => '0.00'])]
    #[Groups(['budget:read', 'budget:month'])]
    private string $actualAmount = '0.00';

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    #[Groups(['budget:read', 'budget:month'])]
    private ?\DateTimeImmutable $approvedAt = null;

    #[ORM\ManyToOne(targetEntity: Transaction::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?Transaction $approvedTransaction = null;

    public function getId(): ?int { return $this->id; }

    public function getCategory(): ?Category { return $this->category; }
    public function setCategory(?Category $category): static { $this->category = $category; return $this; }

    public function getAccount(): ?Account { return $this->account; }
    public function setAccount(?Account $account): static { $this->account = $account; return $this; }

    public function getDestinationAccount(): ?Account { return $this->destinationAccount; }
    public function setDestinationAccount(?Account $account): static { $this->destinationAccount = $account; return $this; }

    public function getLabel(): ?string { return $this->label; }
    public function setLabel(?string $label): static { $this->label = $label; return $this; }

    public function getYear(): int { return $this->year; }
    public function setYear(int $year): static { $this->year = $year; return $this; }

    public function getMonth(): int { return $this->month; }
    public function setMonth(int $month): static { $this->month = $month; return $this; }

    public function getPlannedAmount(): string { return $this->plannedAmount; }
    public function setPlannedAmount(string $amount): static { $this->plannedAmount = $amount; return $this; }

    public function getActualAmount(): string { return $this->actualAmount; }
    public function setActualAmount(string $amount): static { $this->actualAmount = $amount; return $this; }

    public function getVariance(): float { return (float) $this->plannedAmount - (float) $this->actualAmount; }

    public function getApprovedAt(): ?\DateTimeImmutable { return $this->approvedAt; }
    public function setApprovedAt(?\DateTimeImmutable $dt): static { $this->approvedAt = $dt; return $this; }

    public function getApprovedTransaction(): ?Transaction { return $this->approvedTransaction; }
    public function setApprovedTransaction(?Transaction $tx): static { $this->approvedTransaction = $tx; return $this; }

    public function isApproved(): bool { return $this->approvedAt !== null; }

    #[Groups(['budget:read', 'budget:month'])]
    public function getIsApproved(): bool { return $this->isApproved(); }

    public function getPeriodLabel(): string
    {
        $months = [
            1 => 'janvier', 2 => 'février', 3 => 'mars', 4 => 'avril',
            5 => 'mai', 6 => 'juin', 7 => 'juillet', 8 => 'août',
            9 => 'septembre', 10 => 'octobre', 11 => 'novembre', 12 => 'décembre',
        ];
        return ($months[$this->month] ?? '') . ' ' . $this->year;
    }
}
