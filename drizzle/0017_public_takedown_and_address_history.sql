ALTER TABLE `restaurants` ADD `slug_since` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `restaurants` ADD `public_suspended` integer DEFAULT 0 NOT NULL;