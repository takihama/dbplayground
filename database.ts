import { Pool } from "pg";

export const createPool = () =>
  new Pool({
    user: "postgres",
    host: "localhost",
    database: "postgres",
    password: "iamroot",
    port: 5438,
    max: 10, // Maximum number of clients in the pool
  });

export const setupDatabase = async (pool: Pool) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DROP TABLE IF EXISTS orders;");
    await client.query(
      "CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, amount int4, currency varchar(3), status varchar(10), operation varchar(10));"
    );
    await client.query(
      "INSERT INTO orders (id, amount, currency, status, operation) VALUES (1, 100, 'USD', 'COMPLETED', 'credit') ON CONFLICT (id) DO NOTHING;"
    );
    await client.query("COMMIT");
  } finally {
    client.release();
  }
};
