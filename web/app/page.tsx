'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { encodeReport, scan, type ProgressPhase, type Report } from '@starjack/engine';
import { useLang } from '@/components/LangProvider';

const PHASES: ProgressPhase[] = ['repo', 'stars', 'profiles', 'activity', 'commits', 'scoring'];

export default function HomePage() {
  const { t, lang } = useLang();
  const router = useRouter();
  const [repo, setRepo] = useState('');
  const [token, setToken] = useState('');
  const [quick, setQuick] = useState(false);
  const [running, setRunning] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem('starjack.token');
    if (stored) setToken(stored);
  }, []);

  const execute = async () => {
    setError(null);
    setRunning(true);
    setPhaseIdx(0);
    try {
      const report: Report = await scan(repo, {
        token: quick ? null : token || null,
        mode: quick ? 'quick' : 'full',
        onProgress: (phase) => setPhaseIdx(PHASES.indexOf(phase)),
      });
      if (!quick && token) window.localStorage.setItem('starjack.token', token);
      router.push(`/report#${encodeReport(report)}`);
    } catch (e) {
      setError(String((e as Error).message ?? e));
      setRunning(false);
      setPhaseIdx(-1);
      void lang;
    }
  };

  const phaseLabel = (phase: ProgressPhase): string => t.progress[phase];

  return (
    <main>
      <section className="hero">
        <h1>
          STAR<b>JACK</b> · {lang === 'zh' ? '假星验尸处' : 'Fake-star autopsy'}
        </h1>
        <p>{t.web.tagline}</p>
        <p className="slogan">&ldquo;You can buy stars, but you can&apos;t buy dignity.&rdquo;</p>
      </section>

      <div className="card">
        <input
          className="input"
          placeholder={t.web.inputPlaceholder}
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && repo && !running) void execute();
          }}
          disabled={running}
        />

        <div style={{ marginTop: 14 }}>
          <input
            className="input"
            type="password"
            placeholder={t.web.tokenLabel}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={running || quick}
          />
          <p className="faint" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.6 }}>
            {t.web.tokenHint}
          </p>
        </div>

        <label className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={quick} onChange={(e) => setQuick(e.target.checked)} disabled={running} />
          {t.web.quickScan}
        </label>
        {quick && (
          <p className="faint" style={{ fontSize: 12, marginTop: 6 }}>
            {t.web.quickHint}
          </p>
        )}

        <div style={{ marginTop: 18 }}>
          <button className="btn btn-primary" onClick={() => void execute()} disabled={!repo || running}>
            {running ? `${t.web.scanning}...` : t.web.scan}
          </button>
        </div>

        {running && (
          <div style={{ marginTop: 16 }}>
            {PHASES.map((phase, i) => (
              <div key={phase} className={`phase-row ${i < phaseIdx ? 'done' : i === phaseIdx ? 'active' : ''}`}>
                <span className="mono">{i < phaseIdx ? '[ok]' : i === phaseIdx ? '[..]' : '[  ]'}</span>
                {phaseLabel(phase)}
              </div>
            ))}
          </div>
        )}

        {error && (
          <p style={{ marginTop: 14, color: 'var(--accent)', fontSize: 13 }}>
            {t.web.scanFailed}: {error}
          </p>
        )}
      </div>
    </main>
  );
}
