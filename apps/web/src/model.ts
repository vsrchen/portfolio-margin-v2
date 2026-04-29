import {
  tryParseOccOptionSymbol,
  type MarketSnapshot,
  type PositionLeg,
} from '@portfolio-margin/core';

export type StockRow = {
  id: string;
  kind: 'stock';
  underlying: string;
  qty: string;
};

export type OptionRow = {
  id: string;
  kind: 'option';
  entry: 'occ' | 'fields';
  occ: string;
  underlying: string;
  strike: string;
  expiry: string;
  right: 'C' | 'P';
  qty: string;
};

export type LegRow = StockRow | OptionRow;

export function parseLegRows(rows: LegRow[]): { legs: PositionLeg[]; errors: string[] } {
  const errors: string[] = [];
  const legs: PositionLeg[] = [];

  for (const row of rows) {
    if (row.kind === 'stock') {
      const u = row.underlying.trim().toUpperCase();
      const q = Number(row.qty);
      if (!u.length) {
        errors.push(`Stock ${row.id}: missing underlying`);
        continue;
      }
      if (!Number.isFinite(q) || q === 0) {
        errors.push(`Stock ${u}: invalid qty`);
        continue;
      }
      legs.push({ kind: 'stock', underlying: u, qty: q });
      continue;
    }

    const q = Number(row.qty);
    if (!Number.isFinite(q) || q === 0) {
      errors.push(`Option row ${row.id}: invalid qty`);
      continue;
    }

    if (row.entry === 'occ' && row.occ.trim()) {
      const p = tryParseOccOptionSymbol(row.occ);
      if (!p) {
        errors.push(`Option OCC "${row.occ}": could not parse`);
        continue;
      }
      legs.push({ ...p, qty: q });
      continue;
    }

    const u = row.underlying.trim().toUpperCase();
    const strike = Number(row.strike);
    if (!u.length || !Number.isFinite(strike) || strike <= 0) {
      errors.push(`Option ${row.id}: invalid underlying/strike`);
      continue;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.expiry.trim())) {
      errors.push(`Option ${row.id}: expiry must be YYYY-MM-DD`);
      continue;
    }
    legs.push({
      kind: 'option',
      underlying: u,
      strike,
      expiry: row.expiry.trim(),
      right: row.right,
      qty: q,
    });
  }

  return { legs, errors };
}

export type MarketRow = {
  spot: string;
  rate: string;
  divYield: string;
  baselineIv: string;
};

export function buildMarketSnapshot(
  symbols: string[],
  rows: Record<string, MarketRow | undefined>,
  optionMultiplier: number,
): { snapshot: MarketSnapshot | null; errors: string[] } {
  const errors: string[] = [];
  const underlyings: MarketSnapshot['underlyings'] = {};

  for (const s of symbols) {
    const r = rows[s];
    if (!r) {
      errors.push(`Missing market row for ${s}`);
      continue;
    }
    const spot = Number(r.spot);
    const rate = Number(r.rate);
    const divYield = Number(r.divYield);
    const baselineIv = Number(r.baselineIv);
    const symErrors: string[] = [];
    if (!(spot > 0)) symErrors.push(`${s}: spot must be positive`);
    if (!Number.isFinite(rate)) symErrors.push(`${s}: invalid rate`);
    if (!Number.isFinite(divYield)) symErrors.push(`${s}: invalid dividend yield`);
    if (!(baselineIv >= 0)) symErrors.push(`${s}: IV must be >= 0`);
    if (symErrors.length) {
      errors.push(...symErrors);
      continue;
    }
    underlyings[s] = { spot, rate, divYield, baselineIv };
  }

  if (errors.length) return { snapshot: null, errors };

  return {
    snapshot: { underlyings, optionMultiplier },
    errors: [],
  };
}

export function collectSymbolsFromLegs(legs: PositionLeg[]): string[] {
  const set = new Set<string>();
  for (const l of legs) {
    set.add(l.underlying.trim().toUpperCase());
  }
  return [...set].sort();
}
