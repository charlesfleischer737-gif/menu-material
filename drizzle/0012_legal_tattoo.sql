CREATE INDEX `idx_events_kind_created` ON `events` (`kind`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_events_restaurant_kind_created` ON `events` (`restaurant_id`,`kind`,`created_at`);