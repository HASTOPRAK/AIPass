import { pool } from "./pool.js";

export async function chargeCreditsAndLog({
  userId,
  toolKey,
  creditsCharged,
  inputChars = 0,
  outputChars = 0,
  status = "SUCCESS",
  errorMessage = null,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows: userRows } = await client.query(
      `SELECT id, credits FROM users WHERE id = $1 FOR UPDATE`,
      [userId]
    );

    const user = userRows[0];
    if (!user) {
      const err = new Error("User not found");
      err.code = "USER_NOT_FOUND";
      throw err;
    }

    if (status === "SUCCESS") {
      if (user.credits < creditsCharged) {
        await client.query(
      `INSERT INTO usage_logs
       (user_id, tool_key, credits_charged, input_chars, output_chars, status, error_message)
       VALUES ($1, $2, $3, $4, $5, 'FAILED', $6)`,
      [userId, toolKey, creditsCharged, inputChars, 0, "INSUFFICIENT_CREDITS"]
    );

    await client.query("COMMIT");

    const err = new Error("Insufficient credits");
    err.code = "INSUFFICIENT_CREDITS";
    err.available = user.credits;
    throw err;
  }

  await client.query(
    `UPDATE users SET credits = credits - $1 WHERE id = $2`,
    [creditsCharged, userId]
  );
    }

    await client.query(
      `INSERT INTO usage_logs
       (user_id, tool_key, credits_charged, input_chars, output_chars, status, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, toolKey, creditsCharged, inputChars, outputChars, status, errorMessage]
    );

    const { rows: updatedRows } = await client.query(
      `SELECT credits FROM users WHERE id = $1`,
      [userId]
    );

    await client.query("COMMIT");
    return { credits: updatedRows[0].credits };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getUsageForUser(userId, limit = 20) {
  const { rows } = await pool.query(
    `SELECT tool_key, credits_charged, status, created_at
     FROM usage_logs
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

