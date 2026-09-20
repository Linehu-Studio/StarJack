import type { DimensionId } from '../types';

/** 7 维权重（CMU StarScout / fake-star-detector 启发，总和 = 1） */
export const WEIGHTS: Record<DimensionId, number> = {
  fork_ratio: 0.2,
  star_curve: 0.2,
  account_profile: 0.15,
  watchers: 0.1,
  activity: 0.15,
  commit_quality: 0.1,
  lifecycle: 0.1,
};
