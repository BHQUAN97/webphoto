-- ============================================================
-- TABLE: referrals
-- Source: photo-storage/server/src/database/schema.ts
-- ============================================================
CREATE TABLE IF NOT EXISTS `referrals` (
  `id`          VARCHAR(26) NOT NULL PRIMARY KEY,
  `referrer_id` VARCHAR(26) NOT NULL,
  `referee_id`  VARCHAR(26) NOT NULL,
  `reward_days` INT         NOT NULL DEFAULT 7,
  `rewarded`    BOOLEAN     NOT NULL DEFAULT FALSE,
  `created_at`  DATETIME    NOT NULL DEFAULT NOW(),
  INDEX `referrals_referrer_idx` (`referrer_id`),
  UNIQUE INDEX `referrals_referee_idx` (`referee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
