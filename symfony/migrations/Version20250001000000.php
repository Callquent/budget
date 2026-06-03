<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20250001000000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Création du schéma budget : account, category, transaction, monthly_budget';
    }

    public function up(Schema $schema): void
    {
        // ── account ──────────────────────────────────────────────────────────
        $this->addSql(<<<'SQL'
            CREATE TABLE account (
                id         INT AUTO_INCREMENT NOT NULL,
                name       VARCHAR(100)    NOT NULL,
                type       VARCHAR(20)     NOT NULL COMMENT '"credit" ou "debit"',
                currency   VARCHAR(3)      NOT NULL DEFAULT 'EUR',
                balance    DECIMAL(12, 2)  NOT NULL DEFAULT '0.00',
                created_at DATETIME        NOT NULL COMMENT '(DC2Type:datetime_immutable)',
                PRIMARY KEY (id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        SQL);

        // ── category ─────────────────────────────────────────────────────────
        $this->addSql(<<<'SQL'
            CREATE TABLE category (
                id               INT AUTO_INCREMENT NOT NULL,
                name             VARCHAR(100)  NOT NULL,
                transaction_type VARCHAR(20)   NOT NULL COMMENT '"income", "expense" ou "transfer"',
                frequency        VARCHAR(20)   NOT NULL COMMENT '"monthly","yearly","quarterly","occasional"',
                description      LONGTEXT      DEFAULT NULL,
                PRIMARY KEY (id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        SQL);

        // ── transaction ──────────────────────────────────────────────────────
        $this->addSql(<<<'SQL'
            CREATE TABLE transaction (
                id               INT AUTO_INCREMENT NOT NULL,
                account_id       INT             NOT NULL,
                category_id      INT             NOT NULL,
                amount           DECIMAL(10, 2)  NOT NULL,
                type             VARCHAR(20)     NOT NULL COMMENT '"credit" ou "debit"',
                transaction_date DATE            NOT NULL COMMENT '(DC2Type:date_immutable)',
                year             SMALLINT        NOT NULL,
                month            SMALLINT        NOT NULL,
                label            VARCHAR(255)    NOT NULL,
                notes            LONGTEXT        DEFAULT NULL,
                created_at       DATETIME        NOT NULL COMMENT '(DC2Type:datetime_immutable)',
                INDEX idx_year_month (year, month),
                INDEX idx_date (transaction_date),
                INDEX IDX_account (account_id),
                INDEX IDX_category (category_id),
                PRIMARY KEY (id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        SQL);

        // ── monthly_budget ────────────────────────────────────────────────────
        $this->addSql(<<<'SQL'
            CREATE TABLE monthly_budget (
                id             INT AUTO_INCREMENT NOT NULL,
                category_id    INT             NOT NULL,
                year           SMALLINT        NOT NULL,
                month          SMALLINT        NOT NULL,
                planned_amount DECIMAL(10, 2)  NOT NULL DEFAULT '0.00',
                actual_amount  DECIMAL(10, 2)  NOT NULL DEFAULT '0.00',
                UNIQUE INDEX uniq_budget_period (category_id, year, month),
                INDEX idx_budget_period (year, month),
                INDEX IDX_category (category_id),
                PRIMARY KEY (id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        SQL);

        // ── foreign keys ──────────────────────────────────────────────────────
        $this->addSql('ALTER TABLE transaction  ADD CONSTRAINT FK_transaction_account  FOREIGN KEY (account_id)    REFERENCES account  (id)');
        $this->addSql('ALTER TABLE transaction  ADD CONSTRAINT FK_transaction_category FOREIGN KEY (category_id)   REFERENCES category (id)');
        $this->addSql('ALTER TABLE monthly_budget ADD CONSTRAINT FK_budget_category     FOREIGN KEY (category_id)   REFERENCES category (id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE transaction    DROP FOREIGN KEY FK_transaction_account');
        $this->addSql('ALTER TABLE transaction    DROP FOREIGN KEY FK_transaction_category');
        $this->addSql('ALTER TABLE monthly_budget DROP FOREIGN KEY FK_budget_category');
        $this->addSql('DROP TABLE monthly_budget');
        $this->addSql('DROP TABLE transaction');
        $this->addSql('DROP TABLE category');
        $this->addSql('DROP TABLE account');
    }
}
