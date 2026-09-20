/** 从 collect.ts 导出的纯函数测试辅助（不触网） */
export { parseRepoInput, sampleLogins } from '../src/github/collect';
import { stridePages } from '../src/github/collect';

export function stridePagesHelper(n: number, total: number): number[] {
  return stridePages(n, total);
}
