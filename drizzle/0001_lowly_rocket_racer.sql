CREATE TABLE `batch_items` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`dish_id` text NOT NULL,
	`source_id` text,
	`job_id` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`error` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dish_id`) REFERENCES `dishes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_batch_restaurant` ON `batch_items` (`restaurant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_batch_dish` ON `batch_items` (`batch_id`,`dish_id`);--> statement-breakpoint
CREATE TABLE `menu_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`name` text NOT NULL,
	`key` text,
	`mime` text,
	`draft` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`error` text,
	`usage` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_imports_restaurant` ON `menu_imports` (`restaurant_id`);--> statement-breakpoint
CREATE TABLE `promotions` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`draft` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`approved_hash` text,
	`approved_at` integer,
	`published` text,
	`starts_at` integer,
	`ends_at` integer,
	`sold_out` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_promotions_restaurant` ON `promotions` (`restaurant_id`);--> statement-breakpoint
CREATE TABLE `staff_links` (
	`hash` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_staff_restaurant` ON `staff_links` (`restaurant_id`);--> statement-breakpoint
ALTER TABLE `dishes` ADD `category` text DEFAULT 'Dishes' NOT NULL;--> statement-breakpoint
ALTER TABLE `dishes` ADD `preserve` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `restaurants` ADD `style` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `restaurants` ADD `timezone` text DEFAULT 'America/New_York' NOT NULL;--> statement-breakpoint
ALTER TABLE `restaurants` ADD `ordering_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `restaurants` ADD `hours` text DEFAULT '[]' NOT NULL;