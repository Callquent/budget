<?php

namespace App\DataFixtures;

use App\Entity\Account;
use App\Entity\Category;
use App\Entity\Budget;
use App\Entity\Transaction;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Persistence\ObjectManager;

/**
 * Données de démonstration.
 * Commande : php bin/console doctrine:fixtures:load
 */
class AppFixtures extends Fixture
{
    public function load(ObjectManager $manager): void
    {
        // ── Comptes ──────────────────────────────────────────────────────────
        $livretA = (new Account())
            ->setName('Livret A')
            ->setBalance('3500.00');

        $ccp = (new Account())
            ->setName('Compte CCP')
            ->setBalance('1200.00');

        $portemonnaie = (new Account())
            ->setName('Porte-monnaie')
            ->setBalance('80.00');

        foreach ([$livretA, $ccp, $portemonnaie] as $account) {
            $manager->persist($account);
        }

        // ── Catégories ───────────────────────────────────────────────────────
        $categories = [
            'salaire' => (new Category())
                ->setName('Salaire')
                ->setTransactionType(Category::TYPE_INCOME)
                ->setFrequency(Category::FREQ_MONTHLY)
                ->setDescription('Salaire mensuel net'),

            'transport' => (new Category())
                ->setName('Abonnement transport')
                ->setTransactionType(Category::TYPE_EXPENSE)
                ->setFrequency(Category::FREQ_YEARLY)
                ->setDescription('Abonnement annuel (Navigo, TER, etc.)'),

            'taxes_foncieres' => (new Category())
                ->setName('Taxes Foncières')
                ->setTransactionType(Category::TYPE_EXPENSE)
                ->setFrequency(Category::FREQ_YEARLY)
                ->setDescription('Taxes Foncières'),

            'mobile' => (new Category())
                ->setName('Abonnement mobile')
                ->setTransactionType(Category::TYPE_EXPENSE)
                ->setFrequency(Category::FREQ_MONTHLY)
                ->setDescription('Abonnement mobile mensuel (Free, Orange, etc.)'),


            'internet' => (new Category())
                ->setName('Abonnement internet')
                ->setTransactionType(Category::TYPE_EXPENSE)
                ->setFrequency(Category::FREQ_MONTHLY)
                ->setDescription('Abonnement internet mensuel (Free, Orange, etc.)'),

            'courses' => (new Category())
                ->setName('Courses')
                ->setTransactionType(Category::TYPE_EXPENSE)
                ->setFrequency(Category::FREQ_MONTHLY)
                ->setDescription('Alimentation et produits du quotidien'),

            'electricite' => (new Category())
                ->setName('Électricité')
                ->setTransactionType(Category::TYPE_EXPENSE)
                ->setFrequency(Category::FREQ_MONTHLY)
                ->setDescription('Facture EDF / fournisseur électricité'),

            'assurance_habitat' => (new Category())
                ->setName('Assurance habitation')
                ->setTransactionType(Category::TYPE_EXPENSE)
                ->setFrequency(Category::FREQ_MONTHLY)
                ->setDescription('Cotisation mensuelle assurance habitation'),

            'assurance_auto' => (new Category())
                ->setName('Assurance auto')
                ->setTransactionType(Category::TYPE_EXPENSE)
                ->setFrequency(Category::FREQ_YEARLY)
                ->setDescription('Cotisation assurance auto'),

            'charges' => (new Category())
                ->setName('Charges habitation')
                ->setTransactionType(Category::TYPE_EXPENSE)
                ->setFrequency(Category::FREQ_QUARTERLY)
                ->setDescription('Charges trimestrielles de copropriété'),

            'achat' => (new Category())
                ->setName('Achat occasionnel')
                ->setTransactionType(Category::TYPE_EXPENSE)
                ->setFrequency(Category::FREQ_OCCASIONAL)
                ->setDescription('Achat occasionnel'),

            'vacances' => (new Category())
                ->setName('Vacances')
                ->setTransactionType(Category::TYPE_EXPENSE)
                ->setFrequency(Category::FREQ_OCCASIONAL)
                ->setDescription('Vacances'),

            'bancaire' => (new Category())
                ->setName('Bancaire')
                ->setTransactionType(Category::TYPE_EXPENSE)
                ->setFrequency(Category::FREQ_OCCASIONAL)
                ->setDescription('Bancaire'),

            'credit_appartement' => (new Category())
                ->setName('Crédit habitation')
                ->setTransactionType(Category::TYPE_EXPENSE)
                ->setFrequency(Category::FREQ_MONTHLY)
                ->setDescription('Crédit habitation'),

            'virement_livret' => (new Category())
                ->setName('Virement Livret A')
                ->setTransactionType(Category::TYPE_TRANSFER)
                ->setFrequency(Category::FREQ_OCCASIONAL)
                ->setDescription('Virement ponctuel vers le Livret A'),
        ];

        foreach ($categories as $cat) {
            $manager->persist($cat);
        }

        // ── Transactions de démonstration (mars 2025 et mai 2026) ─────────────
        $transactions = [
            // Mai 2026
            [
                'account'  => $ccp,
                'category' => $categories['salaire'],
                'amount'   => '1600.00',
                'type'     => Transaction::TYPE_CREDIT,
                'date'     => new \DateTimeImmutable('2026-05-30'),
                'label'    => 'Salaire mai 2026',
            ],
            [
                'account'  => $ccp,
                'category' => $categories['courses'],
                'amount'   => '210.00',
                'type'     => Transaction::TYPE_DEBIT,
                'date'     => new \DateTimeImmutable('2026-05-14'),
                'label'    => 'Courses mai 2026',
            ],
            [
                'account'  => $livretA,
                'category' => $categories['virement_livret'],
                'amount'   => '300.00',
                'type'     => Transaction::TYPE_CREDIT,
                'date'     => new \DateTimeImmutable('2026-05-01'),
                'label'    => 'Virement Livret A mai 2026',
            ],
        ];

        foreach ($transactions as $data) {
            $t = (new Transaction())
                ->setAccount($data['account'])
                ->setCategory($data['category'])
                ->setAmount($data['amount'])
                ->setType($data['type'])
                ->setTransactionDate($data['date'])
                ->setLabel($data['label']);
            $manager->persist($t);
        }

        // ── Budget mensuel prévisionnel (mars 2025) ────────────────────────
        $budgets = [];

        foreach ($budgets as [$cat, $y, $m, $planned, $actual]) {
            $mb = (new Budget())
                ->setCategory($cat)
                ->setYear($y)
                ->setMonth($m)
                ->setPlannedAmount($planned)
                ->setActualAmount($actual);
            $manager->persist($mb);
        }

        $manager->flush();
    }
}
