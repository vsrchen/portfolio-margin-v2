import { describe, expect, it } from 'vitest';
import { blackScholesPrice, normCdf } from './blackScholes.js';

describe('normCdf', () => {
  it('is ~0.5 at 0', () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 5);
  });
});

describe('blackScholesPrice', () => {
  it('matches known ATM call (approx)', () => {
    const px = blackScholesPrice({
      spot: 100,
      strike: 100,
      rate: 0.05,
      divYield: 0,
      vol: 0.2,
      timeYears: 1,
      right: 'C',
    });
    expect(px).toBeGreaterThan(10.4);
    expect(px).toBeLessThan(10.52);
  });

  it('put-call parity at ATM', () => {
    const S = 100;
    const K = 100;
    const r = 0.05;
    const q = 0.02;
    const v = 0.25;
    const T = 0.5;
    const c = blackScholesPrice({ spot: S, strike: K, rate: r, divYield: q, vol: v, timeYears: T, right: 'C' });
    const p = blackScholesPrice({ spot: S, strike: K, rate: r, divYield: q, vol: v, timeYears: T, right: 'P' });
    const lhs = c - p;
    const rhs = S * Math.exp(-q * T) - K * Math.exp(-r * T);
    expect(lhs).toBeCloseTo(rhs, 8);
  });
});
