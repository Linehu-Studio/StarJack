/** 一站式扫描：输入 repo URL 或 owner/repo → 审计报告 */
import { GitHubClient } from './github/client';
import { collectScanData } from './github/collect';
import { runEngine } from './detectors';
import type { Report, ScanOptions } from './types';

export async function scan(input: string, opts: ScanOptions = {}): Promise<Report> {
  const client = new GitHubClient(opts.token ?? null);
  const data = await collectScanData(client, input, opts);
  return runEngine(data);
}

export { parseRepoInput } from './github/collect';
