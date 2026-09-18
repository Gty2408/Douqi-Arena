import { useState } from 'react';
import { login, register, setStoredAccount, setToken } from '../api';
import { reconnectSocket } from '../socket';
import type { PublicAccount } from '../types';

interface Props {
  onLogin: (account: PublicAccount) => void;
}

export default function Login({ onLogin }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [gameId, setGameId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'register') {
        const { account } = await register(username, password, gameId);
        // After registering, log in automatically.
        const result = await login(username, password);
        setToken(result.token);
        setStoredAccount(result.account);
        reconnectSocket();
        onLogin(result.account);
      } else {
        const result = await login(username, password);
        setToken(result.token);
        setStoredAccount(result.account);
        reconnectSocket();
        onLogin(result.account);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div className="card" style={{ width: 420, padding: '40px 36px' }}>
        <h1 className="title" style={{ textAlign: 'center', fontSize: 28, marginBottom: 8 }}>
          斗棋竞技场
        </h1>
        <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: 12, marginBottom: 32, letterSpacing: 2 }}>
          JUNQI ARENA
        </p>

        <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
          <button
            onClick={() => setMode('login')}
            style={{
              flex: 1,
              padding: '10px 0',
              background: 'none',
              border: 'none',
              borderBottom: mode === 'login' ? '2px solid var(--gold)' : '2px solid transparent',
              color: mode === 'login' ? 'var(--gold)' : 'var(--text-dim)',
              cursor: 'pointer',
              fontSize: 15,
            }}
          >
            登录
          </button>
          <button
            onClick={() => setMode('register')}
            style={{
              flex: 1,
              padding: '10px 0',
              background: 'none',
              border: 'none',
              borderBottom: mode === 'register' ? '2px solid var(--gold)' : '2px solid transparent',
              color: mode === 'register' ? 'var(--gold)' : 'var(--text-dim)',
              cursor: 'pointer',
              fontSize: 15,
            }}
          >
            注册
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>用户名</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{ width: '100%' }}
              autoComplete="username"
            />
          </div>
          {mode === 'register' && (
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>游戏ID（唯一）</label>
              <input
                value={gameId}
                onChange={(e) => setGameId(e.target.value)}
                style={{ width: '100%' }}
                placeholder="用于对局展示"
              />
            </div>
          )}
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%' }}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && (
            <div style={{ color: 'var(--red-glow)', fontSize: 13, textAlign: 'center' }}>{error}</div>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? '处理中...' : mode === 'login' ? '登 录' : '注 册'}
          </button>
        </form>
      </div>
    </div>
  );
}
