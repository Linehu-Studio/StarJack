'use client';

import Link from 'next/link';
import { useLang } from './LangProvider';

export function NavBarLinks() {
  const { t } = useLang();
  return (
    <>
      <Link className="nav-link" href="/leaderboard">
        {t.web.leaderboard}
      </Link>
    </>
  );
}
