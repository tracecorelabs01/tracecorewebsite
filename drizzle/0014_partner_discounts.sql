ALTER TABLE `affiliate_groups` ADD `commission_kind` enum('percent','fixed');--> statement-breakpoint
ALTER TABLE `affiliate_groups` ADD `commission_value` int;--> statement-breakpoint
ALTER TABLE `affiliate_groups` ADD `max_discount` int;--> statement-breakpoint
ALTER TABLE `affiliates` ADD `commission_kind` enum('percent','fixed');--> statement-breakpoint
ALTER TABLE `affiliates` ADD `commission_value` int;--> statement-breakpoint
ALTER TABLE `affiliates` ADD `max_discount` int;--> statement-breakpoint
ALTER TABLE `affiliates` ADD `customer_discount` int;