import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSocket } from '../socket';
import type { PublicAccount } from '../types';

interface Props {
  account: PublicAccount;
  onLogout: () => void;
}

interface RoomListItem {
  code: string;
  host: string;
  playerCount: number;
}

export default function Lobby({ account, onLogout }: Props) {
  const navigate = useNavigate();
  const socket = getSocket();
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    socket.emit('room:list');
    socket.on('room:list', (list: RoomListItem[]) => setRooms(list));
    return () => {
      socket.off('room:list');
    };
  }, [socket]);

  const handleCreate = () => {
    socket.emit('room:create');
    socket.once('room:created', ({ code }: { code: string }) => {
      navigate(`/room/${code}`);
    });
  };

  const handleJoin = () => {
    if (!joinCode.trim()) return;
    socket.emit('room:join', joinCode.trim().toUpperCase());
    socket.once('room:joined', ({ code }: { code: string }) => {
      navigate(`/room/${code}`);
    });
    socket.once('room:error', ({ error }: { error: string }) => {
      alert(error);
    });
  };

  const refresh = () => socket.emit('room:list');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', borderBottom: '1px solid var(--border)' }}>
        <h1 className="title" style={{ fontSize: 22 }}>斗棋竞技场</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <span style={{ color: 'var(--gold)' }}>{account.gameId}</span>
          <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>气运值: {account.luck} | 胜场: {account.wins}</span>
          <button className="btn" style={{ padding: '6px 16px', fontSize: 13 }} onClick={() => navigate('/leaderboard')}>排行榜</button>
          <button className="btn" style={{ padding: '6px 16px', fontSize: 13 }} onClick={onLogout}>退出</button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', padding: 32, gap: 32 }}>
        {/* Left: room list */}
        <div className="card" style={{ flex: 1, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 className="title" style={{ fontSize: 18 }}>房间列表</h2>
            <button className="btn" style={{ padding: '6px 14px', fontSize: 12 }} onClick={refresh}>刷新</button>
          </div>
          {rooms.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 40 }}>暂无房间，创建一个吧</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rooms.map((r) => (
                <div key={r.code} className="card" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ color: 'var(--gold)', fontWeight: 'bold' }}>{r.code}</span>
                    <span style={{ color: 'var(--text-dim)', marginLeft: 12, fontSize: 13 }}>房主: {r.host}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{r.playerCount}/2</span>
                    <button className="btn" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => { setJoinCode(r.code); handleJoin(); }}>加入</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: actions */}
        <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 24 }}>
            <h3 className="title" style={{ fontSize: 16, marginBottom: 16 }}>创建房间</h3>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleCreate}>
              创建新房间
            </button>
          </div>

          <div className="card" style={{ padding: 24 }}>
            <h3 className="title" style={{ fontSize: 16, marginBottom: 16 }}>加入房间</h3>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="输入房间码"
              style={{ width: '100%', marginBottom: 12, letterSpacing: 4, textAlign: 'center', fontSize: 18 }}
              maxLength={6}
            />
            <button className="btn" style={{ width: '100%' }} onClick={handleJoin}>加入</button>
          </div>
        </div>
      </div>
    </div>
  );
}
