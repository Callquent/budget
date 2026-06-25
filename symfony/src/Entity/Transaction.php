<?php

namespace App\Entity;

use App\Repository\TransactionRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: TransactionRepository::class)]
#[ORM\Table(name: 'transaction')]
#[ORM\Index(columns: ['year', 'month'], name: 'idx_year_month')]
#[ORM\Index(columns: ['transaction_date'], name: 'idx_date')]
class Transaction
{
    public const TYPE_CREDIT = 'credit';
    public const TYPE_DEBIT  = 'debit';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['transaction:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Account::class, inversedBy: 'transactions')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['transaction:read'])]
    private ?Account $account = null;

    #[ORM\ManyToOne(targetEntity: Category::class, inversedBy: 'transactions')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['transaction:read'])]
    private ?Category $category = null;

    #[ORM\Column(type: 'decimal', precision: 10, scale: 2)]
    #[Groups(['transaction:read'])]
    private string $amount;

    #[ORM\Column(length: 20)]
    #[Groups(['transaction:read'])]
    private string $type;

    #[ORM\Column(type: 'date_immutable')]
    #[Groups(['transaction:read'])]
    private \DateTimeImmutable $transactionDate;

    #[ORM\Column(type: 'smallint')]
    #[Groups(['transaction:read'])]
    private int $year;

    #[ORM\Column(type: 'smallint')]
    #[Groups(['transaction:read'])]
    private int $month;

    #[ORM\Column(length: 255)]
    #[Groups(['transaction:read'])]
    private string $label;

    #[ORM\Column(type: 'text', nullable: true)]
    #[Groups(['transaction:read'])]
    private ?string $notes = null;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    public function __construct() { $this->createdAt = new \DateTimeImmutable(); }

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

    public function getLabel(): string { return $this->label; }
    public function setLabel(string $label): static { $this->label = $label; return $this; }

    public function getNotes(): ?string { return $this->notes; }
    public function setNotes(?string $notes): static { $this->notes = $notes; return $this; }

    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }

    public function getPeriodLabel(): string
    {
        $formatter = new \IntlDateFormatter('fr_FR', \IntlDateFormatter::NONE, \IntlDateFormatter::NONE, null, null, 'MMMM yyyy');
        return $formatter->format($this->transactionDate);
    }
}
