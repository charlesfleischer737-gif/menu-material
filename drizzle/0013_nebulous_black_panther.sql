CREATE TABLE `studio_look_uses` (
	`restaurant_id` text NOT NULL,
	`request_key` text NOT NULL,
	`preset_id` text DEFAULT '' NOT NULL,
	`job_id` text NOT NULL,
	`used_at` integer NOT NULL,
	PRIMARY KEY(`restaurant_id`, `request_key`),
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_studio_look_uses_recent` ON `studio_look_uses` (`restaurant_id`,`used_at`);
--> statement-breakpoint
INSERT OR IGNORE INTO studio_look_uses (restaurant_id,request_key,preset_id,job_id,used_at)
SELECT restaurant_id,request_key,COALESCE(CASE WHEN json_valid(details) THEN json_extract(details,'$.lookContext.presetId') END,''),id,created_at FROM jobs;
--> statement-breakpoint
INSERT OR IGNORE INTO studio_look_uses (restaurant_id,request_key,preset_id,job_id,used_at)
SELECT e.restaurant_id,'legacy-event:' || e.id,COALESCE(CASE WHEN json_valid(j.details) THEN json_extract(j.details,'$.lookContext.presetId') END,''),j.id,e.created_at
FROM events e JOIN jobs j ON j.id=e.entity_id AND j.restaurant_id=e.restaurant_id WHERE e.kind='generation_reused';
