CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`dish_id` text,
	`kind` text NOT NULL,
	`key` text NOT NULL,
	`working_key` text,
	`mime` text NOT NULL,
	`name` text NOT NULL,
	`approved_at` integer,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dish_id`) REFERENCES `dishes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_assets_restaurant_dish` ON `assets` (`restaurant_id`,`dish_id`);--> statement-breakpoint
CREATE TABLE `captions` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`dish_id` text NOT NULL,
	`body` text NOT NULL,
	`usage` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`dish_id`) REFERENCES `dishes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_captions_restaurant` ON `captions` (`restaurant_id`);--> statement-breakpoint
CREATE TABLE `dishes` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`portion` text DEFAULT '' NOT NULL,
	`plating` text DEFAULT '' NOT NULL,
	`setting` text DEFAULT 'Natural daylight' NOT NULL,
	`price` integer DEFAULT 0 NOT NULL,
	`available` integer DEFAULT 1 NOT NULL,
	`confirmed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_dishes_restaurant` ON `dishes` (`restaurant_id`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text,
	`kind` text NOT NULL,
	`entity_id` text,
	`details` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_events_restaurant` ON `events` (`restaurant_id`);--> statement-breakpoint
CREATE TABLE `invites` (
	`hash` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'owner' NOT NULL,
	`allowance` integer DEFAULT 20 NOT NULL,
	`expires_at` integer NOT NULL,
	`used_by` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`dish_id` text NOT NULL,
	`request_key` text NOT NULL,
	`fingerprint` text NOT NULL,
	`prompt` text NOT NULL,
	`details` text NOT NULL,
	`input_method` text NOT NULL,
	`source_id` text,
	`parent_id` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dish_id`) REFERENCES `dishes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_jobs_idempotency` ON `jobs` (`restaurant_id`,`request_key`);--> statement-breakpoint
CREATE INDEX `idx_jobs_restaurant` ON `jobs` (`restaurant_id`);--> statement-breakpoint
CREATE TABLE `outputs` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`restaurant_id` text NOT NULL,
	`slot` integer NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`response_id` text,
	`asset_id` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`lease_token` text,
	`error` text,
	`usage` text,
	`cost_estimate` real,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_outputs_slot` ON `outputs` (`job_id`,`slot`);--> statement-breakpoint
CREATE INDEX `idx_outputs_restaurant_status` ON `outputs` (`restaurant_id`,`status`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `restaurants` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`cuisine` text DEFAULT '' NOT NULL,
	`brand` text DEFAULT '' NOT NULL,
	`logo_id` text,
	`slug` text NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`allowance` integer DEFAULT 20 NOT NULL,
	`paused` integer DEFAULT 0 NOT NULL,
	`menu_draft` text DEFAULT '{"sections":[]}' NOT NULL,
	`published` text,
	`published_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `restaurants_user_id_unique` ON `restaurants` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `restaurants_slug_unique` ON `restaurants` (`slug`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`role` text DEFAULT 'owner' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);