<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20250002000000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Ajout de la table subscription (abonnements récurrents)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE subscription (
                id           INT AUTO_INCREMENT NOT NULL,
                account_id   INT            NOT NULL,
                category_id  INT            NOT NULL,
                name         VARCHAR(150)   NOT NULL,
                amount       DECIMAL(10, 2) NOT NULL,
                frequency    VARCHAR(20)    NOT NULL,
                day_of_month SMALLINT       DEFAULT NULL,
                start_date   DATE           NOT NULL COMMENT '(DC2Type:date_immutable)',
                end_date     DATE           DEFAULT NULL COMMENT '(DC2Type:date_immutable)',
                status       VARCHAR(20)    NOT NULL DEFAULT 'active',
                notes        LONGTEXT       DEFAULT NULL,
                created_at   DATETIME       NOT NULL COMMENT '(DC2Type:datetime_immutable)',
                INDEX IDX_sub_account (account_id),
                INDEX IDX_sub_category (category_id),
                INDEX IDX_sub_status (status),
                PRIMARY KEY (id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        SQL);

        $this->addSql('ALTER TABLE subscription ADD CONSTRAINT FK_sub_account  FOREIGN KEY (account_id)  REFERENCES account  (id)');
        $this->addSql('ALTER TABLE subscription ADD CONSTRAINT FK_sub_category FOREIGN KEY (category_id) REFERENCES category (id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE subscription DROP FOREIGN KEY FK_sub_account');
        $this->addSql('ALTER TABLE subscription DROP FOREIGN KEY FK_sub_category');
        $this->addSql('DROP TABLE subscription');
    }
}
