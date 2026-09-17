ALTER TABLE `assets` ADD `upload_key` text;--> statement-breakpoint
ALTER TABLE `assets` ADD `upload_fingerprint` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_assets_upload_intent` ON `assets` (`restaurant_id`,`upload_key`);