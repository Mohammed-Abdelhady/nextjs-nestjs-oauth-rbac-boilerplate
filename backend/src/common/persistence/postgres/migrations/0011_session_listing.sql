-- When a session was stored, which the list of a person's sessions shows.
-- 0001 owns every other session column. The MongoDB adapter takes this time
-- from the driver when the document is first saved; here the database stamps
-- the row.

ALTER TABLE sessions
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
