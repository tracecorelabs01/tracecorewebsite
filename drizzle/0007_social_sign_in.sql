ALTER TABLE `customer_sessions` ADD `scope` enum('account','orders') DEFAULT 'account' NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `discord_id` varchar(32);--> statement-breakpoint
ALTER TABLE `customers` ADD `discord_username` varchar(64);--> statement-breakpoint
ALTER TABLE `customers` ADD `google_id` varchar(64);--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_discord_uq` UNIQUE(`discord_id`);--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_google_uq` UNIQUE(`google_id`);