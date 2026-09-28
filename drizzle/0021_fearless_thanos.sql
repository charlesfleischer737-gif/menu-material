CREATE TABLE `free_grant_emails` (
	`hash` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trusted_devices` (
	`hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_trusted_devices_user` ON `trusted_devices` (`user_id`);--> statement-breakpoint
ALTER TABLE `ai_spend` ADD `paid` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `restaurants` ADD `free_grant` text;