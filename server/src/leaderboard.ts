import type { AccountService, PublicAccount } from './accounts.js';

export interface LeaderboardEntry {
  rank: number;
  gameId: string;
  luck: number;
  wins: number;
}

export class LeaderboardService {
  constructor(private accountService: AccountService) {}

  /** Returns the leaderboard sorted by luck descending, then wins descending. */
  getTop(limit = 100): LeaderboardEntry[] {
    const accounts = this.accountService.getAllAccounts();
    const sorted = [...accounts].sort((a, b) => {
      if (b.luck !== a.luck) return b.luck - a.luck;
      return b.wins - a.wins;
    });
    return sorted.slice(0, limit).map((a, i) => ({
      rank: i + 1,
      gameId: a.gameId,
      luck: a.luck,
      wins: a.wins,
    }));
  }

  /** Get a single account's leaderboard info. */
  getPlayer(username: string): LeaderboardEntry | null {
    const accounts = this.accountService.getAllAccounts();
    const sorted = [...accounts].sort((a, b) => {
      if (b.luck !== a.luck) return b.luck - a.luck;
      return b.wins - a.wins;
    });
    const idx = sorted.findIndex((a) => a.username === username);
    if (idx === -1) return null;
    const a = sorted[idx];
    return { rank: idx + 1, gameId: a.gameId, luck: a.luck, wins: a.wins };
  }
}
