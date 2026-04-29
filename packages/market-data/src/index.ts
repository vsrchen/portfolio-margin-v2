/**
 * Server-side market data helpers. Do not expose API keys to the browser.
 */
export type CachedQuote = {
  symbol: string;
  spot: number;
  fetchedAtMs: number;
};

const cacheTtlMs = 60_000;
const cache = new Map<string, CachedQuote>();

export function getCachedQuote(symbol: string): CachedQuote | undefined {
  const k = symbol.trim().toUpperCase();
  const hit = cache.get(k);
  if (!hit) return undefined;
  if (Date.now() - hit.fetchedAtMs > cacheTtlMs) {
    cache.delete(k);
    return undefined;
  }
  return hit;
}

export function setCachedQuote(symbol: string, spot: number): CachedQuote {
  const row: CachedQuote = {
    symbol: symbol.trim().toUpperCase(),
    spot,
    fetchedAtMs: Date.now(),
  };
  cache.set(row.symbol, row);
  return row;
}

const STOOQ_URL = 'https://stooq.com/q/l/';

function toKey(symbol: string): string {
  return symbol.trim().toUpperCase();
}

/**
 * Stooq uses symbols like `spy.us`.
 * These mappings cover common US index trackers and index aliases.
 */
function stooqSymbolFor(symbol: string): string {
  const s = toKey(symbol);
  const map: Record<string, string> = {
    SPY: 'spy.us',
    QQQ: 'qqq.us',
    DIA: 'dia.us',
    IWM: 'iwm.us',
    EFA: 'efa.us',
    EEM: 'eem.us',
    EWJ: 'ewj.us',
    EWU: 'ewu.us',
    FXI: 'fxi.us',
    INDA: 'inda.us',
    SPX: '^spx',
    GSPC: '^spx',
    NDX: '^ndx',
    DJI: '^dji',
    RUT: '^rut',
  };
  return map[s] ?? `${s.toLowerCase()}.us`;
}

function parseStooqClose(csvText: string): number {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error('No quote row returned.');
  }
  const row = lines[1] ?? '';
  const cols = row.split(',');
  const closeRaw = cols[6]?.trim();
  if (!closeRaw || closeRaw === 'N/D') {
    throw new Error('Quote unavailable from provider.');
  }
  const close = Number(closeRaw);
  if (!Number.isFinite(close) || close <= 0) {
    throw new Error(`Invalid quote value: ${closeRaw}`);
  }
  return close;
}

async function fetchStooqSpotUsd(symbol: string): Promise<number> {
  const stooqSymbol = stooqSymbolFor(symbol);
  const url = new URL(STOOQ_URL);
  url.searchParams.set('s', stooqSymbol);
  url.searchParams.set('f', 'sd2t2ohlcv');
  url.searchParams.set('h', '');
  url.searchParams.set('e', 'csv');

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'text/csv',
      'User-Agent': 'portfolio-margin/1.0',
    },
  });
  if (!res.ok) {
    throw new Error(`Provider request failed (${res.status})`);
  }
  const text = await res.text();
  return parseStooqClose(text);
}

/**
 * Fetch delayed end-of-day style spot from Stooq (free public endpoint).
 */
export async function fetchSpotUsd(symbol: string): Promise<number> {
  const key = toKey(symbol);
  const cached = getCachedQuote(key);
  if (cached) return cached.spot;

  const spot = await fetchStooqSpotUsd(key);
  setCachedQuote(key, spot);
  return spot;
}

export async function fetchSpotUsdMany(symbols: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const sym of symbols) {
    out[toKey(sym)] = await fetchSpotUsd(sym);
  }
  return out;
}
