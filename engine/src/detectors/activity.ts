/** 维度 5：Issue/PR 活跃度（权重 15%）— 高星零互动是经典破绽 */
import type { DimensionResult, EvidenceItem, ScanData } from '../types';
import { dim } from './dim';
import { lerp } from './math';

const DAY = 86_400_000;

export function detectActivity(data: ScanData): DimensionResult {
  const { stars, openIssues } = data.repo;

  if (data.mode === 'quick') {
    if (stars < 50) {
      return dim('activity', 0, false, [
        { key: 'evidence.activityQuick', params: { openIssues, stars } },
      ]);
    }
    const per100 = openIssues / Math.max(1, stars / 100);
    const score = per100 >= 1 ? 0 : lerp(per100, 0, 1, 70, 0);
    return dim('activity', score, true, [
      { key: 'evidence.activityQuick', params: { openIssues, stars } },
    ]);
  }

  const issues = data.issuesTotal ?? 0;
  const prs = data.prsTotal ?? 0;
  const comments = data.issueSamples.reduce((a, s) => a + s.comments, 0);
  const interactions = issues + prs + comments;
  const per100 = interactions / Math.max(1, stars / 100);

  let score: number;
  if (interactions === 0) {
    score = stars >= 500 ? 100 : lerp(stars, 50, 500, 60, 100);
  } else if (per100 >= 5) {
    score = 0;
  } else if (per100 >= 1) {
    score = lerp(per100, 1, 5, 30, 0);
  } else if (per100 >= 0.2) {
    score = lerp(per100, 0.2, 1, 60, 30);
  } else {
    score = lerp(per100, 0, 0.2, 85, 60);
  }

  const ageDays = (Date.now() - Date.parse(data.repo.createdAt)) / DAY;
  const evidence: EvidenceItem[] = [
    { key: 'evidence.activity', params: { issues, prs, stars, per100: per100.toFixed(1) } },
  ];
  if (interactions === 0 && stars >= 500) evidence.push({ key: 'evidence.zeroInteraction' });
  if (Number.isFinite(ageDays) && ageDays < 90) {
    score = Math.min(score, 70);
    evidence.push({ key: 'evidence.newRepoCalm', params: { days: Math.round(ageDays) } });
  }
  return dim('activity', score, true, evidence);
}
