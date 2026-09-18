import type { LeaderboardEntry, PublicAccount } from './types';

const API_BASE = '/api';

export interface LoginResult {
  token: string;
  account: PublicAccount;
}

export async function register(
  username: string,
  password: string,
  gameId: string,
): Promise<{ account: PublicAccount }> {
  const res = await fetch(`${API_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, gameId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? '注册失败');
  return data;
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? '登录失败');
  return data;
}

export async function getLeaderboard(limit = 100): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${API_BASE}/leaderboard?limit=${limit}`);
  const data = await res.json();
  return data.entries ?? [];
}

export function getToken(): string | null {
  return localStorage.getItem('junqi_token');
}

export function setToken(token: string): void {
  localStorage.setItem('junqi_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('junqi_token');
}

export function getStoredAccount(): PublicAccount | null {
  const raw = localStorage.getItem('junqi_account');
  return raw ? JSON.parse(raw) : null;
}

export function setStoredAccount(account: PublicAccount): void {
  localStorage.setItem('junqi_account', JSON.stringify(account));
}
