-- The sync backend's whole database.
--
--   npx wrangler d1 execute learn-sync --remote --file tools/schema.sql
--
-- Two tables and a chunk table. `seq` is the cursor every device pages by: a
-- server-assigned counter rather than a timestamp, because two devices have
-- two clocks and a fast one would advance the other's cursor past rows it had
-- never seen. Row bodies are ciphertext (`enc`); the columns beside them are
-- what the server needs to dedupe, order and filter, and nothing more.

CREATE TABLE IF NOT EXISTS log (
  seq    INTEGER PRIMARY KEY AUTOINCREMENT,
  id     TEXT NOT NULL UNIQUE,   -- "<device>:<ts>:<n>", the dedupe key
  device TEXT NOT NULL,          -- who wrote it; no device may write another's
  ts     INTEGER NOT NULL,       -- for ordering on arrival
  enc    TEXT NOT NULL           -- AES-GCM(iv||ciphertext), base64
);
CREATE INDEX IF NOT EXISTS log_device ON log (device, seq);

-- One row per course the account holds. `deleted_at` is a tombstone rather
-- than a delete: removing a course on one device has to reach the others, and
-- a row that simply vanished would be indistinguishable from one they had
-- never seen. The body stays until the tombstone is purged, which is what
-- makes "recently deleted" a restore rather than a promise.
CREATE TABLE IF NOT EXISTS courses (
  id         TEXT PRIMARY KEY,
  version    TEXT NOT NULL,      -- content hash; unchanged means no transfer
  bytes      INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER             -- NULL while live
);

-- D1 caps how large a single value may be, and a course runs to ~1.5MB, so a
-- body is stored in pieces and reassembled on read.
CREATE TABLE IF NOT EXISTS course_chunks (
  id   TEXT NOT NULL,
  n    INTEGER NOT NULL,
  part TEXT NOT NULL,
  PRIMARY KEY (id, n)
);
