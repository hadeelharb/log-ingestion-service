CREATE EXTENSION IF NOT EXISTS pg_trgm;

--> statement-breakpoint

DROP INDEX IF EXISTS "message_trgm_idx";

--> statement-breakpoint

CREATE INDEX "message_trgm_idx"
ON "logs"
USING gin ("message" gin_trgm_ops);