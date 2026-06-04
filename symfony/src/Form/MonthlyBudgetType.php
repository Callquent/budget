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
        $currentYear = (int) (new \DateTimeImmutable())->format('Y');

        // Lire l'année de l'entité liée (disponible dans $options['data'])
        // pour inclure les années passées (ex : 2024, 2025) dans la liste.
        /** @var MonthlyBudget|null $entity */
        $entity      = $options['data'] ?? null;
        $entityYear  = ($entity instanceof MonthlyBudget && $entity->getYear() > 0)
                        ? $entity->getYear()
                        : $currentYear;

        // Plage : de la plus ancienne entre l'année de l'entité et (currentYear - 1)
        // jusqu'à currentYear + 2, pour couvrir passé ET futur.
        $minYear = min($entityYear, $currentYear - 1);
        $years   = [];
        for ($y = $minYear; $y <= $currentYear + 2; $y++) {
            $years[$y] = $y;
        }

        $months = [
            'Janvier'   => 1,
            'Février'   => 2,
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
                'label'        => 'Catégorie',
                'class'        => Category::class,
                'choice_label' => fn(Category $c) => $c->getName(),
                'group_by'     => fn(Category $c) => match ($c->getTransactionType()) {
                    Category::TYPE_INCOME   => 'Recettes',
                    Category::TYPE_EXPENSE  => 'Dépenses',
                    Category::TYPE_TRANSFER => 'Virements',
                    default                 => 'Autre',
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
                // Pas de 'data' : Symfony lit $entity->getYear() via le data_class.
            ])
            ->add('month', ChoiceType::class, [
                'label'   => 'Mois',
                'choices' => $months,
                // Pas de 'data' : Symfony lit $entity->getMonth() via le data_class.
            ])
            ->add('plannedAmount', MoneyType::class, [
                'label'       => 'Montant prévu',
                'currency'    => 'EUR',
                'constraints' => [new PositiveOrZero()],
            ])
            ->add('actualAmount', MoneyType::class, [
                'label'       => 'Montant réalisé',
                'currency'    => 'EUR',
                'required'    => false,
                'constraints' => [new PositiveOrZero()],
                'help'        => 'Mis à jour automatiquement depuis les transactions',
            ]);
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults([
            'data_class' => MonthlyBudget::class,
        ]);
    }
}
