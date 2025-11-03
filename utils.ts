import { Pool } from "pg";

export const withTransaction = async <T>(
  pool: Pool,
  callback: (client: any) => Promise<T>,
  isolationLevel: string = "READ COMMITTED"
) => {
  const client = await pool.connect();
  try {
    await client.query(`BEGIN ISOLATION LEVEL ${isolationLevel}`);
    const txid = await client.query("SELECT txid_current() as txid");
    try {
      const data = await callback(client);
      await client.query("COMMIT");
      return { txid: txid.rows[0].txid, data };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    client.release();
  }
};
