/** Round to 2 decimal places (mirrors backend ROUND_HALF_UP for positive amounts). */
export const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Compute customer-facing line amount and internal breakdown from raw cost.
 * Mirrors backend calculate_line_item exactly.
 */
export function calculateLineItem(rawAmount, invoiceCategory, marginPct, ssclPct, vatPct) {
  const raw = Number(rawAmount) || 0;
  const profitAmt = round2(raw * marginPct);
  const afterMargin = raw + profitAmt;

  if (invoiceCategory === "ALL_INC") {
    const ssclAmt = round2(afterMargin * ssclPct);
    const afterSscl = afterMargin + ssclAmt;
    const vatAmt = round2(afterSscl * vatPct);
    return {
      rawAmount: raw,
      profitAmt,
      ssclAmt,
      vatAmt,
      displayAmount: afterSscl + vatAmt,
    };
  }

  return {
    rawAmount: raw,
    profitAmt,
    ssclAmt: 0,
    vatAmt: 0,
    displayAmount: afterMargin,
  };
}

/**
 * Aggregate line results into invoice-level totals.
 * Mirrors backend calculate_invoice_totals.
 */
export function calculateInvoiceTotals(lines, invoiceCategory, ssclPct, vatPct) {
  const baseSubtotal = lines.reduce((s, l) => s + l.rawAmount, 0);
  const profitAmt = lines.reduce((s, l) => s + l.profitAmt, 0);

  if (invoiceCategory === "ALL_INC") {
    const ssclAmt = lines.reduce((s, l) => s + l.ssclAmt, 0);
    const vatAmt = lines.reduce((s, l) => s + l.vatAmt, 0);
    const grandTotal = lines.reduce((s, l) => s + l.displayAmount, 0);
    return { baseSubtotal, profitAmt, displaySubtotal: 0, ssclAmt, vatAmt, grandTotal };
  }

  const displaySubtotal = lines.reduce((s, l) => s + l.displayAmount, 0);
  const ssclAmt = round2(displaySubtotal * ssclPct);
  const afterSscl = displaySubtotal + ssclAmt;
  const vatAmt = round2(afterSscl * vatPct);
  const grandTotal = afterSscl + vatAmt;
  return { baseSubtotal, profitAmt, displaySubtotal, ssclAmt, vatAmt, grandTotal };
}

/** Compute line breakdown for a single form row (qty × raw rate). */
export function calculateItemRow(item, invoiceCategory, marginPct, ssclPct, vatPct) {
  const rawAmount = (Number(item.qty) || 0) * (Number(item.rate) || 0);
  return calculateLineItem(rawAmount, invoiceCategory, marginPct, ssclPct, vatPct);
}
