-- ============================================================
-- Migration v1.2: Add raw_rate to invoice_items
-- Stores staff-entered raw cost separately from customer-facing rate.
-- Safe to run on existing databases — uses IF NOT EXISTS.
-- ============================================================

ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS raw_rate NUMERIC(12, 2) NOT NULL DEFAULT 0;

-- Backfill: existing rows had rate = raw cost before margin roll-up
UPDATE invoice_items SET raw_rate = rate WHERE raw_rate = 0;
