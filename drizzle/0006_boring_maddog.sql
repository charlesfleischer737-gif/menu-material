CREATE UNIQUE INDEX `idx_launch_request_email` ON `launch_requests` (`kind`,`email`);--> statement-breakpoint
CREATE INDEX `idx_outputs_poll` ON `outputs` (`status`,`next_poll_at`,`lease_until`);--> statement-breakpoint
CREATE INDEX `idx_outputs_restaurant_submitted` ON `outputs` (`restaurant_id`,`submitted_at`);--> statement-breakpoint
CREATE INDEX `idx_storage_restaurant` ON `storage_reservations` (`restaurant_id`);