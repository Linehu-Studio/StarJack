/** 维度 7：生命周期（权重 10%）— 75% 假星仓库活不过 3 天 */
import type { DimensionResult, EvidenceItem, ScanData } from '../types';
import { dim } from './dim';
import { lerp } from './math';
import { sortedTimestamps } from './star-curve';

const DAY = 86_400_000;
const HOUR = 3_600_000;

export function detectLifecycle(data: ScanData): DimensionResult {
  const repo = data.repo;
  const now = Date.now();
  const createdMs = Date.parse(repo.createdAt);
  const ageDays = Number.isFinite(createdMs) ? (now - createdMs) / DAY : NaN;
  const pushAgeDays = (now - Date.parse(repo.pushedAt)) / DAY;
  const evidence: EvidenceItem[] = Number.isFinite(ageDays)
    ? [{ key: 'evidence.age', params: { days: Math.round(Math.max(0, ageDays)), stars: repo.stars } }]
    : [];

  if (data.mode === 'quick') {
    // 快速扫描：仅能看"尸体凉了多久"
    let score = 0;
    if (Number.isFinite(pushAgeDays) && pushAgeDays > 180) score += 40;
    if (repo.archived) score += 20;
    const ev = [...evidence];
    if (Number.isFinite(pushAgeDays) && pushAgeDays > 90) {
      ev.push({ key: 'evidence.deadRepo', params: { days: Math.round(pushAgeDays) } });
    }
    return dim('lifecycle', Math.min(score, 60), true, ev);
  }

  const ts = sortedTimestamps(data);
  if (ts.length < 30) {
    return dim('lifecycle', 0, false, [
      { key: 'evidence.insufficientStars', params: { count: ts.length } },
    ]);
  }

  // 建仓 72h 内的星占比（论文：75% 假星仓库活不过 3 天）
  const created = Number.isFinite(createdMs) ? createdMs : ts[0];
  const early = ts.filter((t) => t - created <= 72 * HOUR).length;
  const earlyShare = early / ts.length;
  const earlyScore =
    earlyShare >= 0.6
      ? 100
      : earlyShare >= 0.3
        ? lerp(earlyShare, 0.3, 0.6, 40, 100)
        : lerp(earlyShare, 0, 0.3, 0, 40);

  const deadScore =
    !Number.isFinite(pushAgeDays)
      ? 0
      : pushAgeDays > 365
        ? 100
        : pushAgeDays > 180
          ? 70
          : pushAgeDays > 90
            ? 40
            : 0;

  const score = 0.5 * earlyScore + 0.2 * (repo.archived ? 100 : 0) + 0.3 * deadScore;

  const ev = [
    ...evidence,
    { key: 'evidence.earlyBurst', params: { percent: (earlyShare * 100).toFixed(1) } },
  ];
  if (Number.isFinite(pushAgeDays) && pushAgeDays > 90) {
    ev.push({ key: 'evidence.deadRepo', params: { days: Math.round(pushAgeDays) } });
  }
  return dim('lifecycle', score, true, ev);
}
