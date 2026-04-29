import type { OptionRight } from './types.js';

const SQRT_2PI = Math.sqrt(2 * Math.PI);

/** Standard normal PDF */
export function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / SQRT_2PI;
}

/** Standard normal CDF via Abramowitz & Stegun approximation */
export function normCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.2316419 * ax);
  const y =
    1 -
    normPdf(ax) *
      t *
      (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return sign === -1 ? 1 - y : y;
}

export type BsInputs = {
  spot: number;
  strike: number;
  rate: number;
  divYield: number;
  vol: number;
  timeYears: number;
  right: OptionRight;
};

export function blackScholesPrice(inputs: BsInputs): number {
  const { spot, strike, rate, divYield, vol, timeYears, right } = inputs;
  if (timeYears <= 0) {
    const intrinsic =
      right === 'C'
        ? Math.max(0, spot - strike)
        : Math.max(0, strike - spot);
    return intrinsic;
  }
  if (vol <= 0) {
    const fwd = spot * Math.exp(-divYield * timeYears);
    const disc = Math.exp(-rate * timeYears);
    const intrinsic =
      right === 'C'
        ? Math.max(0, fwd - strike) * disc
        : Math.max(0, strike - fwd) * disc;
    return intrinsic;
  }

  const sqrtT = Math.sqrt(timeYears);
  const d1 =
    (Math.log(spot / strike) + (rate - divYield + 0.5 * vol * vol) * timeYears) / (vol * sqrtT);
  const d2 = d1 - vol * sqrtT;
  const discSpot = spot * Math.exp(-divYield * timeYears);
  const discStrike = strike * Math.exp(-rate * timeYears);

  if (right === 'C') {
    return discSpot * normCdf(d1) - discStrike * normCdf(d2);
  }
  return discStrike * normCdf(-d2) - discSpot * normCdf(-d1);
}
