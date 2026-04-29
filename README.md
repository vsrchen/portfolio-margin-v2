# Portfolio Margin Simulator

Scenario-based portfolio margin **estimator** for US equities and listed options, built as a TypeScript monorepo with a React web app and a reusable core pricing/margin engine.

This project is designed for planning and education. It is **not** a broker-certified or regulatory-grade margin engine.

## Features

- Portfolio editor for stock and option positions
- OCC-style option symbol parsing (example: `SPY250119C00450000`)
- Black-Scholes option valuation in the core engine
- Configurable scenario grid (spot shocks x vol shocks)
- Worst-case scenario PnL and scenario margin proxy
- Reg T-style comparison proxy metric
- Export results as JSON and scenario grid as CSV
- Seeded demo portfolio with multi-index and SPX options

## Repository Structure

```text
.
├─ apps/
│  └─ web/                  # React + Vite UI
├─ packages/
│  ├─ core/                 # Margin math, pricing, tests
│  └─ market-data/          # Server-side market data/cache stubs
├─ scripts/
│  └─ install.mjs           # One-command repo installer/validator
├─ INSTALL.md
└─ package.json             # Workspace scripts
```

## Prerequisites

- Node.js 20+
- npm

## Quick Start

### One-command installer

```bash
npm run install:repo
```

This runs:

1. `npm install`
2. `npm run build`
3. `npm run test -w @portfolio-margin/core`

### Start the web app

```bash
npm run dev -w web
```

Then open the local URL shown by Vite (typically `http://localhost:5173`).

## Manual Development Commands

```bash
# install deps
npm install

# run core tests
npm run test -w @portfolio-margin/core

# lint all workspaces
npm run lint

# build all workspaces
npm run build
```

## Methodology (High-Level)

For each scenario point in a configurable grid:

- Apply a proportional underlying price shock
- Apply a proportional IV shock to option baseline IV
- Revalue portfolio (stock + options) vs base valuation
- Compute scenario PnL

Outputs:

- `worstPnl` = minimum scenario PnL
- `scenarioMargin` = `max(0, -worstPnl)`
- `regTInitialRequirement` = simplified comparison proxy

## Important Limitations

- Uses Black-Scholes assumptions; American-style exercise effects are simplified
- Real broker PM implementations may use proprietary rules and concentration add-ons not modeled here
- Market data integration is currently a server-side stub in `packages/market-data`
- This tool should not be used as the sole basis for trading or credit decisions

## Environment Variables

See `.env.example`:

- `QUOTE_API_KEY` for future market-data provider integration (server-side use only)

## CI

GitHub Actions workflow in `.github/workflows/ci.yml` runs:

- install
- lint
- build
- core tests

## License

No license file is currently configured. Add one if you plan to open-source or distribute broadly.
