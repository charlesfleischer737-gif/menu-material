CREATE TABLE `menu_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`draft` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`published` text,
	`published_revision` integer,
	`published_at` integer,
	`is_primary` integer DEFAULT 0 NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_menu_documents_restaurant` ON `menu_documents` (`restaurant_id`);--> statement-breakpoint
CREATE TABLE `menu_publication_history` (
	`id` text PRIMARY KEY NOT NULL,
	`menu_id` text NOT NULL,
	`restaurant_id` text NOT NULL,
	`snapshot` text NOT NULL,
	`revision` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`menu_id`) REFERENCES `menu_documents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_menu_history_document` ON `menu_publication_history` (`menu_id`);