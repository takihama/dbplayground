import "dotenv/config";
import { Pool } from "pg";
import { createPool, setupDatabase } from "./database";
import { insertOrder, findOrders, getBalance } from "./orders";

const ORDERS_COUNT = 10;
const ISOLATION_LEVEL = "SERIALIZABLE"; // READ_COMMITTED, REPEATABLE_READ or SERIALIZABLE
const VERSION = 1; // 1: check and then insert or 2: insert and then check
const PERFORM_LOCK = false; // execute PERFORM LOCK before SELECT orders

const testOrders = async (pool: Pool) => {
  // Test: insert orders
  await Promise.all(
    new Array(Number(ORDERS_COUNT))
      .fill(0)
      .map((_, i) => ({
        id: i + 2,
        amount: 40,
        currency: "USD",
        operation: "debit",
      }))
      .map(async (o) => {
        try {
          const orderResult = await insertOrder(
            pool,
            o.id,
            o.amount,
            o.currency,
            o.operation,
            {
              version: VERSION,
              performLock: PERFORM_LOCK,
              isolationLevel: ISOLATION_LEVEL,
            }
          );

          return orderResult;
        } catch (error: any) {
          console.error("Error inserting order: ", error.message);
          return null;
        }
      })
  );
};

(async () => {
  const pool = createPool();

  try {
    await setupDatabase(pool);

    const initialBalance = await getBalance(pool, "USD");

    // Test: insert orders
    await testOrders(pool);

    const finalOrders = (await findOrders(pool)).data.reduce(
      (acc, o) => {
        if (o.status === "FAILED") {
          acc.failed++;
        } else {
          acc.completed++;
        }
        return acc;
      },
      { failed: 0, completed: 0 }
    );
    const finalBalance = await getBalance(pool, "USD");

    console.info("Initial Balance: ", initialBalance.data);
    console.info("Final Balance: ", finalBalance.data);
    console.info("Final Orders: ", finalOrders);

    await pool.end();
  } catch (error: any) {
    console.error("Error: ", error.message);
    await pool.end();
  }
})();
