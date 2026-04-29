import { blackScholesPrice } from './blackScholes.js';
import { yearFractionCalendar } from './dates.js';
import { optionKey } from './optionKey.js';
import type { MarketSnapshot, PositionLeg } from './types.js';

function normalizeSym(s: string): string {
  return s.trim().toUpperCase();
}

export function assertMarket(legs: PositionLeg[], market: MarketSnapshot): void {
  const syms = new Set(legs.map((l) => normalizeSym(l.underlying)));
  for (const s of syms) {
    const u = market.underlyings[s];
    if (!u) {
      throw new Error(`Missing market data for underlying ${s}`);
    }
    if (!(u.spot > 0) || !(u.baselineIv >= 0)) {
      throw new Error(`Invalid spot/IV for ${s}`);
    }
  }
}

export function ivForOption(
  u: MarketSnapshot['underlyings'][string],
  leg: Extract<PositionLeg, { kind: 'option' }>,
): number {
  const k = optionKey(leg);
  const v = u.ivByOption?.[k];
  return v ?? u.baselineIv;
}

/** Mark one leg at given shocked spot / vol (vol is absolute, not bump). */
export function legValue(
  leg: PositionLeg,
  market: MarketSnapshot,
  asOf: string,
  spotByUnderlying: Record<string, number>,
  volResolver: (sym: string, leg: Extract<PositionLeg, { kind: 'option' }>) => number,
): number {
  const sym = normalizeSym(leg.underlying);
  const u = market.underlyings[sym];
  if (!u) {
    throw new Error(`Missing market data for underlying ${sym}`);
  }
  const S = spotByUnderlying[sym] ?? u.spot;

  if (leg.kind === 'stock') {
    return leg.qty * S;
  }

  const T = yearFractionCalendar(asOf, leg.expiry);
  const sigma = volResolver(sym, leg);
  const px = blackScholesPrice({
    spot: S,
    strike: leg.strike,
    rate: u.rate,
    divYield: u.divYield,
    vol: sigma,
    timeYears: T,
    right: leg.right,
  });
  return leg.qty * market.optionMultiplier * px;
}

export function portfolioValue(
  legs: PositionLeg[],
  market: MarketSnapshot,
  asOf: string,
  spotByUnderlying: Record<string, number>,
  volResolver: (sym: string, leg: Extract<PositionLeg, { kind: 'option' }>) => number,
): number {
  let v = 0;
  for (const leg of legs) {
    v += legValue(leg, market, asOf, spotByUnderlying, volResolver);
  }
  return v;
}

/** Base marks: spot from market; IV from baseline / overrides. */
export function baseVolResolver(market: MarketSnapshot) {
  return (sym: string, leg: Extract<PositionLeg, { kind: 'option' }>) =>
    ivForOption(market.underlyings[sym]!, leg);
}

/** Scenario: scale IV by (1+volShock) relative to each leg's base IV. */
export function scenarioVolResolver(
  volShock: number,
  baseIvOf: (sym: string, leg: Extract<PositionLeg, { kind: 'option' }>) => number,
) {
  return (sym: string, leg: Extract<PositionLeg, { kind: 'option' }>) => {
    const base = baseIvOf(sym, leg);
    return Math.max(1e-8, base * (1 + volShock));
  };
}

export function scenarioSpotMap(
  market: MarketSnapshot,
  legs: PositionLeg[],
  priceShock: number,
): Record<string, number> {
  const syms = new Set(legs.map((l) => normalizeSym(l.underlying)));
  const out: Record<string, number> = {};
  for (const s of syms) {
    const u = market.underlyings[s]!;
    out[s] = u.spot * (1 + priceShock);
  }
  return out;
}
