import { describe, expect, it } from 'vitest';
import { computeMarginRun, defaultScenarioGrid } from './margin.js';
import type { MarketSnapshot, PositionLeg } from './types.js';

function marketSpy(spot: number, iv: number): MarketSnapshot {
  return {
    optionMultiplier: 100,
    underlyings: {
      SPY: {
        spot,
        rate: 0.05,
        divYield: 0.015,
        baselineIv: iv,
      },
    },
  };
}

describe('computeMarginRun', () => {
  it('long stock loses on large down shock', () => {
    const legs: PositionLeg[] = [{ kind: 'stock', underlying: 'SPY', qty: 100 }];
    const market = marketSpy(400, 0.2);
    const asOf = '2025-06-01';
    const grid = { priceShocks: [-0.26, 0, 0.26], volShocks: [0] };
    const r = computeMarginRun(legs, market, asOf, grid);
    const down = r.scenarios.find((s) => s.priceShock === -0.26 && s.volShock === 0);
    expect(down).toBeDefined();
    expect(down!.pnl).toBeLessThan(0);
    expect(r.worstPnl).toBe(down!.pnl);
    expect(r.scenarioMargin).toBeCloseTo(-r.worstPnl, 8);
  });

  it('golden: long call has worst loss at down spot and/or vol shock combination', () => {
    const legs: PositionLeg[] = [
      {
        kind: 'option',
        underlying: 'SPY',
        strike: 400,
        expiry: '2025-12-19',
        right: 'C',
        qty: 2,
      },
    ];
    const market = marketSpy(400, 0.22);
    const asOf = '2025-06-01';
    const r = computeMarginRun(legs, market, asOf, defaultScenarioGrid);
    expect(r.basePortfolioValue).toBeGreaterThan(0);
    expect(r.worstPnl).toBeLessThan(0);
    const worst = r.scenarios.reduce((a, b) => (a.pnl < b.pnl ? a : b));
    expect(worst.pnl).toBe(r.worstPnl);
    expect(r.worstScenario.priceShock).toBe(worst.priceShock);
    expect(r.worstScenario.volShock).toBe(worst.volShock);
  });

  it('position attributions sum to portfolio margin and Reg T totals', () => {
    const legs: PositionLeg[] = [
      { kind: 'stock', underlying: 'SPY', qty: 100 },
      {
        kind: 'option',
        underlying: 'SPY',
        strike: 400,
        expiry: '2025-12-19',
        right: 'C',
        qty: 2,
      },
    ];
    const market = marketSpy(400, 0.22);
    const r = computeMarginRun(legs, market, '2025-06-01', defaultScenarioGrid);
    const regTSum = r.positionAttributions.reduce((a, p) => a + p.regTInitialRequirement, 0);
    const marginSum = r.positionAttributions.reduce((a, p) => a + p.scenarioMarginAttribution, 0);
    const pnlSum = r.positionAttributions.reduce((a, p) => a + p.pnlAtScenario, 0);

    expect(regTSum).toBeCloseTo(r.regTInitialRequirement, 8);
    expect(pnlSum).toBeCloseTo(r.worstPnl, 6);
    if (r.scenarioMargin > 0) {
      expect(marginSum).toBeCloseTo(r.scenarioMargin, 6);
    }
  });
});
