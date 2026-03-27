-- ============================================================
-- TABLE: users
-- Source: photo-storage/server/src/database/schema.ts
-- ============================================================
CREATE TABLE IF NOT EXISTS `users` (
  `id`             VARCHAR(26)  NOT NULL PRIMARY KEY,
  `email`          VARCHAR(255) NOT NULL,
  `password_hash`  VARCHAR(255) DEFAULT NULL,
  `display_name`   VARCHAR(100) NOT NULL,
  `avatar_key`     VARCHAR(500) DEFAULT NULL,
  `bio`            TEXT         DEFAULT NULL,
  `role`           ENUM('user','admin') NOT NULL DEFAULT 'user',
  `is_active`      BOOLEAN      NOT NULL DEFAULT TRUE,
  `email_verified`  BOOLEAN     NOT NULL DEFAULT FALSE,
  `referral_code`  VARCHAR(20)  DEFAULT NULL,
  `referred_by`    VARCHAR(26)  DEFAULT NULL,
  `created_at`     DATETIME     NOT NULL DEFAULT NOW(),
  `updated_at`     DATETIME     NOT NULL DEFAULT NOW(),
  UNIQUE INDEX `users_email_idx` (`email`),
  INDEX `users_role_idx` (`role`, `is_active`, `created_at`),
  UNIQUE INDEX `users_referral_code_idx` (`referral_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
