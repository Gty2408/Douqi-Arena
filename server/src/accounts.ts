import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JsonStore } from './storage.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'junqi-arena-dev-secret-change-me';
const JWT_EXPIRES_IN = '7d';

/** Account record persisted in storage. */
export interface Account {
  username: string;
  gameId: string;
  passwordHash: string;
  luck: number;        // 气运值 / 排位分
  wins: number;        // 胜场
  matchHistory: string[]; // 战绩扩展位（对局记录 id 列表）
  createdAt: number;
}

/** Public-safe account data (no password hash). */
export interface PublicAccount {
  username: string;
  gameId: string;
  luck: number;
  wins: number;
}

interface AccountsData {
  accounts: Record<string, Account>; // keyed by username
}

function ensureAccounts(data: AccountsData): Record<string, Account> {
  if (!data.accounts) data.accounts = {};
  return data.accounts;
}

export class AccountService {
  private store: JsonStore<AccountsData>;

  constructor(store?: JsonStore<AccountsData>) {
    this.store = store ?? new JsonStore<AccountsData>('accounts.json');
  }

  /** Register a new account. Returns the public account or an error. */
  register(
    username: string,
    password: string,
    gameId: string,
  ): { ok: true; account: PublicAccount } | { ok: false; error: string } {
    if (!username || !password || !gameId) {
      return { ok: false, error: '用户名、密码、游戏ID 不能为空' };
    }
    const data = this.store.read();
    const accounts = ensureAccounts(data);
    if (accounts[username]) {
      return { ok: false, error: '用户名已存在' };
    }
    // Check gameId uniqueness.
    const gameIdTaken = Object.values(accounts).some((a) => a.gameId === gameId);
    if (gameIdTaken) {
      return { ok: false, error: '游戏ID 已被占用' };
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const account: Account = {
      username,
      gameId,
      passwordHash,
      luck: 0,
      wins: 0,
      matchHistory: [],
      createdAt: Date.now(),
    };
    this.store.update((d) => {
      ensureAccounts(d)[username] = account;
    });
    return { ok: true, account: this.toPublic(account) };
  }

  /** Login and return a JWT token. */
  login(
    username: string,
    password: string,
  ): { ok: true; token: string; account: PublicAccount } | { ok: false; error: string } {
    const data = this.store.read();
    const account = ensureAccounts(data)[username];
    if (!account) return { ok: false, error: '用户名或密码错误' };
    if (!bcrypt.compareSync(password, account.passwordHash)) {
      return { ok: false, error: '用户名或密码错误' };
    }
    const token = jwt.sign({ username, gameId: account.gameId }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });
    return { ok: true, token, account: this.toPublic(account) };
  }

  /** Verify a JWT token and return the account. */
  verifyToken(token: string): PublicAccount | null {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { username: string };
      const data = this.store.read();
      const account = ensureAccounts(data)[payload.username];
      return account ? this.toPublic(account) : null;
    } catch {
      return null;
    }
  }

  getByUsername(username: string): Account | null {
    return ensureAccounts(this.store.read())[username] ?? null;
  }

  /** Increment wins for an account (called when a game ends). */
  addWin(username: string): void {
    this.store.update((d) => {
      const accounts = ensureAccounts(d);
      if (accounts[username]) accounts[username].wins += 1;
    });
  }

  /** Update luck value (placeholder for future 气运值 system). */
  setLuck(username: string, luck: number): void {
    this.store.update((d) => {
      const accounts = ensureAccounts(d);
      if (accounts[username]) accounts[username].luck = luck;
    });
  }

  /** All accounts for leaderboard. */
  getAllAccounts(): PublicAccount[] {
    return Object.values(ensureAccounts(this.store.read())).map((a) => this.toPublic(a));
  }

  private toPublic(a: Account): PublicAccount {
    return {
      username: a.username,
      gameId: a.gameId,
      luck: a.luck,
      wins: a.wins,
    };
  }
}
