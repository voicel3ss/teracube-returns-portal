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

  const pendingTransfersInStock = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM devices
     WHERE circulation_state = 'in_stock'
       AND serial IN (
         SELECT shipment_units.device_serial
         FROM shipment_units
         INNER JOIN shipments ON shipments.id = shipment_units.shipment_id
         WHERE shipments.type = 'internal_transfer'
           AND shipments.status IN ('created', 'label_ready', 'in_transit', 'exception')
       )`,
  );
  if (pendingTransfersInStock.rows[0]?.count !== "0") throw new Error("A device awaiting warehouse transfer is incorrectly available as stock.");

  const invalidOrderPricing = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM replacement_orders
     WHERE quoted_fee_in_cents < 0
        OR quoted_deposit_in_cents < 0
        OR amount_paid_in_cents < 0
        OR deposit_refunded_in_cents < 0
        OR deposit_refunded_in_cents > LEAST(quoted_deposit_in_cents, amount_paid_in_cents)`,
  );
  if (invalidOrderPricing.rows[0]?.count !== "0") throw new Error("An order has invalid quoted pricing or refund totals.");

  const activeRepairDuplicates = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM (
       SELECT device_serial
       FROM repairs
       WHERE status IN ('received', 'in_repair', 'qc_pass')
       GROUP BY device_serial
       HAVING COUNT(*) > 1
     ) AS duplicates`,
  );
  if (activeRepairDuplicates.rows[0]?.count !== "0") throw new Error("A device has more than one active repair record.");

  const physicalStatusMismatches = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM replacement_orders AS orders
     WHERE (
       orders.status IN ('return_received', 'return_discrepancy')
       AND NOT EXISTS (
         SELECT 1 FROM shipments
         WHERE shipments.replacement_order_id = orders.id
           AND shipments.type = 'inbound'
           AND shipments.status = 'received'
       )
     ) OR (
       orders.status IN ('refurb_dispatched', 'refurb_delivered')
       AND NOT EXISTS (
         SELECT 1 FROM shipments
         WHERE shipments.replacement_order_id = orders.id
           AND shipments.type = 'outbound'
           AND shipments.status IN ('in_transit', 'delivered')
       )
     )`,
  );
  if (physicalStatusMismatches.rows[0]?.count !== "0") throw new Error("An order status disagrees with its physical shipment records.");

  const inconsistentWorkOwnership = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM work_items
     WHERE (status = 'open' AND assigned_to_staff_id IS NOT NULL)
        OR (status IN ('claimed', 'snoozed') AND assigned_to_staff_id IS NULL)`,
  );
  if (inconsistentWorkOwnership.rows[0]?.count !== "0") throw new Error("A support work item has an assignment that disagrees with its status.");

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
