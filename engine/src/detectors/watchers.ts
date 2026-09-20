/** 维度 4：Watcher 数（权重 10%）— 高星但 watcher 个位数是经典破绽 */
import type { DimensionResult, ScanData } from '../types';
import { dim } from './dim';
import { lerp } from './math';

/**
 * 对数刻度映射：>=0.02 → 0；[0.005,0.02) → 0-40；[0.002,0.005) → 40-70；
 * [0.001,0.002) → 70-90；<0.001 → 90-100。watchers>=100 时强 organic 信号封顶 30。
 */
export function detectWatchers(data: ScanData): DimensionResult {
  const { stars, watchers } = data.repo;
  if (stars === 0) {
    return dim('watchers', 0, false, [
      { key: 'evidence.watchers', params: { watchers, stars, ratio: '0' } },
    ]);
  }
  const ratio = watchers / stars;
  let score =
    ratio >= 0.02
      ? 0
      : ratio >= 0.005
        ? lerp(ratio, 0.005, 0.02, 40, 0)
        : ratio >= 0.002
          ? lerp(ratio, 0.002, 0.005, 70, 40)
          : ratio >= 0.001
            ? lerp(ratio, 0.001, 0.002, 90, 70)
            : 100;
  if (watchers >= 100) score = Math.min(score, 30);
  return dim('watchers', score, true, [
    { key: 'evidence.watchers', params: { watchers, stars, ratio: ratio.toFixed(4) } },
  ]);
}
