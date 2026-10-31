CREATE TABLE `media` (
	`key` varchar(191) NOT NULL,
	`content_type` varchar(64) NOT NULL,
	`data` mediumblob NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `media_key` PRIMARY KEY(`key`)
);
