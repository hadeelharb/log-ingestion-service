import { and, eq, gte, ilike, lte, sql } from "drizzle-orm";

import { db } from "./index.js";
import { logs } from "./schema.js";

export type AggregateBucket = "1m" | "5m" | "1h" | "1d";

export type AggregateGroupBy = "service" | "level";

export interface AggregateOptions {
  since: Date;
  until: Date;
  bucket: AggregateBucket;
  groupBy?: AggregateGroupBy;
  service?: string;
  level?: string;
  q?: string;
  attributes?: Record<string, string>;
}

const bucketIntervals: Record<AggregateBucket, string> = {
  "1m": "1 minute",
  "5m": "5 minutes",
  "1h": "1 hour",
  "1d": "1 day",
};

export async function aggregateLogs(options: AggregateOptions) {
  const conditions = [
    gte(logs.timestamp, options.since),
    lte(logs.timestamp, options.until),
  ];

  if (options.service) {
    conditions.push(eq(logs.service, options.service));
  }

  if (options.level) {
    conditions.push(eq(logs.level, options.level));
  }

  if (options.q) {
    conditions.push(ilike(logs.message, `%${options.q}%`));
  }

  if (options.attributes) {
    for (const [key, value] of Object.entries(options.attributes)) {
      conditions.push(sql`${logs.attributes} ->> ${key} = ${value}`);
    }
  }

  const interval = bucketIntervals[options.bucket];

  const bucketExpression = sql`
    date_bin(
      ${sql.raw(`'${interval}'`)},
      ${logs.timestamp},
      TIMESTAMPTZ '1970-01-01 00:00:00+00'
    )
  `;

  /*
   * No group_by:
   * one row per time bucket, group must be null.
   */
  if (!options.groupBy) {
    const result = await db
      .select({
        start: bucketExpression,
        count: sql<number>`count(*)`,
      })
      .from(logs)
      .where(and(...conditions))
      .groupBy(bucketExpression)
      .orderBy(bucketExpression);

    return result.map((row) => ({
      start: row.start,
      group: null,
      count: Number(row.count),
    }));
  }

  /*
   * Group by service or level.
   */
  const groupExpression =
    options.groupBy === "service" ? logs.service : logs.level;

  const result = await db
    .select({
      start: bucketExpression,
      group: groupExpression,
      count: sql<number>`count(*)`,
    })
    .from(logs)
    .where(and(...conditions))
    .groupBy(bucketExpression, groupExpression)
    .orderBy(bucketExpression, groupExpression);

  return result.map((row) => ({
    start: row.start,
    group: row.group,
    count: Number(row.count),
  }));
}
