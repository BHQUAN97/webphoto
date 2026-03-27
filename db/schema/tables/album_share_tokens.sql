-- ============================================================
-- TABLE: album_share_tokens
-- Source: photo-storage/server/src/database/schema.ts
-- ============================================================
CREATE TABLE IF NOT EXISTS `album_share_tokens` (
  `id`             VARCHAR(26) NOT NULL PRIMARY KEY,
  `album_id`       VARCHAR(26) NOT NULL,
  `token`          VARCHAR(64) NOT NULL,
  `allow_like`     BOOLEAN     NOT NULL DEFAULT TRUE,
  `allow_comment`  BOOLEAN     NOT NULL DEFAULT TRUE,
  `allow_download` BOOLEAN     NOT NULL DEFAULT TRUE,
  `expires_at`     DATETIME    DEFAULT NULL,
  `created_at`     DATETIME    NOT NULL DEFAULT NOW(),
  UNIQUE INDEX `share_tokens_token_idx` (`token`),
  INDEX `share_tokens_album_idx` (`album_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
