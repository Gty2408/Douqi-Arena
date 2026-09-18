import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLeaderboard } from '../api';
import type { LeaderboardEntry, PublicAccount } from '../types';

interface Props {
  account: PublicAccount;
  onLogout: () => void;
}

export default function Leaderboard({ account, onLogout }: Props) {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    getLeaderboard(50).then(setEntries).catch(() => {});
  }, []);

  const medalColor = (rank: number) => {
    if (rank === 1) return '#f0c95a';
    if (rank === 2) return '#c0c0c0';
    if (rank === 3) return '#cd7f32';
    return 'var(--text-dim)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', borderBottom: '1px solid var(--border)' }}>
        <h1 className="title" style={{ fontSize: 22 }}>排行榜</h1>
        <div style={{ display: 'flex', gap: 16 }}>
          <button className="btn" style={{ padding: '6px 16px', fontSize: 13 }} onClick={() => navigate('/')}>返回大厅</button>
          <button className="btn" style={{ padding: '6px 16px', fontSize: 13 }} onClick={onLogout}>退出</button>
        </div>
      </div>

      <div style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
        <div className="card" style={{ maxWidth: 700, margin: '0 auto', padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 100px 100px', padding: '12px 16px', borderBottom: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: 13 }}>
            <span>排名</span>
            <span>游戏ID</span>
            <span style={{ textAlign: 'right' }}>气运值</span>
            <span style={{ textAlign: 'right' }}>胜场</span>
          </div>
          {entries.map((e) => (
            <div
              key={e.rank}
              style={{
                display: 'grid',
                gridTemplateColumns: '60px 1fr 100px 100px',
                padding: '14px 16px',
                borderBottom: '1px solid rgba(212,168,67,0.1)',
                alignItems: 'center',
                background: e.gameId === account.gameId ? 'rgba(212,168,67,0.08)' : 'transparent',
              }}
            >
              <span style={{ color: medalColor(e.rank), fontWeight: 'bold', fontSize: e.rank <= 3 ? 18 : 14, textShadow: e.rank <= 3 ? `0 0 8px ${medalColor(e.rank)}` : 'none' }}>
                {e.rank}
              </span>
              <span style={{ color: e.gameId === account.gameId ? 'var(--gold-bright)' : 'var(--text)' }}>
                {e.gameId}
                {e.gameId === account.gameId && <span style={{ color: 'var(--text-dim)', marginLeft: 8, fontSize: 12 }}>（我）</span>}
              </span>
              <span style={{ textAlign: 'right', color: 'var(--gold)' }}>{e.luck}</span>
              <span style={{ textAlign: 'right', color: 'var(--text-dim)' }}>{e.wins}</span>
            </div>
          ))}
          {entries.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>暂无数据</div>
          )}
        </div>

        {/* Personal stats */}
        <div className="card" style={{ maxWidth: 700, margin: '24px auto 0', padding: 24 }}>
          <h3 className="title" style={{ fontSize: 16, marginBottom: 16 }}>个人主页</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>游戏ID</div>
              <div style={{ color: 'var(--gold)', fontSize: 18 }}>{account.gameId}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>气运值</div>
              <div style={{ color: 'var(--gold)', fontSize: 18 }}>{account.luck}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>胜场</div>
              <div style={{ color: 'var(--gold)', fontSize: 18 }}>{account.wins}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
