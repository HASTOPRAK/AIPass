import { pool } from "./pool.js";

export async function getAdminStats() {
  const [{ rows: u }, { rows: o }, { rows: logs }] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS count FROM users`),
    pool.query(`SELECT COUNT(*)::int AS count FROM organizations`),
    pool.query(`SELECT COUNT(*)::int AS count FROM usage_logs`),
  ]);

  return {
    users: u[0].count,
    orgs: o[0].count,
    usageLogs: logs[0].count,
  };
}

export async function getRecentUsage(limit = 20) {
  const { rows } = await pool.query(
    `SELECT ul.created_at, ul.tool_key, ul.credits_charged, ul.status, ul.error_message,
            u.email, u.role
     FROM usage_logs ul
     JOIN users u ON u.id = ul.user_id
     ORDER BY ul.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function listUsers(limit = 50) {
  const { rows } = await pool.query(
    `SELECT id, name, email, role, credits, org_id, created_at
     FROM users
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}
