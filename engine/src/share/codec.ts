/** 报告 ↔ URL hash 编解码（lz-string，零后端分享的唯一可行方案） */
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { Report } from '../types';

export function encodeReport(report: Report): string {
  return compressToEncodedURIComponent(JSON.stringify({ ...report, _t: 'starjack' }));
}

export function decodeReport(encoded: string): Report {
  const json = decompressFromEncodedURIComponent(encoded);
  if (!json) throw new Error('Invalid share payload');
  const obj = JSON.parse(json) as Report & { _t?: string };
  if (obj?._t !== 'starjack' || typeof obj.index !== 'number' || !obj.repo) {
    throw new Error('Not a StarJack report');
  }
  return obj as Report;
}

/** 构造 Web 分享链接 */
export function buildShareUrl(baseUrl: string, report: Report, page: 'report' | 'obituary' = 'report'): string {
  const base = baseUrl.replace(/\/$/, '');
  return `${base}/${page}#${encodeReport(report)}`;
}
