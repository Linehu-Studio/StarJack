import type { EvidenceItem, Lang } from '../types';
import { en } from './en';
import { zh } from './zh';

export type Dict = typeof en;

const dictionaries: Record<Lang, Dict> = { en, zh };

export function getDict(lang: Lang): Dict {
  return dictionaries[lang] ?? dictionaries.zh;
}

/** 渲染 {param} 模板 */
export function fmt(tpl: string, params?: Record<string, string | number>): string {
  if (!params) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) =>
    k in params ? String(params[k]) : `{${k}}`,
  );
}

/** 按语言解析证据条目（dotted key → 模板 → 插值） */
export function ev(lang: Lang, item: EvidenceItem): string {
  const tpl = item.key
    .split('.')
    .reduce<unknown>((o, k) => (typeof o === 'object' && o !== null ? (o as Record<string, unknown>)[k] : undefined), dictionaries[lang]);
  return typeof tpl === 'string' ? fmt(tpl, item.params) : item.key;
}

/** 按语言解析任意 dotted key（供讣告/Issue 等场景复用） */
export function tKey(lang: Lang, key: string, params?: Record<string, string | number>): string {
  return ev(lang, { key, params });
}

export { en, zh };
