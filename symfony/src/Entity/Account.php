<?php

namespace App\Entity;

use App\Repository\AccountRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: AccountRepository::class)]
#[ORM\Table(name: 'account')]
class Account
{
    // Types de comptes
    public const TYPE_CREDIT = 'credit';  // ex: Livret A, CCP
    public const TYPE_DEBIT  = 'debit';   // ex: porte-monnaie

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['subscription:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 100)]
    #[Groups(['subscription:read'])]
    private string $name;

    /** 'credit' ou 'debit' */
    #[ORM\Column(length: 20)]
    private string $type;

    #[ORM\Column(length: 3, options: ['default' => 'EUR'])]
    private string $currency = 'EUR';

    /** Solde initial/courant du compte */
    #[ORM\Column(type: 'decimal', precision: 12, scale: 2, options: ['default' => '0.00'])]
    private string $balance = '0.00';

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    #[ORM\OneToMany(mappedBy: 'account', targetEntity: Transaction::class, orphanRemoval: true)]
    private Collection $transactions;

    public function __construct()
    {
        $this->transactions = new ArrayCollection();
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

    public function getType(): string
    {
        return $this->type;
    }
    public function setType(string $type): static
    {
        $this->type = $type;
        return $this;
    }

    public function getCurrency(): string
    {
        return $this->currency;
    }
    public function setCurrency(string $currency): static
    {
        $this->currency = $currency;
        return $this;
    }

    public function getBalance(): string
    {
        return $this->balance;
    }
    public function setBalance(string $balance): static
    {
        $this->balance = $balance;
        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }
    public function setCreatedAt(\DateTimeImmutable $createdAt): static
    {
        $this->createdAt = $createdAt;
        return $this;
    }

    public function getTransactions(): Collection
    {
        return $this->transactions;
    }

    public function addTransaction(Transaction $transaction): static
    {
        if (!$this->transactions->contains($transaction)) {
            $this->transactions->add($transaction);
            $transaction->setAccount($this);
        }
        return $this;
    }

    public function removeTransaction(Transaction $transaction): static
    {
        if ($this->transactions->removeElement($transaction)) {
            if ($transaction->getAccount() === $this) {
                $transaction->setAccount(null);
            }
        }
        return $this;
    }

    public function __toString(): string
    {
        return $this->name;
    }
}
