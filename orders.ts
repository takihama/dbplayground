import { Pool } from "pg";
import { withTransaction } from "./utils";

const getBalance = async (pool: Pool, currency: string) => {
  return await withTransaction(pool, async (client) => {
    const balance = await client.query(
      `SELECT SUM(amount) as balance FROM orders WHERE currency = $1 AND status = 'COMPLETED'`,
      [currency]
    );
    return balance.rows[0].balance;
  });
};

const findOrders = async (pool: Pool) => {
  return await withTransaction(pool, async (client) => {
    const ordersResult = await client.query(`SELECT * FROM orders;`);
    return ordersResult.rows;
  });
};

// V1: Get balance and then insert order
const insertOrderV1 = async (
  pool: Pool,
  id: number,
  amount: number,
  currency: string,
  operation: string | "credit" | "debit",
  opts: {
    performLock: boolean;
    isolationLevel: string;
  } = {
    performLock: true,
    isolationLevel: "READ COMMITTED",
  }
) => {
  return await withTransaction(
    pool,
    async (client) => {
      // Perform lock before getting orders for balance calculation
      if (opts.performLock) {
        await client.query(
          `SELECT * FROM orders WHERE currency = $1 AND status = 'COMPLETED' FOR UPDATE;`,
          [currency]
        );
      }

      const ordersResult = await client.query(
        `SELECT id, amount, status FROM orders WHERE currency = $1 AND status = 'COMPLETED' FOR UPDATE;`,
        [currency]
      );
      console.info(
        `Order ${id}: views orders: ${ordersResult.rows.map((o) => o.id)}`
      );
      const balance = ordersResult.rows.reduce((acc, order) => {
        if (order.status === "COMPLETED") {
          return acc + order.amount;
        }
        return acc;
      }, 0);
      let status = "COMPLETED";

      if (operation === "debit" && Number(balance ?? 0) < amount) {
        status = "FAILED";
      }
      const orderResult = await client.query(
        "INSERT INTO orders (id, amount, currency, status, operation) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING RETURNING *",
        [
          id,
          operation === "debit" ? -amount : amount,
          currency,
          status,
          operation,
        ]
      );
      return orderResult.rows[0];
    },
    opts.isolationLevel
  );
};

// V2: Insert order and then get balance
const insertOrderV2 = async (
  pool: Pool,
  id: number,
  amount: number,
  currency: string,
  operation: string | "credit" | "debit",
  opts: {
    performLock: boolean;
    isolationLevel: string;
  } = {
    performLock: true,
    isolationLevel: "READ COMMITTED",
  }
) => {
  return await withTransaction(pool, async (client) => {
    let status = "COMPLETED";
    const orderResult = await client.query(
      "INSERT INTO orders (id, amount, currency, status, operation) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING RETURNING *",
      [
        id,
        operation === "debit" ? -amount : amount,
        currency,
        status,
        operation,
      ]
    );

    // Perform lock before getting orders for balance calculation
    if (opts.performLock) {
      await client.query(
        `SELECT * FROM orders WHERE currency = $1 FOR UPDATE;`,
        [currency]
      );
    }

    const ordersResult = await client.query(
      `SELECT id, amount, status FROM orders WHERE currency = $1;`,
      [currency]
    );
    console.info(
      `Order ${id}: views orders: ${ordersResult.rows.map((o) => o.id)}`
    );
    const balance = ordersResult.rows.reduce((acc, order) => {
      if (order.status === "COMPLETED") {
        return acc + order.amount;
      }
      return acc;
    }, 0);

    if (operation === "debit" && Number(balance ?? 0) < 0) {
      const updateResult = await client.query(
        "UPDATE orders SET status = 'FAILED' WHERE id = $1 RETURNING *",
        [id]
      );
      return updateResult.rows[0];
    }

    return orderResult.rows[0];
  }, opts.isolationLevel);
};

const insertOrder = async (
  pool: Pool,
  id: number,
  amount: number,
  currency: string,
  operation: string | "credit" | "debit",
  opts: {
    version: 1 | 2;
    performLock: boolean;
    isolationLevel: string;
  } = {
    version: 2,
    performLock: true,
    isolationLevel: "READ COMMITTED",
  }
) => {
  if (opts.version === 1) {
    return await insertOrderV1(pool, id, amount, currency, operation, opts);
  } else {
    return await insertOrderV2(pool, id, amount, currency, operation, opts);
  }
};

export { insertOrder, findOrders, getBalance };
