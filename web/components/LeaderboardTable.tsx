'use client';

import { useLang } from './LangProvider';
import type { Verdict } from '@starjack/engine';

export interface Entry {
  repo: string;
  stars: number;
  index: number;
  verdict: Verdict;
  estimatedFakePercent: number | null;
  scannedAt: string;
  note: string;
}

const VERDICT_TAG: Record<Verdict, string> = {
  clean: 'tag tag-clean',
  suspect: 'tag tag-suspect',
  jacked: 'tag tag-jacked',
  crime_scene: 'tag tag-crime_scene',
  empty: 'tag tag-empty',
};

export function LeaderboardTable({ entries }: { entries: Entry[] }) {
  const { t } = useLang();
  const sorted = [...entries].sort((a, b) => b.index - a.index);
  return (
    <main>
      <h1 style={{ fontSize: 26, margin: '20px 0 6px' }}>{t.web.leaderboard}</h1>
      <p className="muted" style={{ fontSize: 13, marginBottom: 22 }}>{t.web.leaderboardNote}</p>
      <div className="card" style={{ padding: '6px 12px' }}>
        <table className="lb-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Repo</th>
              <th>Stars</th>
              <th>{t.report.fakeEstimate}</th>
              <th>{t.report.index}</th>
              <th>{t.report.verdict}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e, i) => (
              <tr key={e.repo}>
                <td className="mono faint">{i + 1}</td>
                <td>
                  <a
                    href={`https://github.com/${e.repo}`}
                    target="_blank"
                    rel="noopener"
                    className="mono"
                  >
                    {e.repo}
                  </a>
                  <div className="faint" style={{ fontSize: 11, marginTop: 3 }}>{e.note}</div>
                </td>
                <td className="mono">{e.stars.toLocaleString('en-US')}</td>
                <td className="mono">{e.estimatedFakePercent === null ? '—' : `${e.estimatedFakePercent}%`}</td>
                <td className="mono">{e.index}</td>
                <td>
                  <span className={VERDICT_TAG[e.verdict]}>{t.verdict[e.verdict]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
