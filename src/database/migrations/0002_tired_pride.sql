DROP INDEX "service_idx";--> statement-breakpoint
DROP INDEX "level_idx";--> statement-breakpoint
DROP INDEX "timestamp_service_idx";--> statement-breakpoint
DROP INDEX "timestamp_level_idx";--> statement-breakpoint
CREATE INDEX "service_timestamp_idx" ON "logs" USING btree ("service","timestamp");--> statement-breakpoint
CREATE INDEX "level_timestamp_idx" ON "logs" USING btree ("level","timestamp");