ALTER TABLE `affiliates` ADD `link_token` varchar(32);--> statement-breakpoint
ALTER TABLE `affiliates` ADD CONSTRAINT `affiliates_link_token_uq` UNIQUE(`link_token`);