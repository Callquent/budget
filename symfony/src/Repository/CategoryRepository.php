<?php

namespace App\Repository;

use App\Entity\Category;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class CategoryRepository extends ServiceEntityRepository
{
    private const DEFAULT_TRANSFER_NAME = 'Virement';

    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Category::class);
    }

    public function findByTransactionType(string $type): array
    {
        return $this->createQueryBuilder('c')
            ->where('c.transactionType = :type')
            ->setParameter('type', $type)
            ->orderBy('c.name', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Garantit qu'une catégorie de type Virement existe toujours, sans que
     * l'utilisateur ait à la créer manuellement. Une seule suffit : le compte
     * destination d'un virement se choisit directement sur la ligne de
     * budget (Budget::destinationAccount), pas via des catégories dédiées
     * par compte (ex : "Virement Livret A", "Virement porte-monnaie"…).
     *
     * Cherche par transactionType plutôt que par nom : si l'utilisateur
     * renomme la catégorie depuis /categories, elle reste "la" catégorie
     * virement et n'est pas recréée en double.
     */
    public function findOrCreateTransferCategory(): Category
    {
        $existing = $this->findOneBy(['transactionType' => Category::TYPE_TRANSFER]);
        if ($existing) {
            return $existing;
        }

        $category = (new Category())
            ->setName(self::DEFAULT_TRANSFER_NAME)
            ->setTransactionType(Category::TYPE_TRANSFER)
            ->setDescription('Virements entre vos propres comptes — créée automatiquement.');

        $em = $this->getEntityManager();
        $em->persist($category);
        $em->flush();

        return $category;
    }
}
