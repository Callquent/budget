<?php

namespace App\Form;

use App\Entity\Category;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\ChoiceType;
use Symfony\Component\Form\Extension\Core\Type\TextareaType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\Component\Validator\Constraints\NotBlank;

class CategoryType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add('name', TextType::class, [
                'label' => 'Nom',
                'constraints' => [new NotBlank()],
                'attr' => ['placeholder' => 'ex : Courses, Salaire…'],
            ])
            ->add('transactionType', ChoiceType::class, [
                'label' => 'Type de transaction',
                'choices' => [
                    'Recette (entrée)'  => Category::TYPE_INCOME,
                    'Dépense (sortie)'  => Category::TYPE_EXPENSE,
                    'Virement interne'  => Category::TYPE_TRANSFER,
                ],
            ])
            ->add('frequency', ChoiceType::class, [
                'label' => 'Fréquence',
                'choices' => [
                    'Mensuelle'      => Category::FREQ_MONTHLY,
                    'Annuelle'       => Category::FREQ_YEARLY,
                    'Trimestrielle'  => Category::FREQ_QUARTERLY,
                    'Occasionnelle'  => Category::FREQ_OCCASIONAL,
                ],
            ])
            ->add('description', TextareaType::class, [
                'label'    => 'Description',
                'required' => false,
                'attr'     => ['rows' => 3],
            ]);
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults(['data_class' => Category::class]);
    }
}
