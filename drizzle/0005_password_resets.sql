CREATE TABLE `password_resets` (
	`id` char(64) NOT NULL,
	`kind` enum('customer','admin') NOT NULL,
	`subject_id` int NOT NULL,
	`expires_at` datetime NOT NULL,
	`used_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `password_resets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `password_resets_subject_idx` ON `password_resets` (`kind`,`subject_id`);