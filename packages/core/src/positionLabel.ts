import type { PositionLeg } from './types.js';

/** Short human-readable label for a position leg (UI / exports). */
export function formatPositionLegLabel(leg: PositionLeg): string {
  if (leg.kind === 'stock') {
    const sym = leg.underlying.trim().toUpperCase();
    return `${sym} stock × ${leg.qty}`;
  }
  const sym = leg.underlying.trim().toUpperCase();
  return `${sym} ${leg.expiry} ${leg.right}${leg.strike} × ${leg.qty}`;
}
