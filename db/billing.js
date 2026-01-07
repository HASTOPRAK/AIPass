import { pool } from "./pool.js";

export async function addCreditsAndLogPurchase({ userId, packageKey, creditsAdded }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE users SET credits = credits + $1 WHERE id = $2`,
      [creditsAdded, userId]
    );

    await client.query(
      `INSERT INTO credit_purchases (user_id, package_key, credits_added)
       VALUES ($1, $2, $3)`,
      [userId, packageKey, creditsAdded]
    );

    const { rows } = await client.query(`SELECT credits FROM users WHERE id = $1`, [userId]);

    await client.query("COMMIT");
    return rows[0]?.credits ?? null;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
