'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Lang } from '@starjack/engine';
import { getDict, type Dict } from '@starjack/engine';

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Dict;
}

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('zh');

  useEffect(() => {
    const stored = window.localStorage.getItem('starjack.lang');
    if (stored === 'en' || stored === 'zh') setLangState(stored);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    window.localStorage.setItem('starjack.lang', l);
  }, []);

  return (
    <LangContext.Provider value={{ lang, setLang, t: getDict(lang) }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within LangProvider');
  return ctx;
}

export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <button
      className="nav-link"
      style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--mono)' }}
      onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
    >
      {lang === 'zh' ? 'EN' : '中文'}
    </button>
  );
}
