-- ============================================================
-- TABLE: payments
-- Source: photo-storage/server/src/database/schema.ts
-- ============================================================
CREATE TABLE IF NOT EXISTS `payments` (
  `id`                VARCHAR(26)  NOT NULL PRIMARY KEY,
  `user_id`           VARCHAR(26)  NOT NULL,
  `plan_id`           VARCHAR(26)  DEFAULT NULL,
  `addon_bytes`       BIGINT       DEFAULT NULL,
  `amount_vnd`        INT          NOT NULL,
  `reference_code`    VARCHAR(50)  NOT NULL,
  `payment_method_id` VARCHAR(26)  DEFAULT NULL,
  `status`            ENUM('pending','awaiting_confirm','paid','failed') NOT NULL DEFAULT 'pending',
  `customer_note`     TEXT         DEFAULT NULL,
  `admin_note`        TEXT         DEFAULT NULL,
  `confirmed_by_user` BOOLEAN      NOT NULL DEFAULT FALSE,
  `confirmed_at`      DATETIME     DEFAULT NULL,
  `marked_paid_by`    VARCHAR(26)  DEFAULT NULL,
  `paid_at`           DATETIME     DEFAULT NULL,
  `expires_at`        DATETIME     DEFAULT NULL,
  `created_at`        DATETIME     NOT NULL DEFAULT NOW(),
  UNIQUE INDEX `payments_ref_idx` (`reference_code`),
  INDEX `payments_user_idx` (`user_id`, `created_at`),
  INDEX `payments_status_idx` (`status`, `created_at`),
  INDEX `payments_method_idx` (`payment_method_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
