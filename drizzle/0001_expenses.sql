CREATE TABLE `expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`spent_on` date NOT NULL,
	`amount_cents` int NOT NULL,
	`category` varchar(60) NOT NULL,
	`vendor` varchar(120) NOT NULL DEFAULT '',
	`description` varchar(500) NOT NULL DEFAULT '',
	`payment_method` varchar(40) NOT NULL DEFAULT '',
	`reference` varchar(120) NOT NULL DEFAULT '',
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_created_by_admin_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `admin_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `expenses_spent_on_idx` ON `expenses` (`spent_on`);--> statement-breakpoint
CREATE INDEX `expenses_category_idx` ON `expenses` (`category`);