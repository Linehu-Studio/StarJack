/** 测试夹具：确定性伪随机 + 有机/lockstep 合成时间线 */
import type { ScanData, StarEvent, UserProfile, RepoMeta } from '../src/types';

/** mulberry32 确定性 PRNG */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOW = Date.UTC(2026, 8, 20); // 2026-09-20
export { NOW };

/** 有机时间线：均匀分布在 spreadDays 内，带随机抖动 */
export function organicTimeline(count: number, spreadDays: number, startDaysAgo = 730): StarEvent[] {
  const r = rng(42);
  const start = NOW - startDaysAgo * 86_400_000;
  const span = spreadDays * 86_400_000;
  const events: StarEvent[] = [];
  for (let i = 0; i < count; i++) {
    const t = Math.floor(start + r() * span + r() * 60_000);
    events.push({ starredAt: new Date(t).toISOString(), user: `user${i}` });
  }
  return events;
}

/** lockstep 时间线：bursts 组爆发，每组内 count 颗星在 1 分钟内以固定间隔涌入 */
export function lockstepTimeline(
  bursts: number,
  count: number,
  intervalMs = 600,
  gapDays = 1,
  startDaysAgo = 30,
): StarEvent[] {
  const start = NOW - startDaysAgo * 86_400_000;
  const events: StarEvent[] = [];
  let userId = 0;
  for (let b = 0; b < bursts; b++) {
    const burstStart = start + b * gapDays * 86_400_000;
    for (let i = 0; i < count; i++) {
      const t = Math.floor(burstStart + i * intervalMs);
      events.push({ starredAt: new Date(t).toISOString(), user: `bot${userId++}` });
    }
  }
  return events;
}

export function ghostProfiles(count: number, createdDaysAgo = 60): UserProfile[] {
  return Array.from({ length: count }, (_, i) => ({
    login: `ghost${i}`,
    avatarUrl: `https://avatars.githubusercontent.com/u/${900000 + i}?v=4`,
    bio: null,
    createdAt: new Date(NOW - createdDaysAgo * 86_400_000).toISOString(),
    publicRepos: 0,
    followers: 0,
    following: 0,
  }));
}

export function realProfiles(count: number): UserProfile[] {
  const r = rng(7);
  return Array.from({ length: count }, (_, i) => ({
    login: `real${i}`,
    avatarUrl: `https://avatars.githubusercontent.com/u/${100000 + i}?v=4`,
    bio: 'Building things on the internet.',
    createdAt: new Date(
      Date.UTC(2014 + Math.floor(r() * 10), Math.floor(r() * 12), 1 + Math.floor(r() * 28)),
    ).toISOString(),
    publicRepos: Math.floor(r() * 50) + 3,
    followers: Math.floor(r() * 80) + 1,
    following: Math.floor(r() * 100),
  }));
}

export function makeRepo(overrides: Partial<RepoMeta> = {}): RepoMeta {
  return {
    owner: 'someone',
    repo: 'awesome-ai',
    fullName: 'someone/awesome-ai',
    description: 'The next big thing',
    stars: 10_000,
    forks: 30,
    watchers: 3,
    openIssues: 0,
    createdAt: new Date(NOW - 90 * 86_400_000).toISOString(),
    pushedAt: new Date(NOW - 85 * 86_400_000).toISOString(),
    archived: false,
    htmlUrl: 'https://github.com/someone/awesome-ai',
    ...overrides,
  };
}

export function makeScanData(overrides: Partial<ScanData> = {}): ScanData {
  return {
    mode: 'full',
    repo: makeRepo(),
    stars: [],
    starsPartial: false,
    starsTotalKnown: 10_000,
    profiles: [],
    issuesTotal: 0,
    prsTotal: 0,
    issueSamples: [],
    commits: [],
    commitsPartial: false,
    ...overrides,
  };
}

/** 典型"刷星仓库"：高星、无 fork、无 watcher、无互动、批量 commit、建仓 3 天内冲完星 */
export function fakeScanData(): ScanData {
  const createdAt = NOW - 200 * 86_400_000;
  return makeScanData({
    repo: makeRepo({
      stars: 12_000,
      forks: 25,
      watchers: 2,
      openIssues: 0,
      createdAt: new Date(createdAt).toISOString(),
      pushedAt: new Date(NOW - 190 * 86_400_000).toISOString(),
    }),
    // 爆发起点 = 建仓后 0.2 天，6 组 × 0.5 天间隔 → 全部落在 72h 窗口内
    stars: lockstepTimeline(6, 2000, 300, 0.5, 199.8),
    starsPartial: false,
    profiles: ghostProfiles(120),
    issuesTotal: 0,
    prsTotal: 0,
    issueSamples: [],
    commits: Array.from({ length: 60 }, (_, i) => ({
      message: i % 3 === 0 ? 'update' : i % 3 === 1 ? 'fix' : 'update readme',
      author: 'bot-author',
      date: new Date(createdAt + i * 3600_000).toISOString(),
    })),
  });
}

/** 典型有机仓库：fork 多、watcher 多、互动频繁、commit 多样、两年自然增长 */
export function organicScanData(): ScanData {
  const createdAt = NOW - 730 * 86_400_000;
  const r = rng(11);
  return makeScanData({
    repo: makeRepo({
      stars: 8_000,
      forks: 1_500,
      watchers: 220,
      openIssues: 88,
      createdAt: new Date(createdAt).toISOString(),
      pushedAt: new Date(NOW - 2 * 86_400_000).toISOString(),
    }),
    stars: organicTimeline(8_000, 700),
    starsPartial: false,
    profiles: realProfiles(150),
    issuesTotal: 1_200,
    prsTotal: 2_400,
    issueSamples: Array.from({ length: 40 }, (_, i) => ({
      title: `Bug in module ${i}`,
      comments: Math.floor(r() * 20) + 1,
      isPr: i % 2 === 0,
      date: new Date(NOW - i * 86_400_000).toISOString(),
    })),
    commits: Array.from({ length: 100 }, (_, i) => ({
      message: [
        'Fix race condition in scheduler queue',
        'Add retry with exponential backoff to HTTP client',
        'Refactor: extract template rendering into its own module',
        'Improve error message when config file is missing',
        'Bump dependencies for security patch',
      ][i % 5] + ` (#${1000 + i})`,
      author: `dev${i % 7}`,
      date: new Date(NOW - i * 43_200_000 - r() * 3_600_000).toISOString(),
    })),
  });
}
