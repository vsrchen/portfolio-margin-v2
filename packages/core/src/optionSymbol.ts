import type { OptionLeg, OptionRight } from './types.js';

/** Parse compact OCC-style symbol: ROOT + YYMMDD + C|P + strike*1000 (8 digits). */
export function tryParseOccOptionSymbol(raw: string): Omit<OptionLeg, 'qty'> | null {
  const s = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (s.length < 15) return null;
  const tail = s.slice(-15);
  const yymmdd = tail.slice(0, 6);
  const cp = tail[6];
  const strikeRaw = tail.slice(7);
  if (cp !== 'C' && cp !== 'P') return null;
  if (!/^\d{6}$/.test(yymmdd) || !/^\d{8}$/.test(strikeRaw)) return null;
  const root = s.slice(0, -15);
  if (!root.length) return null;

  const yy = Number(yymmdd.slice(0, 2));
  const mm = Number(yymmdd.slice(2, 4));
  const dd = Number(yymmdd.slice(4, 6));
  const year = yy >= 80 ? 1900 + yy : 2000 + yy;
  const expiry = `${year.toString().padStart(4, '0')}-${mm.toString().padStart(2, '0')}-${dd.toString().padStart(2, '0')}`;
  const strike = Number(strikeRaw) / 1000;
  const right = (cp === 'C' ? 'C' : 'P') as OptionRight;

  return {
    kind: 'option',
    underlying: root,
    strike,
    expiry,
    right,
  };
}
