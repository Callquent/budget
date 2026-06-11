<?php

namespace App\Entity;

use App\Repository\SubscriptionRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

/**
 * Abonnement récurrent : génère automatiquement des transactions
 * selon sa fréquence.
 */
#[ORM\Entity(repositoryClass: SubscriptionRepository::class)]
#[ORM\Table(name: 'subscription')]
class Subscription
{
    public const STATUS_ACTIVE   = 'active';
    public const STATUS_INACTIVE = 'inactive';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['subscription:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 150)]
    #[Groups(['subscription:read'])]
    private string $name;

    #[ORM\ManyToOne(targetEntity: Account::class)]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['subscription:read'])]
    private Account $account;

    #[ORM\ManyToOne(targetEntity: Category::class)]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['subscription:read'])]
    private Category $category;

    #[ORM\Column(type: 'decimal', precision: 10, scale: 2)]
    #[Groups(['subscription:read'])]
    private string $amount;

    #[ORM\Column(length: 20)]
    #[Groups(['subscription:read'])]
    private string $frequency;

    #[ORM\Column(type: 'smallint', nullable: true)]
    #[Groups(['subscription:read'])]
    private ?int $dayOfMonth = null;

    #[ORM\Column(type: 'date_immutable')]
    #[Groups(['subscription:read'])]
    private \DateTimeImmutable $startDate;

    #[ORM\Column(type: 'date_immutable', nullable: true)]
    #[Groups(['subscription:read'])]
    private ?\DateTimeImmutable $endDate = null;

    #[ORM\Column(length: 20, options: ['default' => 'active'])]
    #[Groups(['subscription:read'])]
    private string $status = self::STATUS_ACTIVE;

    #[ORM\Column(type: 'text', nullable: true)]
    #[Groups(['subscription:read'])]
    private ?string $notes = null;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
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

    public function getAccount(): Account
    {
        return $this->account;
    }
    public function setAccount(Account $account): static
    {
        $this->account = $account;
        return $this;
    }

    public function getCategory(): Category
    {
        return $this->category;
    }
    public function setCategory(Category $category): static
    {
        $this->category = $category;
        return $this;
    }

    public function getAmount(): string
    {
        return $this->amount;
    }
    public function setAmount(string $amount): static
    {
        $this->amount = $amount;
        return $this;
    }

    public function getFrequency(): string
    {
        return $this->frequency;
    }
    public function setFrequency(string $frequency): static
    {
        $this->frequency = $frequency;
        return $this;
    }

    public function getDayOfMonth(): ?int
    {
        return $this->dayOfMonth;
    }
    public function setDayOfMonth(?int $day): static
    {
        $this->dayOfMonth = $day;
        return $this;
    }

    public function getStartDate(): \DateTimeImmutable
    {
        return $this->startDate;
    }
    public function setStartDate(\DateTimeImmutable $date): static
    {
        $this->startDate = $date;
        return $this;
    }

    public function getEndDate(): ?\DateTimeImmutable
    {
        return $this->endDate;
    }
    public function setEndDate(?\DateTimeImmutable $date): static
    {
        $this->endDate = $date;
        return $this;
    }

    public function getStatus(): string
    {
        return $this->status;
    }
    public function setStatus(string $status): static
    {
        $this->status = $status;
        return $this;
    }

    public function getNotes(): ?string
    {
        return $this->notes;
    }
    public function setNotes(?string $notes): static
    {
        $this->notes = $notes;
        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    public function __toString(): string
    {
        return $this->name;
    }
}
