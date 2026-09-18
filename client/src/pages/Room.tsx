import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getSocket } from '../socket';
import type { PublicAccount, RoomState } from '../types';

interface Props {
  account: PublicAccount;
}

export default function Room({ account }: Props) {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const socket = getSocket();
  const [room, setRoom] = useState<RoomState | null>(null);
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    socket.emit('room:join', code);
    socket.on('room:state', (state: RoomState) => {
      setRoom(state);
      setIsHost(state.host === account.username || state.players.some((p) => p.gameId === account.gameId && state.host === account.username));
    });
    socket.on('room:error', ({ error }: { error: string }) => {
      alert(error);
      navigate('/');
    });
    // If game starts, navigate to game page.
    const onGameState = () => navigate(`/game/${code}`);
    socket.on('game:state', onGameState);

    return () => {
      socket.off('room:state');
      socket.off('room:error');
      socket.off('game:state', onGameState);
    };
  }, [socket, code, account.username, account.gameId, navigate]);

  // Determine if current player is the host (host username stored in room.host)
  useEffect(() => {
    if (room) {
      setIsHost(room.host === account.username);
    }
  }, [room, account.username]);

  const handleReady = () => {
    socket.emit('room:ready', true);
  };

  const handleLeave = () => {
    socket.emit('room:leave');
    navigate('/');
  };

  if (!room) {
    return <div style={{ padding: 40, color: 'var(--text-dim)' }}>加载中...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', borderBottom: '1px solid var(--border)' }}>
        <h1 className="title" style={{ fontSize: 22 }}>房间等待</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: 'var(--gold)', letterSpacing: 4, fontSize: 18 }}>房间码: {room.code}</span>
          <button className="btn" style={{ padding: '6px 16px', fontSize: 13 }} onClick={handleLeave}>离开</button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 48 }}>
        {room.players.map((p) => (
          <div key={p.gameId} className="card" style={{ width: 280, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16, color: p.side === 'red' ? '#c94a2e' : '#4a9ebb' }}>
              {p.side === 'red' ? '红' : '蓝'}
            </div>
            <div style={{ fontSize: 20, color: 'var(--gold)', marginBottom: 8 }}>{p.gameId}</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              {p.connected ? '已连接' : '已断开'}
            </div>
            <div style={{ marginTop: 16, padding: '6px 0', borderRadius: 3, fontSize: 13,
              background: p.ready ? 'rgba(74, 158, 187, 0.2)' : 'rgba(138, 128, 112, 0.1)',
              color: p.ready ? 'var(--blue-glow)' : 'var(--text-dim)' }}>
              {p.ready ? '已准备' : '等待中'}
            </div>
          </div>
        ))}
        {room.players.length < 2 && (
          <div className="card" style={{ width: 280, padding: 32, textAlign: 'center', opacity: 0.5 }}>
            <div style={{ fontSize: 48, marginBottom: 16, color: 'var(--text-dim)' }}>?</div>
            <div style={{ color: 'var(--text-dim)' }}>等待玩家加入...</div>
          </div>
        )}
      </div>

      <div style={{ padding: 24, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center' }}>
        {!room.players.find((p) => p.gameId === account.gameId)?.ready ? (
          <button className="btn btn-primary" style={{ padding: '12px 48px', fontSize: 16 }} onClick={handleReady}>
            准 备
          </button>
        ) : (
          <div style={{ color: 'var(--blue-glow)', fontSize: 16 }}>已准备，等待对手...</div>
        )}
      </div>
    </div>
  );
}
