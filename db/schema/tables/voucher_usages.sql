-- ============================================================
-- TABLE: voucher_usages
-- Source: photo-storage/server/src/database/schema.ts
-- ============================================================
CREATE TABLE IF NOT EXISTS `voucher_usages` (
  `id`         VARCHAR(26) NOT NULL PRIMARY KEY,
  `voucher_id` VARCHAR(26) NOT NULL,
  `user_id`    VARCHAR(26) NOT NULL,
  `used_at`    DATETIME    NOT NULL DEFAULT NOW(),
  INDEX `voucher_usages_voucher_idx` (`voucher_id`),
  INDEX `voucher_usages_user_idx` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
