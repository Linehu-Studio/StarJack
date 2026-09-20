import data from '../data/leaderboard.json';
import { LeaderboardTable, type Entry } from '@/components/LeaderboardTable';

export default function LeaderboardPage() {
  return <LeaderboardTable entries={data as Entry[]} />;
}
