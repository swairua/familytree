-- Family Tree database schema (MariaDB 10.4 / MySQL 5.7+)
-- Mirrors the React app's data model from src/utils/gedcomParser.js

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- Individuals
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS individuals (
  id           VARCHAR(64)  NOT NULL,
  name         VARCHAR(255) NOT NULL DEFAULT '',
  given_name   VARCHAR(128) NOT NULL DEFAULT '',
  surname      VARCHAR(128) NOT NULL DEFAULT '',
  prefix       VARCHAR(32)  NOT NULL DEFAULT '',
  suffix       VARCHAR(32)  NOT NULL DEFAULT '',
  nickname     VARCHAR(128) NOT NULL DEFAULT '',
  gender       ENUM('male','female','unknown') NOT NULL DEFAULT 'unknown',
  birth_date   VARCHAR(64)  NOT NULL DEFAULT '',
  birth_place  VARCHAR(255) NOT NULL DEFAULT '',
  death_date   VARCHAR(64)  NOT NULL DEFAULT '',
  death_place  VARCHAR(255) NOT NULL DEFAULT '',
  burial_date  VARCHAR(64)  NOT NULL DEFAULT '',
  burial_place VARCHAR(255) NOT NULL DEFAULT '',
  occupation   VARCHAR(255) NOT NULL DEFAULT '',
  education    VARCHAR(255) NOT NULL DEFAULT '',
  religion     VARCHAR(128) NOT NULL DEFAULT '',
  email        VARCHAR(255) NOT NULL DEFAULT '',
  phone        VARCHAR(255) NOT NULL DEFAULT '',
  photo        TEXT,
  notes        TEXT,
  birth_year   SMALLINT NULL,
  death_year   SMALLINT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_surname (surname),
  KEY idx_given (given_name),
  KEY idx_gender (gender),
  KEY idx_birth_year (birth_year)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Families
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS families (
  id             VARCHAR(64) NOT NULL,
  husband_id     VARCHAR(64) NULL,
  wife_id        VARCHAR(64) NULL,
  marriage_date  VARCHAR(64) NOT NULL DEFAULT '',
  marriage_place VARCHAR(255) NOT NULL DEFAULT '',
  divorce_date   VARCHAR(64) NOT NULL DEFAULT '',
  notes          TEXT,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_husband (husband_id),
  KEY idx_wife (wife_id),
  CONSTRAINT fk_fam_husband FOREIGN KEY (husband_id) REFERENCES individuals(id) ON DELETE SET NULL,
  CONSTRAINT fk_fam_wife    FOREIGN KEY (wife_id)    REFERENCES individuals(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Children of each family (keeps child order)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS family_children (
  family_id  VARCHAR(64) NOT NULL,
  child_id   VARCHAR(64) NOT NULL,
  position   INT NOT NULL DEFAULT 0,
  PRIMARY KEY (family_id, child_id),
  KEY idx_child (child_id),
  CONSTRAINT fk_fc_family FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  CONSTRAINT fk_fc_child  FOREIGN KEY (child_id)  REFERENCES individuals(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- App users (authentication / session management)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  email          VARCHAR(255) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  display_name   VARCHAR(255) NOT NULL DEFAULT '',
  individual_id  VARCHAR(64) NULL,
  role           ENUM('admin','member') NOT NULL DEFAULT 'member',
  status         ENUM('pending','active','rejected') NOT NULL DEFAULT 'active',
  photo          VARCHAR(255) NOT NULL DEFAULT '',
  deceased       TINYINT(1) NOT NULL DEFAULT 0,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_user_email (email),
  KEY idx_user_individual (individual_id),
  CONSTRAINT fk_user_individual FOREIGN KEY (individual_id) REFERENCES individuals(id) ON DELETE SET NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS app_settings (
  `key`       VARCHAR(100) NOT NULL PRIMARY KEY,
  `value`     TEXT NOT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS password_resets (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,
  token_hash    VARCHAR(64) NOT NULL,
  expires_at    DATETIME NOT NULL,
  used          TINYINT(1) NOT NULL DEFAULT 0,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_reset_token (token_hash),
  KEY idx_reset_user (user_id),
  CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS messages (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  from_user_id INT NOT NULL,
  to_user_id  INT NOT NULL,
  subject     VARCHAR(255) NOT NULL DEFAULT '',
  body        TEXT NOT NULL,
  is_read     TINYINT(1) NOT NULL DEFAULT 0,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_msg_to (to_user_id, is_read),
  KEY idx_msg_from (from_user_id),
  CONSTRAINT fk_msg_from FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_msg_to   FOREIGN KEY (to_user_id)   REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS events (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  individual_id VARCHAR(64) NULL,
  family_id     VARCHAR(64) NULL,
  type          VARCHAR(16) NOT NULL DEFAULT '',
  date          VARCHAR(64) NOT NULL DEFAULT '',
  place         VARCHAR(255) NOT NULL DEFAULT '',
  description   TEXT,
  KEY idx_event_individual (individual_id),
  KEY idx_event_family (family_id),
  CONSTRAINT fk_ev_ind  FOREIGN KEY (individual_id) REFERENCES individuals(id) ON DELETE CASCADE,
  CONSTRAINT fk_ev_fam  FOREIGN KEY (family_id)     REFERENCES families(id)     ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Photo albums (user-curated collections of files in data/photos/)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS albums (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(120) NOT NULL,
  description  VARCHAR(500) NOT NULL DEFAULT '',
  cover_photo  VARCHAR(255) NOT NULL DEFAULT '',
  created_by   INT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_created_by (created_by)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS album_photos (
  album_id  INT NOT NULL,
  photo     VARCHAR(255) NOT NULL,
  added_by  INT NULL,
  added_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (album_id, photo),
  CONSTRAINT fk_album_photos_album FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
  KEY idx_photo (photo)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Security: session revocation, login throttling, TOTP 2FA
-- ---------------------------------------------------------------------------
-- users.session_version is bumped on password change / "sign out everywhere";
-- sessions carrying an older version are rejected.
-- ALTER TABLE users ADD COLUMN session_version INT NOT NULL DEFAULT 0;
-- ALTER TABLE users ADD COLUMN totp_secret VARCHAR(64) NULL;
-- ALTER TABLE users ADD COLUMN totp_enabled TINYINT(1) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS login_attempts (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL,
  ip            VARCHAR(64) NOT NULL DEFAULT '',
  attempted_at  DATETIME NOT NULL,
  INDEX idx_email_time (email, attempted_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS mfa_pending (
  token      VARCHAR(64) PRIMARY KEY,
  user_id    INT NOT NULL,
  ip         VARCHAR(64) NOT NULL DEFAULT '',
  expires_at DATETIME NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS mfa_backup_codes (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  code_hash  VARCHAR(255) NOT NULL,
  used_at    DATETIME NULL,
  INDEX idx_user (user_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- FamilySearch OAuth tokens (one per member, stored server-side)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fs_tokens (
  user_id      INT PRIMARY KEY,
  access_token TEXT NOT NULL,
  token_type   VARCHAR(32) NOT NULL DEFAULT 'family_search',
  expires_at   DATETIME NOT NULL,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- DNA: per-member tested flag + family DNA kit/match registry
-- ---------------------------------------------------------------------------
-- users.dna_tested: self-reported "I have taken a DNA test"
-- ALTER TABLE users ADD COLUMN dna_tested TINYINT(1) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS dna_kits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  provider VARCHAR(48) NOT NULL DEFAULT 'other',
  result_date DATE NULL,
  visible_to_members TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS dna_matches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  kit_id INT NOT NULL,
  user_id INT NOT NULL,
  match_name VARCHAR(255) NOT NULL,
  provider VARCHAR(48) NOT NULL DEFAULT '',
  predicted_relationship VARCHAR(120) NOT NULL DEFAULT '',
  shared_surname VARCHAR(120) NOT NULL DEFAULT '',
  shared_cm DECIMAL(6,1) NULL,
  notes VARCHAR(500) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dnamatch_kit FOREIGN KEY (kit_id) REFERENCES dna_kits(id) ON DELETE CASCADE,
  KEY idx_kit (kit_id),
  KEY idx_user (user_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Family member invitations - admin sends a one-time link to enroll
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS member_invitations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  individual_id VARCHAR(64) NOT NULL,    -- individuals.id (tree reference)
  name VARCHAR(255) NOT NULL DEFAULT '',  -- friendly name shown to member
  invited_by INT NOT NULL,               -- users.id of the admin who sent it
  email VARCHAR(255) NOT NULL DEFAULT '',  -- prefilled email for direct invites; blank for link-only
  token_hash VARCHAR(64) NOT NULL UNIQUE,  -- sha256 of raw token in link
  channel VARCHAR(16) NOT NULL DEFAULT 'link',  -- 'email' or 'link'
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_individual (individual_id),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
