// Core type definitions for the Junqi game engine.
// All fields are designed to be extensible for the future "斗棋竞技场" system.

/** Which side a piece belongs to. */
export type Side = 'red' | 'blue';

/** The type of a board cell. */
export type CellType = 'road' | 'railway' | 'camp' | 'base';

/**
 * Piece type identifiers.
 * Special pieces have fixed behavior; 'blank' is the customizable placeholder
 * that will later become multi-attribute custom pieces.
 */
export type PieceType = 'flag' | 'mine' | 'bomb' | 'sapper' | 'blank';

/**
 * Extensible piece attributes.
 * In v1 only `rank` (0-9) is used for blank pieces.
 * Future versions may add attack, speed, armor, crit, rune effects, etc.
 */
export interface PieceAttributes {
  rank: number;
  [key: string]: unknown;
}

/** A single piece instance on the board. */
export interface Piece {
  id: string;
  type: PieceType;
  side: Side;
  name: string;
  attributes: PieceAttributes;
  /** Whether this piece is still alive. */
  alive: boolean;
  /** Current board position, null if captured / not placed. */
  position: Position | null;
  /** Set after the piece is involved in a combat, so the opponent learns its type. */
  revealedType?: PieceType;
}

/** A position on the 12x5 board. row 0-11, col 0-4. */
export interface Position {
  row: number;
  col: number;
}

/** A single cell in the board config. */
export interface BoardCellConfig {
  row: number;
  col: number;
  type: CellType;
}

/** Board configuration loaded from board-config.json. */
export interface BoardConfig {
  rows: number;
  cols: number;
  cells: BoardCellConfig[];
}

/** Runtime board cell with connection info. */
export interface BoardCell {
  row: number;
  col: number;
  type: CellType;
}

/** Result of a combat resolution. */
export type CombatResultType =
  | 'attacker_wins'   // attacker survives, defender dies
  | 'defender_wins'   // defender survives, attacker dies
  | 'mutual'          // both die
  | 'flag_captured';  // defender was the flag -> game over

export interface CombatResult {
  type: CombatResultType;
  attackerId: string;
  defenderId: string;
}

/** A layout entry mapping a piece id to a board position. */
export interface LayoutEntry {
  pieceId: string;
  position: Position;
}

/** Result of layout validation. */
export interface LayoutValidationResult {
  valid: boolean;
  errors: string[];
}

/** Game phase. */
export type GamePhase = 'setup' | 'playing' | 'ended';

/** The full game state. */
export interface GameState {
  phase: GamePhase;
  turn: Side;
  pieces: Piece[];
  winner: Side | null;
  /** Map of pieceId -> allocated rank for blank pieces. */
  levelAllocations: Record<string, number>;
  /** Remaining level points per side. */
  remainingPoints: Record<Side, number>;
}

/** Visible piece data sent to a player (own pieces fully visible). */
export interface VisiblePiece {
  id: string;
  type: PieceType;
  side: Side;
  name: string;
  attributes: PieceAttributes;
  alive: boolean;
  position: Position | null;
}

/** Hidden piece placeholder sent to the opponent. */
export interface HiddenPiece {
  id: string;
  side: Side;
  alive: boolean;
  position: Position | null;
  /** Revealed type only after a combat involving this piece. */
  revealedType?: PieceType;
}

/** State visible to a specific side. */
export interface VisibleState {
  phase: GamePhase;
  turn: Side;
  yourSide: Side;
  pieces: VisiblePiece[];
  enemyPieces: HiddenPiece[];
  winner: Side | null;
  remainingPoints: number;
}
