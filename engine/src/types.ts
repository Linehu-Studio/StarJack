/** StarJack 核心类型定义 */

export type Lang = 'zh' | 'en';

export type DimensionId =
  | 'fork_ratio'
  | 'star_curve'
  | 'account_profile'
  | 'watchers'
  | 'activity'
  | 'commit_quality'
  | 'lifecycle';

export type Verdict = 'clean' | 'suspect' | 'jacked' | 'crime_scene' | 'empty';

export type Confidence = 'low' | 'medium' | 'high';

export type ScanMode = 'full' | 'quick';

/** 仓库元数据（来自 GET /repos/{o}/{r}） */
export interface RepoMeta {
  owner: string;
  repo: string;
  fullName: string;
  description: string | null;
  stars: number;
  forks: number;
  /** subscribers_count，即 watchers */
  watchers: number;
  openIssues: number;
  createdAt: string;
  pushedAt: string;
  archived: boolean;
  htmlUrl: string;
}

/** 单次加星事件 */
export interface StarEvent {
  /** ISO 时间；老星可能为 null */
  starredAt: string | null;
  user: string;
}

/** stargazer 账号画像（GraphQL 批量采样） */
export interface UserProfile {
  login: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
  publicRepos: number;
  followers: number;
  following: number;
}

export interface CommitSample {
  message: string;
  author: string | null;
  date: string;
}

export interface IssueSample {
  title: string;
  comments: number;
  isPr: boolean;
  date: string;
}

/** 采集到的原始扫描数据（检测器输入） */
export interface ScanData {
  mode: ScanMode;
  repo: RepoMeta;
  stars: StarEvent[];
  /** 星时间线是否为采样（非全量） */
  starsPartial: boolean;
  starsTotalKnown: number;
  profiles: UserProfile[];
  issuesTotal: number | null;
  prsTotal: number | null;
  issueSamples: IssueSample[];
  commits: CommitSample[];
  commitsPartial: boolean;
}

/** 证据条目：key 指向 i18n 字典的模板字符串，渲染时按语言解析 */
export interface EvidenceItem {
  key: string;
  params?: Record<string, string | number>;
}

export interface DimensionResult {
  id: DimensionId;
  /** 0-100，越高越假 */
  score: number;
  weight: number;
  /** 数据不足时为 false，聚合时剔除 */
  available: boolean;
  evidence: EvidenceItem[];
}

export interface Burst {
  at: string;
  count: number;
}

export interface GhostSample {
  login: string;
  avatarUrl: string | null;
  ghostScore: number;
}

/** 报告中的星增长直方图（压缩表示） */
export interface CurveHistogram {
  bucketMs: number;
  start: number;
  points: number[];
}

/** 最终审计报告（可序列化，用于 JSON 输出 / 分享 hash / 讣告） */
export interface Report {
  v: 1;
  repo: RepoMeta;
  mode: ScanMode;
  /** 假星指数 0-100 */
  index: number;
  verdict: Verdict;
  /** 估算假星百分比（基于画像样本外推） */
  estimatedFakePercent: number | null;
  confidence: Confidence;
  dimensions: DimensionResult[];
  curve: CurveHistogram | null;
  bursts: Burst[];
  ghosts: GhostSample[];
  scannedAt: string;
}

export type ProgressPhase = 'repo' | 'stars' | 'profiles' | 'activity' | 'commits' | 'scoring';

export interface CollectOptions {
  mode?: ScanMode;
  /** 星时间线最大拉取页数（每页 100），默认 100 */
  maxStarPages?: number;
  /** 账号画像采样数量，默认 300 */
  profileSampleSize?: number;
  commitPages?: number;
  issuePages?: number;
  onProgress?: (phase: ProgressPhase) => void;
}

export interface ScanOptions extends CollectOptions {
  token?: string | null;
}
