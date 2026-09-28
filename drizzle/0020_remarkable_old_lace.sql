CREATE TABLE `google_auth_flows` (
	`hash` text PRIMARY KEY NOT NULL,
	`nonce_hash` text NOT NULL,
	`subject` text,
	`email` text,
	`authoritative` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_google_auth_flows_expiry` ON `google_auth_flows` (`expires_at`);--> statement-breakpoint
CREATE TABLE `google_identities` (
	`subject` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `google_identities_user_id_unique` ON `google_identities` (`user_id`);