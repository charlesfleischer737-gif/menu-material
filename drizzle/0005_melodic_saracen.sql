CREATE TABLE `ai_spend` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`kind` text NOT NULL,
	`budget_day` text NOT NULL,
	`reserved_cents` integer NOT NULL,
	`status` text DEFAULT 'reserved' NOT NULL,
	`usage` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_spend_day_restaurant` ON `ai_spend` (`budget_day`,`restaurant_id`);--> statement-breakpoint
CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `launch_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`email` text NOT NULL,
	`restaurant` text DEFAULT '' NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `storage_reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`bytes` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `creation_drafts` ADD `name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `creation_drafts` ADD `archived_at` integer;--> statement-breakpoint
ALTER TABLE `creation_drafts` ADD `favorite` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_drafts_kind_archive_updated` ON `creation_drafts` (`restaurant_id`,`kind`,`archived_at`,`updated_at`);--> statement-breakpoint
ALTER TABLE `outputs` ADD `next_poll_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `outputs` ADD `submitted_at` integer;--> statement-breakpoint
ALTER TABLE `outputs` ADD `poll_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `restaurants` ADD `daily_budget_cents` integer DEFAULT 2000 NOT NULL;
