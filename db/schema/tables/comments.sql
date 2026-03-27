-- ============================================================
-- TABLE: comments
-- Source: photo-storage/server/src/database/schema.ts
-- ============================================================
CREATE TABLE IF NOT EXISTS `comments` (
  `id`         VARCHAR(26) NOT NULL PRIMARY KEY,
  `image_id`   VARCHAR(26) NOT NULL,
  `user_id`    VARCHAR(26) DEFAULT NULL,
  `guest_name` VARCHAR(50) DEFAULT NULL,
  `content`    TEXT        NOT NULL,
  `created_at` DATETIME    NOT NULL DEFAULT NOW(),
  INDEX `comments_image_idx` (`image_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
