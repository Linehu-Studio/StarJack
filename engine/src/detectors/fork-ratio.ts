/** 维度 1：Fork/Star 比（权重 20%） */
import type { DimensionResult, ScanData } from '../types';
import { dim } from './dim';
import { lerp } from './math';

/**
 * 正常项目 0.1–0.2；刷星项目只有星没有 fork。
 * 映射：>=0.1 → 0；[0.05,0.1) → 0-50；[0.02,0.05) → 50-80；[0.01,0.02) → 80-95；<0.01 → 100
 */
export function detectForkRatio(data: ScanData): DimensionResult {
  const { stars, forks } = data.repo;
  const ratio = stars > 0 ? forks / stars : 0;
  const score =
    stars === 0
      ? 0
      : ratio >= 0.1
        ? 0
        : ratio >= 0.05
          ? lerp(ratio, 0.05, 0.1, 50, 0)
          : ratio >= 0.02
            ? lerp(ratio, 0.02, 0.05, 80, 50)
            : ratio >= 0.01
              ? lerp(ratio, 0.01, 0.02, 95, 80)
              : 100;
  return dim('fork_ratio', score, stars > 0, [
    { key: 'evidence.ratio', params: { ratio: ratio.toFixed(4), forks, stars } },
  ]);
}
