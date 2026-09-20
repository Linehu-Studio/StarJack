/** 7 维聚合 → 假星指数 + 报告 */
import type {
  Confidence,
  DimensionId,
  DimensionResult,
  Report,
  ScanData,
  Verdict,
} from '../types';
import { detectForkRatio } from './fork-ratio';
import { detectStarCurve, computeCurveExtras } from './star-curve';
import { detectAccountProfile, ghostScoreOf, ghostShareOf } from './account-profile';
import { detectWatchers } from './watchers';
import { detectActivity } from './activity';
import { detectCommitQuality } from './commit-quality';
import { detectLifecycle } from './lifecycle';
import { round1 } from './math';

export { WEIGHTS } from './weights';
export { ghostScoreOf, ghostShareOf, creationWindowShare } from './account-profile';
export { computeCurveExtras, sortedTimestamps } from './star-curve';
export { detectForkRatio } from './fork-ratio';
export { detectStarCurve } from './star-curve';
export { detectAccountProfile } from './account-profile';
export { detectWatchers } from './watchers';
export { detectActivity } from './activity';
export { detectCommitQuality } from './commit-quality';
export { detectLifecycle } from './lifecycle';

export interface DetectorDef {
  id: DimensionId;
  run: (data: ScanData) => DimensionResult;
}

export const DETECTORS: DetectorDef[] = [
  { id: 'fork_ratio', run: detectForkRatio },
  { id: 'star_curve', run: detectStarCurve },
  { id: 'account_profile', run: detectAccountProfile },
  { id: 'watchers', run: detectWatchers },
  { id: 'activity', run: detectActivity },
  { id: 'commit_quality', run: detectCommitQuality },
  { id: 'lifecycle', run: detectLifecycle },
];

/** 运行全部 7 个维度的检测器 */
export function runDetectors(data: ScanData): DimensionResult[] {
  return DETECTORS.map((d) => d.run(data));
}

function verdictOf(index: number, empty: boolean): Verdict {
  if (empty) return 'empty';
  if (index < 30) return 'clean';
  if (index < 60) return 'suspect';
  if (index < 85) return 'jacked';
  return 'crime_scene';
}

function confidenceOf(data: ScanData): Confidence {
  if (data.mode === 'quick' || data.repo.stars < 30) return 'low';
  if (data.starsPartial || data.profiles.length < 100 || data.commits.length < 10) return 'medium';
  return 'high';
}

/** 加权聚合（仅 available 维度，权重归一化） */
export function runEngine(data: ScanData): Report {
  const dimensions = runDetectors(data);
  const available = dimensions.filter((d) => d.available);
  const wSum = available.reduce((a, d) => a + d.weight, 0);
  const empty = data.repo.stars === 0;
  const index = empty || wSum === 0
    ? 0
    : round1(available.reduce((a, d) => a + d.score * d.weight, 0) / wSum);

  const estimatedFakePercent =
    data.profiles.length >= 50 ? round1(ghostShareOf(data.profiles) * 100) : null;

  const { curve, bursts } = computeCurveExtras(data);
  const ghosts = data.profiles
    .map((p) => ({ login: p.login, avatarUrl: p.avatarUrl, ghostScore: ghostScoreOf(p) }))
    .sort((a, b) => b.ghostScore - a.ghostScore)
    .slice(0, 24);

  return {
    v: 1,
    repo: data.repo,
    mode: data.mode,
    index,
    verdict: verdictOf(index, empty),
    estimatedFakePercent,
    confidence: confidenceOf(data),
    dimensions,
    curve,
    bursts,
    ghosts,
    scannedAt: new Date().toISOString(),
  };
}
