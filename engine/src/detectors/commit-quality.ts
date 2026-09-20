/** 维度 6：Commit 质量（权重 10%）— 批量生成的无意义 commit */
import type { DimensionResult, EvidenceItem, ScanData } from '../types';
import { dim } from './dim';
import { mean, stdev } from './math';

/** 泛型 message：常见模板词开头，或不超过 2 个词 */
const GENERIC =
  /^(update|updated|fix|fixed|fixes|init|initial commit|first commit|docs?|test|tests|feat|feature|chore|refactor|style|perf|create|created|modified?|changed?|delete|deleted|remove|removed)\b/i;

function isGeneric(message: string): boolean {
  const m = message.trim();
  if (GENERIC.test(m)) return true;
  return m.split(/\s+/).length <= 2;
}

export function detectCommitQuality(data: ScanData): DimensionResult {
  const commits = data.commits.filter((c) => c.message && !/^merge /i.test(c.message));
  if (commits.length < 10) {
    return dim('commit_quality', 0, false, [
      { key: 'evidence.insufficientCommits', params: { count: commits.length } },
    ]);
  }

  const generic = commits.filter((c) => isGeneric(c.message)).length / commits.length;
  const genericScore = Math.min(100, generic * 125);

  const norm = (m: string) => m.trim().toLowerCase().replace(/\s+/g, ' ');
  const unique = new Set(commits.map((c) => norm(c.message))).size;
  const dupScore = Math.min(100, Math.max(0, (1 - unique / commits.length) * 250));

  const authors = new Set(commits.map((c) => c.author ?? '')).size;
  const authorScore = authors === 1 ? 60 : authors <= 2 ? 30 : 0;

  let regularityScore = 0;
  const dates = commits
    .map((c) => Date.parse(c.date))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (dates.length >= 10) {
    const gaps: number[] = [];
    for (let i = 1; i < dates.length; i++) gaps.push(dates[i] - dates[i - 1]);
    const m = mean(gaps);
    const cv = m > 0 ? stdev(gaps) / m : 1;
    regularityScore = cv < 0.05 ? 90 : cv < 0.15 ? 50 : 0;
  }

  const score = 0.4 * genericScore + 0.25 * dupScore + 0.15 * authorScore + 0.2 * regularityScore;

  const evidence: EvidenceItem[] = [
    { key: 'evidence.genericCommits', params: { percent: (generic * 100).toFixed(1) } },
    { key: 'evidence.dupMessages', params: { unique, total: commits.length } },
    { key: 'evidence.authors', params: { authors, total: commits.length } },
  ];
  if (regularityScore > 0) evidence.push({ key: 'evidence.regularCommits' });
  return dim('commit_quality', score, true, evidence);
}
