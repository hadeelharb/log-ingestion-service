import { sql } from "drizzle-orm";
import { db } from "../database/index.js";

const BATCH_SIZE = 5000;

export async function deleteExpiredLogs() {
  const retentionDays = Number(
    process.env.RETENTION_DAYS ?? 30,
  );

  if (
    !Number.isInteger(retentionDays) ||
    retentionDays < 1
  ) {
    throw new Error(
      "RETENTION_DAYS must be a positive integer",
    );
  }

  const cutoff = new Date(
    Date.now() -
      retentionDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  let totalDeleted = 0;

  while (true) {
    const result = await db.execute(sql`
      WITH expired AS (
        SELECT id
        FROM logs
        WHERE timestamp < ${cutoff}::timestamptz
        ORDER BY timestamp ASC
        LIMIT ${BATCH_SIZE}
      )
      DELETE FROM logs
      WHERE id IN (
        SELECT id
        FROM expired
      )
      RETURNING id;
    `);

    const deletedCount = result.length;

    totalDeleted += deletedCount;

    if (deletedCount < BATCH_SIZE) {
      break;
    }
  }

  return totalDeleted;
}