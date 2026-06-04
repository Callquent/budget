<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20250003000000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Ajout des colonnes approved_at et approved_transaction_id sur monthly_budget';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE monthly_budget
            ADD approved_at DATETIME DEFAULT NULL COMMENT \'(DC2Type:datetime_immutable)\',
            ADD approved_transaction_id INT DEFAULT NULL');

        $this->addSql('ALTER TABLE monthly_budget
            ADD CONSTRAINT FK_budget_approved_tx
            FOREIGN KEY (approved_transaction_id)
            REFERENCES `transaction` (id)
            ON DELETE SET NULL');

        $this->addSql('CREATE INDEX IDX_budget_approved_tx ON monthly_budget (approved_transaction_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE monthly_budget DROP FOREIGN KEY FK_budget_approved_tx');
        $this->addSql('DROP INDEX IDX_budget_approved_tx ON monthly_budget');
        $this->addSql('ALTER TABLE monthly_budget DROP approved_at, DROP approved_transaction_id');
    }
}
