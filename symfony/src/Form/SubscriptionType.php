<?php

namespace App\Form;

use App\Entity\Account;
use App\Entity\Category;
use App\Entity\Subscription;
use Symfony\Bridge\Doctrine\Form\Type\EntityType;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\ChoiceType;
use Symfony\Component\Form\Extension\Core\Type\DateType;
use Symfony\Component\Form\Extension\Core\Type\IntegerType;
use Symfony\Component\Form\Extension\Core\Type\MoneyType;
use Symfony\Component\Form\Extension\Core\Type\TextareaType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\Component\Validator\Constraints\NotBlank;
use Symfony\Component\Validator\Constraints\Positive;
use Symfony\Component\Validator\Constraints\Range;

class SubscriptionType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add('name', TextType::class, [
                'label' => 'Nom de l\'abonnement',
                'constraints' => [new NotBlank()],
                'attr' => ['placeholder' => 'ex : Netflix, Navigo annuel…'],
            ])
            ->add('account', EntityType::class, [
                'label' => 'Compte débité',
                'class' => Account::class,
                'choice_label' => fn(Account $a) => $a->getName(),
            ])
            ->add('category', EntityType::class, [
                'label' => 'Catégorie',
                'class' => Category::class,
                'choice_label' => fn(Category $c) => $c->getName(),
                'group_by' => fn(Category $c) => match($c->getTransactionType()) {
                    Category::TYPE_INCOME   => 'Recettes',
                    Category::TYPE_EXPENSE  => 'Dépenses',
                    Category::TYPE_TRANSFER => 'Virements',
                    default => 'Autre',
                },
            ])
            ->add('amount', MoneyType::class, [
                'label' => 'Montant',
                'currency' => 'EUR',
                'constraints' => [new Positive()],
            ])
            ->add('frequency', ChoiceType::class, [
                'label' => 'Fréquence de prélèvement',
                'choices' => [
                    'Mensuelle'     => Subscription::FREQ_MONTHLY,
                    'Annuelle'      => Subscription::FREQ_YEARLY,
                    'Trimestrielle' => Subscription::FREQ_QUARTERLY,
                    'Occasionnelle' => Subscription::FREQ_OCCASIONAL,
                ],
            ])
            ->add('dayOfMonth', IntegerType::class, [
                'label'    => 'Jour du mois (optionnel)',
                'required' => false,
                'constraints' => [new Range(['min' => 1, 'max' => 28])],
                'attr' => ['placeholder' => '1 à 28'],
                'help' => 'Jour de prélèvement mensuel (laisser vide si non applicable)',
            ])
            ->add('startDate', DateType::class, [
                'label'  => 'Date de début',
                'widget' => 'single_text',
                'input'  => 'datetime_immutable',
                'constraints' => [new NotBlank()],
            ])
            ->add('endDate', DateType::class, [
                'label'    => 'Date de fin',
                'widget'   => 'single_text',
                'input'    => 'datetime_immutable',
                'required' => false,
                'help'     => 'Laisser vide si l\'abonnement est sans fin',
            ])
            ->add('status', ChoiceType::class, [
                'label' => 'Statut',
                'choices' => [
                    'Actif'   => Subscription::STATUS_ACTIVE,
                    'Inactif' => Subscription::STATUS_INACTIVE,
                ],
            ])
            ->add('notes', TextareaType::class, [
                'label'    => 'Notes',
                'required' => false,
                'attr'     => ['rows' => 3],
            ]);
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults(['data_class' => Subscription::class]);
    }
}
