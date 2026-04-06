-- ============================================================
-- V000: Create schema_changelog tracking table
-- Date:   2026-04-06
-- Author: CI/CD
-- Purpose: Track which changelog versions have been applied
-- ============================================================
-- Bang nay duoc tao tu dong boi CI/CD pipeline.
-- Moi lan deploy, chi nhung version CHUA co trong bang nay moi duoc chay.
-- ============================================================

CREATE TABLE IF NOT EXISTS schema_changelog (
    version     VARCHAR(10) NOT NULL PRIMARY KEY COMMENT 'VD: V001, V002',
    description VARCHAR(255) NOT NULL DEFAULT '' COMMENT 'Mo ta ngan',
    filename    VARCHAR(255) NOT NULL COMMENT 'Ten file SQL',
    applied_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    applied_by  VARCHAR(50) NOT NULL DEFAULT 'ci' COMMENT 'ci hoac manual',
    checksum    VARCHAR(64) NULL COMMENT 'SHA256 cua file SQL',
    execution_ms INT NULL COMMENT 'Thoi gian chay (ms)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SELECT '[OK] schema_changelog table ready' AS result;
