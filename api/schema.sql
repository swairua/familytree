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
