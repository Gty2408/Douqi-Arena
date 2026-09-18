import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { BoardCell, BoardConfig, CellType, Position, Side } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class Board {
  readonly rows: number;
  readonly cols: number;
  private cells: Map<string, BoardCell>;

  constructor(config: BoardConfig) {
    this.rows = config.rows;
    this.cols = config.cols;
    this.cells = new Map();
    for (const c of config.cells) {
      this.cells.set(this.key(c.row, c.col), { row: c.row, col: c.col, type: c.type });
    }
  }

  static load(path?: string): Board {
    const configPath = path ?? join(__dirname, '..', 'data', 'board-config.json');
    const raw = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw) as BoardConfig;
    return new Board(config);
  }

  private key(row: number, col: number): string {
    return `${row},${col}`;
  }

  getCell(pos: Position): BoardCell | undefined {
    return this.cells.get(this.key(pos.row, pos.col));
  }

  getCellType(pos: Position): CellType | undefined {
    return this.cells.get(this.key(pos.row, pos.col))?.type;
  }

  inBounds(pos: Position): boolean {
    return pos.row >= 0 && pos.row < this.rows && pos.col >= 0 && pos.col < this.cols;
  }

  /** Orthogonally adjacent positions that are in bounds. */
  getAdjacent(pos: Position): Position[] {
    const dirs = [
      { row: -1, col: 0 },
      { row: 1, col: 0 },
      { row: 0, col: -1 },
      { row: 0, col: 1 },
    ];
    const result: Position[] = [];
    for (const d of dirs) {
      const p = { row: pos.row + d.row, col: pos.col + d.col };
      if (this.inBounds(p)) result.push(p);
    }
    return result;
  }

  /**
   * Return all cells in a straight line (same row or same column) starting from
   * `pos` in direction `dr`,`dc`, stopping at the first occupied cell.
   * Used for railway movement.
   */
  getLineCells(
    pos: Position,
    dr: number,
    dc: number,
    isOccupied: (p: Position) => boolean,
  ): Position[] {
    const cells: Position[] = [];
    let r = pos.row + dr;
    let c = pos.col + dc;
    while (r >= 0 && r < this.rows && c >= 0 && c < this.cols) {
      const p = { row: r, col: c };
      if (isOccupied(p)) break;
      cells.push(p);
      r += dr;
      c += dc;
    }
    return cells;
  }

  /** Returns the back row index for a given side. */
  getBackRow(side: Side): number {
    return side === 'red' ? 0 : this.rows - 1;
  }

  /** Returns the rows that count as "last two rows" for mine placement. */
  getMineRows(side: Side): number[] {
    if (side === 'red') return [0, 1];
    return [this.rows - 1, this.rows - 2];
  }

  /** Returns the forbidden first row for bomb placement. */
  getForbiddenBombRow(side: Side): number {
    return side === 'red' ? 0 : this.rows - 1;
  }

  /** Returns all camp positions. */
  getCampPositions(): Position[] {
    const camps: Position[] = [];
    for (const cell of this.cells.values()) {
      if (cell.type === 'camp') camps.push({ row: cell.row, col: cell.col });
    }
    return camps;
  }

  /** Returns all base positions. */
  getBasePositions(): Position[] {
    const bases: Position[] = [];
    for (const cell of this.cells.values()) {
      if (cell.type === 'base') bases.push({ row: cell.row, col: cell.col });
    }
    return bases;
  }

  /** Returns base positions for a specific side. */
  getBasePositionsFor(side: Side): Position[] {
    return this.getBasePositions().filter((p) => p.row === this.getBackRow(side));
  }

  posKey(pos: Position): string {
    return this.key(pos.row, pos.col);
  }
}
