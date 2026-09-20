/** 处刑 issue：内容构建 + 发送 */
import type { GitHubClient, Lang, Report } from '@starjack/engine';
import { ev, getDict } from '@starjack/engine';

export interface IssueContent {
  title: string;
  body: string;
}

export function buildIssueBody(report: Report, lang: Lang, shareUrl?: string): IssueContent {
  const D = getDict(lang);
  const percent = report.estimatedFakePercent ?? report.index;
  const title = `${D.issue.title.replace('{percent}', String(percent))} ({repo})`.replace('{repo}', report.repo.fullName);
  const { repo } = report;

  const rows = report.dimensions
    .map((d) => {
      const score = d.available ? String(d.score) : '—';
      return `| ${D.dims[d.id]} | ${score} | ${Math.round(d.weight * 100)}% |`;
    })
    .join('\n');

  const evidenceLines = report.dimensions
    .filter((d) => d.available && d.score >= 40)
    .flatMap((d) => d.evidence.slice(0, 2).map((e) => `- **${D.dims[d.id]}**: ${ev(lang, e)}`))
    .join('\n');

  const confLabel = D.report[report.confidence];
  const verdictLabel = D.verdict[report.verdict];
  const summary = D.issue.summary
    .replace('{index}', String(report.index))
    .replace('{verdict}', verdictLabel)
    .replace('{percent}', String(percent))
    .replace('{confidence}', confLabel);

  const body = [
    `## ${D.issue.header.replace('{repo}', repo.fullName)}`,
    '',
    summary,
    '',
    `| ${D.issue.tableHeader} |`,
    '| --- | --- | --- |',
    rows,
    '',
    `### ${D.report.evidence}`,
    evidenceLines,
    '',
    shareUrl ? `${D.issue.reportLink.replace('{url}', shareUrl)}` : '',
    '',
    '---',
    D.issue.methodology,
    '',
    D.issue.footer,
  ]
    .filter((s) => s !== '')
    .join('\n\n');

  return { title, body };
}

/** 发送处刑 issue，返回 html_url。需要 token 具备 Issues 写权限。 */
export async function postIssue(
  client: GitHubClient,
  report: Report,
  lang: Lang,
  shareUrl?: string,
): Promise<string> {
  const { title, body } = buildIssueBody(report, lang, shareUrl);
  const res = await client.post<{ html_url: string }>(
    `/repos/${report.repo.owner}/${report.repo.repo}/issues`,
    { title, body },
  );
  return res.html_url;
}
