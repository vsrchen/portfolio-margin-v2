import { describe, expect, it } from 'vitest';
import { tryParseOccOptionSymbol } from './optionSymbol.js';

describe('tryParseOccOptionSymbol', () => {
  it('parses standard equity option symbol', () => {
    const p = tryParseOccOptionSymbol('SPY250119C00450000');
    expect(p).not.toBeNull();
    expect(p!.underlying).toBe('SPY');
    expect(p!.expiry).toBe('2025-01-19');
    expect(p!.right).toBe('C');
    expect(p!.strike).toBe(450);
  });
});
