<?php

namespace App\Entity;

use App\Repository\CategoryRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: CategoryRepository::class)]
#[ORM\Table(name: 'category')]
class Category
{
    // Type de transaction
    public const TYPE_INCOME  = 'income';   // recette (salaire, etc.)
    public const TYPE_EXPENSE = 'expense';  // dépense
    public const TYPE_TRANSFER = 'transfer'; // virement entre comptes

    // Fréquence de l'opération
    public const FREQ_MONTHLY    = 'monthly';
    public const FREQ_YEARLY     = 'yearly';
    public const FREQ_QUARTERLY  = 'quarterly';
    public const FREQ_OCCASIONAL = 'occasional';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    /**
     * Exemples : "Salaire", "Abonnement transport", "Courses",
     *            "Électricité", "Assurance habitation",
     *            "Charges habitation", "Virement Livret A"
     */
    #[ORM\Column(length: 100)]
    private string $name;

    /** 'income', 'expense' ou 'transfer' */
    #[ORM\Column(length: 20)]
    private string $transactionType;

    /** 'monthly', 'yearly', 'quarterly', 'occasional' */
    #[ORM\Column(length: 20)]
    private string $frequency;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $description = null;

    #[ORM\OneToMany(mappedBy: 'category', targetEntity: Transaction::class)]
    private Collection $transactions;

    #[ORM\OneToMany(mappedBy: 'category', targetEntity: MonthlyBudget::class, orphanRemoval: true)]
    private Collection $monthlyBudgets;

    public function __construct()
    {
        $this->transactions   = new ArrayCollection();
        $this->monthlyBudgets = new ArrayCollection();
    }

    public function getId(): ?int { return $this->id; }

    public function getName(): string { return $this->name; }
    public function setName(string $name): static { $this->name = $name; return $this; }

    public function getTransactionType(): string { return $this->transactionType; }
    public function setTransactionType(string $type): static { $this->transactionType = $type; return $this; }

    public function getFrequency(): string { return $this->frequency; }
    public function setFrequency(string $frequency): static { $this->frequency = $frequency; return $this; }

    public function getDescription(): ?string { return $this->description; }
    public function setDescription(?string $description): static { $this->description = $description; return $this; }

    public function getTransactions(): Collection { return $this->transactions; }
    public function getMonthlyBudgets(): Collection { return $this->monthlyBudgets; }

    public function __toString(): string { return $this->name; }
}
