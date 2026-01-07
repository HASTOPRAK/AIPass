import { pool } from "./pool.js";

export async function getOrgByOwnerId(ownerUserId) {
  const { rows } = await pool.query(
    `SELECT id, name, owner_user_id FROM organizations WHERE owner_user_id = $1`,
    [ownerUserId]
  );
  return rows[0] || null;
}

export async function createOrgForOwner({ ownerUserId, name }) {
  const { rows } = await pool.query(
    `INSERT INTO organizations (name, owner_user_id)
     VALUES ($1, $2)
     RETURNING id, name, owner_user_id`,
    [name.trim(), ownerUserId]
  );
  return rows[0];
}

export async function listEmployeesByOrgId(orgId) {
  const { rows } = await pool.query(
    `SELECT id, name, email, role, credits, created_at
     FROM users
     WHERE org_id = $1
     ORDER BY created_at DESC`,
    [orgId]
  );
  return rows;
}

export async function setEmployeeCredits({ employeeId, orgId, credits }) {
  const { rows } = await pool.query(
    `UPDATE users
     SET credits = $1
     WHERE id = $2 AND org_id = $3
     RETURNING id, name, email, credits`,
    [credits, employeeId, orgId]
  );
  return rows[0] || null;
}

export async function listOrganizations(limit = 50) {
  const { rows } = await pool.query(
    `SELECT o.id, o.name, o.owner_user_id, u.email AS owner_email
     FROM organizations o
     JOIN users u ON u.id = o.owner_user_id
     ORDER BY o.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function assignUserToOrg({ userId, orgId }) {
  const { rows } = await pool.query(
    `UPDATE users
     SET org_id = $1
     WHERE id = $2
     RETURNING id, name, email, role, credits, org_id`,
    [orgId, userId]
  );
  return rows[0] || null;
}

export async function removeUserFromOrg({ userId }) {
  const { rows } = await pool.query(
    `UPDATE users
     SET org_id = NULL
     WHERE id = $1
     RETURNING id, name, email, role, credits, org_id`,
    [userId]
  );
  return rows[0] || null;
}

export async function assignUserToOwnersOrgByEmail({ ownerUserId, email }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: orgRows } = await client.query(
      `SELECT id FROM organizations WHERE owner_user_id = $1`,
      [ownerUserId]
    );
    const org = orgRows[0];
    if (!org) {
      const err = new Error("Owner organization not found");
      err.code = "ORG_NOT_FOUND";
      throw err;
    }

    const { rows: userRows } = await client.query(
      `SELECT id, email, role FROM users WHERE lower(email) = lower($1)`,
      [email.trim()]
    );
    const user = userRows[0];
    if (!user) {
      const err = new Error("User not found");
      err.code = "USER_NOT_FOUND";
      throw err;
    }

    // Only INDIVIDUALs can be employees
    if (user.role !== "INDIVIDUAL") {
      const err = new Error("Only INDIVIDUAL users can be added as employees");
      err.code = "INVALID_ROLE";
      throw err;
    }

    const { rows: updatedRows } = await client.query(
      `UPDATE users
       SET org_id = $1
       WHERE id = $2
       RETURNING id, name, email, role, credits, org_id`,
      [org.id, user.id]
    );

    await client.query("COMMIT");
    return updatedRows[0];
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
