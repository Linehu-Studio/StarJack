import { describe, expect, test } from 'bun:test';
import { encodeReport, decodeReport, buildShareUrl } from '../src/share/codec';
import { runEngine } from '../src/detectors';
import { fakeScanData } from './fixtures';

describe('share codec', () => {
  test('编码 → 解码往返一致', () => {
    const report = runEngine(fakeScanData());
    const encoded = encodeReport(report);
    const decoded = decodeReport(encoded);
    expect(decoded.repo.fullName).toBe(report.repo.fullName);
    expect(decoded.index).toBe(report.index);
    expect(decoded.verdict).toBe(report.verdict);
    expect(decoded.dimensions).toEqual(report.dimensions);
    expect(decoded.ghosts).toEqual(report.ghosts);
  });

  test('非 StarJack 载荷被拒绝', () => {
    const bad = btoa(JSON.stringify({ hello: 1 }));
    let thrown = false;
    try {
      decodeReport(bad);
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
  });

  test('构造分享链接', () => {
    const report = runEngine(fakeScanData());
    const url = buildShareUrl('https://starjack.example.com/', report, 'obituary');
    expect(url.startsWith('https://starjack.example.com/obituary#')).toBe(true);
    expect(decodeReport(url.split('#')[1]).index).toBe(report.index);
  });
});
