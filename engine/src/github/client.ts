/**
 * GitHub REST + GraphQL 客户端
 * - 零依赖，纯 fetch（isomorphic：Bun CLI 与浏览器共用）
 * - 限速等待（403/429 + x-ratelimit-reset）、5xx 重试
 */

const API_ROOT = 'https://api.github.com';

export class GitHubError extends Error {
  constructor(
    public status: number,
    message: string,
    public resetAt?: Date,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

export interface RestOptions {
  /** 覆盖 Accept 头（如 stargazers 的 star+json） */
  accept?: string;
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 200);
  } catch {
    return '';
  }
}

export class GitHubClient {
  constructor(public token: string | null = null) {}

  private headers(accept?: string): Record<string, string> {
    const h: Record<string, string> = {
      'X-GitHub-Api-Version': '2022-11-28',
      Accept: accept ?? 'application/vnd.github+json',
    };
    // 浏览器禁止设置 User-Agent（forbidden header），仅 Node/Bun 环境 设置
    if (typeof window === 'undefined') h['User-Agent'] = 'StarJack/1.0';
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    return h;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  /** 判断是否为限速响应（供 rest/graphql 共用） */
  private async handleRateLimit(res: Response, attempt: number, retry: () => Promise<Response>): Promise<Response> {
    if (res.status !== 403 && res.status !== 429) return res;
    const remaining = res.headers.get('x-ratelimit-remaining');
    if (remaining !== '0') return res;
    const resetHeader = res.headers.get('x-ratelimit-reset');
    const resetAt = resetHeader ? new Date(Number(resetHeader) * 1000) : undefined;
    const waitMs = resetAt ? resetAt.getTime() - Date.now() + 1000 : 60_000;
    if (attempt < 1 && waitMs <= 120_000) {
      await this.sleep(Math.max(waitMs, 1000));
      return retry();
    }
    throw new GitHubError(403, 'GitHub API rate limit exhausted', resetAt);
  }

  async rest<T = unknown>(path: string, opts: RestOptions = {}, attempt = 0): Promise<T> {
    const url = path.startsWith('http') ? path : API_ROOT + path;
    let res = await fetch(url, { headers: this.headers(opts.accept) });
    res = await this.handleRateLimit(res, attempt, () =>
      fetch(url, { headers: this.headers(opts.accept) }),
    );
    if (res.status === 404) throw new GitHubError(404, `Not found: ${path}`);
    if (res.status >= 500 && attempt < 2) {
      await this.sleep(500 * (attempt + 1));
      return this.rest<T>(path, opts, attempt + 1);
    }
    if (!res.ok) throw new GitHubError(res.status, `${res.status} ${await safeText(res)}`);
    return (await res.json()) as T;
  }

  /** POST JSON（如发 issue） */
  async post<T = unknown>(path: string, body: unknown, attempt = 0): Promise<T> {
    const url = path.startsWith('http') ? path : API_ROOT + path;
    const doFetch = () =>
      fetch(url, {
        method: 'POST',
        headers: { ...this.headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    let res = await doFetch();
    res = await this.handleRateLimit(res, attempt, doFetch);
    if (res.status >= 500 && attempt < 2) {
      await this.sleep(500 * (attempt + 1));
      return this.post<T>(path, body, attempt + 1);
    }
    if (!res.ok) throw new GitHubError(res.status, `${res.status} ${await safeText(res)}`);
    return (await res.json()) as T;
  }

  /** 拉取一页列表；对 page>1 的 404 视为越界返回空数组 */
  async restPage<T = unknown>(path: string, page: number, perPage = 100, accept?: string): Promise<T[]> {
    const sep = path.includes('?') ? '&' : '?';
    try {
      const data = await this.rest<T[]>(`${path}${sep}per_page=${perPage}&page=${page}`, { accept });
      return Array.isArray(data) ? data : [];
    } catch (e) {
      if (e instanceof GitHubError && e.status === 404 && page > 1) return [];
      throw e;
    }
  }

  async graphql<T = Record<string, unknown>>(query: string, attempt = 0): Promise<T> {
    const doFetch = () =>
      fetch(`${API_ROOT}/graphql`, {
        method: 'POST',
        headers: { ...this.headers('application/json'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
    let res = await doFetch();
    res = await this.handleRateLimit(res, attempt, doFetch);
    if (!res.ok) throw new GitHubError(res.status, `GraphQL ${res.status}: ${await safeText(res)}`);
    const body = (await res.json()) as { data?: T; errors?: { type?: string; message: string }[] };
    if (body.errors?.length) {
      const rateLimited = body.errors.some((e) => e.type === 'RATE_LIMITED');
      if (rateLimited && attempt < 1) {
        await this.sleep(30_000);
        return this.graphql<T>(query, attempt + 1);
      }
      // 不存在的 user alias 会产生 errors 但 data 仍在——仅当无 data 时抛错
      if (!body.data) {
        throw new GitHubError(400, `GraphQL error: ${body.errors.map((e) => e.message).join('; ')}`);
      }
    }
    return body.data as T;
  }
}
