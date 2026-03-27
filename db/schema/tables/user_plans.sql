-- ============================================================
-- TABLE: user_plans
-- Source: photo-storage/server/src/database/schema.ts
-- ============================================================
CREATE TABLE IF NOT EXISTS `user_plans` (
  `id`         VARCHAR(26) NOT NULL PRIMARY KEY,
  `user_id`    VARCHAR(26) NOT NULL,
  `plan_id`    VARCHAR(26) NOT NULL,
  `granted_by` VARCHAR(26) DEFAULT NULL,
  `started_at` DATETIME    NOT NULL,
  `expires_at` DATETIME    NOT NULL,
  `is_active`  BOOLEAN     NOT NULL DEFAULT TRUE,
  INDEX `user_plans_user_active_idx` (`user_id`, `is_active`),
  INDEX `user_plans_expiry_idx` (`expires_at`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
