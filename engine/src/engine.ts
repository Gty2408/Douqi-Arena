import { Board } from './board.js';
import { resolveCombat } from './combat.js';
import { applyLevelAllocation, validateLayout, validateLevelAllocation } from './layout.js';
import { getValidMoves } from './movement.js';
import { PieceFactory, PieceRules } from './pieces.js';
import { renamePiece } from './rename.js';
import { buildCombatNotification, serializeStateFor } from './serialization.js';
import type {
  CombatNotification,
} from './serialization.js';
import type {
  GameState,
  LayoutEntry,
  Piece,
  Position,
  Side,
  VisibleState,
} from './types.js';

export interface MoveOutcome {
  ok: boolean;
  error?: string;
  combat?: CombatNotification;
  winner?: Side;
}

export class GameEngine {
  readonly board: Board;
  readonly rules: PieceRules;
  private factory: PieceFactory;
  state: GameState;
  private pieces: Piece[];

  constructor(board?: Board, rules?: PieceRules) {
    this.board = board ?? Board.load();
    this.rules = rules ?? PieceRules.load();
    this.factory = new PieceFactory(this.rules);
    this.pieces = [...this.factory.createPieces('red'), ...this.factory.createPieces('blue')];
    this.state = {
      phase: 'setup',
      turn: 'red',
      pieces: this.pieces,
      winner: null,
      levelAllocations: {},
      remainingPoints: { red: this.rules.levelBudget, blue: this.rules.levelBudget },
    };
  }

  getPieces(side: Side): Piece[] {
    return this.pieces.filter((p) => p.side === side);
  }

  getPieceAt(pos: Position): Piece | null {
    return this.pieces.find((p) => p.alive && p.position?.row === pos.row && p.position?.col === pos.col) ?? null;
  }

  /** Submit a layout for a side. Validates then places pieces. */
  submitLayout(side: Side, layout: LayoutEntry[]): { ok: boolean; errors: string[] } {
    if (this.state.phase !== 'setup') return { ok: false, errors: ['非布阵阶段'] };
    const sidePieces = this.getPieces(side);
    const validation = validateLayout(layout, sidePieces, side, this.board);
    if (!validation.valid) return { ok: false, errors: validation.errors };

    for (const entry of layout) {
      const piece = this.pieces.find((p) => p.id === entry.pieceId);
      if (piece) piece.position = { ...entry.position };
    }
    return { ok: true, errors: [] };
  }

  /** Allocate level points to blank pieces for a side. */
  allocateLevels(side: Side, allocations: Record<string, number>): { ok: boolean; errors: string[] } {
    if (this.state.phase !== 'setup') return { ok: false, errors: ['非布阵阶段'] };
    const sidePieces = this.getPieces(side);
    const validation = validateLevelAllocation(allocations, sidePieces, this.rules);
    if (!validation.valid) return { ok: false, errors: validation.errors };

    applyLevelAllocation(allocations, sidePieces);
    this.state.levelAllocations = { ...this.state.levelAllocations, ...allocations };
    const used = Object.values(allocations).reduce((s, v) => s + v, 0);
    this.state.remainingPoints[side] = this.rules.levelBudget - used;
    return { ok: true, errors: [] };
  }

  /** Rename a piece (only the owner can rename their pieces). */
  rename(side: Side, pieceId: string, newName: string): { ok: boolean; error?: string } {
    const piece = this.pieces.find((p) => p.id === pieceId);
    if (!piece) return { ok: false, error: '棋子不存在' };
    if (piece.side !== side) return { ok: false, error: '只能改名己方棋子' };
    const ok = renamePiece(piece, newName, this.rules);
    return ok ? { ok: true } : { ok: false, error: '名字长度需在 1-3 字之间' };
  }

  /** Start the game once both sides have submitted layouts. */
  start(): { ok: boolean; error?: string } {
    if (this.state.phase !== 'setup') return { ok: false, error: '非布阵阶段' };
    this.state.phase = 'playing';
    this.state.turn = 'red';
    return { ok: true };
  }

  /** Get valid moves for a piece (used by the server to validate client moves). */
  getValidMovesFor(pieceId: string): Position[] {
    const piece = this.pieces.find((p) => p.id === pieceId);
    if (!piece || !piece.alive || !piece.position) return [];
    return getValidMoves(this.board, piece, (p) => this.getPieceAt(p), this.rules);
  }

  /** Execute a move. Returns the outcome including combat result. */
  move(side: Side, from: Position, to: Position): MoveOutcome {
    if (this.state.phase !== 'playing') return { ok: false, error: '对局未开始' };
    if (this.state.turn !== side) return { ok: false, error: '非你的回合' };

    const piece = this.getPieceAt(from);
    if (!piece) return { ok: false, error: '起始位置无棋子' };
    if (piece.side !== side) return { ok: false, error: '不能操作敌方棋子' };

    const validMoves = this.getValidMovesFor(piece.id);
    const isValid = validMoves.some((m) => m.row === to.row && m.col === to.col);
    if (!isValid) return { ok: false, error: '非法移动' };

    const defender = this.getPieceAt(to);

    if (defender) {
      // Combat.
      const combatResult = resolveCombat(piece, defender);
      // Reveal types to both sides after combat.
      piece.revealedType = piece.type;
      defender.revealedType = defender.type;

      switch (combatResult.type) {
        case 'attacker_wins':
          defender.alive = false;
          defender.position = null;
          piece.position = { ...to };
          break;
        case 'defender_wins':
          piece.alive = false;
          piece.position = null;
          break;
        case 'mutual':
          piece.alive = false;
          piece.position = null;
          defender.alive = false;
          defender.position = null;
          break;
        case 'flag_captured':
          defender.alive = false;
          defender.position = null;
          piece.position = { ...to };
          this.state.phase = 'ended';
          this.state.winner = piece.side;
          break;
      }

      const notif = buildCombatNotification(piece, defender, combatResult.type);
      // Switch turn.
      this.state.turn = side === 'red' ? 'blue' : 'red';
      return {
        ok: true,
        combat: notif,
        winner: this.state.winner ?? undefined,
      };
    } else {
      // Plain move.
      piece.position = { ...to };
      this.state.turn = side === 'red' ? 'blue' : 'red';
      return { ok: true };
    }
  }

  /** Serialize the visible state for a side (dark-chess isolation). */
  getStateFor(side: Side): VisibleState {
    return serializeStateFor(this.state, side);
  }
}
