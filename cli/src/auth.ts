/** CLI 认证：PAT 管理 + OAuth Device Flow */
import { homedir } from 'node:os';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GitHubClient, GitHubError } from '@starjack/engine';

const CONFIG_DIR = join(homedir(), '.starjack');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

interface Config {
  token?: string;
  site?: string;
}

function readConfig(): Config {
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) as Config;
  } catch {
    return {};
  }
}

/** 优先级：环境变量 > 配置文件 */
export function loadToken(): string | null {
  const env = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (env) return env;
  return readConfig().token ?? null;
}

export function loadSite(): string | null {
  return readConfig().site ?? null;
}

export function saveToken(token: string): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  const cfg = { ...readConfig(), token };
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), { mode: 0o600 });
}

export function saveSite(site: string): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  const cfg = { ...readConfig(), site };
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), { mode: 0o600 });
}

/** 校验 token（GET /user），返回 login */
export async function validateToken(token: string): Promise<string> {
  const client = new GitHubClient(token);
  try {
    const user = await client.rest<{ login: string }>('/user');
    return user.login;
  } catch (e) {
    const msg = e instanceof GitHubError ? `HTTP ${e.status}` : String(e);
    throw new Error(msg);
  }
}

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  interval?: number;
  expires_in?: number;
}

interface AccessTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

async function postForm(url: string, body: Record<string, string>): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

/**
 * OAuth Device Flow（无需回调服务器）。
 * 需要设置 STARJACK_CLIENT_ID（GitHub OAuth App 的 client id）。
 */
export async function deviceFlow(clientId: string, hint: (msg: string) => void): Promise<string> {
  const init = (await postForm('https://github.com/login/device/code', {
    client_id: clientId,
    scope: 'public_repo',
  })) as DeviceCodeResponse;
  hint(init.verification_uri.replace('{code}', init.user_code) + '  →  ' + init.user_code);
  const interval = (init.interval ?? 5) * 1000;
  const deadline = Date.now() + (init.expires_in ?? 900) * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval));
    const tok = (await postForm('https://github.com/login/oauth/access_token', {
      client_id: clientId,
      device_code: init.device_code,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    })) as AccessTokenResponse;
    if (tok.access_token) return tok.access_token;
    if (tok.error === 'authorization_pending') continue;
    if (tok.error === 'slow_down') {
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }
    throw new Error(tok.error_description ?? tok.error ?? 'device flow failed');
  }
  throw new Error('device flow timed out');
}
