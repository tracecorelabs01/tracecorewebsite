ALTER TABLE `orders` ADD `razorpay_order_id` varchar(40);--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_razorpay_order_uq` UNIQUE(`razorpay_order_id`);