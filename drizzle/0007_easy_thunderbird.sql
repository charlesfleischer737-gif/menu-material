CREATE TABLE `billing_accounts` (
	`restaurant_id` text PRIMARY KEY NOT NULL,
	`customer_id` text,
	`subscription_id` text,
	`status` text DEFAULT 'free' NOT NULL,
	`cancel_at_period_end` integer DEFAULT 0 NOT NULL,
	`checkout_id` text,
	`checkout_key` text,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`lease_token` text,
	`synced_at` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `billing_accounts_customer_id_unique` ON `billing_accounts` (`customer_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `billing_accounts_subscription_id_unique` ON `billing_accounts` (`subscription_id`);--> statement-breakpoint
CREATE TABLE `billing_periods` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`subscription_id` text NOT NULL,
	`invoice_id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`allowance` integer DEFAULT 100 NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `billing_periods_invoice_id_unique` ON `billing_periods` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `idx_billing_period_restaurant` ON `billing_periods` (`restaurant_id`,`starts_at`,`ends_at`);--> statement-breakpoint
ALTER TABLE `jobs` ADD `credit_period` text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `outputs` ADD `credit_period` text DEFAULT 'free' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_outputs_credit_period` ON `outputs` (`restaurant_id`,`credit_period`,`status`);