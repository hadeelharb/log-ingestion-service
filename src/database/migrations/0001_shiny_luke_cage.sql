CREATE INDEX "timestamp_service_idx" ON "logs" USING btree ("service","timestamp");--> statement-breakpoint
CREATE INDEX "timestamp_level_idx" ON "logs" USING btree ("level","timestamp");--> statement-breakpoint
CREATE INDEX "attributes_idx" ON "logs" USING gin ("attributes");