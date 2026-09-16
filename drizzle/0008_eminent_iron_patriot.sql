ALTER TABLE `dishes` ADD `preferred_photo_id` text;--> statement-breakpoint
ALTER TABLE `dishes` ADD `archived_at` integer;--> statement-breakpoint
ALTER TABLE `dishes` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `dishes` ADD `revision` integer DEFAULT 1 NOT NULL;