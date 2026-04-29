import type { OptionLeg } from './types.js';

export function optionKey(leg: Pick<OptionLeg, 'strike' | 'expiry' | 'right'>): string {
  return `${leg.strike}|${leg.expiry}|${leg.right}`;
}
