CREATE TABLE `cost_fields` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(60) NOT NULL,
	`kind` enum('per-item','per-order','percent') NOT NULL,
	`default_value` int,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cost_fields_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_costs` (
	`order_id` int NOT NULL,
	`costs` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `order_costs_order_id` PRIMARY KEY(`order_id`)
);
--> statement-breakpoint
CREATE TABLE `product_costs` (
	`product_id` int NOT NULL,
	`cost_field_id` int NOT NULL,
	`value` int NOT NULL,
	CONSTRAINT `product_costs_product_id_cost_field_id_pk` PRIMARY KEY(`product_id`,`cost_field_id`)
);
--> statement-breakpoint
ALTER TABLE `order_costs` ADD CONSTRAINT `order_costs_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_costs` ADD CONSTRAINT `product_costs_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_costs` ADD CONSTRAINT `product_costs_cost_field_id_cost_fields_id_fk` FOREIGN KEY (`cost_field_id`) REFERENCES `cost_fields`(`id`) ON DELETE cascade ON UPDATE no action;