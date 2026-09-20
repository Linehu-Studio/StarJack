/** 维度 2：Star 增长曲线（权重 20%）— lockstep 同步点星检测 */
import type { Burst, CurveHistogram, DimensionResult, ScanData } from '../types';
import { dim } from './dim';
import { lerp, quantile } from './math';

const MINUTE = 60_000;
const DAY = 86_400_000;

/** 提取带时间戳的星（升序 epoch ms） */
export function sortedTimestamps(data: ScanData): number[] {
  return data.stars
    .map((s) => s.starredAt)
    .filter((x): x is string => !!x)
    .map(Date.parse)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
}

function countBy(ts: number[], bucketMs: number): Map<number, number> {
  const m = new Map<number, number>();
  for (const t of ts) {
    const k = Math.floor(t / bucketMs);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export interface CurveExtras {
  curve: CurveHistogram | null;
  bursts: Burst[];
}

/** 报告用的直方图 + top 爆发分钟（供聚合层调用） */
export function computeCurveExtras(data: ScanData): CurveExtras {
  const ts = sortedTimestamps(data);
  if (ts.length < 5) return { curve: null, bursts: [] };
  const span = ts[ts.length - 1] - ts[0];
  if (span <= 0) return { curve: null, bursts: [] };
  const bucketMs = span <= 3 * DAY ? 3_600_000 : span <= 180 * DAY ? DAY : 7 * DAY;
  const buckets = countBy(ts, bucketMs);
  const start = Math.floor(ts[0] / bucketMs) * bucketMs;
  const end = Math.floor(ts[ts.length - 1] / bucketMs) * bucketMs;
  const points: number[] = [];
  for (let k = start; k <= end; k += bucketMs) points.push(buckets.get(k / bucketMs) ?? 0);
  const curve: CurveHistogram = { bucketMs, start, points };

  const minutes = countBy(ts, MINUTE);
  const bursts: Burst[] = [...minutes.entries()]
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, count]) => ({ at: new Date(k * MINUTE).toISOString(), count }));
  return { curve, bursts };
}

/**
 * 四个子信号：
 * - lockstep：单分钟最大星数（付费农场同分钟点星）
 * - burstShare：top 1% 分钟承载的星占比
 * - dupSecond：同秒重复星的占比
 * - spike：峰值单日 / 中位单日
 */
export function detectStarCurve(data: ScanData): DimensionResult {
  const ts = sortedTimestamps(data);
  if (ts.length < 30) {
    return dim('star_curve', 0, false, [
      { key: 'evidence.insufficientStars', params: { count: ts.length } },
    ]);
  }
  const evidence = [];
  if (data.starsPartial) {
    evidence.push({
      key: 'evidence.timelinePartial',
      params: { sampled: ts.length, total: data.repo.stars },
    });
  }

  const minuteBuckets = countBy(ts, MINUTE);
  const minuteCounts = [...minuteBuckets.values()].sort((a, b) => b - a);
  const maxPerMin = minuteCounts[0] ?? 0;
  const lockstepScore =
    maxPerMin >= 50
      ? 100
      : maxPerMin >= 20
        ? lerp(maxPerMin, 20, 50, 80, 100)
        : maxPerMin >= 10
          ? lerp(maxPerMin, 10, 20, 50, 80)
          : maxPerMin >= 5
            ? lerp(maxPerMin, 5, 10, 20, 50)
            : lerp(maxPerMin, 1, 5, 0, 20);

  // 爆发占比：落在"爆发分钟"（count >= max(5, P99)）里的星占比
  const p99 = quantile(minuteCounts.slice().sort((a, b) => a - b), 0.99) ?? 1;
  const burstThreshold = Math.max(5, p99);
  const burstStars = minuteCounts.filter((c) => c >= burstThreshold).reduce((a, b) => a + b, 0);
  const burstShare = burstStars / ts.length;
  const burstScore = Math.min(100, burstShare * 120);

  const secBuckets = countBy(ts, 1000);
  let dupSeconds = 0;
  for (const c of secBuckets.values()) dupSeconds += Math.max(0, c - 1);
  const dupShare = dupSeconds / ts.length;
  const dupScore = Math.min(100, dupShare * 400);

  const dayCounts = [...countBy(ts, DAY).values()];
  const medianDay = quantile(dayCounts.slice().sort((a, b) => a - b), 0.5) ?? 1;
  const spikeX = Math.max(...dayCounts) / Math.max(1, medianDay);
  const spikeScore = spikeX >= 10 ? 100 : spikeX >= 3 ? lerp(spikeX, 3, 10, 20, 100) : lerp(spikeX, 1, 3, 0, 20);

  const score = 0.4 * lockstepScore + 0.3 * burstScore + 0.15 * dupScore + 0.15 * spikeScore;

  const topMinute = [...minuteBuckets.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topMinute && topMinute[1] >= 3) {
    evidence.push({
      key: 'evidence.lockstep',
      params: { count: topMinute[1], time: new Date(topMinute[0] * MINUTE).toISOString() },
    });
  }
  evidence.push(
    { key: 'evidence.burstShare', params: { percent: (burstShare * 100).toFixed(1) } },
    { key: 'evidence.dupSecond', params: { percent: (dupShare * 100).toFixed(1) } },
    { key: 'evidence.spike', params: { x: spikeX.toFixed(1) } },
  );
  return dim('star_curve', score, true, evidence);
}
