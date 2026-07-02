<?php

namespace App\Form;

use App\Entity\Account;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\ChoiceType;
use Symfony\Component\Form\Extension\Core\Type\MoneyType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\Component\Validator\Constraints\NotBlank;
use Symfony\Component\Validator\Constraints\PositiveOrZero;

class AccountType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add('name', TextType::class, [
                'label' => 'Nom du compte',
                'constraints' => [new NotBlank()],
                'attr' => ['placeholder' => 'ex : Compte CCP, Livret A…'],
            ])
            ->add('currency', ChoiceType::class, [
                'label' => 'Devise',
                'choices' => ['EUR €' => 'EUR', 'USD $' => 'USD', 'CHF' => 'CHF'],
            ])
            ->add('balance', MoneyType::class, [
                'label' => 'Solde initial',
                'currency' => 'EUR',
                'constraints' => [new PositiveOrZero()],
            ]);
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults(['data_class' => Account::class]);
    }
}
