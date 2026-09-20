import { describe, expect, test, afterEach } from 'bun:test';
import { GitHubClient, GitHubError } from '../src/github/client';
import { parseRepoInput, sampleLogins, stridePagesHelper } from './client-helpers';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('parseRepoInput', () => {
  test('解析 owner/repo', () => {
    expect(parseRepoInput('vercel/next.js')).toEqual({ owner: 'vercel', repo: 'next.js' });
  });
  test('解析完整 URL（含 .git / 尾斜杠）', () => {
    expect(parseRepoInput('https://github.com/Union-Labs/union.git/')).toEqual({
      owner: 'Union-Labs',
      repo: 'union',
    });
  });
  test('非法输入抛错', () => {
    expect(() => parseRepoInput('not a repo')).toThrow();
  });
});

describe('sampleLogins', () => {
  test('等距采样覆盖整条时间线', () => {
    const events = Array.from({ length: 1000 }, (_, i) => ({
      starredAt: null,
      user: `u${i}`,
    }));
    const logins = sampleLogins(events, 100);
    expect(logins.length).toBe(100);
    expect(logins[0]).toBe('u0');
    expect(logins[99]).toBe('u990');
  });
  test('数量不足时全量返回', () => {
    const events = [{ starredAt: null, user: 'a' }, { starredAt: null, user: 'b' }];
    expect(sampleLogins(events, 100)).toEqual(['a', 'b']);
  });
});

describe('stridePages', () => {
  test('400 页中取 100 个等距页', () => {
    const pages = stridePagesHelper(100, 400);
    expect(pages.length).toBe(100);
    expect(pages[0]).toBe(2);
    expect(pages[99]).toBe(398);
  });
});

describe('GitHubClient', () => {
  test('404 抛 GitHubError', async () => {
    globalThis.fetch = (async () =>
      new Response('{"message":"Not Found"}', { status: 404 })) as unknown as typeof fetch;
    const client = new GitHubClient('token');
    let err: unknown;
    try {
      await client.rest('/repos/a/b');
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(GitHubError);
    expect((err as GitHubError).status).toBe(404);
  });

  test('restPage 对 page>1 的 404 返回空数组（越界页）', async () => {
    globalThis.fetch = (async () =>
      new Response('{"message":"Not Found"}', { status: 404 })) as unknown as typeof fetch;
    const client = new GitHubClient('token');
    const page = await client.restPage('/repos/a/b/stargazers', 3);
    expect(page).toEqual([]);
  });

  test('restPage 对 page=1 的 404 抛错（仓库不存在）', async () => {
    globalThis.fetch = (async () =>
      new Response('{"message":"Not Found"}', { status: 404 })) as unknown as typeof fetch;
    const client = new GitHubClient('token');
    let err: unknown;
    try {
      await client.restPage('/repos/a/b/stargazers', 1);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(GitHubError);
  });

  test('携带 token 与 star+json 头', async () => {
    let captured: Record<string, string> = {};
    globalThis.fetch = (async (_url: any, init: any) => {
      captured = init.headers;
      return new Response('[]', { status: 200 });
    }) as unknown as typeof fetch;
    const client = new GitHubClient('tok123');
    await client.restPage('/repos/a/b/stargazers', 1, 100, 'application/vnd.github.star+json');
    expect(captured['Authorization']).toBe('Bearer tok123');
    expect(captured['Accept']).toBe('application/vnd.github.star+json');
  });
});
