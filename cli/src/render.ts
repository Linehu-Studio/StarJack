/** 终端报告渲染：分数卡 + 维度条形图 + ASCII sparkline */
import pc from 'picocolors';
import type { Lang, Report, Verdict } from '@starjack/engine';
import { ev, getDict } from '@starjack/engine';

const SPARK = '▁▂▃▄▅▆▇█';

function bar(width: number, score: number): string {
  const filled = Math.round((Math.max(0, Math.min(100, score)) / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function verdictColor(verdict: Verdict, text: string): string {
  switch (verdict) {
    case 'clean':
      return pc.green(text);
    case 'suspect':
      return pc.yellow(text);
    case 'jacked':
      return pc.red(text);
    case 'crime_scene':
      return pc.bgRed(pc.white(text));
    default:
      return pc.dim(text);
  }
}

/** 星增长曲线 sparkline（降采样到 maxChars） */
export function sparkline(points: number[], maxChars = 72): string {
  if (points.length === 0) return '';
  const step = Math.max(1, Math.ceil(points.length / maxChars));
  const samples: number[] = [];
  for (let i = 0; i < points.length; i += step) {
    let max = 0;
    for (let j = i; j < Math.min(i + step, points.length); j++) max = Math.max(max, points[j]);
    samples.push(max);
  }
  const peak = Math.max(...samples, 1);
  return samples.map((v) => SPARK[Math.min(SPARK.length - 1, Math.floor((v / peak) * (SPARK.length - 1)))]).join('');
}

export function renderReport(report: Report, lang: Lang): string {
  const D = getDict(lang);
  const lines: string[] = [];
  const { repo } = report;

  lines.push('');
  lines.push(pc.bold(`  ⚰  ${D.report.title}`));
  lines.push(pc.dim('  ' + '─'.repeat(58)));
  lines.push(`  ${pc.bold(repo.fullName)}${repo.description ? pc.dim(` — ${repo.description}`) : ''}`);
  lines.push('');

  const indexLabel = D.report.index;
  lines.push(`  ${indexLabel}  ${bar(30, report.index)}  ${pc.bold(String(report.index))} / 100`);
  lines.push('');
  const roast = D.roast[report.verdict];
  lines.push(`  ${D.report.verdict}:  ${verdictColor(report.verdict, D.verdict[report.verdict])}  ${pc.italic(pc.dim(roast))}`);

  const fakePct = report.estimatedFakePercent ?? '—';
  const confLabel = D.report[report.confidence];
  lines.push(`  ${D.report.fakeEstimate}: ${pc.bold(String(fakePct))}%   ${D.report.confidence}: ${confLabel}   ${report.mode === 'quick' ? pc.dim(D.report.quickScan) : D.report.fullScan}`);
  lines.push('');

  lines.push(`  ${pc.bold(D.report.dimensions)}`);
  for (const d of report.dimensions) {
    if (!d.available) {
      lines.push(`    ${pc.dim(`○ ${D.dims[d.id].padEnd(18)}  ${D.report.unavailable}`)}`);
      continue;
    }
    const icon = d.score >= 85 ? '☠' : d.score >= 60 ? '▲' : d.score >= 30 ? '~' : '✓';
    const color = d.score >= 85 ? pc.red : d.score >= 60 ? pc.yellow : pc.green;
    lines.push(`    ${color(`${icon} ${D.dims[d.id].padEnd(18)}`)} ${color(bar(24, d.score))} ${color(String(d.score))}`);
    for (const e of d.evidence.slice(0, 2)) {
      lines.push(pc.dim(`      · ${ev(lang, e)}`));
    }
  }

  if (report.curve) {
    lines.push('');
    lines.push(`  ${pc.bold(D.report.starCurve)}`);
    lines.push(`    ${sparkline(report.curve.points)}`);
  }
  if (report.bursts.length > 0) {
    lines.push('');
    lines.push(`  ${pc.bold(D.report.bursts)}`);
    for (const b of report.bursts.slice(0, 3)) {
      lines.push(pc.dim(`    · ${b.count} stars @ ${b.at}`));
    }
  }
  if (report.ghosts.length > 0) {
    lines.push('');
    lines.push(`  ${pc.bold(D.report.topGhosts)} ${pc.dim(D.evidence.ghostDef)}`);
    lines.push(pc.dim('    ' + report.ghosts.slice(0, 8).map((g) => g.login).join(', ')));
  }

  lines.push('');
  lines.push(pc.dim(`  ${D.report.scannedAt}: ${report.scannedAt}`));
  lines.push(pc.dim(`  ${D.report.disclaimer}`));
  lines.push('');
  return lines.join('\n');
}
