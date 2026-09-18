// Client-side type mirrors of the engine + server types.

export type Side = 'red' | 'blue';
export type PieceType = 'flag' | 'mine' | 'bomb' | 'sapper' | 'blank';
export type CellType = 'road' | 'railway' | 'camp' | 'base';
export type GamePhase = 'setup' | 'playing' | 'ended';

export interface Position {
  row: number;
  col: number;
}

export interface PieceAttributes {
  rank: number;
  [key: string]: unknown;
}

export interface VisiblePiece {
  id: string;
  type: PieceType;
  side: Side;
  name: string;
  attributes: PieceAttributes;
  alive: boolean;
  position: Position | null;
}

export interface HiddenPiece {
  id: string;
  side: Side;
  alive: boolean;
  position: Position | null;
  revealedType?: PieceType;
}

export interface VisibleState {
  phase: GamePhase;
  turn: Side;
  yourSide: Side;
  pieces: VisiblePiece[];
  enemyPieces: HiddenPiece[];
  winner: Side | null;
  remainingPoints: number;
}

export interface CombatNotification {
  type: 'attacker_wins' | 'defender_wins' | 'mutual' | 'flag_captured';
  attackerId: string;
  defenderId: string;
  attackerSide: Side;
  defenderSide: Side;
  capturerSide?: Side;
}

export interface LayoutEntry {
  pieceId: string;
  position: Position;
}

export interface RoomPlayerInfo {
  gameId: string;
  side: Side;
  ready: boolean;
  connected: boolean;
}

export interface RoomState {
  code: string;
  host: string;
  status: 'waiting' | 'ready' | 'playing' | 'ended';
  players: RoomPlayerInfo[];
}

export interface LeaderboardEntry {
  rank: number;
  gameId: string;
  luck: number;
  wins: number;
}

export interface PublicAccount {
  username: string;
  gameId: string;
  luck: number;
  wins: number;
}
