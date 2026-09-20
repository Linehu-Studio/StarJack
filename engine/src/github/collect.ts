/**
 * 数据采集编排：repo 元数据 → 星时间线 → 账号画像 → 活动 → commit
 * 全量扫描预算 ≈ 130 REST + ~15 GraphQL，远低于认证后 5000/h 限额
 */
import type {
  CollectOptions,
  CommitSample,
  IssueSample,
  ProgressPhase,
  RepoMeta,
  ScanData,
  StarEvent,
  UserProfile,
} from '../types';
import type { GitHubClient } from './client';

export function parseRepoInput(input: string): { owner: string; repo: string } {
  const trimmed = input.trim().replace(/\/+$/, '').replace(/\.git$/, '');
  const m =
    trimmed.match(/github\.com[/:]([^/]+)\/([^/?#]+)/i) ?? trimmed.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (!m) throw new Error(`Cannot parse GitHub repo from: ${input}`);
  return { owner: m[1], repo: m[2] };
}

const PAGE = 100;
const DAY = 86_400_000;

/** 简单并发映射（保持结果顺序） */
async function pmap<T, R>(items: T[], fn: (item: T) => Promise<R>, concurrency: number): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let i = from; i <= to; i++) out.push(i);
  return out;
}

/** 从 [1..total] 中等距取 n 个页码 */
export function stridePages(n: number, total: number): number[] {
  const out = new Set<number>();
  for (let i = 0; i < n; i++) {
    out.add(Math.max(1, Math.min(total, Math.round(((i + 0.5) * total) / n))));
  }
  return [...out].sort((a, b) => a - b);
}

export interface StarTimeline {
  events: StarEvent[];
  partial: boolean;
}

/**
 * 拉取带 starred_at 的加星时间线。
 * API 硬上限 400 页（4w 星）；超出 maxPages 时等距跨页采样并标记 partial。
 */
export async function fetchStarTimeline(
  client: GitHubClient,
  owner: string,
  name: string,
  totalStars: number,
  maxPages: number,
): Promise<StarTimeline> {
  const totalPages = Math.max(1, Math.min(400, Math.ceil(totalStars / PAGE)));
  const partial = totalPages > maxPages;
  const pages = partial ? stridePages(maxPages, totalPages) : range(1, totalPages);
  const results = await pmap(
    pages,
    async (page) => ({
      page,
      rows: await client.restPage<Record<string, any>>(
        `/repos/${owner}/${name}/stargazers`,
        page,
        PAGE,
        'application/vnd.github.star+json',
      ),
    }),
    5,
  );
  results.sort((a, b) => a.page - b.page);
  const events: StarEvent[] = [];
  for (const { rows } of results) {
    for (const row of rows) {
      events.push({
        starredAt: row.starred_at ?? null,
        user: row.user?.login ?? row.login ?? 'unknown',
      });
    }
  }
  return { events, partial };
}

/** 从时间线中等距采样最多 size 个 login（覆盖整条曲线，避免只采到头部） */
export function sampleLogins(events: StarEvent[], size: number): string[] {
  const logins = events.map((e) => e.user);
  if (logins.length <= size) return logins;
  const out: string[] = [];
  const step = logins.length / size;
  for (let i = 0; i < size; i++) out.push(logins[Math.floor(i * step)]);
  return out;
}

/** GraphQL alias 批查用户画像（100 login/次） */
export async function fetchUserProfiles(client: GitHubClient, logins: string[]): Promise<UserProfile[]> {
  const profiles: UserProfile[] = [];
  for (let i = 0; i < logins.length; i += 100) {
    const batch = logins.slice(i, i + 100);
    if (batch.length === 0) break;
    const aliases = batch
      .map(
        (l, j) =>
          `u${j}: user(login: ${JSON.stringify(l)}) { login avatarUrl bio createdAt publicRepos followers { totalCount } following { totalCount } }`,
      )
      .join(' ');
    const data = await client
      .graphql<Record<string, any>>(`query { ${aliases} }`)
      .catch(() => null);
    if (!data) continue;
    for (let j = 0; j < batch.length; j++) {
      const u = data[`u${j}`];
      if (!u) continue;
      profiles.push({
        login: u.login,
        avatarUrl: u.avatarUrl ?? null,
        bio: u.bio ?? null,
        createdAt: u.createdAt,
        publicRepos: u.publicRepos ?? 0,
        followers: u.followers?.totalCount ?? 0,
        following: u.following?.totalCount ?? 0,
      });
    }
  }
  return profiles;
}

async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<T[]>,
  maxPages: number,
): Promise<T[]> {
  const first = await fetchPage(1);
  if (first.length < PAGE || maxPages <= 1) return first;
  const rest = await pmap(range(2, maxPages), fetchPage, 4);
  return [...first, ...rest.flat()];
}

function toIssueSample(isPr: boolean) {
  return (i: Record<string, any>): IssueSample => ({
    title: i.title ?? '',
    comments: i.comments ?? 0,
    isPr,
    date: i.created_at ?? '',
  });
}

/** 采集完整 ScanData */
export async function collectScanData(
  client: GitHubClient,
  input: string,
  opts: CollectOptions = {},
): Promise<ScanData> {
  const { owner, repo: name } = parseRepoInput(input);
  const mode = opts.mode ?? 'full';
  const onProgress: (p: ProgressPhase) => void = opts.onProgress ?? (() => {});

  onProgress('repo');
  const r = await client.rest<Record<string, any>>(`/repos/${owner}/${name}`);
  const repoMeta: RepoMeta = {
    owner: r.owner?.login ?? owner,
    repo: r.name ?? name,
    fullName: r.full_name ?? `${owner}/${name}`,
    description: r.description ?? null,
    stars: r.stargazers_count ?? 0,
    forks: r.forks_count ?? 0,
    watchers: r.subscribers_count ?? 0,
    openIssues: r.open_issues_count ?? 0,
    createdAt: r.created_at,
    pushedAt: r.pushed_at,
    archived: !!r.archived,
    htmlUrl: r.html_url ?? `https://github.com/${owner}/${name}`,
  };

  const data: ScanData = {
    mode,
    repo: repoMeta,
    stars: [],
    starsPartial: false,
    starsTotalKnown: repoMeta.stars,
    profiles: [],
    issuesTotal: null,
    prsTotal: null,
    issueSamples: [],
    commits: [],
    commitsPartial: false,
  };

  if (mode === 'quick' || repoMeta.stars === 0) return data;

  onProgress('stars');
  const timeline = await fetchStarTimeline(
    client,
    owner,
    name,
    repoMeta.stars,
    opts.maxStarPages ?? 100,
  );
  data.stars = timeline.events;
  data.starsPartial = timeline.partial;

  onProgress('profiles');
  const logins = sampleLogins(timeline.events, opts.profileSampleSize ?? 300);
  data.profiles = await fetchUserProfiles(client, logins);

  onProgress('activity');
  const q = encodeURIComponent(`repo:${owner}/${name}`);
  const [issueSearch, prSearch, issueLists, pullLists] = await Promise.all([
    client
      .rest<{ total_count: number }>(`/search/issues?q=${q}%20type:issue&per_page=1`)
      .catch(() => null),
    client
      .rest<{ total_count: number }>(`/search/issues?q=${q}%20type:pr&per_page=1`)
      .catch(() => null),
    fetchAllPages(
      (p) => client.restPage<Record<string, any>>(`/repos/${owner}/${name}/issues?state=all`, p, PAGE),
      opts.issuePages ?? 2,
    ).catch(() => [] as Record<string, any>[]),
    fetchAllPages(
      (p) => client.restPage<Record<string, any>>(`/repos/${owner}/${name}/pulls?state=all`, p, PAGE),
      opts.issuePages ?? 2,
    ).catch(() => [] as Record<string, any>[]),
  ]);
  data.issuesTotal = issueSearch?.total_count ?? null;
  data.prsTotal = prSearch?.total_count ?? null;
  data.issueSamples = [
    ...issueLists.filter((i) => !i.pull_request).map(toIssueSample(false)),
    ...pullLists.map(toIssueSample(true)),
  ].slice(0, 400);

  onProgress('commits');
  const commitLists = await fetchAllPages(
    (p) => client.restPage<Record<string, any>>(`/repos/${owner}/${name}/commits`, p, PAGE),
    opts.commitPages ?? 2,
  ).catch(() => [] as Record<string, any>[]);
  data.commitsPartial = commitLists.length >= (opts.commitPages ?? 2) * PAGE;
  data.commits = commitLists.map((c) => ({
    message: c.commit?.message ?? '',
    author: c.author?.login ?? c.commit?.author?.email ?? null,
    date: c.commit?.author?.date ?? '',
  })) as CommitSample[];

  return data;
}
