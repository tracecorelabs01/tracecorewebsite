CREATE TABLE `customer_addresses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customer_id` int NOT NULL,
	`first_name` varchar(80) NOT NULL,
	`last_name` varchar(80) NOT NULL,
	`address1` varchar(191) NOT NULL,
	`address2` varchar(191),
	`city` varchar(120) NOT NULL,
	`region` varchar(120),
	`postal_code` varchar(40) NOT NULL,
	`country` varchar(80) NOT NULL,
	`is_default` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_addresses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `customer_addresses` ADD CONSTRAINT `customer_addresses_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `customer_addresses_customer_idx` ON `customer_addresses` (`customer_id`);