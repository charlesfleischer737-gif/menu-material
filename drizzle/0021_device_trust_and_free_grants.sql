-- Browsers that signed in before skip the per-account sign-in slowdown (trusted_devices, by a hash of their device cookie). A deleted account leaves a one-way hash of its email, so its free signup images aren't granted twice (free_grant_emails). Past the daily cap on free-image grants, a new account's images wait (restaurants.free_grant).
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
ALTER TABLE `restaurants` ADD `free_grant` text;