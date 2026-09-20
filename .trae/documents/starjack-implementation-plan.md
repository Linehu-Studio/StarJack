# StarJack 实施计划

> GitHub 假星公开处刑工具 — CLI + Web 双端，输入任意 repo URL，扫描打分、生成讣告式审计报告、一键处刑。
> Slogan: "You can buy stars, but you can't buy dignity."

## 1. 现状

- 目录仅有 [README.md](file:///d:/Code/LINEHU/StarJack/README.md)（一行标题）与 MIT LICENSE（Linehu-Studio），**全新绿地项目**。
- 无任何代码、构建配置或依赖。

## 2. 已确认决策

| 决策点 | 结论 | 理由 |
|---|---|---|
| CLI 语言 | **TypeScript (Bun)** | engine 为共享 TS 包，CLI 与 Web 零重复代码；瓶颈在 GitHub API 速率（I/O 密集），语言性能无差异 |
| Monorepo | **Bun workspaces** | 单工具链，`bun test` / `bun build` 一条龙，CLI 可 `bun build --compile` 出单文件可执行 |
| 文案语言 | **双语 (zh/en)** | 文案字典集中放 engine 包，CLI `--lang` 切换，Web 端自定义轻量 i18n Context（不引入 next-intl） |
| Web 架构 | **Next.js 15 纯前端**，Vercel 部署 | GitHub REST/GraphQL API 支持 CORS，浏览器直连；用户粘贴自己的 PAT（存 localStorage）；零后端成本 |
| GitHub 认证 | CLI: OAuth **Device Flow** + `GITHUB_TOKEN` 环境变量；Web: 手动粘贴 PAT | Device Flow 无需回调服务器；扫描必须有 token（未认证仅 60 req/h，不可用） |
| 分享机制 | 报告 JSON 压缩进 URL hash（lz-string）+ 独立单文件 HTML 讣告 | 零后端下唯一可行的分享方式 |
| 哀乐 BGM | **WebAudio API 合成**，不使用音频文件 | 讣告页保持单文件自包含，无资源依赖 |

## 3. 目录结构

```
StarJack/
├── package.json               # Bun workspaces: engine, cli, web
├── engine/                    # @starjack/engine — 核心检测引擎（零运行时依赖，isomorphic）
│   └── src/
│       ├── github/            # client.ts(REST+GraphQL fetch 封装/限速/重试)、repo.ts、
│       │                      # stargazers.ts、users.ts(GraphQL 批量)、activity.ts、commits.ts
│       ├── detectors/         # 7 个维度检测器 + index.ts 加权聚合
│       ├── report/            # Report 类型、假星指数、嘲讽文案生成（双语）
│       ├── i18n/              # zh.ts / en.ts 文案字典（detector 文案也在此）
│       ├── share/             # 报告压缩编码（lz-string）→ URL hash
│       └── types.ts
├── cli/                       # @starjack/cli — starjack 命令
│   └── src/
│       ├── index.ts           # commander 入口
│       ├── auth.ts            # Device Flow / PAT 管理 (~/.starjack/config.json, 0600)
│       ├── render.ts          # 终端报告：进度条、维度条形图、星曲线 ASCII sparkline
│       ├── issue.ts           # --execute 发 issue（含 --dry-run、确认提示）
│       └── obituary.ts        # 调 engine 模板生成单文件 HTML
├── web/                       # Next.js 15 (App Router) + Tailwind v4
│   └── app/
│       ├── page.tsx           # 输入 repo → 浏览器端直接跑 engine 扫描
│       ├── report/page.tsx    # 报告页（读取 URL hash 数据）：星曲线、雷达图、样本卡片
│       ├── obituary/page.tsx  # 讣告页：黑白滤镜、WebAudio 哀乐、生前贡献、死因分析
│       └── leaderboard/page.tsx # 假星排行榜（静态 JSON 数据）
├── templates/                 # 讣告单文件 HTML 生成器（TS 模板函数，CLI 与 Web 共用）
└── README.md                  # 传播钩子：排行榜、截图对比、slogan、双语
```

## 4. 检测引擎设计

### 4.1 数据采集（单次扫描的 API 预算 ≈ 130 REST + ~15 GraphQL，远低于 5000/h 限额）

| 数据 | 来源 | 策略 |
|---|---|---|
| 仓库元数据 | `GET /repos/{o}/{r}` 1 次 | stars/forks/watchers(subscribers_count)/created_at/pushed_at |
| 星时间线 | `GET .../stargazers?per_page=100` + `Accept: application/vnd.github.star+json` | 默认最多 100 页（1w 星）；超出则等距跨页采样，报告标记 `partial`；>4w 星受 API 400 页硬上限，同法处理 |
| 账号画像 | **GraphQL alias 批查**（100 login/查询）：avatarUrl, bio, createdAt, publicRepos, followers, following | 默认采样 300 个 stargazer（3 次查询），可调 |
| Issue/PR 活跃度 | `search/issues` 拿 issue/PR 总数（各 1 次）+ 采样 issues/pulls 列表各 ≤3 页看评论分布 | Search API 限额 30/min，注意节流 |
| Commit 质量 | `GET .../commits?per_page=100` ≤2 页 | message、作者、时间戳 |

### 4.2 检测器统一接口

```ts
interface Detector {
  id: DimensionId;            // 'fork_ratio' | 'star_curve' | 'account_profile' | 'watchers'
                              // | 'activity' | 'commit_quality' | 'lifecycle'
  weight: number;             // 0.20 / 0.20 / 0.15 / 0.10 / 0.15 / 0.10 / 0.10
  run(data: ScanData): DimensionResult;  // score 0-100(越高越假) + evidence[] + 双语文案 key
}
```

各维度评分逻辑（score 0=正常 → 100=铁证）：

1. **fork-star-ratio (20%)**：ratio=forks/stars，分段线性映射（≥0.1→0；0.05~0.1 线性；<0.01→100）。
2. **star-curve (20%)**：lockstep 检测（同分钟窗口内星数峰值）、时间戳 Gini 集中度、间隔方差过小（机器人定时）、突刺占比。
3. **account-profile (15%)**：样本中"幽灵账号"占比（无头像/无简介/0 仓库/0 粉丝 0 关注加权）+ 注册时间扎堆度（top 月份占比 + 熵）。
4. **watchers (10%)**：subscribers/stars 对数刻度映射（大仓库天然低比率，需校准）。
5. **activity (15%)**：(issues+PRs+comments)/百星；高星零互动→高分；分母为 0 的保护。
6. **commit-quality (10%)**：message 多样性、泛型 message 占比（"update"/"fix"/"init"）、作者数与星数失衡、commit 时间规律性。
7. **lifecycle (10%)**：建仓到星峰的时间窗、72h 内星占比（对应论文"75% 假星仓库活不过 3 天"）、last_push 距今。

### 4.3 聚合输出

- **假星指数** 0-100 = Σ(score×weight)，分档：`0-29 Clean` / `30-59 Suspect` / `60-84 Jacked` / `85-100 Crime Scene`，各档配双语嘲讽文案。
- **estimatedFakePercent**：由账号画像样本外推（支撑 "Your stars are 47.4% fake" 类标题）。
- **confidence**：按采样覆盖率给 low/medium/high；0 星仓库直接返回 "没东西可处刑" 短路结果。

## 5. CLI 设计

```
starjack auth                     # Device Flow 认证，token 存 ~/.starjack/config.json
starjack scan <owner/repo|URL>
  --lang zh|en        # 默认 zh
  --json [file]       # 机器可读报告
  --max-pages N       # 星时间线采样深度
  --dry-run           # 预览 issue 内容不发送
  --execute           # 处刑：往目标 repo 发 issue（需二次确认，-y 跳过）
  --obituary          # 生成 obituary-{owner}-{repo}.html 单文件
  --share             # 输出 starjack web 分享链接（hash 携带报告）
  -y                  # 跳过确认
```

- Issue 标题模板：`Your stars are {X}% fake — StarJack Audit`，正文附分维度报告 + 分享链接。
- 退出码：0=Clean, 1=Suspect, 2=Jacked, 3=Crime Scene（CI 友好）。
- 终端样式：`picocolors` + TTY/ANSI 检测，旧式 Windows 控制台优雅降级为纯文本（不出乱码色块）；进度用 `@clack/prompts`（spinner/confirm）。
- `bun build --compile` 产出单文件可执行（Windows/Linux/macOS），GitHub Releases 分发。

## 6. Web 设计（零后端）

- **扫描**：浏览器直调 GitHub API（CORS 可用），engine 直接复用；PAT 存 localStorage，明确警告；未登录提供"快速扫描"降级模式（仅元数据维度，60 req/h）。
- **报告页**：星曲线（recharts 面积图 + 突刺高亮）、七维雷达图、幽灵账号样本卡片墙。
- **讣告页**：黑白滤镜、WebAudio 合成哀乐（可静音）、"生前贡献"统计、"死因分析"（top 3 维度）、分享按钮（X intent / 复制链接 / 下载单文件 HTML）。
- **排行榜**：静态 JSON 手工维护，作为 README 传播钩子的数据源。
- i18n：自定义字典 + React Context 顶层切换 zh/en，全站文案走 engine 的 i18n 字典。

## 7. 实施里程碑

| 阶段 | 内容 | 交付物 |
|---|---|---|
| M1 | Monorepo 脚手架 + engine 全部 7 维检测器 + GitHub client + 聚合 + 单测 | `bun test` 通过（合成星时间线 fixture：有机 vs lockstep） |
| M2 | CLI：auth、scan、终端渲染、--json | `starjack scan vercel/next.js` 出完整报告 |
| M3 | 处刑模式：--execute（dry-run/确认）、--obituary（templates/）、--share | 单文件讣告 HTML + issue 发送 |
| M4 | Web：扫描页/报告页/讣告页/排行榜/i18n | Vercel 可部署 |
| M5 | README 传播钩子（双语、排行榜、截图对比、slogan）+ 收尾 | 可发布状态 |

## 8. 验证方式

1. `bun install && bun test` — engine 单测：7 检测器对合成数据的得分断言（正常仓库低分、lockstep 高分）、聚合权重和=1、边界（0 星/0 fork）。
2. `bun run scan -- vercel/next.js --json` — 真实大仓库采样路径（>4w 星 partial 逻辑）。
3. `bun run scan -- <某可疑AI项目> --obituary --dry-run` — 生成讣告 HTML 并本地打开验证（黑白滤镜/哀乐/文案）。
4. `cd web && bun dev` — 浏览器扫描 → 报告页图表 → 讣告页 → hash 分享链接往返解码一致。
5. `bun run typecheck && bun run lint` 全绿。

## 9. 假设与风险

- **API 硬上限**：stargazers 分页最多 400 页（4w 星），超出只能采样，报告中显式标注置信度。
- **误伤风险**：正常冷启动仓库可能得中高分 → 报告必须展示 evidence 而非只给分数；issue 发送默认需确认 + `--dry-run`。
- **滥用防护**：README 与 issue 模板底部附免责声明（仅分析公开数据、观点非指控）；CLI 不提供批量处刑（无 `--batch`）。
- **Next.js 浏览器端跑 engine**：engine 必须零 Node 专属依赖（仅 fetch），CI 中加一条 "engine 被 web 引用不报错" 的构建验证。
