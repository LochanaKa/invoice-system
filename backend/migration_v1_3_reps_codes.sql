-- ============================================================
-- Migration v1.3: Standardise reps.code to CC-0000 format
-- ============================================================
-- Safe for existing data:
--   • Never deletes or truncates the reps table
--   • Only updates the `code` column (FKs use reps.id, not code)
--   • Two-phase update avoids UNIQUE constraint collisions
--
-- Run once against PostgreSQL:
--   psql -U <user> -d <database> -f migration_v1_3_reps_codes.sql
-- ============================================================

BEGIN;

-- Phase 1: move every row to a guaranteed-unique temporary code
UPDATE reps
SET code = 'CC-TEMP-' || LPAD(id::text, 6, '0');

-- Phase 2: assign CC-0001, CC-0002, … in stable id order
WITH numbered AS (
    SELECT id,
           ROW_NUMBER() OVER (ORDER BY id) AS seq
    FROM reps
)
UPDATE reps r
SET code = 'CC-' || LPAD(n.seq::text, 4, '0')
FROM numbered n
WHERE r.id = n.id;

COMMIT;
