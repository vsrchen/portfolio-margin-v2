/** Years from `asOf` (ISO date) to expiry (ISO date), using UTC midnight boundaries. */
export function yearFractionCalendar(isoAsOf: string, isoExpiry: string): number {
  const t0 = Date.parse(`${isoAsOf}T12:00:00Z`);
  const t1 = Date.parse(`${isoExpiry}T12:00:00Z`);
  if (!Number.isFinite(t0) || !Number.isFinite(t1)) {
    throw new Error(`Invalid date: asOf=${isoAsOf}, expiry=${isoExpiry}`);
  }
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  return Math.max(0, (t1 - t0) / msPerYear);
}
