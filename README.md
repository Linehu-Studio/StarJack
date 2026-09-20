<div align="center">

# ⚰ STARJACK

**GitHub fake-star public execution tool.**
**GitHub 假星公开处刑工具。**

*Input a repo. Get an autopsy. 输入仓库，领取讣告。*

**You can buy stars, but you can't buy dignity.**

CLI + Web · zero backend · 7-dimension detection engine

</div>

---

## Why / 为什么做这个

Inspired by the CMU paper on star-hijacking ("StarJacking") and [fake-star-detector](https://github.com/heckad/fake-star-detector), StarJack is not another serious academic tool.
参考 CMU 的 StarJacking 论文与 [fake-star-detector](https://github.com/heckad/fake-star-detector)，但 StarJack 不是又一个严肃学术工具。

> CMU's StarScout tells you a repo has fake stars. **StarJack attends the funeral.**
> CMU 的 StarScout 告诉你仓库有假星。**StarJack 直接送葬。**

## How it works / 检测原理

7 dimensions, weighted into a single **Fake Star Index (0–100)**:
7 个维度加权合成为一个**假星指数（0–100）**：

| Dimension | Signal | Weight |
|---|---|---|
| Fork/Star Ratio | Healthy: 0.1–0.2. Star-farms: < 0.01 | 20% |
| Star Growth Curve | Lockstep bursts, same-second stars, spike shapes | 20% |
| Account Profiles | Ghost ratio: no bio / 0 repos / 0+0 followers / brand-new, plus signup clustering | 15% |
| Watchers | 10k stars, 3 watchers? | 10% |
| Issue/PR Activity | High stars, zero interaction | 15% |
| Commit Quality | Generated messages ("update", "fix"...), single author | 10% |
| Lifecycle | 75% of fake-star repos are dead within 3 days | 10% |

Verdicts: `CLEAN` (0–29) → `SUSPECT` (30–59) → `JACKED` (60–84) → `CRIME SCENE` (85–100).
判定：`干净`（0–29）→ `可疑`（30–59）→ `被劫持`（60–84）→ `犯罪现场`（85–100）。

## Quick start / 快速开始

### CLI

```bash
# install deps (Bun required)
bun install

# scan (full autopsy needs a token — any classic PAT with ZERO scopes works)
bun cli/src/index.ts scan vercel/next.js --lang en
bun cli/src/index.ts scan https://github.com/someone/suspicious-ai --json report.json

# save token for later scans
bun cli/src/index.ts auth

# THE MAIN EVENT — public execution / 公开处刑
bun cli/src/index.ts scan someone/suspicious-ai --obituary        # standalone black-filter obituary HTML (with synthesized dirge) 黑白讣告单文件（内置合成哀乐）
bun cli/src/index.ts scan someone/suspicious-ai --share           # shareable web link (report encoded in URL hash) 分享链接
bun cli/src/index.ts scan someone/suspicious-ai --execute --dry-run  # preview the execution issue 预览处刑 issue
bun cli/src/index.ts scan someone/suspicious-ai --execute -y      # post "Your stars are 47.4% fake" to their repo 发 issue 处刑
```

Exit codes are CI-friendly: `0` clean · `1` suspect · `2` jacked · `3` crime scene.
退出码：`0` 干净 · `1` 可疑 · `2` 被劫持 · `3` 犯罪现场。

Build a single-file binary: `bun run build:cli` → `./starjack`.
> Note: `bun build --compile` requires a standalone Bun install (bun.sh / scoop). On Windows, if Bun was installed via `npm i -g bun`, the compile step may fail with `ENOENT` — use `bun run scan` directly, or install Bun from the official installer.
> 注意：`bun build --compile` 需要官方安装器版 Bun。Windows 上若经 `npm i -g bun` 安装，编译单文件可能报 `ENOENT`——直接用 `bun run scan`，或换官方安装。

### Web (zero backend / 零后端)

```bash
bun run dev   # Next.js on localhost:3000
```

Paste a repo URL, optionally paste your own PAT (stays in your browser), and the **engine runs client-side** — same code as the CLI, calling `api.github.com` directly. Deploy to Vercel with zero server cost. Share links carry the whole report in the URL hash (lz-string compressed).
粘贴仓库链接（可选粘贴自己的 PAT，仅存浏览器），**engine 完全在浏览器运行**——与 CLI 共用同一套代码，直连 `api.github.com`。一键部署 Vercel，零服务器成本。分享链接将整份报告压缩进 URL hash。

## Fake Star Leaderboard / 假星排行榜

*(example entries — run `starjack scan --json`, get real results, open a PR to add executions)*
*（示例条目——跑 `starjack scan --json` 拿真实结果，提 PR 处刑下一个）*

| # | Repo | Stars | Fake (est.) | Index | Verdict |
|---|---|---:|---:|---:|---|
| 1 | someone/awesome-agi-agent | 12,400 | 100% | 93.3 | `CRIME SCENE` |
| 2 | someone/mcp-ultra-suite | 8,100 | 82.5% | 78.4 | `JACKED` |
| 3 | someone/vibe-code-100x | 5,600 | 61.2% | 64.1 | `JACKED` |
| — | someone/real-open-source-tool | 23,000 | — | 12.6 | `CLEAN` |

Live version: `/leaderboard` in the web app. 在线版见 web 应用 `/leaderboard` 页。

## Architecture / 架构

```
StarJack/
├── engine/     @starjack/engine — detection engine, isomorphic CLI 与浏览器共用同一套检测代码
├── cli/        @starjack/cli    — commander + clack terminal UX, bun build --compile 单文件二进制
├── web/        Next.js 15 pure frontend 引擎全在浏览器跑，Vercel-ready
└── templates/  single-file obituary HTML 单文件讣告（grayscale 滤镜 + WebAudio 合成哀乐）
```

- **API budget**: one full scan ≈ 130 REST + ~15 GraphQL calls — well within the authenticated 5,000/h limit. Star timelines are sampled beyond 10k stars (API hard-caps pagination at 40k); reports state confidence. 单次完整扫描约 130 次 REST + ~15 次 GraphQL，远低于认证后 5,000/h 限额；1 万星以上采样时间线（API 硬上限 4 万星），报告标注置信度。
- **Token**: a classic PAT with **zero scopes** is enough for scanning. Posting the execution issue needs `public_repo`. 扫描用零权限 classic PAT 即可；发 issue 需 `public_repo`。
- **Share**: no backend — the report is compressed into the URL hash; the obituary is a self-contained HTML file you can email to the bereaved. 分享零后端——报告压缩进 URL hash；讣告是自包含单文件 HTML，可直接发给"家属"。

## The execution / 处刑模式

```bash
starjack scan someone/suspicious-ai --execute
```

Posts an issue titled **"Your stars are 47.4% fake — StarJack Audit"** with the full dimension table, evidence and share link.
自动往目标仓库发 issue，标题 **"Your stars are 47.4% fake — StarJack Audit"**，附完整维度表、证据与分享链接。

The executed repo has exactly two options. 被处刑的仓库只有两个选择：

1. **Delete the issue** — guilty conscience confirmed. 删 issue——心虚坐实。
2. **Respond** — congratulations on trending. 回应——恭喜上热搜。

Either way, the tool wins. 无论哪种，工具都赢了。

## Disclaimer / 免责声明

StarJack produces **statistical assessments from public GitHub data** — heuristics, not proof. Scores can flag legitimately cold-starting repos; that's why every report ships evidence, not just numbers. Don't use it for harassment. We are a funeral home, not a mob.
StarJack 输出的是**基于 GitHub 公开数据的统计推断**——启发式，不是证据。冷启动的正常仓库可能被误伤，所以每份报告都附带证据而不只是分数。请勿用于骚扰。我们是殡仪馆，不是暴民。

## Credits

- CMU StarScout paper (star-hijacking detection methodology)
- [fake-star-detector](https://github.com/heckad/fake-star-detector)

## License

MIT © Linehu-Studio
