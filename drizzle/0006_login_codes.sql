CREATE TABLE `login_codes` (
	`customer_id` int NOT NULL,
	`code_hash` char(64) NOT NULL,
	`expires_at` datetime NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `login_codes_customer_id` PRIMARY KEY(`customer_id`)
);
--> statement-breakpoint
ALTER TABLE `login_codes` ADD CONSTRAINT `login_codes_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Accounts now open with the first paid order, so open them for customers who have already paid.
UPDATE `customers` SET `account_created_at` = (SELECT COALESCE(MIN(`paid_at`), MIN(`created_at`)) FROM `orders` WHERE `orders`.`customer_id` = `customers`.`id` AND `orders`.`payment_status` = 'paid') WHERE `account_created_at` IS NULL;--> statement-breakpoint
ALTER TABLE `customers` DROP COLUMN `password_hash`;