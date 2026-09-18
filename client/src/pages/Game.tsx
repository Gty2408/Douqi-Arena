import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getSocket } from '../socket';
import { BOARD_COLS, BOARD_ROWS, getCellType } from '../boardConfig';
import BoardCanvas from '../components/BoardCanvas';
import type {
  CombatNotification,
  LayoutEntry,
  Position,
  PublicAccount,
  Side,
  VisiblePiece,
  VisibleState,
} from '../types';

interface Props {
  account: PublicAccount;
}

const BOARD_W = 360;
const BOARD_H = 820;
const PADDING = 40;
const CELL_W = (BOARD_W - PADDING * 2) / BOARD_COLS;
const CELL_H = (BOARD_H - PADDING * 2) / BOARD_ROWS;

function posToPixel(row: number, col: number) {
  return { x: PADDING + col * CELL_W + CELL_W / 2, y: PADDING + row * CELL_H + CELL_H / 2 };
}

function pixelToPos(x: number, y: number): Position | null {
  const col = Math.round((x - PADDING - CELL_W / 2) / CELL_W);
  const row = Math.round((y - PADDING - CELL_H / 2) / CELL_H);
  if (row < 0 || row >= BOARD_ROWS || col < 0 || col >= BOARD_COLS) return null;
  return { row, col };
}

/**
 * Client-side valid moves computation (mirrors engine logic for UI feedback).
 * The server is the authoritative validator.
 */
function computeValidMoves(
  piece: VisiblePiece,
  ownPieces: VisiblePiece[],
  enemyPositions: Position[],
): Position[] {
  if (!piece.position) return [];
  const type = piece.type;
  const movable = type !== 'flag' && type !== 'mine';
  if (!movable) return [];

  const from = piece.position;
  const moves = new Set<string>();
  const add = (p: Position) => moves.add(`${p.row},${p.col}`);

  const allOccupied = new Map<string, 'own' | 'enemy'>();
  for (const p of ownPieces) {
    if (p.position && p.id !== piece.id) allOccupied.set(`${p.position.row},${p.position.col}`, 'own');
  }
  for (const ep of enemyPositions) {
    allOccupied.set(`${ep.row},${ep.col}`, 'enemy');
  }

  const isCamp = (r: number, c: number) => getCellType(r, c) === 'camp';

  // Road: one step
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of dirs) {
    const r = from.row + dr;
    const c = from.col + dc;
    if (r < 0 || r >= BOARD_ROWS || c < 0 || c >= BOARD_COLS) continue;
    const occ = allOccupied.get(`${r},${c}`);
    if (occ === 'own') continue;
    if (occ === 'enemy' && isCamp(r, c)) continue;
    add({ row: r, col: c });
  }

  // Railway
  if (getCellType(from.row, from.col) === 'railway') {
    const isSapper = type === 'sapper';
    if (isSapper) {
      // BFS over railway network
      const visited = new Set<string>();
      const queue: Position[] = [from];
      visited.add(`${from.row},${from.col}`);
      while (queue.length) {
        const cur = queue.shift()!;
        for (const [dr, dc] of dirs) {
          const r = cur.row + dr;
          const c = cur.col + dc;
          if (r < 0 || r >= BOARD_ROWS || c < 0 || c >= BOARD_COLS) continue;
          const key = `${r},${c}`;
          if (visited.has(key)) continue;
          if (getCellType(r, c) !== 'railway') continue;
          const occ = allOccupied.get(key);
          if (occ) {
            if (occ === 'enemy' && !isCamp(r, c)) add({ row: r, col: c });
            visited.add(key);
            continue;
          }
          visited.add(key);
          add({ row: r, col: c });
          queue.push({ row: r, col: c });
        }
      }
    } else {
      // Straight lines
      for (const [dr, dc] of dirs) {
        let r = from.row + dr;
        let c = from.col + dc;
        while (r >= 0 && r < BOARD_ROWS && c >= 0 && c < BOARD_COLS) {
          const key = `${r},${c}`;
          if (getCellType(r, c) !== 'railway') break;
          const occ = allOccupied.get(key);
          if (occ) {
            if (occ === 'enemy' && !isCamp(r, c)) add({ row: r, col: c });
            break;
          }
          add({ row: r, col: c });
          r += dr;
          c += dc;
        }
      }
    }
  }

  moves.delete(`${from.row},${from.col}`);
  return Array.from(moves).map((k) => {
    const [r, c] = k.split(',').map(Number);
    return { row: r, col: c };
  });
}

export default function Game({ account }: Props) {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const socket = getSocket();

  const [state, setState] = useState<VisibleState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [combat, setCombat] = useState<CombatNotification | null>(null);
  const [chat, setChat] = useState<Array<{ gameId: string; message: string }>>([]);
  const [chatInput, setChatInput] = useState('');

  // Setup phase local state
  const [layout, setLayout] = useState<Record<string, Position>>({});
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [setupStep, setSetupStep] = useState<'place' | 'levels'>('place');
  const [selectedPieceForPlace, setSelectedPieceForPlace] = useState<string | null>(null);

  const mySide: Side = state?.yourSide ?? 'red';

  useEffect(() => {
    const onState = (s: VisibleState) => {
      console.log('[Game] state received:', s.phase, 'own pieces:', s.pieces.length, 'with pos:', s.pieces.filter((p) => p.position).length, 'enemy with pos:', s.enemyPieces.filter((p) => p.position).length);
      setState(s);
    };
    const onCombat = (c: CombatNotification) => {
      setCombat(c);
      setTimeout(() => setCombat(null), 1500);
    };
    const onChat = (m: { gameId: string; message: string }) => setChat((prev) => [...prev.slice(-50), m]);
    const onEnded = ({ winner }: { winner: Side }) => {
      setTimeout(() => alert(winner === mySide ? '胜利！' : '失败...'), 100);
    };
    const onMoveError = ({ error }: { error: string }) => alert(error);

    socket.on('game:state', onState);
    socket.on('combat:result', onCombat);
    socket.on('chat:message', onChat);
    socket.on('game:ended', onEnded);
    socket.on('move:error', onMoveError);
    socket.on('layout:error', ({ errors }: { errors: string[] }) => alert('布局错误: ' + errors.join('; ')));

    // Join the room so the server sends us the game state. This supports
    // direct navigation to /game/:code (e.g. reconnect or page refresh).
    if (code) socket.emit('room:join', code);

    return () => {
      socket.off('game:state', onState);
      socket.off('combat:result', onCombat);
      socket.off('chat:message', onChat);
      socket.off('game:ended', onEnded);
      socket.off('move:error', onMoveError);
      socket.off('layout:error');
    };
  }, [socket, mySide, code]);

  // Auto-place a valid layout for convenience.
  const autoLayout = useCallback(() => {
    if (!state) return;
    const pieces = state.pieces;
    const backRow = mySide === 'red' ? 0 : 11;
    const mineRows = mySide === 'red' ? [0, 1] : [11, 10];
    const camps = new Set<string>();
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        if (getCellType(r, c) === 'camp') camps.add(`${r},${c}`);
      }
    }
    const baseCols = mySide === 'red' ? [1, 3] : [1, 3];
    const newLayout: Record<string, Position> = {};
    const placed = new Set<string>();

    const placeAt = (pieceId: string, row: number, col: number) => {
      const key = `${row},${col}`;
      if (placed.has(key) || camps.has(key)) return false;
      newLayout[pieceId] = { row, col };
      placed.add(key);
      return true;
    };

    // Flag in base
    const flag = pieces.find((p) => p.type === 'flag');
    if (flag) placeAt(flag.id, backRow, baseCols[0]);

    // Mines in mine rows
    const mines = pieces.filter((p) => p.type === 'mine');
    let mi = 0;
    for (const r of mineRows) {
      for (let c = 0; c < BOARD_COLS && mi < mines.length; c++) {
        if (placeAt(mines[mi].id, r, c)) mi++;
      }
    }

    // Fill remaining (bombs cannot go in the first row).
    // Place non-bomb pieces first so the back row isn't left with empty cells
    // when a bomb is skipped there.
    const rest = pieces.filter((p) => p.type !== 'flag' && p.type !== 'mine');
    const nonBombs = rest.filter((p) => p.type !== 'bomb');
    const bombs = rest.filter((p) => p.type === 'bomb');
    const orderedRest = [...nonBombs, ...bombs];
    let idx = 0;
    const rowOrder = mySide === 'red'
      ? Array.from({ length: BOARD_ROWS }, (_, i) => i)
      : Array.from({ length: BOARD_ROWS }, (_, i) => BOARD_ROWS - 1 - i);
    for (const r of rowOrder) {
      if (idx >= orderedRest.length) break;
      for (let c = 0; c < BOARD_COLS && idx < orderedRest.length; c++) {
        if (orderedRest[idx].type === 'bomb' && r === backRow) continue;
        if (placeAt(orderedRest[idx].id, r, c)) idx++;
      }
    }
    setLayout(newLayout);
  }, [state, mySide]);

  const submitLayout = () => {
    if (!state) return;
    const entries: LayoutEntry[] = Object.entries(layout).map(([pieceId, position]) => ({ pieceId, position }));
    // Send layout positions AND level allocations together.
    socket.emit('layout:submit', entries, levels);
  };

  // Valid moves for selected piece (playing phase)
  const validMoves = useMemo(() => {
    if (!state || !selectedId) return [];
    const piece = state.pieces.find((p) => p.id === selectedId);
    if (!piece || piece.side !== state.yourSide || !piece.position) return [];
    const enemyPositions = state.enemyPieces.filter((p) => p.position).map((p) => p.position!);
    return computeValidMoves(piece, state.pieces, enemyPositions);
  }, [state, selectedId]);

  const handleBoardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!state) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pos = pixelToPos(x, y);
    if (!pos) return;

    if (state.phase === 'setup') {
      // Setup: place selected piece
      if (!selectedPieceForPlace) return;
      setLayout((prev) => ({ ...prev, [selectedPieceForPlace]: pos }));
      setSelectedPieceForPlace(null);
      return;
    }

    if (state.phase !== 'playing') return;

    // Check if clicking own piece
    const clickedOwn = state.pieces.find(
      (p) => p.alive && p.position?.row === pos.row && p.position?.col === pos.col,
    );
    if (clickedOwn) {
      setSelectedId(clickedOwn.id);
      return;
    }

    // Otherwise try to move selected piece to pos
    if (selectedId) {
      const piece = state.pieces.find((p) => p.id === selectedId);
      if (piece?.position) {
        socket.emit('move', piece.position, pos);
      }
      setSelectedId(null);
    }
  };

  const handleRename = (pieceId: string) => {
    const name = prompt('输入新名字（1-3字）:');
    if (name) socket.emit('rename', pieceId, name);
  };

  const sendChat = () => {
    if (chatInput.trim()) {
      socket.emit('chat', chatInput.trim());
      setChatInput('');
    }
  };

  // Setup phase pieces not yet placed
  const unplacedPieces = state?.pieces.filter((p) => !layout[p.id]) ?? [];
  const placedPieces = state?.pieces.filter((p) => layout[p.id]) ?? [];

  // Total level points used
  const totalLevels = Object.values(levels).reduce((s, v) => s + v, 0);
  const remainingPoints = 100 - totalLevels;

  // Merge local layout positions into the visible state so the player can see
  // their placed pieces on the board during the setup phase.
  const displayState: VisibleState | null = useMemo(() => {
    if (!state) return null;
    if (state.phase !== 'setup') return state;
    const layoutByPiece = new Map(Object.entries(layout));
    return {
      ...state,
      pieces: state.pieces.map((p) => {
        const pos = layoutByPiece.get(p.id);
        return pos ? { ...p, position: pos } : p;
      }),
    };
  }, [state, layout]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 24px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <span style={{ color: '#c94a2e' }}>{state?.pieces.find((p) => p.side === 'red') ? '红方' : ''}</span>
          <span style={{ color: 'var(--gold)' }}>回合: {state?.turn === mySide ? '我方' : '对方'}</span>
          <span style={{ color: 'var(--text-dim)' }}>剩余棋子: {state?.pieces.filter((p) => p.alive).length ?? 0}</span>
        </div>
        <span className="title" style={{ fontSize: 18 }}>斗棋竞技场</span>
        <button className="btn" style={{ padding: '6px 16px', fontSize: 13 }} onClick={() => navigate('/')}>退出对局</button>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: reserved for future custom panels */}
        <div style={{ width: 200, padding: 16, borderRight: '1px solid var(--border)', opacity: 0.3 }}>
          <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>（后续：锻体/符文/气运值面板）</div>
        </div>

        {/* Center: board */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <div style={{ position: 'relative' }}>
            <BoardCanvas
              state={displayState ?? emptyState(mySide)}
              selectedPieceId={selectedId}
              validMoves={validMoves}
              combat={combat}
              width={BOARD_W}
              height={BOARD_H}
            />
            {/* Transparent interaction overlay */}
            <div
              onClick={handleBoardClick}
              style={{
                position: 'absolute',
                inset: 0,
                cursor: 'pointer',
              }}
            />
          </div>
        </div>

        {/* Right: operation panel */}
        <div className="card" style={{ width: 280, margin: 12, padding: 16, overflowY: 'auto' }}>
          {state?.phase === 'setup' && (
            <>
              <h3 className="title" style={{ fontSize: 16, marginBottom: 12 }}>布阵阶段</h3>
              <div style={{ marginBottom: 12 }}>
                <button className="btn" style={{ width: '100%', marginBottom: 8 }} onClick={autoLayout}>自动布阵</button>
                <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>点击棋子再点击棋盘放置</div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, marginBottom: 6 }}>
                  等级点: <span style={{ color: 'var(--gold)' }}>{remainingPoints}</span> / 100
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {placedPieces.filter((p) => p.type === 'blank').map((p) => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--bg-panel-light)', padding: '2px 6px', borderRadius: 3, fontSize: 12 }}>
                      <span>{p.name}</span>
                      <button style={{ background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer' }} onClick={() => setLevels((l) => ({ ...l, [p.id]: Math.max(0, (l[p.id] ?? 0) - 1) }))}>-</button>
                      <span style={{ color: 'var(--gold-bright)', minWidth: 14, textAlign: 'center' }}>{levels[p.id] ?? 0}</span>
                      <button style={{ background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer' }} onClick={() => setLevels((l) => ({ ...l, [p.id]: Math.min(9, (l[p.id] ?? 0) + 1) }))}>+</button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, marginBottom: 6 }}>未放置 ({unplacedPieces.length})</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
                  {unplacedPieces.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPieceForPlace(p.id)}
                      style={{
                        padding: '4px 8px',
                        background: selectedPieceForPlace === p.id ? 'rgba(212,168,67,0.3)' : 'var(--bg-panel-light)',
                        border: '1px solid var(--border)',
                        borderRadius: 3,
                        color: 'var(--text)',
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={unplacedPieces.length > 0}
                onClick={submitLayout}
              >
                确认布阵
              </button>
            </>
          )}

          {state?.phase === 'playing' && (
            <>
              <h3 className="title" style={{ fontSize: 16, marginBottom: 12 }}>对局中</h3>
              {selectedId && (() => {
                const p = state.pieces.find((x) => x.id === selectedId);
                if (!p) return null;
                return (
                  <div className="card" style={{ padding: 12, marginBottom: 12 }}>
                    <div style={{ color: 'var(--gold)', fontSize: 16, marginBottom: 4 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>类型: {p.type}</div>
                    {p.type === 'blank' && <div style={{ fontSize: 12, color: 'var(--gold-bright)' }}>等级: {p.attributes.rank}</div>}
                    <button className="btn" style={{ width: '100%', marginTop: 8, padding: '4px', fontSize: 12 }} onClick={() => handleRename(p.id)}>改名</button>
                  </div>
                );
              })()}
              {!selectedId && <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>点击己方棋子查看可移动位置</div>}
            </>
          )}

          {state?.phase === 'ended' && (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <div className="title" style={{ fontSize: 24, marginBottom: 12 }}>
                {state.winner === mySide ? '胜 利' : '失 败'}
              </div>
              <button className="btn" onClick={() => navigate('/')}>返回大厅</button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom chat bar */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '8px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, display: 'flex', gap: 8, maxHeight: 60, overflowY: 'auto' }}>
          {chat.slice(-3).map((m, i) => (
            <span key={i} style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              <span style={{ color: 'var(--gold)' }}>{m.gameId}</span>: {m.message}
            </span>
          ))}
        </div>
        <input
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendChat()}
          placeholder="聊天..."
          style={{ width: 200 }}
        />
        <button className="btn" style={{ padding: '6px 16px' }} onClick={sendChat}>发送</button>
      </div>
    </div>
  );
}

function emptyState(side: Side): VisibleState {
  return {
    phase: 'setup',
    turn: 'red',
    yourSide: side,
    pieces: [],
    enemyPieces: [],
    winner: null,
    remainingPoints: 100,
  };
}
