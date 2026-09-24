ALTER TABLE `dishes` ADD `dietary` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `restaurants` ADD `address` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `restaurants` ADD `phone` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `restaurants` ADD `reservation_url` text DEFAULT '' NOT NULL;