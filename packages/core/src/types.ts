/** Listed option right */
export type OptionRight = 'C' | 'P';

/** Stock lot (shares). `qty` signed: long positive, short negative. */
export type StockLeg = {
  kind: 'stock';
  underlying: string;
  qty: number;
};

/** Single listed option. `qty` contracts signed; each contract = multiplier shares. */
export type OptionLeg = {
  kind: 'option';
  underlying: string;
  strike: number;
  /** Calendar expiry at market close (US), ISO date `YYYY-MM-DD` */
  expiry: string;
  right: OptionRight;
  qty: number;
};

export type PositionLeg = StockLeg | OptionLeg;

export type UnderlyingInputs = {
  /** Spot price */
  spot: number;
  /** Annual risk-free rate (continuous compounding basis for BS) */
  rate: number;
  /** Continuous dividend yield */
  divYield: number;
  /**
   * Baseline implied vol for options on this underlying when no per-leg IV is set.
   * Annualized, e.g. 0.25 = 25%.
   */
  baselineIv: number;
  /** Optional override IV per option key `strike|expiry|right` from `optionKey()` */
  ivByOption?: Record<string, number>;
};

export type MarketSnapshot = {
  /** Per underlying symbol (uppercase recommended) */
  underlyings: Record<string, UnderlyingInputs>;
  /** Share multiplier per option contract (US listed equity options: 100) */
  optionMultiplier: number;
};

/** Relative shocks as fractions: priceShock 0.15 means +15% spot move */
export type ScenarioGridConfig = {
  priceShocks: number[];
  volShocks: number[];
};

export type ScenarioPoint = {
  priceShock: number;
  volShock: number;
};

export type ScenarioResult = ScenarioPoint & {
  /** Portfolio mark-to-market PnL vs base marks (same positions) */
  pnl: number;
  /** Total portfolio value under this scenario */
  portfolioValue: number;
};

export type MarginRunResult = {
  basePortfolioValue: number;
  scenarios: ScenarioResult[];
  /** Most negative scenario PnL (typically ≤ 0) */
  worstPnl: number;
  /** Conservative margin proxy: max(0, -worstPnl) */
  scenarioMargin: number;
  /** Simple Reg T style comparison (not PM) */
  regTInitialRequirement: number;
};
