<?php

namespace App\Entity;

use App\Repository\CategoryRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Entity(repositoryClass: CategoryRepository::class)]
#[ORM\Table(name: 'category')]
class Category
{
    // Type de transaction
    public const TYPE_INCOME  = 'income';   // recette (salaire, etc.)
    public const TYPE_EXPENSE = 'expense';  // dépense
    public const TYPE_TRANSFER = 'transfer'; // virement entre comptes

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['subscription:read', 'category:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 100)]
    #[Groups(['subscription:read', 'category:read'])]
    private ?string $name = null;

    /** 'income', 'expense' ou 'transfer' */
    #[ORM\Column(length: 20)]
    #[Groups(['category:read'])]
    private string $transactionType;

    #[ORM\Column(type: 'text', nullable: true)]
    #[Groups(['category:read'])]
    private ?string $description = null;

    #[ORM\OneToMany(mappedBy: 'category', targetEntity: Transaction::class)]
    private Collection $transactions;

    #[ORM\OneToMany(mappedBy: 'category', targetEntity: Budget::class, orphanRemoval: true)]
    private Collection $budgets;

    public function __construct()
    {
        $this->transactions   = new ArrayCollection();
        $this->budgets = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getName(): string
    {
        return $this->name;
    }
    public function setName(string $name): static
    {
        $this->name = $name;
        return $this;
    }

    public function getTransactionType(): string
    {
        return $this->transactionType;
    }
    public function setTransactionType(string $type): static
    {
        $this->transactionType = $type;
        return $this;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }
    public function setDescription(?string $description): static
    {
        $this->description = $description;
        return $this;
    }

    public function getTransactions(): Collection
    {
        return $this->transactions;
    }
    public function getBudgets(): Collection
    {
        return $this->budgets;
    }

    public function __toString(): string
    {
        return $this->name;
    }
}
