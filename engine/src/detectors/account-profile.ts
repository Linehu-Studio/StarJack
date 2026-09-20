/** 维度 3：账号画像（权重 15%）— 幽灵账号占比 + 注册时间扎堆 */
import type { DimensionResult, ScanData, UserProfile } from '../types';
import { dim } from './dim';
import { lerp } from './math';

const DAY = 86_400_000;

/**
 * 单账号幽灵分 0-100（>=60 判为幽灵）。
 * 注意：GitHub API 无法通过 avatarUrl 区分默认头像（均为 avatars.githubusercontent.com/u/{id}），
 * 故头像不作为信号；权重：无简介 15 / 0 仓库 30 / 0 粉丝 0 关注 30 / 新注册 25。
 */
export function ghostScoreOf(p: UserProfile, now = Date.now()): number {
  let s = 0;
  if (!p.bio) s += 15;
  if (p.publicRepos === 0) s += 30;
  if (p.followers === 0 && p.following === 0) s += 30;
  const ageDays = (now - Date.parse(p.createdAt)) / DAY;
  if (Number.isFinite(ageDays) && ageDays < 90) s += 25;
  return Math.min(100, s);
}

export function ghostShareOf(profiles: UserProfile[], now = Date.now()): number {
  if (profiles.length === 0) return 0;
  return profiles.filter((p) => ghostScoreOf(p, now) >= 60).length / profiles.length;
}

/** 样本账号注册时间的最大 30 天窗口占比 */
export function creationWindowShare(profiles: UserProfile[]): number {
  if (profiles.length === 0) return 0;
  const creations = profiles
    .map((p) => Date.parse(p.createdAt))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (creations.length === 0) return 0;
  let maxWin = 0;
  let i = 0;
  for (let j = 0; j < creations.length; j++) {
    while (creations[j] - creations[i] > 30 * DAY) i++;
    maxWin = Math.max(maxWin, j - i + 1);
  }
  return maxWin / creations.length;
}

export function detectAccountProfile(data: ScanData): DimensionResult {
  const profiles = data.profiles;
  if (profiles.length < 20) {
    return dim('account_profile', 0, false, [
      { key: 'evidence.sampleInfo', params: { size: profiles.length, total: data.repo.stars } },
    ]);
  }
  const now = Date.now();
  const ghostShare = ghostShareOf(profiles, now);
  const winShare = creationWindowShare(profiles);
  const clusterScore =
    winShare >= 0.5
      ? 100
      : winShare >= 0.3
        ? lerp(winShare, 0.3, 0.5, 60, 100)
        : winShare >= 0.15
          ? lerp(winShare, 0.15, 0.3, 20, 60)
          : lerp(winShare, 0, 0.15, 0, 20);
  const score = Math.min(100, ghostShare * 90 + clusterScore * 0.25);
  return dim('account_profile', score, true, [
    {
      key: 'evidence.ghostShare',
      params: { percent: (ghostShare * 100).toFixed(1), size: profiles.length },
    },
    { key: 'evidence.cluster', params: { percent: (winShare * 100).toFixed(1) } },
    {
      key: 'evidence.sampleInfo',
      params: { size: profiles.length, total: data.starsTotalKnown },
    },
    { key: 'evidence.ghostDef' },
  ]);
}
