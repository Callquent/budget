<?php

namespace App\Entity;

use App\Repository\MonthlyBudgetRepository;
use Doctrine\ORM\Mapping as ORM;

/**
 * Permet de suivre budget prévu vs réalisé pour chaque catégorie,
 * mois par mois sur n'importe quelle année.
 *
 * Exemple : Courses — mars 2025 — prévu 400€ / réalisé 387€
 */
#[ORM\Entity(repositoryClass: MonthlyBudgetRepository::class)]
#[ORM\Table(name: 'monthly_budget')]
#[ORM\UniqueConstraint(name: 'uniq_budget_period', columns: ['category_id', 'year', 'month'])]
#[ORM\Index(columns: ['year', 'month'], name: 'idx_budget_period')]
class MonthlyBudget
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Category::class, inversedBy: 'monthlyBudgets')]
    #[ORM\JoinColumn(nullable: false)]
    private ?Category $category = null;

    /** Compte concerné (optionnel : permet de rattacher un budget à un compte précis) */
    #[ORM\ManyToOne(targetEntity: Account::class)]
    #[ORM\JoinColumn(nullable: true)]
    private ?Account $account = null;

    /** Année : 2025, 2026, … */
    #[ORM\Column(type: 'smallint')]
    private int $year;

    /** Mois : 1 (janvier) … 12 (décembre) */
    #[ORM\Column(type: 'smallint')]
    private int $month;

    /** Montant planifié pour ce poste ce mois-ci */
    #[ORM\Column(type: 'decimal', precision: 10, scale: 2, options: ['default' => '0.00'])]
    private string $plannedAmount = '0.00';

    /** Montant réellement dépensé/encaissé. */
    #[ORM\Column(type: 'decimal', precision: 10, scale: 2, options: ['default' => '0.00'])]
    private string $actualAmount = '0.00';

    /**
     * Date d'approbation : renseignée quand la ligne est validée
     * et convertie en transaction réelle.
     */
    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $approvedAt = null;

    /**
     * Transaction générée lors de l'approbation.
     * Nullable : null = pas encore approuvé.
     */
    #[ORM\ManyToOne(targetEntity: Transaction::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?Transaction $approvedTransaction = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getCategory(): ?Category
    {
        return $this->category;
    }
    public function setCategory(?Category $category): static
    {
        $this->category = $category;
        return $this;
    }

    public function getAccount(): ?Account
    {
        return $this->account;
    }
    public function setAccount(?Account $account): static
    {
        $this->account = $account;
        return $this;
    }

    public function getYear(): int
    {
        return $this->year;
    }
    public function setYear(int $year): static
    {
        $this->year = $year;
        return $this;
    }

    public function getMonth(): int
    {
        return $this->month;
    }
    public function setMonth(int $month): static
    {
        $this->month = $month;
        return $this;
    }

    public function getPlannedAmount(): string
    {
        return $this->plannedAmount;
    }
    public function setPlannedAmount(string $amount): static
    {
        $this->plannedAmount = $amount;
        return $this;
    }

    public function getActualAmount(): string
    {
        return $this->actualAmount;
    }
    public function setActualAmount(string $amount): static
    {
        $this->actualAmount = $amount;
        return $this;
    }

    /** Écart prévu - réalisé (positif = économie, négatif = dépassement) */
    public function getVariance(): float
    {
        return (float) $this->plannedAmount - (float) $this->actualAmount;
    }

    public function getApprovedAt(): ?\DateTimeImmutable
    {
        return $this->approvedAt;
    }
    public function setApprovedAt(?\DateTimeImmutable $dt): static
    {
        $this->approvedAt = $dt;
        return $this;
    }

    public function getApprovedTransaction(): ?Transaction
    {
        return $this->approvedTransaction;
    }
    public function setApprovedTransaction(?Transaction $tx): static
    {
        $this->approvedTransaction = $tx;
        return $this;
    }

    public function isApproved(): bool
    {
        return $this->approvedAt !== null;
    }

    /** Clé lisible pour l'affichage : "mars 2025" */
    public function getPeriodLabel(): string
    {
        $date = \DateTimeImmutable::createFromFormat('Y-n', "{$this->year}-{$this->month}");
        $formatter = new \IntlDateFormatter(
            'fr_FR',
            \IntlDateFormatter::NONE,
            \IntlDateFormatter::NONE,
            null,
            null,
            'MMMM yyyy'
        );
        return $formatter->format($date);
    }
}
