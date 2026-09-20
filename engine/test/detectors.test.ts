import { describe, expect, test } from 'bun:test';
import {
  WEIGHTS,
  runEngine,
  detectForkRatio,
  detectStarCurve,
  detectAccountProfile,
  detectWatchers,
  detectActivity,
  detectCommitQuality,
  detectLifecycle,
  ghostScoreOf,
} from '../src/detectors';
import {
  fakeScanData,
  ghostProfiles,
  lockstepTimeline,
  makeScanData,
  organicScanData,
  organicTimeline,
  realProfiles,
  NOW,
} from './fixtures';
import type { DimensionId } from '../src/types';

describe('权重', () => {
  test('7 维权重之和为 1', () => {
    const ids: DimensionId[] = [
      'fork_ratio', 'star_curve', 'account_profile', 'watchers', 'activity', 'commit_quality', 'lifecycle',
    ];
    const sum = ids.reduce((a, id) => a + WEIGHTS[id], 0);
    expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
  });
});

describe('fork_ratio', () => {
  test('正常比率 → 0 分', () => {
    const d = detectForkRatio(makeScanData({ repo: { ...makeScanData().repo, stars: 10_000, forks: 1_500 } }));
    expect(d.score).toBe(0);
    expect(d.available).toBe(true);
  });
  test('刷星比率 0.004 → 满分', () => {
    const d = detectForkRatio(makeScanData({ repo: { ...makeScanData().repo, stars: 10_000, forks: 40 } }));
    expect(d.score).toBe(100);
  });
  test('0 星仓库不可用', () => {
    const d = detectForkRatio(makeScanData({ repo: { ...makeScanData().repo, stars: 0, forks: 0 } }));
    expect(d.available).toBe(false);
  });
});

describe('star_curve', () => {
  test('有机增长 → 低分', () => {
    const data = organicScanData();
    const d = detectStarCurve(data);
    expect(d.available).toBe(true);
    expect(d.score).toBeLessThan(40);
  });
  test('lockstep 齐步点星 → 高分', () => {
    const data = fakeScanData();
    const d = detectStarCurve(data);
    expect(d.score).toBeGreaterThan(70);
  });
  test('时间线不足 30 条不可用', () => {
    const d = detectStarCurve(makeScanData({ stars: organicTimeline(10, 5) }));
    expect(d.available).toBe(false);
  });
});

describe('account_profile', () => {
  test('全幽灵样本 → 高分，ghost 分为 100', () => {
    const ghosts = ghostProfiles(50);
    for (const g of ghosts) expect(ghostScoreOf(g, NOW)).toBe(100);
    const d = detectAccountProfile(makeScanData({ profiles: ghosts }));
    expect(d.score).toBeGreaterThan(70);
  });
  test('全真实样本 → 低分', () => {
    const d = detectAccountProfile(makeScanData({ profiles: realProfiles(150) }));
    expect(d.score).toBeLessThan(20);
  });
  test('样本不足 20 不可用', () => {
    const d = detectAccountProfile(makeScanData({ profiles: ghostProfiles(5) }));
    expect(d.available).toBe(false);
  });
});

describe('watchers', () => {
  test('1w 星 3 watcher → 满分', () => {
    expect(detectWatchers(makeScanData()).score).toBe(100);
  });
  test('健康比率 → 0 分', () => {
    const d = detectWatchers(makeScanData({ repo: { ...makeScanData().repo, stars: 10_000, watchers: 300 } }));
    expect(d.score).toBe(0);
  });
  test('watcher 绝对值大时封顶 30', () => {
    const d = detectWatchers(makeScanData({ repo: { ...makeScanData().repo, stars: 50_000, watchers: 120 } }));
    expect(d.score).toBeLessThanOrEqual(30);
  });
});

describe('activity', () => {
  test('高星零互动 → 满分', () => {
    const d = detectActivity(makeScanData());
    expect(d.score).toBe(100);
  });
  test('互动充分 → 0 分', () => {
    const d = detectActivity(organicScanData());
    expect(d.score).toBe(0);
  });
  test('新仓库减刑', () => {
    const data = makeScanData({
      repo: { ...makeScanData().repo, stars: 2_000, createdAt: new Date(NOW - 30 * 86_400_000).toISOString() },
      issuesTotal: 0,
      prsTotal: 0,
    });
    const d = detectActivity(data);
    expect(d.score).toBeLessThanOrEqual(70);
  });
});

describe('commit_quality', () => {
  test('批量生成 commit → 高分', () => {
    const d = detectCommitQuality(fakeScanData());
    expect(d.score).toBeGreaterThan(60);
  });
  test('多样真实 commit → 低分', () => {
    const d = detectCommitQuality(organicScanData());
    expect(d.score).toBeLessThan(40);
  });
});

describe('lifecycle', () => {
  test('建仓 72h 内冲完星 + 尸体已凉 → 高分', () => {
    const d = detectLifecycle(fakeScanData());
    expect(d.score).toBeGreaterThan(60);
  });
  test('两年自然增长 + 持续维护 → 低分', () => {
    const d = detectLifecycle(organicScanData());
    expect(d.score).toBeLessThan(30);
  });
});

describe('聚合 runEngine', () => {
  test('刷星仓库 → 高指数 + crime_scene/jacked', () => {
    const report = runEngine(fakeScanData());
    expect(report.index).toBeGreaterThan(60);
    expect(['jacked', 'crime_scene']).toContain(report.verdict);
    expect(report.estimatedFakePercent).toBe(100);
    expect(report.confidence).toBe('high');
  });

  test('有机仓库 → 低指数 + clean', () => {
    const report = runEngine(organicScanData());
    expect(report.index).toBeLessThan(30);
    expect(report.verdict).toBe('clean');
  });

  test('0 星仓库 → empty 短路', () => {
    const report = runEngine(makeScanData({ repo: { ...makeScanData().repo, stars: 0 } }));
    expect(report.verdict).toBe('empty');
    expect(report.index).toBe(0);
  });

  test('quick 模式：曲线/画像不可用，权重归一化，置信度低', () => {
    const report = runEngine(
      makeScanData({ mode: 'quick', repo: { ...makeScanData().repo, stars: 5_000, forks: 40, watchers: 4 } }),
    );
    const curve = report.dimensions.find((d) => d.id === 'star_curve')!;
    const profile = report.dimensions.find((d) => d.id === 'account_profile')!;
    expect(curve.available).toBe(false);
    expect(profile.available).toBe(false);
    expect(report.confidence).toBe('low');
    const wSum = report.dimensions.filter((d) => d.available).reduce((a, d) => a + d.weight, 0);
    expect(wSum).toBeGreaterThan(0);
    expect(report.index).toBeGreaterThan(0);
  });

  test('lockstep 时间线产生 bursts 与直方图', () => {
    const report = runEngine(fakeScanData());
    expect(report.bursts.length).toBeGreaterThan(0);
    expect(report.curve).not.toBeNull();
    expect(report.curve!.points.length).toBeGreaterThan(0);
  });

  test('ghost 样本按分数排序输出', () => {
    const report = runEngine(fakeScanData());
    expect(report.ghosts.length).toBe(24);
    expect(report.ghosts[0].ghostScore).toBeGreaterThanOrEqual(report.ghosts[23].ghostScore);
  });
});
