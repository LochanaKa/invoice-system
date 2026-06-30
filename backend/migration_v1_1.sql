-- ============================================================
-- Migration: Add tax breakdown columns + settings table
-- Creative Computers Invoice System v1.1
-- Run this ONCE against your PostgreSQL database.
-- Safe to run on an existing database — uses IF NOT EXISTS.
-- ============================================================


-- ── 1. New columns on the invoices table ─────────────────────────────────────
--
-- base_subtotal        = raw sum of line items (qty × rate)
-- profit_margin_pct    = rate snapshot at invoice creation time (0–1 decimal)
-- profit_margin_amount = base_subtotal × profit_margin_pct
-- sscl_pct             = SSCL rate snapshot (0–1 decimal)
-- sscl_amount          = (base_subtotal + profit_margin_amount) × sscl_pct
-- vat_pct              = VAT rate snapshot (0–1 decimal)
-- vat_amount           = (after margin + sscl) × vat_pct   ← already existed
-- grand_total          = base + margin + sscl + vat
--
-- Existing columns NOT changed:
--   amount     → kept for backward compatibility, = base_subtotal on new rows
--   vat_amount → already existed, now calculated by the backend
--   credit_balance, is_vat_posted, etc. → unchanged

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS base_subtotal         NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profit_margin_pct     NUMERIC(8,  6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profit_margin_amount  NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sscl_pct              NUMERIC(8,  6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sscl_amount           NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_pct               NUMERIC(8,  6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS grand_total           NUMERIC(12, 2) NOT NULL DEFAULT 0;

-- Backfill existing rows so grand_total = amount (best estimate for old data)
-- For old ALL_INC rows: grand_total was already baked into `amount`
-- For old VAT rows:     grand_total = amount + vat_amount
UPDATE invoices
SET
  base_subtotal = amount,
  grand_total   = CASE
                    WHEN invoice_category = 'VAT' THEN amount + vat_amount
                    ELSE amount
                  END
WHERE grand_total = 0;


-- ── 2. Settings table (single-row global config) ──────────────────────────────

CREATE TABLE IF NOT EXISTS settings (
  id            INTEGER      PRIMARY KEY DEFAULT 1,
  sscl_pct      NUMERIC(8,6) NOT NULL DEFAULT 0.025,
  vat_pct       NUMERIC(8,6) NOT NULL DEFAULT 0.18,
  profit_margin NUMERIC(8,6) NOT NULL DEFAULT 0.20,
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed the one and only row (no-op if already exists)
INSERT INTO settings (id, sscl_pct, vat_pct, profit_margin)
VALUES (1, 0.025, 0.18, 0.20)
ON CONFLICT (id) DO NOTHING;


-- ── 3. Verify ────────────────────────────────────────────────────────────────
-- Run these SELECTs to confirm the migration worked:

-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'invoices'
--   AND column_name IN (
--     'base_subtotal', 'profit_margin_pct', 'profit_margin_amount',
--     'sscl_pct', 'sscl_amount', 'vat_pct', 'grand_total'
--   );

-- SELECT * FROM settings;
