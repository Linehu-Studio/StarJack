/**
 * 讣告单文件 HTML 生成器
 * 黑白滤镜 + WebAudio 哀乐 + 生前贡献 + 死因分析，全部内联，无外部资源
 */
import type { Lang, Report } from '@starjack/engine';
import { getDict, ev } from '@starjack/engine';
import { DIRGE_NOTES, DIRGE_BEAT } from './dirge';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** 死因：得分最高的前 3 个可用维度 */
function causesOfDeath(report: Report, lang: Lang): { name: string; score: number; firstEvidence: string }[] {
  return report.dimensions
    .filter((d) => d.available)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((d) => ({
      name: getDict(lang).dims[d.id],
      score: d.score,
      firstEvidence: d.evidence.length > 0 ? ev(lang, d.evidence[0]) : '',
    }));
}

export function buildObituary(report: Report, lang: Lang): string {
  const D = getDict(lang);
  const { repo } = report;
  const title = esc(D.obituary.title.replace('{repo}', repo.fullName));
  const subtitle = esc(
    D.obituary.subtitle
      .replace('{stars}', repo.stars.toLocaleString('en-US'))
      .replace('{percent}', String(report.estimatedFakePercent ?? report.index)),
  );
  const born = fmtDate(repo.createdAt, lang);
  const died = fmtDate(report.scannedAt, lang);
  const realStars = Math.round(repo.stars * (1 - (report.estimatedFakePercent ?? report.index) / 100));
  const survivedBy = esc(
    D.obituary.survivedBy
      .replace('{realStars}', realStars.toLocaleString('en-US'))
      .replace('{watchers}', String(repo.watchers)),
  );
  const epitaph = esc(D.roast[report.verdict]);
  const causes = causesOfDeath(report, lang)
    .map(
      (c) => `
      <div class="cause">
        <div class="cause-head"><span>${esc(c.name)}</span><span class="cause-score">${c.score}</span></div>
        ${c.firstEvidence ? `<p class="cause-evidence">${esc(c.firstEvidence)}</p>` : ''}
      </div>`,
    )
    .join('');
  const stat = (label: string, value: string): string =>
    `<div class="stat"><div class="stat-value">${esc(value)}</div><div class="stat-label">${esc(label)}</div></div>`;
  const stats = [
    stat(D.obituary.stars, repo.stars.toLocaleString('en-US')),
    stat(D.obituary.forks, repo.forks.toLocaleString('en-US')),
    stat(D.obituary.watchers, String(repo.watchers)),
    stat(D.obituary.fakeStars, `${report.estimatedFakePercent ?? report.index}%`),
  ].join('');
  const notesJson = JSON.stringify(DIRGE_NOTES);
  const langHtml = lang === 'zh' ? 'lang="zh-CN"' : 'lang="en"';

  return `<!DOCTYPE html>
<html ${langHtml}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root { color-scheme: dark; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    filter: grayscale(1);
    background: #0a0a0a;
    color: #c9c4bc;
    font-family: Georgia, 'Times New Roman', 'Songti SC', 'SimSun', serif;
    min-height: 100vh;
    display: flex;
    justify-content: center;
    padding: 48px 16px;
  }
  main { max-width: 720px; width: 100%; }
  .frame {
    border: 1px solid #3a3733;
    outline: 1px solid #242220;
    outline-offset: 6px;
    padding: 48px 40px;
    text-align: center;
  }
  .cross { font-size: 28px; letter-spacing: 12px; color: #6b655d; margin-bottom: 24px; }
  h1 { font-size: 30px; font-weight: 400; color: #e6e1d8; line-height: 1.35; }
  .subtitle { margin-top: 10px; font-size: 15px; font-style: italic; color: #8f887d; }
  .dates { margin: 28px 0 6px; font-size: 14px; color: #8f887d; letter-spacing: 1px; }
  .dates b { color: #c9c4bc; font-weight: 400; }
  .survived { margin-top: 14px; font-size: 13.5px; color: #8f887d; }
  .stats { display: flex; justify-content: center; gap: 36px; margin: 34px 0; flex-wrap: wrap; }
  .stat-value { font-size: 24px; color: #e6e1d8; }
  .stat-label { font-size: 12px; color: #8f887d; margin-top: 4px; letter-spacing: 1px; }
  h2 { font-size: 15px; font-weight: 400; letter-spacing: 4px; text-transform: uppercase; color: #8f887d; margin: 34px 0 16px; }
  .cause { border-top: 1px solid #242220; padding: 14px 0; text-align: left; }
  .cause-head { display: flex; justify-content: space-between; font-size: 15px; color: #d5cfc5; }
  .cause-score { color: #8f887d; }
  .cause-evidence { font-size: 13px; color: #8f887d; margin-top: 5px; line-height: 1.55; }
  .epitaph { margin: 34px auto 0; max-width: 480px; font-size: 16px; font-style: italic; line-height: 1.7; color: #d5cfc5; }
  .dirge-btn {
    margin-top: 30px;
    background: none;
    border: 1px solid #3a3733;
    color: #c9c4bc;
    font-family: inherit;
    font-size: 14px;
    padding: 10px 26px;
    cursor: pointer;
    letter-spacing: 1px;
  }
  .dirge-btn:hover { border-color: #8f887d; color: #e6e1d8; }
  footer { margin-top: 40px; font-size: 12px; color: #6b655d; line-height: 1.8; }
  footer a { color: #8f887d; }
  .slogan { letter-spacing: 0.5px; }
</style>
</head>
<body>
<main>
  <div class="frame">
    <div class="cross">✝ ✝ ✝</div>
    <h1>${title}</h1>
    <p class="subtitle">${subtitle}</p>
    <p class="dates">${esc(D.obituary.born)} <b>${esc(born)}</b> &nbsp;·&nbsp; ${esc(D.obituary.died)} <b>${esc(died)}</b></p>
    <p class="survived">${survivedBy}</p>
    <div class="stats">${stats}</div>
    <h2>${esc(D.obituary.causeOfDeath)}</h2>
    ${causes}
    <h2>${esc(D.obituary.epitaphLabel)}</h2>
    <p class="epitaph">“${epitaph}”</p>
    <button class="dirge-btn" id="dirge-btn" type="button">${esc(D.obituary.playDirge)}</button>
    <footer>
      <div class="slogan">You can buy stars, but you can't buy dignity.</div>
      <div>${esc(D.obituary.autopsiedBy)} · <a href="${esc(repo.htmlUrl)}" target="_blank" rel="noopener">${esc(repo.fullName)}</a></div>
      <div>${esc(D.obituary.disclaimer)}</div>
    </footer>
  </div>
</main>
<script>
(function () {
  var NOTES = ${notesJson};
  var BEAT = ${DIRGE_BEAT};
  var ctx = null, timer = null, playing = false;
  var btn = document.getElementById('dirge-btn');
  var labelPlay = btn.textContent;
  var labelStop = btn.getAttribute('data-stop') || '■';
  function playLoop() {
    if (!ctx || !playing) return;
    var t = ctx.currentTime + 0.05;
    for (var i = 0; i < NOTES.length; i++) {
      var freq = NOTES[i][0], dur = NOTES[i][1] * BEAT;
      if (freq > 0) {
        var osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        var gain = ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.12, t + 0.04);
        gain.gain.setValueAtTime(0.12, t + dur * 0.7);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + dur + 0.05);
      }
      t += dur;
    }
    timer = setTimeout(playLoop, (t - ctx.currentTime) * 1000);
  }
  btn.addEventListener('click', function () {
    playing = !playing;
    if (playing) {
      btn.textContent = ${JSON.stringify(lang === 'zh' ? '■ 止乐' : '■ Silence the choir')};
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      ctx.resume();
      playLoop();
    } else {
      btn.textContent = labelPlay;
      if (timer) { clearTimeout(timer); timer = null; }
      if (ctx) ctx.suspend();
    }
  });
})();
</script>
</body>
</html>
`;
}
