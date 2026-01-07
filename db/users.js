import { pool } from "./pool.js";

export async function findUserByEmail(email) {
    const { rows } = await pool.query(
        'SELECT id, name, email, password_hash, role, credits FROM users WHERE email = $1',
        [email.toLowerCase()]
    );
    return rows[0] || null;
}

export async function createUser({ name, email, passwordHash, role }) {
    const { rows } = await pool.query(
        'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, credits',
        [name.trim(), email.toLowerCase(), passwordHash, role]
    );
    return rows[0];
}

export async function findUserById(id) {
    const { rows } = await pool.query(
        'SELECT id, name, email, password_hash, role, credits FROM users WHERE id = $1',
        [id]
    );
    return rows[0] || null;
}

export async function findUserByGoogleId(googleId) {
  const { rows } = await pool.query(
    `SELECT id, name, email, password_hash, role, credits FROM users WHERE google_id = $1`,
    [googleId]
  );
  return rows[0] || null;
}

export async function createGoogleUser({ name, email, googleId, role = "INDIVIDUAL" }) {
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, google_id, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role, credits`,
    [name.trim(), email.toLowerCase(), googleId, role]
  );
  return rows[0];
}
