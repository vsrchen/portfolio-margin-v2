import type { MarketSnapshot, PositionLeg } from './types.js';
import { baseVolResolver, legValue } from './valuation.js';

function normalizeSym(s: string): string {
  return s.trim().toUpperCase();
}

/**
 * Simplified Reg T initial requirement proxy:
 * max(25% * stock position market value (long only rough); short stock 30%;
 * short option premium + OTM amount per standard tables is simplified here as:
 * sum of max(0, - intrinsic estimate for naked shorts) — MVP uses premium at base marks for short options).
 *
 * For a clearer MVP: initial = 25% * abs(long stock MV) + for short stock 30% * abs(MV) +
 * for each short option: margin approx = contracts * multiplier * max(regulatory_pct * spot - OTM, min_floor).
 *
 * We use a compact approximation matching "plan" ask:
 * - Long stock: 50% Reg T initial often cited as **not** for PM; standard Reg T initial on margin stock purchase is 50% of purchase — for portfolio we approximate:
 *   requirement contribution = max(0, 0.25 * MV) for long stock leveraged portion only is messy without loan info.
 *
 * Simpler comparison metric:
 * - Stocks: 25% of |market value| (both sides) as gross approximation.
 * - Options: max(intrinsic + 0.10 * spot * multiplier * |qty|, 0.15 * spot * multiplier * |qty|) for short contracts only — still heavy.
 *
 * Implemented: REG_T_SIMPLE from plan "comparison only":
 * Sum over legs: stocks -> 0.25 * abs(qty * spot); options short -> 0.20 * spot * abs(qty) * multiplier (very rough).
 */
export function regTInitialRequirementProxy(
  legs: PositionLeg[],
  market: MarketSnapshot,
  asOf: string,
): number {
  const spotOf = (sym: string) => market.underlyings[normalizeSym(sym)]!.spot;
  let req = 0;

  for (const leg of legs) {
    const sym = normalizeSym(leg.underlying);
    const S = spotOf(sym);

    if (leg.kind === 'stock') {
      req += 0.25 * Math.abs(leg.qty * S);
      continue;
    }

    const mv = Math.abs(
      legValue(leg, market, asOf, { [sym]: S }, baseVolResolver(market)),
    );
    if (leg.qty < 0) {
      req += Math.max(0.1 * S * market.optionMultiplier * Math.abs(leg.qty), 0.25 * mv);
    }
  }

  return req;
}
