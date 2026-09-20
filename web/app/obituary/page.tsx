'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { Report } from '@starjack/engine';
import { decodeReport, ev, getDict } from '@starjack/engine';
import { buildObituary, createDirgePlayer } from '@starjack/templates';
import { useLang } from '@/components/LangProvider';

function fmtDate(iso: string, lang: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function ObituaryPage() {
  const { t, lang } = useLang();
  const [report, setReport] = useState<Report | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [copied, setCopied] = useState(false);
  const playerRef = useRef<ReturnType<typeof createDirgePlayer> | null>(null);
  const [playing, setPlaying] = useState(false);

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
    return () => {
      playerRef.current?.stop();
    };
  }, []);

  const causes = useMemo(() => {
    if (!report) return [];
    const D = getDict(lang);
    return report.dimensions
      .filter((d) => d.available)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((d) => ({
        name: D.dims[d.id],
        score: d.score,
        evidence: d.evidence.length > 0 ? ev(lang, d.evidence[0]) : '',
      }));
  }, [report, lang]);

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

  const D = t;
  const { repo } = report;
  const fakePct = report.estimatedFakePercent ?? report.index;
  const realStars = Math.round(repo.stars * (1 - fakePct / 100));

  const toggleDirge = () => {
    playerRef.current ??= createDirgePlayer();
    if (playing) {
      playerRef.current.stop();
      setPlaying(false);
    } else {
      playerRef.current.start();
      setPlaying(true);
    }
  };

  const copyShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const downloadHtml = () => {
    const html = buildObituary(report!, lang);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `obituary-${repo.owner}-${repo.repo}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <main className="obit-page">
      <div className="obit-frame">
        <div className="obit-cross">✝ ✝ ✝</div>
        <h1 className="obit-title">{D.obituary.title.replace('{repo}', repo.fullName)}</h1>
        <p className="obit-sub">
          {D.obituary.subtitle
            .replace('{stars}', repo.stars.toLocaleString('en-US'))
            .replace('{percent}', String(fakePct))}
        </p>
        <p className="obit-dates">
          {D.obituary.born} <b>{fmtDate(repo.createdAt, lang)}</b> · {D.obituary.died}{' '}
          <b>{fmtDate(report.scannedAt, lang)}</b>
        </p>
        <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
          {D.obituary.survivedBy
            .replace('{realStars}', realStars.toLocaleString('en-US'))
            .replace('{watchers}', String(repo.watchers))}
        </p>

        <div className="obit-stats">
          <div className="obit-stat">
            <b>{repo.stars.toLocaleString('en-US')}</b>
            <span>{D.obituary.stars}</span>
          </div>
          <div className="obit-stat">
            <b>{repo.forks.toLocaleString('en-US')}</b>
            <span>{D.obituary.forks}</span>
          </div>
          <div className="obit-stat">
            <b>{repo.watchers}</b>
            <span>{D.obituary.watchers}</span>
          </div>
          <div className="obit-stat">
            <b>{fakePct}%</b>
            <span>{D.obituary.fakeStars}</span>
          </div>
        </div>

        <div className="section-title" style={{ textAlign: 'center' }}>{D.obituary.causeOfDeath}</div>
        {causes.map((c) => (
          <div key={c.name}>
            <div className="cause">
              <span>{c.name}</span>
              <span className="mono">{c.score}</span>
            </div>
            {c.evidence && <p className="cause-evidence">{c.evidence}</p>}
          </div>
        ))}

        <div className="section-title" style={{ textAlign: 'center' }}>{D.obituary.epitaphLabel}</div>
        <p className="obit-epitaph">&ldquo;{D.roast[report.verdict]}&rdquo;</p>

        <div className="obit-actions">
          <button className="btn" onClick={toggleDirge}>
            {playing ? D.obituary.stopDirge : D.obituary.playDirge}
          </button>
          <a
            className="btn"
            target="_blank"
            rel="noopener"
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
              `${D.obituary.title.replace('{repo}', repo.fullName)} — ${fakePct}% fake stars. RIP.`,
            )}&url=${encodeURIComponent(window.location.href)}`}
          >
            {D.obituary.shareOnX}
          </a>
          <button className="btn" onClick={() => void copyShare()}>
            {copied ? D.web.copied : D.web.copyLink}
          </button>
          <button className="btn" onClick={downloadHtml}>
            {D.web.downloadHtml}
          </button>
        </div>

        <p className="faint" style={{ fontSize: 12, marginTop: 34, lineHeight: 1.8 }}>
          {D.obituary.autopsiedBy} ·{' '}
          <a href={repo.htmlUrl} target="_blank" rel="noopener" style={{ color: 'var(--text-dim)' }}>
            {repo.fullName}
          </a>
          <br />
          {D.obituary.disclaimer}
        </p>
      </div>
    </main>
  );
}
