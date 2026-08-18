import {
  and,
  desc,
  eq,
  gte,
  ilike,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";

import { db } from "./index.js";
import { logs } from "./schema.js";
import type { CursorData } from "../utils/cursor.js";

export interface QueryOptions {
  service?: string;
  level?: string;
  since?: Date;
  until?: Date;
  q?: string;
  attributes?: Record<string, string>;
  limit: number;
  cursor?: CursorData;
}

export async function getLogs(options: QueryOptions) {
  const conditions = [];

  if (options.service) {
    conditions.push(
      eq(logs.service, options.service),
    );
  }

  if (options.level) {
    conditions.push(
      eq(logs.level, options.level),
    );
  }

  if (options.since) {
    conditions.push(
      gte(logs.timestamp, options.since),
    );
  }

  if (options.until) {
    conditions.push(
      lte(logs.timestamp, options.until),
    );
  }

  if (options.q) {
    conditions.push(
      ilike(logs.message, `%${options.q}%`),
    );
  }

  if (options.attributes) {
    for (const [key, value] of Object.entries(
      options.attributes,
    )) {
      conditions.push(
        sql`${logs.attributes} ->> ${key} = ${value}`,
      );
    }
  }

  if (options.cursor) {
    const cursorTimestamp = new Date(
      options.cursor.timestamp,
    );

    conditions.push(
      or(
        lt(logs.timestamp, cursorTimestamp),

        and(
          eq(logs.timestamp, cursorTimestamp),
          lt(logs.id, options.cursor.id),
        ),
      ),
    );
  }

  return await db
    .select({
      id: logs.id,
      timestamp: logs.timestamp,
      level: logs.level,
      service: logs.service,
      message: logs.message,
      attributes: logs.attributes,
    })
    .from(logs)
    .where(
      conditions.length
        ? and(...conditions)
        : undefined,
    )
    .orderBy(
      desc(logs.timestamp),
      desc(logs.id),
    )
    .limit(options.limit + 1);
}