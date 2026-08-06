import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const pool = new Pool({ connectionString });

async function verify() {
  const seededModels = await pool.query<{ code: string }>(
    `SELECT code FROM device_models WHERE code IN ('T2E', 'T2S', 'TC4') ORDER BY code`,
  );
  const codes = seededModels.rows.map((row) => row.code);
  if (codes.join(",") !== "T2E,T2S,TC4") throw new Error(`Unexpected seeded models: ${codes.join(",")}`);

  const primaryIndex = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'customer_emails_one_primary_per_customer'
    ) AS exists`,
  );
  if (!primaryIndex.rows[0]?.exists) throw new Error("Primary-email uniqueness index is missing.");

  const client = await pool.connect();
  let mutationWasBlocked = false;
  try {
    await client.query("BEGIN");
    const id = randomUUID();
    await client.query(
      `INSERT INTO audit_events
        (id, actor_kind, action, entity_type, entity_id, occurred_at)
       VALUES ($1, 'system', 'database.verify', 'system', 'local', now())`,
      [id],
    );
    try {
      await client.query(`UPDATE audit_events SET action = 'tampered' WHERE id = $1`, [id]);
    } catch (error) {
      mutationWasBlocked = error instanceof Error && error.message.includes("append-only");
    }
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }

  if (!mutationWasBlocked) throw new Error("Audit-event mutation was not blocked by PostgreSQL.");
  console.log("Database verified: migration, seed data, constraints, and append-only audit events are healthy.");
}

verify()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exitCode = 1;
  });
