/** 评分工具函数（纯函数，便于测试） */

/** 线性插值：x 在 [x0,x1] 之间映射到 [y0,y1] */
export function lerp(x: number, x0: number, x1: number, y0: number, y1: number): number {
  if (x1 === x0) return y0;
  const t = (x - x0) / (x1 - x0);
  const clamped = Math.max(0, Math.min(1, t));
  return y0 + clamped * (y1 - y0);
}

export function quantile(sorted: number[], q: number): number | undefined {
  if (sorted.length === 0) return undefined;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (base + 1 < sorted.length) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

export function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

export function round1(x: number): number {
  return Math.round(x * 10) / 10;
}
