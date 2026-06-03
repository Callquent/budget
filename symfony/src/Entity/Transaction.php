<?php

namespace App\Entity;

use App\Repository\TransactionRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: TransactionRepository::class)]
#[ORM\Table(name: 'transaction')]
#[ORM\Index(columns: ['year', 'month'], name: 'idx_year_month')]
#[ORM\Index(columns: ['transaction_date'], name: 'idx_date')]
class Transaction
{
    public const TYPE_CREDIT   = 'credit';   // entrée d'argent
    public const TYPE_DEBIT    = 'debit';    // sortie d'argent
    public const TYPE_TRANSFER = 'transfer'; // virement

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Account::class, inversedBy: 'transactions')]
    #[ORM\JoinColumn(nullable: false)]
    private ?Account $account = null;

    #[ORM\ManyToOne(targetEntity: Category::class, inversedBy: 'transactions')]
    #[ORM\JoinColumn(nullable: false)]
    private ?Category $category = null;

    /** Montant positif (le type credit/debit porte le sens) */
    #[ORM\Column(type: 'decimal', precision: 10, scale: 2)]
    private string $amount;

    /** 'credit' ou 'debit' */
    #[ORM\Column(length: 20)]
    private string $type;

    /** Date effective de l'opération */
    #[ORM\Column(type: 'date_immutable')]
    private \DateTimeImmutable $transactionDate;

    /**
     * Année dénormalisée pour faciliter les requêtes par période.
     * Exemple : 2025, 2026
     */
    #[ORM\Column(type: 'smallint')]
    private int $year;

    /**
     * Mois dénormalisé (1-12).
     * Permet de filtrer mars 2025 avec WHERE year=2025 AND month=3
     */
    #[ORM\Column(type: 'smallint')]
    private int $month;

    /** Libellé libre (ex: "Salaire mars 2025") */
    #[ORM\Column(length: 255)]
    private string $label;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $notes = null;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    // Synchronise year/month à partir de transactionDate
    #[ORM\PrePersist]
    #[ORM\PreUpdate]
    public function syncPeriod(): void
    {
        if ($this->transactionDate) {
            $this->year  = (int) $this->transactionDate->format('Y');
            $this->month = (int) $this->transactionDate->format('n');
        }
    }

    public function getId(): ?int { return $this->id; }

    public function getAccount(): ?Account { return $this->account; }
    public function setAccount(?Account $account): static { $this->account = $account; return $this; }

    public function getCategory(): ?Category { return $this->category; }
    public function setCategory(?Category $category): static { $this->category = $category; return $this; }

    public function getAmount(): string { return $this->amount; }
    public function setAmount(string $amount): static { $this->amount = $amount; return $this; }

    public function getType(): string { return $this->type; }
    public function setType(string $type): static { $this->type = $type; return $this; }

    public function getTransactionDate(): \DateTimeImmutable { return $this->transactionDate; }
    public function setTransactionDate(\DateTimeImmutable $date): static
    {
        $this->transactionDate = $date;
        $this->year  = (int) $date->format('Y');
        $this->month = (int) $date->format('n');
        return $this;
    }

    public function getYear(): int { return $this->year; }
    public function getMonth(): int { return $this->month; }

    /** Retourne une clé lisible, ex : "mars 2025" */
    public function getPeriodLabel(): string
    {
        $formatter = new \IntlDateFormatter(
            'fr_FR',
            \IntlDateFormatter::NONE,
            \IntlDateFormatter::NONE,
            null, null, 'MMMM yyyy'
        );
        return $formatter->format($this->transactionDate);
    }

    public function getLabel(): string { return $this->label; }
    public function setLabel(string $label): static { $this->label = $label; return $this; }

    public function getNotes(): ?string { return $this->notes; }
    public function setNotes(?string $notes): static { $this->notes = $notes; return $this; }

    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
}
