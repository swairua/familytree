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
-- Extended events (BIRT/DEAT/MARR/EDUC/CENS/RESI/etc.)
-- ---------------------------------------------------------------------------
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
