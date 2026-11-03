CREATE TABLE `content_patches` (
	`id` varchar(120) NOT NULL,
	`description` varchar(255) NOT NULL DEFAULT '',
	`log` json,
	`applied_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `content_patches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `guide_revisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`guide_id` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`body` mediumtext NOT NULL,
	`saved_by` int,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `guide_revisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `guides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(160) NOT NULL,
	`title` varchar(200) NOT NULL,
	`seo_title` varchar(160),
	`description` varchar(320) NOT NULL DEFAULT '',
	`section` enum('dma','fuser','input','reference') NOT NULL,
	`kind` enum('guide','comparison','glossary') NOT NULL DEFAULT 'guide',
	`body` mediumtext NOT NULL,
	`cover_url` varchar(500),
	`cover_alt` varchar(255) NOT NULL DEFAULT '',
	`related_products` json,
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`reviewed_by` varchar(120),
	`reviewed_at` datetime,
	`review_due` datetime,
	`published_at` datetime,
	`content_updated_at` datetime,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `guides_id` PRIMARY KEY(`id`),
	CONSTRAINT `guides_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `slug_redirects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`kind` enum('product','category','guide') NOT NULL,
	`old_slug` varchar(160) NOT NULL,
	`new_slug` varchar(160) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `slug_redirects_id` PRIMARY KEY(`id`),
	CONSTRAINT `slug_redirects_old_uq` UNIQUE(`kind`,`old_slug`)
);
--> statement-breakpoint
ALTER TABLE `categories` ADD `intro` text;--> statement-breakpoint
ALTER TABLE `categories` ADD `seo_title` varchar(160);--> statement-breakpoint
ALTER TABLE `categories` ADD `seo_description` varchar(320);--> statement-breakpoint
ALTER TABLE `categories` ADD `content_updated_at` datetime;--> statement-breakpoint
ALTER TABLE `products` ADD `brand` varchar(80);--> statement-breakpoint
ALTER TABLE `products` ADD `mpn` varchar(80);--> statement-breakpoint
ALTER TABLE `products` ADD `gtin` varchar(14);--> statement-breakpoint
ALTER TABLE `products` ADD `description` mediumtext;--> statement-breakpoint
ALTER TABLE `products` ADD `content_updated_at` datetime;--> statement-breakpoint
ALTER TABLE `guide_revisions` ADD CONSTRAINT `guide_revisions_guide_id_guides_id_fk` FOREIGN KEY (`guide_id`) REFERENCES `guides`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `guide_revisions` ADD CONSTRAINT `guide_revisions_saved_by_admin_users_id_fk` FOREIGN KEY (`saved_by`) REFERENCES `admin_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `guide_revisions_guide_idx` ON `guide_revisions` (`guide_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `guides_status_idx` ON `guides` (`status`,`section`);