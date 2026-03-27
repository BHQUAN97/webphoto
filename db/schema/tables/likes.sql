-- ============================================================
-- TABLE: likes
-- Source: photo-storage/server/src/database/schema.ts
-- ============================================================
CREATE TABLE IF NOT EXISTS `likes` (
  `user_id`    VARCHAR(26) NOT NULL,
  `image_id`   VARCHAR(26) NOT NULL,
  `created_at` DATETIME    NOT NULL DEFAULT NOW(),
  PRIMARY KEY (`user_id`, `image_id`),
  INDEX `likes_image_idx` (`image_id`),
  INDEX `likes_user_idx` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
