-- ============================================================
-- TABLE: storage_addons
-- Source: photo-storage/server/src/database/schema.ts
-- ============================================================
CREATE TABLE IF NOT EXISTS `storage_addons` (
  `id`         VARCHAR(26) NOT NULL PRIMARY KEY,
  `user_id`    VARCHAR(26) NOT NULL,
  `bytes`      BIGINT      NOT NULL,
  `expires_at` DATETIME    NOT NULL,
  `created_at` DATETIME    NOT NULL DEFAULT NOW(),
  INDEX `storage_addons_user_idx` (`user_id`, `expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
