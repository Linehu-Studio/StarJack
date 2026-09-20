'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Report, Verdict } from '@starjack/engine';
import { buildShareUrl, decodeReport, ev } from '@starjack/engine';
import { buildObituary } from '@starjack/templates';
import { useLang } from '@/components/LangProvider';
import { DimRadarChart, StarCurveChart } from '@/components/charts';

function scoreColor(score: number): string {
  if (score >= 85) return 'var(--accent)';
  if (score >= 60) return '#f5a623';
  return 'var(--ok)';
}

const VERDICT_TAG: Record<Verdict, string> = {
  clean: 'tag tag-clean',
  suspect: 'tag tag-suspect',
  jacked: 'tag tag-jacked',
  crime_scene: 'tag tag-crime_scene',
  empty: 'tag tag-empty',
};

function verdictColorClass(verdict: Verdict): string {
  if (verdict === 'clean') return 'var(--ok)';
  if (verdict === 'suspect') return 'var(--warn)';
  return 'var(--accent)';
}

export default function ReportPage() {
  const { t, lang } = useLang();
  const [report, setReport] = useState<Report | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) {
      setInvalid(true);
      return;
    }
    try {
      setReport(decodeReport(hash));
    } catch {
      setInvalid(true);
    }
  }, []);

  const shareUrl = useMemo(
    () => (report ? buildShareUrl(window.location.origin, report, 'report') : ''),
    [report],
  );

  if (invalid) {
    return (
      <main>
        <h2 style={{ fontSize: 22, margin: '30px 0 10px' }}>{t.web.errorTitle}</h2>
        <p className="muted">{t.web.invalidLink}</p>
        <Link className="btn" href="/" style={{ marginTop: 18 }}>
          {t.web.backToScan}
        </Link>
      </main>
    );
  }
  if (!report) return null;

  const verdictLabel = t.verdict[report.verdict];
  const confLabel = t.report[report.confidence];
  const fakePct = report.estimatedFakePercent ?? report.index;

  const copyShare = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const downloadHtml = () => {
    const html = buildObituary(report!, lang);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `obituary-${report!.repo.owner}-${report!.repo.repo}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <main>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <a className="mono" href={report.repo.htmlUrl} target="_blank" rel="noopener" style={{ color: 'var(--text)', fontSize: 20, fontWeight: 700, textDecoration: 'none' }}>
              {report.repo.fullName}
            </a>
            {report.repo.description && <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{report.repo.description}</p>}
          </div>
          <span className={VERDICT_TAG[report.verdict]}>{verdictLabel}</span>
        </div>

        <div className="score-hero" style={{ marginTop: 24 }}>
          <div className="score-num" style={{ color: verdictColorClass(report.verdict) }}>
            {report.index}
          </div>
          <div className="score-sub">
            <div>/ 100 · {t.report.index}</div>
            <div style={{ marginTop: 4 }}>
              {t.report.fakeEstimate}: <b className="mono">{fakePct}%</b> · {t.report.confidence}: {confLabel}
              {report.mode === 'quick' && <> · {t.report.quickScan}</>}
            </div>
          </div>
        </div>
        <p className="slogan" style={{ marginTop: 14, fontSize: 15 }}>{t.roast[report.verdict]}</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 26 }}>
          {report.curve && (
            <div>
              <div className="section-title" style={{ margin: '0 0 8px' }}>{t.report.starCurve}</div>
              <StarCurveChart curve={report.curve} bursts={report.bursts} lang={lang} />
            </div>
          )}
          <div>
            <div className="section-title" style={{ margin: '0 0 8px' }}>{t.report.dimensions}</div>
            <DimRadarChart dimensions={report.dimensions} lang={lang} />
          </div>
        </div>
      </div>

      <div className="section-title">{t.report.dimensions}</div>
      <div className="card" style={{ paddingTop: 8, paddingBottom: 8 }}>
        {report.dimensions.map((d) => (
          <div className="dim-row" key={d.id}>
            <div className="dim-head">
              <span className="dim-name">{t.dims[d.id]}</span>
              {d.available ? (
                <>
                  <div className="dim-bar">
                    <i style={{ width: `${d.score}%`, background: scoreColor(d.score) }} />
                  </div>
                  <span className="dim-score mono" style={{ color: scoreColor(d.score) }}>
                    {d.score}
                  </span>
                </>
              ) : (
                <span className="faint mono" style={{ fontSize: 12 }}>{t.report.unavailable}</span>
              )}
            </div>
            {d.available &&
              d.evidence.slice(0, 2).map((e, i) => (
                <p className="evidence" key={i}>
                  · {ev(lang, e)}
                </p>
              ))}
          </div>
        ))}
      </div>

      {report.ghosts.length > 0 && (
        <>
          <div className="section-title">{t.report.topGhosts}</div>
          <div className="ghost-grid">
            {report.ghosts.map((g) => (
              <div className="ghost-card" key={g.login}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.avatarUrl ?? `https://avatars.githubusercontent.com/u/0?v=4`} alt="" />
                <div style={{ minWidth: 0 }}>
                  <div className="ghost-login">{g.login}</div>
                  <div className="ghost-score mono">{g.ghostScore}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="obit-actions" style={{ justifyContent: 'flex-start', marginTop: 34 }}>
        <Link className="btn btn-primary" href={`/obituary#${window.location.hash.slice(1)}`}>
          {t.web.viewObituary}
        </Link>
        <button className="btn" onClick={() => void copyShare()}>
          {copied ? t.web.copied : t.web.copyLink}
        </button>
        <button className="btn" onClick={downloadHtml}>
          {t.web.downloadHtml}
        </button>
        <a className="btn" href={report.repo.htmlUrl} target="_blank" rel="noopener">
          {t.web.openRepo}
        </a>
      </div>
      <p className="faint" style={{ fontSize: 12, marginTop: 16 }}>
        {t.report.disclaimer} · {t.report.scannedAt}: {report.scannedAt}
      </p>
    </main>
  );
}
