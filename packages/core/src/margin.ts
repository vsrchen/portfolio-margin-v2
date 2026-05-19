import { formatPositionLegLabel } from './positionLabel.js';
import { regTInitialRequirementProxy, regTRequirementForLeg } from './regT.js';
import type {
  MarginRunResult,
  MarketSnapshot,
  PositionAttribution,
  PositionLeg,
  ScenarioGridConfig,
  ScenarioResult,
} from './types.js';
import {
  assertMarket,
  baseVolResolver,
  ivForOption,
  legValue,
  portfolioValue,
  scenarioSpotMap,
  scenarioVolResolver,
} from './valuation.js';

function normalizeSym(s: string): string {
  return s.trim().toUpperCase();
}

function baseSpotMap(legs: PositionLeg[], market: MarketSnapshot): Record<string, number> {
  const syms = new Set(legs.map((l) => normalizeSym(l.underlying)));
  const out: Record<string, number> = {};
  for (const s of syms) {
    out[s] = market.underlyings[s]!.spot;
  }
  return out;
}

/**
 * Full cartesian grid of price × vol shocks (parallel per underlying).
 * Vol bump is applied relative to each option's base IV at run time.
 */
export function computeMarginRun(
  legs: PositionLeg[],
  market: MarketSnapshot,
  asOf: string,
  grid: ScenarioGridConfig,
): MarginRunResult {
  assertMarket(legs, market);
  const baseSpot = baseSpotMap(legs, market);
  const baseVol = baseVolResolver(market);

  const basePortfolioValue = portfolioValue(legs, market, asOf, baseSpot, baseVol);

  const scenarios: ScenarioResult[] = [];

  for (const priceShock of grid.priceShocks) {
    for (const volShock of grid.volShocks) {
      const spots = scenarioSpotMap(market, legs, priceShock);
      const volFn = scenarioVolResolver(volShock, (sym, leg) =>
        ivForOption(market.underlyings[sym]!, leg),
      );
      const portfolioValueScenario = portfolioValue(legs, market, asOf, spots, volFn);
      const pnl = portfolioValueScenario - basePortfolioValue;
      scenarios.push({
        priceShock,
        volShock,
        pnl,
        portfolioValue: portfolioValueScenario,
      });
    }
  }

  let worstPnl = scenarios.length ? scenarios[0]!.pnl : 0;
  let worstScenario = scenarios.length
    ? { priceShock: scenarios[0]!.priceShock, volShock: scenarios[0]!.volShock }
    : { priceShock: 0, volShock: 0 };
  for (const s of scenarios) {
    if (s.pnl < worstPnl) {
      worstPnl = s.pnl;
      worstScenario = { priceShock: s.priceShock, volShock: s.volShock };
    }
  }

  const scenarioMargin = Math.max(0, -worstPnl);
  const regTInitialRequirement = regTInitialRequirementProxy(legs, market, asOf);
  const positionAttributions = computePositionAttributionsForScenario(
    legs,
    market,
    asOf,
    worstScenario,
    scenarioMargin,
  );

  return {
    basePortfolioValue,
    scenarios,
    worstPnl,
    scenarioMargin,
    regTInitialRequirement,
    worstScenario,
    positionAttributions,
  };
}

/** Per-leg PnL and margin attribution at a specific spot/vol shock. */
export function computePositionAttributionsForScenario(
  legs: PositionLeg[],
  market: MarketSnapshot,
  asOf: string,
  scenario: { priceShock: number; volShock: number },
  scenarioMargin: number,
): PositionAttribution[] {
  const baseSpot = baseSpotMap(legs, market);
  const baseVol = baseVolResolver(market);
  const scenarioSpots = scenarioSpotMap(market, legs, scenario.priceShock);
  const scenarioVol = scenarioVolResolver(scenario.volShock, (sym, leg) =>
    ivForOption(market.underlyings[sym]!, leg),
  );

  const rows: PositionAttribution[] = [];
  let totalLoss = 0;

  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i]!;
    const baseValue = legValue(leg, market, asOf, baseSpot, baseVol);
    const scenarioValue = legValue(leg, market, asOf, scenarioSpots, scenarioVol);
    const pnlAtScenario = scenarioValue - baseValue;
    const regT = regTRequirementForLeg(leg, market, asOf);

    if (pnlAtScenario < 0) {
      totalLoss += -pnlAtScenario;
    }

    rows.push({
      legIndex: i,
      label: formatPositionLegLabel(leg),
      baseValue,
      pnlAtScenario,
      scenarioMarginAttribution: 0,
      regTInitialRequirement: regT,
    });
  }

  if (scenarioMargin > 0 && totalLoss > 0) {
    for (const row of rows) {
      if (row.pnlAtScenario < 0) {
        row.scenarioMarginAttribution = (scenarioMargin * -row.pnlAtScenario) / totalLoss;
      }
    }
  }

  return rows;
}

/** Default PM-like grid (example magnitudes; configurable in UI). */
export const defaultScenarioGrid: ScenarioGridConfig = {
  priceShocks: [-0.26, -0.2, -0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15, 0.2, 0.26],
  volShocks: [-0.22, -0.15, -0.1, 0, 0.1, 0.15, 0.22],
};

export const conservativeScenarioGrid: ScenarioGridConfig = {
  priceShocks: [-0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15],
  volShocks: [-0.15, 0, 0.15],
};
