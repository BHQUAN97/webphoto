-- ============================================================
-- TABLE: refresh_tokens
-- Source: photo-storage/server/src/database/schema.ts
-- ============================================================
CREATE TABLE IF NOT EXISTS `refresh_tokens` (
  `id`         VARCHAR(26) NOT NULL PRIMARY KEY,
  `user_id`    VARCHAR(26) NOT NULL,
  `token_hash` VARCHAR(64) NOT NULL,
  `expires_at` DATETIME    NOT NULL,
  `created_at` DATETIME    NOT NULL DEFAULT NOW(),
  UNIQUE KEY (`token_hash`),
  INDEX `refresh_tokens_user_idx` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
