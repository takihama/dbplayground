# Database Transaction Testing

This project tests concurrent order insertion with balance validation in PostgreSQL. It simulates multiple simultaneous debit operations and validates that the balance doesn't go negative using different transaction isolation levels and locking strategies.

## What it does

- Creates an orders table with an initial balance of 100 USD
- Attempts to insert 10 concurrent debit orders of 40 USD each
- Validates balance before/after insertion to prevent negative balances
- Tests different isolation levels (READ_COMMITTED, REPEATABLE_READ, SERIALIZABLE)
- Supports two order insertion strategies:
  - Version 1: Check balance first, then insert
  - Version 2: Insert first, then check balance and update status if needed

## How to run

1. Start the PostgreSQL database:
   ```bash
   yarn docker:up
   ```

2. Run the test:
   ```bash
   yarn start
   ```

3. Stop the database when done:
   ```bash
   yarn docker:down
   ```

The script will output the initial balance, final balance, and the count of completed/failed orders.

