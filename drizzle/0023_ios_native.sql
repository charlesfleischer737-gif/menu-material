CREATE TABLE `app_store_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`original_transaction_id` text NOT NULL,
	`product_id` text NOT NULL,
	`environment` text NOT NULL,
	`status` text NOT NULL,
	`auto_renew` integer DEFAULT 1 NOT NULL,
	`expires_at` integer,
	`synced_at` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_app_store_subscriptions_restaurant` ON `app_store_subscriptions` (`restaurant_id`);--> statement-breakpoint
CREATE TABLE `apple_auth_flows` (
	`hash` text PRIMARY KEY NOT NULL,
	`nonce_hash` text NOT NULL,
	`subject` text,
	`email` text,
	`refresh_token` text,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_apple_auth_flows_expiry` ON `apple_auth_flows` (`expires_at`);--> statement-breakpoint
CREATE TABLE `apple_identities` (
	`subject` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`refresh_token` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `apple_identities_user_id_unique` ON `apple_identities` (`user_id`);--> statement-breakpoint
CREATE TABLE `live_activities` (
	`job_id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`token` text NOT NULL,
	`environment` text DEFAULT 'production' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `push_devices` (
	`token` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`restaurant_id` text NOT NULL,
	`environment` text DEFAULT 'production' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_push_devices_restaurant` ON `push_devices` (`restaurant_id`);--> statement-breakpoint
CREATE TABLE `push_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`token` text NOT NULL,
	`environment` text DEFAULT 'production' NOT NULL,
	`push_type` text DEFAULT 'alert' NOT NULL,
	`payload` text NOT NULL,
	`collapse_id` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`sent_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_push_outbox_lease` ON `push_outbox` (`sent_at`,`lease_until`);--> statement-breakpoint
ALTER TABLE `sessions` ADD `client` text DEFAULT 'web' NOT NULL;