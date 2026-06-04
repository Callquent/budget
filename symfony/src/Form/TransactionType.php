<?php

namespace App\Form;

use App\Entity\Account;
use App\Entity\Category;
use App\Entity\Transaction;
use Symfony\Bridge\Doctrine\Form\Type\EntityType;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\ChoiceType;
use Symfony\Component\Form\Extension\Core\Type\DateType;
use Symfony\Component\Form\Extension\Core\Type\MoneyType;
use Symfony\Component\Form\Extension\Core\Type\TextareaType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\Component\Validator\Constraints\NotBlank;
use Symfony\Component\Validator\Constraints\Positive;

class TransactionType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add('transactionDate', DateType::class, [
                'label'  => 'Date',
                'widget' => 'single_text',
                'input'  => 'datetime_immutable',
                'data'   => $options['default_date'] ?? new \DateTimeImmutable(),
                'constraints' => [new NotBlank()],
            ])
            ->add('account', EntityType::class, [
                'label'        => 'Compte',
                'class'        => Account::class,
                'choice_label' => fn(Account $a) => $a->getName(),
                'constraints'  => [new NotBlank()],
            ])
            ->add('category', EntityType::class, [
                'label'        => 'Catégorie',
                'class'        => Category::class,
                'choice_label' => fn(Category $c) => $c->getName(),
                'group_by'     => fn(Category $c) => match ($c->getTransactionType()) {
                    Category::TYPE_INCOME   => '↑ Recettes',
                    Category::TYPE_EXPENSE  => '↓ Dépenses',
                    Category::TYPE_TRANSFER => '⇄ Virements',
                    default                 => 'Autre',
                },
                'constraints' => [new NotBlank()],
            ])
            ->add('type', ChoiceType::class, [
                'label'   => 'Sens',
                'choices' => [
                    'Crédit — entrée d\'argent (+)' => Transaction::TYPE_CREDIT,
                    'Débit — sortie d\'argent (−)'  => Transaction::TYPE_DEBIT,
                    'Virement interne'               => Transaction::TYPE_TRANSFER,
                ],
                'constraints' => [new NotBlank()],
            ])
            ->add('amount', MoneyType::class, [
                'label'    => 'Montant',
                'currency' => 'EUR',
                'constraints' => [new Positive()],
            ])
            ->add('label', TextType::class, [
                'label'       => 'Libellé',
                'constraints' => [new NotBlank()],
                'attr'        => ['placeholder' => 'ex : Salaire juin 2026, Courses Leclerc…'],
            ])
            ->add('notes', TextareaType::class, [
                'label'    => 'Notes',
                'required' => false,
                'attr'     => ['rows' => 2],
            ]);
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults([
            'data_class'   => Transaction::class,
            'default_date' => null,
        ]);
    }
}
