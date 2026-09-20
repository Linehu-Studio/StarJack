#!/usr/bin/env bun
/** starjack — GitHub 假星公开处刑 CLI */
import { Command } from 'commander';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { writeFile } from 'node:fs/promises';
import {
  GitHubClient,
  GitHubError,
  buildShareUrl,
  getDict,
  scan,
  type Lang,
  type Report,
  type Verdict,
} from '@starjack/engine';
import { buildObituary } from '@starjack/templates';
import { deviceFlow, loadSite, loadToken, saveSite, saveToken, validateToken } from './auth';
import { renderReport } from './render';
import { buildIssueBody, postIssue } from './issue';

const VERSION = '0.1.0';
const DEFAULT_SITE = 'https://starjack.vercel.app';

const EXIT_CODES: Record<Verdict, number> = {
  clean: 0,
  suspect: 1,
  jacked: 2,
  crime_scene: 3,
  empty: 0,
};

const program = new Command();

program
  .name('starjack')
  .description("GitHub fake-star public execution tool — You can buy stars, but you can't buy dignity.")
  .version(VERSION);

program
  .command('auth')
  .description('保存 GitHub token（粘贴 PAT 或 OAuth Device Flow）')
  .option('--token <token>', '直接传入 token')
  .option('--device', '使用 OAuth Device Flow（需设置 STARJACK_CLIENT_ID）')
  .option('--site <url>', '同时保存 StarJack Web 站点地址（用于 --share）')
  .action(async (opts: { token?: string; device?: boolean; site?: string }) => {
    const zh = (process.env.LANG ?? '').toLowerCase().includes('zh') || process.platform === 'win32';
    const lang: Lang = zh ? 'zh' : 'en';
    const D = getDict(lang);
    try {
      let token: string | null = null;
      if (opts.device) {
        const clientId = process.env.STARJACK_CLIENT_ID;
        if (!clientId) {
          p.log.error(D.cli.deviceFlowNotConfigured);
          process.exit(1);
        }
        token = await deviceFlow(clientId, (msg) => p.log.step(D.cli.deviceFlowHint.replace('{url}', msg.split('  →  ')[0]).replace('{code}', msg.split('  →  ')[1] ?? '')));
      } else if (opts.token) {
        token = opts.token;
      } else {
        p.log.step(pc.dim(D.cli.authInstructions));
        const pasted = await p.password({ message: D.cli.authPastePrompt });
        if (p.isCancel(pasted) || !pasted) {
          p.cancel('cancelled');
          process.exit(0);
        }
        token = pasted;
      }
      const s = p.spinner();
      s.start('...');
      try {
        const user = await validateToken(token);
        s.stop(pc.green('✓'));
        saveToken(token);
        if (opts.site) {
          saveSite(opts.site);
        }
        p.log.success(D.cli.tokenSaved.replace('{user}', user).replace('{path}', '~/.starjack/config.json'));
      } catch (e) {
        s.stop(pc.red('✗'));
        p.log.error(D.cli.tokenInvalid.replace('{message}', String((e as Error).message ?? e)));
        process.exit(1);
      }
    } catch (e) {
      p.log.error(String((e as Error).message ?? e));
      process.exit(1);
    }
  });

program
  .command('scan')
  .description('扫描仓库并生成假星审计报告')
  .argument('<repo>', 'owner/repo 或 GitHub URL')
  .option('--lang <lang>', '输出语言 zh | en', 'zh')
  .option('--json [file]', '输出 JSON 报告（可选写入文件）')
  .option('--max-pages <n>', '星时间线最大页数（每页 100）', '100')
  .option('--profile-sample <n>', '账号画像采样数', '300')
  .option('--quick', '快速扫描（仅元数据，无需 token）')
  .option('--dry-run', '预览处刑 issue 内容，不发送')
  .option('--execute', '处刑：往目标仓库发 issue')
  .option('--obituary', '生成单文件讣告 HTML')
  .option('--share', '输出 Web 分享链接')
  .option('--site <url>', 'StarJack Web 站点地址')
  .option('-y, --yes', '跳过确认')
  .option('--token <token>', 'GitHub token（优先于已保存的）')
  .action(async (repo: string, opts: Record<string, any>) => {
    const lang: Lang = opts.lang === 'en' ? 'en' : 'zh';
    const D = getDict(lang);
    const started = Date.now();

    const storedToken = opts.token ?? loadToken();
    const site = opts.site ?? loadSite() ?? DEFAULT_SITE;
    let quick = !!opts.quick;
    if (!storedToken && !quick) {
      p.log.warn(pc.yellow(D.cli.tokenMissing));
      quick = true;
    }
    if (quick && storedToken) {
      p.log.info(pc.dim(D.cli.quickNotice));
    }

    const s = p.spinner();
    s.start(D.progress.repo);
    let report: Report;
    try {
      report = await scan(repo, {
        token: quick ? null : storedToken,
        mode: quick ? 'quick' : 'full',
        maxStarPages: Number(opts.maxPages) || 100,
        profileSampleSize: Number(opts.profileSample) || 300,
        onProgress: (phase) => {
          s.message(D.progress[phase]);
        },
      });
      s.stop(pc.green(`✓ ${D.cli.scanComplete.replace('{seconds}', ((Date.now() - started) / 1000).toFixed(1))}`));
    } catch (e) {
      s.stop(pc.red('✗'));
      if (e instanceof GitHubError && e.status === 404) {
        p.log.error(D.cli.repoNotFound.replace('{repo}', repo));
      } else {
        p.log.error(D.cli.scanFailed.replace('{message}', String((e as Error).message ?? e)));
      }
      process.exit(1);
    }

    console.log(renderReport(report, lang));

    const shareUrl = opts.share ? buildShareUrl(site, report, 'report') : undefined;

    if (opts.json) {
      const json = JSON.stringify(report, null, 2);
      if (typeof opts.json === 'string' && opts.json !== 'true') {
        await writeFile(opts.json, json, 'utf8');
        p.log.info(D.cli.jsonWritten.replace('{file}', opts.json));
      } else {
        console.log(json);
      }
    }

    if (opts.obituary) {
      const file = `obituary-${report.repo.owner}-${report.repo.repo}.html`;
      await writeFile(file, buildObituary(report, lang), 'utf8');
      p.log.info(pc.green(D.cli.obituaryWritten.replace('{file}', file)));
    }

    if (opts.share) {
      p.log.info(`${D.cli.shareUrl}\n${pc.cyan(shareUrl)}`);
      p.log.info(pc.cyan(buildShareUrl(site, report, 'obituary')));
    }

    if (opts.dryRun) {
      const { title, body } = buildIssueBody(report, lang, shareUrl);
      p.log.step(pc.dim(D.cli.issueDryRun));
      console.log(`${pc.bold(title)}\n\n${body}`);
    } else if (opts.execute) {
      if (!storedToken) {
        p.log.error(D.cli.tokenMissing);
        process.exit(1);
      }
      let confirmed = opts.yes === true;
      if (!confirmed) {
        const answer = await p.confirm({
          message: D.cli.confirmIssue.replace('{repo}', report.repo.fullName),
        });
        confirmed = answer === true;
      }
      if (!confirmed) {
        p.log.info(pc.dim('cancelled'));
        process.exit(0);
      }
      try {
        const url = await postIssue(new GitHubClient(storedToken), report, lang, shareUrl);
        p.log.success(pc.green(D.cli.issuePosted.replace('{url}', url)));
      } catch (e) {
        if (e instanceof GitHubError && e.status === 403) {
          p.log.error(D.cli.issueScopeError);
        } else {
          p.log.error(D.cli.scanFailed.replace('{message}', String((e as Error).message ?? e)));
        }
        process.exit(1);
      }
    }

    process.exit(EXIT_CODES[report.verdict]);
  });

program.parseAsync(process.argv);
