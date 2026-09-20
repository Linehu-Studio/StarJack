import type { Metadata } from 'next';
import Link from 'next/link';
import { LangProvider, LangToggle } from '@/components/LangProvider';
import { NavBarLinks } from '@/components/NavBarLinks';
import './globals.css';

export const metadata: Metadata = {
  title: 'StarJack — You can buy stars, but you can\u2019t buy dignity.',
  description: 'GitHub fake-star public execution tool. Input a repo, get an obituary.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <LangProvider>
          <div className="shell">
            <nav className="nav">
              <Link className="nav-brand" href="/">
                STAR<b>JACK</b>
              </Link>
              <NavBarLinks />
              <div className="nav-spacer" />
              <LangToggle />
            </nav>
            {children}
            <footer className="faint" style={{ marginTop: 60, fontSize: 12, textAlign: 'center', lineHeight: 1.8 }}>
              You can buy stars, but you can&apos;t buy dignity.
              <br />
              Statistical assessment from public GitHub data — not an accusation.
            </footer>
          </div>
        </LangProvider>
      </body>
    </html>
  );
}
