CREATE TABLE `photo_corrections` (
	`original_job_id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`reported_asset_id` text NOT NULL,
	`source_id` text,
	`reason` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`correction_job_id` text,
	`status` text DEFAULT 'reported' NOT NULL,
	`credited_period` text,
	`credited_at` integer,
	`resolution` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photo_corrections_correction_job_id_unique` ON `photo_corrections` (`correction_job_id`);--> statement-breakpoint
CREATE INDEX `idx_corrections_restaurant_credit` ON `photo_corrections` (`restaurant_id`,`credited_at`);--> statement-breakpoint
CREATE INDEX `idx_corrections_status` ON `photo_corrections` (`status`,`updated_at`);--> statement-breakpoint
ALTER TABLE `assets` ADD `needs_correction` integer DEFAULT 0 NOT NULL;