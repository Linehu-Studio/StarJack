'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CurveHistogram, DimensionResult, Lang } from '@starjack/engine';
import { getDict } from '@starjack/engine';

function bucketLabel(t: number, bucketMs: number): string {
  const d = new Date(t);
  if (bucketMs >= 7 * 86_400_000) {
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  }
  if (bucketMs >= 86_400_000) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' });
}

export function StarCurveChart({ curve, bursts, lang }: { curve: CurveHistogram; bursts: { at: string }[]; lang: Lang }) {
  const burstSet = new Set(bursts.map((b) => Math.floor(Date.parse(b.at) / curve.bucketMs) * curve.bucketMs));
  const data = curve.points.map((count, i) => {
    const t = curve.start + i * curve.bucketMs;
    return { label: bucketLabel(t, curve.bucketMs), count, burst: burstSet.has(t) ? count : null };
  });
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e5484d" stopOpacity={0.55} />
            <stop offset="100%" stopColor="#e5484d" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#26262e" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: '#5c5a54', fontSize: 10 }} minTickGap={48} />
        <YAxis tick={{ fill: '#5c5a54', fontSize: 10 }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: '#16161b', border: '1px solid #3a3a45', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#8b8880' }}
        />
        <Area type="monotone" dataKey="count" stroke="#e5484d" strokeWidth={1.5} fill="url(#curveFill)" />
        <Area type="monotone" dataKey="burst" stroke="#fff" strokeWidth={0} fill="#fff" fillOpacity={0.65} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function DimRadarChart({ dimensions, lang }: { dimensions: DimensionResult[]; lang: Lang }) {
  const D = getDict(lang);
  const data = dimensions.map((d) => ({
    dim: D.dims[d.id],
    score: d.available ? d.score : 0,
  }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="#26262e" />
        <PolarAngleAxis dataKey="dim" tick={{ fill: '#8b8880', fontSize: 10 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar dataKey="score" stroke="#e5484d" fill="#e5484d" fillOpacity={0.28} />
        <Tooltip
          contentStyle={{ background: '#16161b', border: '1px solid #3a3a45', borderRadius: 8, fontSize: 12 }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
