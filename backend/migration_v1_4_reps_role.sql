-- ============================================================
-- Migration v1.4: Add reps.role + assign CC-0000 employee numbers
-- ============================================================
-- Safe for existing data:
--   • Never deletes reps rows
--   • Only updates code and role columns (FKs use reps.id)
--
-- Canonical numbering:
--   CC-0001  Asanka   — CEO
--   CC-0002  Joseph   — General Manager
--   CC-0003  Hasitha
--   CC-0004  Pramod
--   CC-0005  Shen
--
-- Run once:
--   psql -U <user> -d <database> -f migration_v1_4_reps_role.sql
-- ============================================================

BEGIN;

ALTER TABLE reps ADD COLUMN IF NOT EXISTS role VARCHAR(100);

-- Phase 1: temporary unique codes
UPDATE reps
SET code = 'CC-TEMP-' || LPAD(id::text, 6, '0');

-- Phase 2: named assignments
UPDATE reps SET code = 'CC-0001', role = 'CEO'              WHERE LOWER(name) = 'asanka';
UPDATE reps SET code = 'CC-0002', role = 'General Manager' WHERE LOWER(name) = 'joseph';
UPDATE reps SET code = 'CC-0003'                             WHERE LOWER(name) = 'hasitha';
UPDATE reps SET code = 'CC-0004'                             WHERE LOWER(name) = 'pramod';
UPDATE reps SET code = 'CC-0005'                             WHERE LOWER(name) = 'shen';

-- Phase 3: any other staff get the next available CC-#### number
DO $$
DECLARE
    rec RECORD;
    next_num INT := 6;
BEGIN
    FOR rec IN
        SELECT id FROM reps WHERE code LIKE 'CC-TEMP-%' ORDER BY id
    LOOP
        UPDATE reps SET code = 'CC-' || LPAD(next_num::text, 4, '0') WHERE id = rec.id;
        next_num := next_num + 1;
    END LOOP;
END $$;

COMMIT;
