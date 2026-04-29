import type { MarginRunResult, PositionLeg, ScenarioGridConfig } from '@portfolio-margin/core';

export function exportJson(payload: {
  asOf: string;
  legs: PositionLeg[];
  grid: ScenarioGridConfig;
  result: MarginRunResult;
}): string {
  return JSON.stringify(payload, null, 2);
}

export function exportCsvScenarios(result: MarginRunResult): string {
  const header = ['priceShock', 'volShock', 'pnl', 'portfolioValue'];
  const lines = [header.join(',')];
  for (const s of result.scenarios) {
    lines.push(
      [s.priceShock, s.volShock, s.pnl, s.portfolioValue]
        .map((x) => (typeof x === 'number' ? String(x) : x))
        .join(','),
    );
  }
  return lines.join('\n');
}

export function downloadText(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
