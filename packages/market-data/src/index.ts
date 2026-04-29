/**
 * Server-side market data helpers. Do not expose API keys to the browser.
 */
import process from 'node:process';

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

/**
 * Resolve API key from Node-style env (use only on server / scripts).
 */
export function quoteApiKeyFromEnv(env: Record<string, string | undefined>): string | undefined {
  return env['QUOTE_API_KEY'] ?? env['ALPHA_VANTAGE_KEY'] ?? env['FMP_KEY'];
}

/**
 * Placeholder fetch — wire your approved delayed-quote vendor here.
 * Requires QUOTE_API_KEY (or vendor-specific env vars above).
 */
export async function fetchSpotUsd(symbol: string): Promise<number> {
  const key = quoteApiKeyFromEnv(process.env as Record<string, string | undefined>);
  if (!key) {
    throw new Error(
      'Missing QUOTE_API_KEY (or vendor-specific key). Set server-side env to enable quotes.',
    );
  }

  const cached = getCachedQuote(symbol);
  if (cached) return cached.spot;

  void key;
  throw new Error(
    'fetchSpotUsd is not wired to a vendor yet — integrate HTTP quotes behind this function.',
  );
}
