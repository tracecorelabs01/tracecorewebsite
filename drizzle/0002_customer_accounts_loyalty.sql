CREATE TABLE `customer_sessions` (
	`id` char(64) NOT NULL,
	`customer_id` int NOT NULL,
	`expires_at` datetime NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `customer_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `loyalty_ledger` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customer_id` int NOT NULL,
	`points` int NOT NULL,
	`kind` enum('order','redeem','adjust') NOT NULL,
	`order_id` int,
	`discount_code_id` int,
	`admin_id` int,
	`note` varchar(255) NOT NULL DEFAULT '',
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `loyalty_ledger_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `loyalty_offers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(80) NOT NULL,
	`description` varchar(255) NOT NULL DEFAULT '',
	`points_cost` int NOT NULL,
	`kind` enum('percent','fixed') NOT NULL,
	`value` int NOT NULL,
	`min_subtotal_cents` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `loyalty_offers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `customers` ADD `password_hash` varchar(255);--> statement-breakpoint
ALTER TABLE `customers` ADD `account_created_at` datetime;--> statement-breakpoint
ALTER TABLE `customers` ADD `last_login_at` datetime;--> statement-breakpoint
ALTER TABLE `discount_codes` ADD `customer_id` int;--> statement-breakpoint
ALTER TABLE `reviews` ADD `customer_id` int;--> statement-breakpoint
ALTER TABLE `customer_sessions` ADD CONSTRAINT `customer_sessions_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `loyalty_ledger` ADD CONSTRAINT `loyalty_ledger_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `loyalty_ledger` ADD CONSTRAINT `loyalty_ledger_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `loyalty_ledger` ADD CONSTRAINT `loyalty_ledger_discount_code_id_discount_codes_id_fk` FOREIGN KEY (`discount_code_id`) REFERENCES `discount_codes`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `loyalty_ledger` ADD CONSTRAINT `loyalty_ledger_admin_id_admin_users_id_fk` FOREIGN KEY (`admin_id`) REFERENCES `admin_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `customer_sessions_customer_idx` ON `customer_sessions` (`customer_id`);--> statement-breakpoint
CREATE INDEX `loyalty_ledger_customer_idx` ON `loyalty_ledger` (`customer_id`);--> statement-breakpoint
CREATE INDEX `loyalty_ledger_order_idx` ON `loyalty_ledger` (`order_id`);--> statement-breakpoint
ALTER TABLE `discount_codes` ADD CONSTRAINT `discount_codes_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE set null ON UPDATE no action;