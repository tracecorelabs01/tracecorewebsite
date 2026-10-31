CREATE TABLE `affiliate_clicks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`affiliate_id` int NOT NULL,
	`day` date NOT NULL,
	`clicks` int NOT NULL DEFAULT 0,
	CONSTRAINT `affiliate_clicks_id` PRIMARY KEY(`id`),
	CONSTRAINT `affiliate_clicks_day_uq` UNIQUE(`affiliate_id`,`day`)
);
--> statement-breakpoint
CREATE TABLE `affiliate_commissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`affiliate_id` int NOT NULL,
	`order_id` int,
	`kind` enum('order','adjustment') NOT NULL DEFAULT 'order',
	`amount_cents` int NOT NULL,
	`status` enum('pending','approved','paid','reversed') NOT NULL DEFAULT 'pending',
	`lines` json,
	`note` varchar(255),
	`payout_id` int,
	`approved_at` datetime,
	`clawed_back_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `affiliate_commissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `affiliate_commissions_order_uq` UNIQUE(`order_id`)
);
--> statement-breakpoint
CREATE TABLE `affiliate_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(80) NOT NULL,
	`description` varchar(255) NOT NULL DEFAULT '',
	`is_default` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `affiliate_groups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `affiliate_payouts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`affiliate_id` int NOT NULL,
	`method` enum('paypal','store_credit') NOT NULL,
	`amount_cents` int NOT NULL,
	`status` enum('requested','paid','rejected') NOT NULL DEFAULT 'requested',
	`paypal_email` varchar(191),
	`reference` varchar(191),
	`note` varchar(255),
	`processed_by` int,
	`paid_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `affiliate_payouts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `affiliate_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scope` varchar(24) NOT NULL,
	`group_id` int,
	`affiliate_id` int,
	`product_id` int NOT NULL,
	`visible` boolean,
	`commission_kind` enum('percent','fixed'),
	`commission_value` int,
	`price_cents` int,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `affiliate_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `affiliate_rules_scope_product_uq` UNIQUE(`scope`,`product_id`)
);
--> statement-breakpoint
CREATE TABLE `affiliates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customer_id` int NOT NULL,
	`status` enum('pending','approved','rejected','suspended') NOT NULL DEFAULT 'pending',
	`code` varchar(32) NOT NULL,
	`group_id` int,
	`name` varchar(120) NOT NULL,
	`website` varchar(255),
	`audience` text,
	`paypal_email` varchar(191),
	`notes` text,
	`approved_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `affiliates_id` PRIMARY KEY(`id`),
	CONSTRAINT `affiliates_customer_uq` UNIQUE(`customer_id`),
	CONSTRAINT `affiliates_code_uq` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `affiliate_id` int;--> statement-breakpoint
ALTER TABLE `orders` ADD `affiliate_source` enum('link','code');--> statement-breakpoint
ALTER TABLE `affiliate_clicks` ADD CONSTRAINT `affiliate_clicks_affiliate_id_affiliates_id_fk` FOREIGN KEY (`affiliate_id`) REFERENCES `affiliates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `affiliate_commissions` ADD CONSTRAINT `affiliate_commissions_affiliate_id_affiliates_id_fk` FOREIGN KEY (`affiliate_id`) REFERENCES `affiliates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `affiliate_commissions` ADD CONSTRAINT `affiliate_commissions_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `affiliate_commissions` ADD CONSTRAINT `affiliate_commissions_payout_id_affiliate_payouts_id_fk` FOREIGN KEY (`payout_id`) REFERENCES `affiliate_payouts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `affiliate_payouts` ADD CONSTRAINT `affiliate_payouts_affiliate_id_affiliates_id_fk` FOREIGN KEY (`affiliate_id`) REFERENCES `affiliates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `affiliate_payouts` ADD CONSTRAINT `affiliate_payouts_processed_by_admin_users_id_fk` FOREIGN KEY (`processed_by`) REFERENCES `admin_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `affiliate_rules` ADD CONSTRAINT `affiliate_rules_group_id_affiliate_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `affiliate_groups`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `affiliate_rules` ADD CONSTRAINT `affiliate_rules_affiliate_id_affiliates_id_fk` FOREIGN KEY (`affiliate_id`) REFERENCES `affiliates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `affiliate_rules` ADD CONSTRAINT `affiliate_rules_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `affiliates` ADD CONSTRAINT `affiliates_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `affiliates` ADD CONSTRAINT `affiliates_group_id_affiliate_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `affiliate_groups`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `affiliate_commissions_affiliate_idx` ON `affiliate_commissions` (`affiliate_id`,`status`);--> statement-breakpoint
CREATE INDEX `affiliate_commissions_payout_idx` ON `affiliate_commissions` (`payout_id`);--> statement-breakpoint
CREATE INDEX `affiliate_payouts_affiliate_idx` ON `affiliate_payouts` (`affiliate_id`);--> statement-breakpoint
CREATE INDEX `affiliate_payouts_status_idx` ON `affiliate_payouts` (`status`);--> statement-breakpoint
CREATE INDEX `affiliates_status_idx` ON `affiliates` (`status`);--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_affiliate_id_affiliates_id_fk` FOREIGN KEY (`affiliate_id`) REFERENCES `affiliates`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `orders_affiliate_idx` ON `orders` (`affiliate_id`);