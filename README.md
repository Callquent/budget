# Budget App: Functional Guide

The Budget app is a personal financial management tool designed to provide a clear and accurate view of your financial situation. It allows you to move from simple accounting tracking to true budget planning.

---

## 📂 Application Modules

### Budget

The budget module is the steering tool. Unlike transactions, which look at the past, a budget looks toward the future.

- **Role**: Set spending limits to avoid over-indebtedness and encourage saving.
- **How it works**: For a given **Category** and a specific month, you define a "Planned" amount (e.g., €200 for Leisure in July).
- **Actual Tracking**: The app automatically calculates the "Actual" amount by summing all **Transactions** in that category for the current month.
- **Analysis**: This allows you to see at a glance whether you are below or above your goals.

### Transactions

A transaction is the act of recording a movement of money. It is the central element that feeds the rest of the system.

- **Role**: Log every financial flow.
- **Link**: A transaction is systematically linked to an **Account** (where the money moves) and a **Category** (why it moves).
- **Impact**:
  - An _Expense_ transaction decreases the account balance.
  - An _Income_ transaction increases the balance.
  - A _Transfer_ transaction adjusts the balances of both accounts involved.

### Accounts

An account is the foundation of every financial movement. It represents where the money physically resides.

- **Role**: Track the current balance of your various funding sources.
- **Examples**: Checking Account, Savings Account, Cash Wallet, Joint Account.
- **How it works**: Each account has a balance that is automatically updated with every linked transaction. It is the measure of your available wealth.

### Categories

Categories give meaning to your expenses and income. They are used to classify money to help you understand your spending habits.

- **Role**: Qualify the nature of a transaction.
- **Flow Types**:
  - **Income**: Money coming in (e.g., Salary, Allowance).
  - **Expense**: Money going out (e.g., Groceries, Rent).
  - **Transfer**: Moving money between two accounts (e.g., Checking $\rightarrow$ Savings).
- **Usefulness**: Without categories, you know _how much_ you spent, but not _why_.

### Subscriptions

Subscriptions are transaction "generators" used to automate the management of fixed costs.

- **Role**: Avoid repetitive manual entry of recurring expenses.
- **Setup**: You define a name, amount, frequency (monthly, yearly, etc.), an account, and a category.
- **Automation**: The app identifies due subscriptions and automatically generates the corresponding **Transaction**. This allows your fixed costs to be integrated into your budget effortlessly.

### Statistics

This is the final stage of analysis: transforming raw data into actionable information.

- **Role**: Visualize overall financial health over the long term.
- **Analysis**:
  - Expense breakdown by category (to identify the costliest items).
  - Evolution of account balances over time.
  - Month-to-month budget comparison.
- **Goal**: Identify trends and make informed decisions to optimize your savings.
