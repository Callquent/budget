<?php

namespace App\Form;

use App\Entity\Account;
use App\Entity\Category;
use App\Entity\MonthlyBudget;
use Symfony\Bridge\Doctrine\Form\Type\EntityType;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\ChoiceType;
use Symfony\Component\Form\Extension\Core\Type\MoneyType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\Component\Validator\Constraints\NotBlank;
use Symfony\Component\Validator\Constraints\PositiveOrZero;

class MonthlyBudgetType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        // Années disponibles : année courante + 2 suivantes
        $currentYear = (int) (new \DateTimeImmutable())->format('Y');
        $years = [];
        for ($y = $currentYear; $y <= $currentYear + 2; $y++) {
            $years[$y] = $y;
        }

        $months = [
            'Janvier'   => 1,
            'Février'  => 2,
            'Mars'      => 3,
            'Avril'     => 4,
            'Mai'       => 5,
            'Juin'      => 6,
            'Juillet'   => 7,
            'Août'      => 8,
            'Septembre' => 9,
            'Octobre'   => 10,
            'Novembre'  => 11,
            'Décembre'  => 12,
        ];

        $builder
            ->add('category', EntityType::class, [
                'label' => 'Catégorie',
                'class' => Category::class,
                'choice_label' => fn(Category $c) => $c->getName(),
                'group_by' => fn(Category $c) => match ($c->getTransactionType()) {
                    Category::TYPE_INCOME   => 'Recettes',
                    Category::TYPE_EXPENSE  => 'Dépenses',
                    Category::TYPE_TRANSFER => 'Virements',
                    default => 'Autre',
                },
                'constraints' => [new NotBlank()],
            ])
            ->add('account', EntityType::class, [
                'label'        => 'Compte (optionnel)',
                'class'        => Account::class,
                'choice_label' => fn(Account $a) => $a->getName(),
                'required'     => false,
                'placeholder'  => '— Tous les comptes —',
            ])
            ->add('year', ChoiceType::class, [
                'label'   => 'Année',
                'choices' => $years,
                'data'    => $options['default_year'] ?? $currentYear,
            ])
            ->add('month', ChoiceType::class, [
                'label'   => 'Mois',
                'choices' => $months,
                'data'    => $options['default_month'] ?? (int)(new \DateTimeImmutable())->format('n'),
            ])
            ->add('plannedAmount', MoneyType::class, [
                'label'    => 'Montant prévu',
                'currency' => 'EUR',
                'constraints' => [new PositiveOrZero()],
            ])
            ->add('actualAmount', MoneyType::class, [
                'label'    => 'Montant réalisé',
                'currency' => 'EUR',
                'required' => false,
                'constraints' => [new PositiveOrZero()],
                'help' => 'Mis à jour automatiquement depuis les transactions',
            ]);
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults([
            'data_class'    => MonthlyBudget::class,
            'default_year'  => null,
            'default_month' => null,
        ]);
    }
}
