-- Update future grants to 50 images; preserve already granted allowances.
-- No tables reference billing_periods, so foreign keys can stay enabled.
CREATE TABLE `__new_billing_periods` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`subscription_id` text NOT NULL,
	`invoice_id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`allowance` integer DEFAULT 50 NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_billing_periods`("id", "restaurant_id", "subscription_id", "invoice_id", "starts_at", "ends_at", "allowance") SELECT "id", "restaurant_id", "subscription_id", "invoice_id", "starts_at", "ends_at", "allowance" FROM `billing_periods`;--> statement-breakpoint
DROP TABLE `billing_periods`;--> statement-breakpoint
ALTER TABLE `__new_billing_periods` RENAME TO `billing_periods`;--> statement-breakpoint
CREATE UNIQUE INDEX `billing_periods_invoice_id_unique` ON `billing_periods` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `idx_billing_period_restaurant` ON `billing_periods` (`restaurant_id`,`starts_at`,`ends_at`);
