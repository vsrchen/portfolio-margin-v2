import {
  computeMarginRun,
  conservativeScenarioGrid,
  defaultScenarioGrid,
  type MarginRunResult,
  type ScenarioGridConfig,
} from '@portfolio-margin/core';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { downloadText, exportCsvScenarios, exportJson } from './exportRun.js';
import {
  buildMarketSnapshot,
  collectSymbolsFromLegs,
  type LegRow,
  type MarketRow,
  parseLegRows,
} from './model.js';

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Math.random().toString(36).slice(2)}`;
}

const defaultMarket = (): MarketRow => ({
  spot: '450',
  rate: '0.05',
  divYield: '0.015',
  baselineIv: '0.22',
});

function parseShocksCsv(text: string): number[] | null {
  const parts = text
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  return nums;
}

function useScenarioGrid(
  preset: 'conservative' | 'default' | 'custom',
  customPrice: string,
  customVol: string,
): { grid: ScenarioGridConfig | null; error: string | null } {
  return useMemo(() => {
    if (preset === 'conservative') return { grid: conservativeScenarioGrid, error: null };
    if (preset === 'default') return { grid: defaultScenarioGrid, error: null };
    const priceShocks = parseShocksCsv(customPrice);
    const volShocks = parseShocksCsv(customVol);
    if (!priceShocks || priceShocks.length === 0) {
      return { grid: null, error: 'Enter numeric price shocks (comma-separated fractions, e.g. -0.26,0,0.26).' };
    }
    if (!volShocks || volShocks.length === 0) {
      return { grid: null, error: 'Enter numeric vol shocks (comma-separated fractions).' };
    }
    return { grid: { priceShocks, volShocks }, error: null };
  }, [preset, customPrice, customVol]);
}

const demoLegs: LegRow[] = [
  { id: '1', kind: 'stock', underlying: 'SPY', qty: '100' },
  { id: '3', kind: 'stock', underlying: 'QQQ', qty: '75' },
  { id: '4', kind: 'stock', underlying: 'DIA', qty: '40' },
  { id: '5', kind: 'stock', underlying: 'IWM', qty: '60' },
  { id: '6', kind: 'stock', underlying: 'EFA', qty: '90' },
  { id: '7', kind: 'stock', underlying: 'EEM', qty: '90' },
  { id: '8', kind: 'stock', underlying: 'EWJ', qty: '70' },
  { id: '9', kind: 'stock', underlying: 'EWU', qty: '70' },
  { id: '10', kind: 'stock', underlying: 'FXI', qty: '80' },
  { id: '11', kind: 'stock', underlying: 'INDA', qty: '80' },
  {
    id: '2',
    kind: 'option',
    entry: 'occ',
    occ: 'SPY250119C00450000',
    underlying: 'SPY',
    strike: '450',
    expiry: '2025-01-19',
    right: 'C',
    qty: '2',
  },
  {
    id: '12',
    kind: 'option',
    entry: 'occ',
    occ: 'SPX250620C05000000',
    underlying: 'SPX',
    strike: '5000',
    expiry: '2025-06-20',
    right: 'C',
    qty: '1',
  },
  {
    id: '13',
    kind: 'option',
    entry: 'occ',
    occ: 'SPX250620P04800000',
    underlying: 'SPX',
    strike: '4800',
    expiry: '2025-06-20',
    right: 'P',
    qty: '1',
  },
  {
    id: '14',
    kind: 'option',
    entry: 'occ',
    occ: 'SPX250920C05250000',
    underlying: 'SPX',
    strike: '5250',
    expiry: '2025-09-20',
    right: 'C',
    qty: '-1',
  },
  {
    id: '15',
    kind: 'option',
    entry: 'occ',
    occ: 'SPX250920P04750000',
    underlying: 'SPX',
    strike: '4750',
    expiry: '2025-09-20',
    right: 'P',
    qty: '-1',
  },
];

export default function App() {
  const [asOf, setAsOf] = useState('2025-06-01');
  const [rows, setRows] = useState<LegRow[]>(demoLegs);
  const [marketBySymbol, setMarketBySymbol] = useState<Record<string, MarketRow>>({
    SPY: defaultMarket(),
  });
  const [optionMultiplier, setOptionMultiplier] = useState('100');
  const [preset, setPreset] = useState<'conservative' | 'default' | 'custom'>('default');
  const [customPrice, setCustomPrice] = useState('-0.26,-0.2,-0.1,0,0.1,0.2,0.26');
  const [customVol, setCustomVol] = useState('-0.22,0,0.22');

  const { grid, error: gridError } = useScenarioGrid(preset, customPrice, customVol);

  const runState = useMemo(() => {
    const parsedLegs = parseLegRows(rows);
    if (parsedLegs.errors.length) {
      return { ok: false as const, message: parsedLegs.errors.join(' ') };
    }
    const symbols = collectSymbolsFromLegs(parsedLegs.legs);
    const snap = buildMarketSnapshot(symbols, marketBySymbol, Number(optionMultiplier));
    if (snap.errors.length) {
      return { ok: false as const, message: snap.errors.join(' ') };
    }
    if (!grid) {
      return { ok: false as const, message: gridError ?? 'Invalid scenario grid.' };
    }
    if (!snap.snapshot) {
      return { ok: false as const, message: 'Missing market snapshot.' };
    }
    try {
      const result = computeMarginRun(parsedLegs.legs, snap.snapshot, asOf, grid);
      return { ok: true as const, result, legs: parsedLegs.legs, grid };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false as const, message: msg };
    }
  }, [rows, marketBySymbol, optionMultiplier, grid, gridError, asOf]);

  function upsertMarketForSymbols(symbols: string[]) {
    setMarketBySymbol((prev) => {
      const next = { ...prev };
      for (const s of symbols) {
        if (!next[s]) next[s] = defaultMarket();
      }
      return next;
    });
  }

  function addStock() {
    const id = uid();
    setRows((r) => [...r, { id, kind: 'stock', underlying: '', qty: '1' }]);
  }

  function addOption() {
    const id = uid();
    setRows((r) => [
      ...r,
      {
        id,
        kind: 'option',
        entry: 'fields',
        occ: '',
        underlying: '',
        strike: '',
        expiry: '',
        right: 'C',
        qty: '1',
      },
    ]);
  }

  function removeRow(id: string) {
    setRows((r) => r.filter((x) => x.id !== id));
  }

  const previewSymbols = useMemo(() => {
    const pl = parseLegRows(rows);
    if (!pl.legs.length) return [];
    return collectSymbolsFromLegs(pl.legs);
  }, [rows]);

  useEffect(() => {
    setMarketBySymbol((prev) => {
      const next = { ...prev };
      for (const s of previewSymbols) {
        if (!next[s]) next[s] = defaultMarket();
      }
      return next;
    });
  }, [previewSymbols]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Portfolio margin simulator
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-zinc-400">
            Scenario-based estimate for US equities and listed options using Black–Scholes marks and a
            configurable spot/vol shock grid. Outputs are simulations for planning and education—not a
            broker margin determination.
          </p>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1fr_320px]">
        <section className="flex flex-col gap-8">
          <Panel title="Portfolio">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600"
                onClick={addStock}
              >
                Add stock
              </button>
              <button
                type="button"
                className="rounded-md bg-emerald-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                onClick={addOption}
              >
                Add option
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="mt-4 w-full min-w-[720px] border-collapse text-left text-sm">
                <thead className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="py-2 pr-2">Type</th>
                    <th className="py-2 pr-2">Details</th>
                    <th className="py-2 pr-2">Qty</th>
                    <th className="py-2"> </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {rows.map((row) => (
                    <tr key={row.id} className="align-top">
                      <td className="py-3 pr-2">
                        {row.kind === 'stock' ? (
                          <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
                            Stock
                          </span>
                        ) : (
                          <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
                            Option
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-2">
                        {row.kind === 'stock' ? (
                          <div className="flex flex-wrap gap-2">
                            <input
                              className="w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
                              placeholder="SPY"
                              value={row.underlying}
                              onChange={(e) =>
                                setRows((rs) =>
                                  rs.map((x) =>
                                    x.id === row.id && x.kind === 'stock'
                                      ? { ...x, underlying: e.target.value }
                                      : x,
                                  ),
                                )
                              }
                            />
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <label className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                              <span>OCC symbol</span>
                              <input
                                type="radio"
                                checked={row.entry === 'occ'}
                                onChange={() =>
                                  setRows((rs) =>
                                    rs.map((x) =>
                                      x.id === row.id && x.kind === 'option'
                                        ? { ...x, entry: 'occ' }
                                        : x,
                                    ),
                                  )
                                }
                              />
                              <span className="ml-3">Manual</span>
                              <input
                                type="radio"
                                checked={row.entry === 'fields'}
                                onChange={() =>
                                  setRows((rs) =>
                                    rs.map((x) =>
                                      x.id === row.id && x.kind === 'option'
                                        ? { ...x, entry: 'fields' }
                                        : x,
                                    ),
                                  )
                                }
                              />
                            </label>
                            {row.entry === 'occ' ? (
                              <input
                                className="w-full max-w-md rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-100"
                                placeholder="SPY250119C00450000"
                                value={row.occ}
                                onChange={(e) =>
                                  setRows((rs) =>
                                    rs.map((x) =>
                                      x.id === row.id && x.kind === 'option'
                                        ? { ...x, occ: e.target.value }
                                        : x,
                                    ),
                                  )
                                }
                              />
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                <input
                                  className="w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
                                  placeholder="SPY"
                                  value={row.underlying}
                                  onChange={(e) =>
                                    setRows((rs) =>
                                      rs.map((x) =>
                                        x.id === row.id && x.kind === 'option'
                                          ? { ...x, underlying: e.target.value }
                                          : x,
                                      ),
                                    )
                                  }
                                />
                                <input
                                  className="w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
                                  placeholder="Strike"
                                  value={row.strike}
                                  onChange={(e) =>
                                    setRows((rs) =>
                                      rs.map((x) =>
                                        x.id === row.id && x.kind === 'option'
                                          ? { ...x, strike: e.target.value }
                                          : x,
                                      ),
                                    )
                                  }
                                />
                                <input
                                  className="w-36 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-100"
                                  placeholder="YYYY-MM-DD"
                                  value={row.expiry}
                                  onChange={(e) =>
                                    setRows((rs) =>
                                      rs.map((x) =>
                                        x.id === row.id && x.kind === 'option'
                                          ? { ...x, expiry: e.target.value }
                                          : x,
                                      ),
                                    )
                                  }
                                />
                                <select
                                  className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
                                  value={row.right}
                                  onChange={(e) =>
                                    setRows((rs) =>
                                      rs.map((x) =>
                                        x.id === row.id && x.kind === 'option'
                                          ? { ...x, right: e.target.value as 'C' | 'P' }
                                          : x,
                                      ),
                                    )
                                  }
                                >
                                  <option value="C">Call</option>
                                  <option value="P">Put</option>
                                </select>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-2">
                        <input
                          className="w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
                          value={row.qty}
                          onChange={(e) =>
                            setRows((rs) =>
                              rs.map((x) =>
                                x.id === row.id ? { ...x, qty: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      </td>
                      <td className="py-3">
                        <button
                          type="button"
                          className="text-xs text-red-400 hover:text-red-300"
                          onClick={() => removeRow(row.id)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Market inputs (manual)">
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500">As-of date</span>
                <input
                  className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-zinc-100"
                  value={asOf}
                  onChange={(e) => setAsOf(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500">Option multiplier</span>
                <input
                  className="w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
                  value={optionMultiplier}
                  onChange={(e) => setOptionMultiplier(e.target.value)}
                />
              </label>
            </div>

            <p className="mt-3 text-xs text-zinc-500">
              Symbols referenced by positions:{' '}
              <span className="font-mono text-zinc-300">{previewSymbols.join(', ') || '—'}</span>
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {previewSymbols.map((sym) => (
                <div key={sym} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                  <div className="mb-2 font-mono text-sm font-semibold text-emerald-400">{sym}</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <Field
                      label="Spot"
                      value={marketBySymbol[sym]?.spot ?? ''}
                      onChange={(v) =>
                        setMarketBySymbol((m) => ({
                          ...m,
                          [sym]: { ...(m[sym] ?? defaultMarket()), spot: v },
                        }))
                      }
                    />
                    <Field
                      label="Rate"
                      value={marketBySymbol[sym]?.rate ?? ''}
                      onChange={(v) =>
                        setMarketBySymbol((m) => ({
                          ...m,
                          [sym]: { ...(m[sym] ?? defaultMarket()), rate: v },
                        }))
                      }
                    />
                    <Field
                      label="Div yield"
                      value={marketBySymbol[sym]?.divYield ?? ''}
                      onChange={(v) =>
                        setMarketBySymbol((m) => ({
                          ...m,
                          [sym]: { ...(m[sym] ?? defaultMarket()), divYield: v },
                        }))
                      }
                    />
                    <Field
                      label="Baseline IV"
                      value={marketBySymbol[sym]?.baselineIv ?? ''}
                      onChange={(v) =>
                        setMarketBySymbol((m) => ({
                          ...m,
                          [sym]: { ...(m[sym] ?? defaultMarket()), baselineIv: v },
                        }))
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Scenario grid">
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={preset === 'conservative'}
                  onChange={() => setPreset('conservative')}
                />
                Conservative
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={preset === 'default'}
                  onChange={() => setPreset('default')}
                />
                PM-like (default)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={preset === 'custom'}
                  onChange={() => setPreset('custom')}
                />
                Custom
              </label>
            </div>
            {preset === 'custom' && (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-zinc-500">Price shocks (fractions)</span>
                  <textarea
                    className="min-h-[88px] rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-zinc-100"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-zinc-500">Vol shocks (fractions)</span>
                  <textarea
                    className="min-h-[88px] rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-zinc-100"
                    value={customVol}
                    onChange={(e) => setCustomVol(e.target.value)}
                  />
                </label>
              </div>
            )}
            {gridError && preset === 'custom' && (
              <p className="mt-2 text-sm text-amber-400">{gridError}</p>
            )}
          </Panel>

          <Panel title="Methodology">
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-400">
              <li>
                Positions are marked with Black–Scholes for European-style parity; listed Americans can
                deviate when deep ITM/near dividend — documented limitation.
              </li>
              <li>
                Each scenario applies the same proportional spot shock to every underlying and bumps each
                option&apos;s IV relative to its baseline IV by the vol shock (parallel bump).
              </li>
              <li>
                Scenario margin proxy is{' '}
                <span className="font-mono text-zinc-300">max(0, −worstPnL)</span> across the grid.
              </li>
              <li>
                Reg T column is a rough analytic proxy for comparison only (not a full SPAN or broker
                rules engine).
              </li>
            </ul>
          </Panel>
        </section>

        <aside className="flex flex-col gap-4">
          <Panel title="Results">
            {!runState.ok && (
              <p className="rounded-md border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-sm text-amber-200">
                {runState.message}
              </p>
            )}
            {runState.ok && (
              <ResultsCard
                result={runState.result}
                onExportJson={() =>
                  downloadText(
                    'margin-run.json',
                    exportJson({
                      asOf,
                      legs: runState.legs,
                      grid: runState.grid,
                      result: runState.result,
                    }),
                    'application/json',
                  )
                }
                onExportCsv={() =>
                  downloadText('margin-scenarios.csv', exportCsvScenarios(runState.result), 'text/csv')
                }
              />
            )}
          </Panel>

          <Panel title="Disclaimer">
            <p className="text-xs leading-relaxed text-zinc-500">
              This tool estimates portfolio loss across synthetic shocks. It does not replicate SEC/FINRA
              portfolio margin, OCC SPAN, or any broker&apos;s proprietary requirement. Do not rely on these
              numbers for trading or credit decisions.
            </p>
          </Panel>
        </aside>
      </main>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 shadow-sm shadow-black/30">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">{title}</h2>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${accent ?? 'text-white'}`}>{value}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-zinc-500">{label}</span>
      <input
        className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-zinc-100"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function ResultsCard({
  result,
  onExportJson,
  onExportCsv,
}: {
  result: MarginRunResult;
  onExportJson: () => void;
  onExportCsv: () => void;
}) {
  const worst = result.scenarios.reduce((a, b) => (a.pnl < b.pnl ? a : b));
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Base MTM" value={fmtUsd(result.basePortfolioValue)} />
        <Stat label="Worst PnL" value={fmtUsd(result.worstPnl)} accent="text-red-400" />
        <Stat label="Scenario margin" value={fmtUsd(result.scenarioMargin)} accent="text-amber-300" />
        <Stat label="Reg T proxy" value={fmtUsd(result.regTInitialRequirement)} />
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-400">
        <div className="font-semibold text-zinc-300">Worst scenario</div>
        <div className="mt-1 font-mono">
          price shock {worst.priceShock.toFixed(4)}, vol shock {worst.volShock.toFixed(4)}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-white"
          onClick={onExportJson}
        >
          Export JSON
        </button>
        <button
          type="button"
          className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:bg-zinc-700"
          onClick={onExportCsv}
        >
          Export scenarios CSV
        </button>
      </div>

      <details className="text-xs text-zinc-400">
        <summary className="cursor-pointer text-zinc-300">Top stressful scenarios</summary>
        <ol className="mt-2 max-h-56 list-decimal space-y-1 overflow-auto pl-5">
          {[...result.scenarios]
            .sort((a, b) => a.pnl - b.pnl)
            .slice(0, 12)
            .map((s, i) => (
              <li key={`${i}-${s.priceShock}-${s.volShock}`} className="font-mono">
                pnl {fmtUsd(s.pnl)} · ΔS {s.priceShock.toFixed(3)} · Δσ {s.volShock.toFixed(3)}
              </li>
            ))}
        </ol>
      </details>
    </div>
  );
}

function fmtUsd(n: number): string {
  return n.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  });
}
