CREATE TABLE `slug_redirects` (
	`slug` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `dishes` ADD `sample` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `dishes` SET `sample` = 1 WHERE `name` = 'Sample burger' AND `price` = 0;
