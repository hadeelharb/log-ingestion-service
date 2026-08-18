import { sql } from "drizzle-orm";

import {
  pgTable,
  uuid,
  timestamp,
  text,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

export const logs = pgTable(
  "logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    timestamp: timestamp("timestamp", {
      withTimezone: true,
    }).notNull(),

    level: text("level").notNull(),

    service: text("service").notNull(),

    message: text("message").notNull(),

    attributes: jsonb("attributes"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    timestampIdx: index("timestamp_idx").on(table.timestamp),

    serviceTimestampIdx: index("service_timestamp_idx").on(
      table.service,
      table.timestamp,
    ),

    levelTimestampIdx: index("level_timestamp_idx").on(
      table.level,
      table.timestamp,
    ),

    attributesIdx: index("attributes_idx").using(
      "gin",
      table.attributes,
    ),
    messageTrgmIdx: index("message_trgm_idx").using(
  "gin",
  sql`${table.message} gin_trgm_ops`,
),
  }),
);