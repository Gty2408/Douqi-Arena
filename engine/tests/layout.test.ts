import { describe, it, expect } from 'vitest';
import { Board } from '../src/board.js';
import { applyLevelAllocation, validateLayout, validateLevelAllocation } from '../src/layout.js';
import { PieceFactory, PieceRules } from '../src/pieces.js';
import type { LayoutEntry, Piece, Side } from '../src/types.js';

const board = Board.load();
const rules = PieceRules.load();
const factory = new PieceFactory(rules);

function makePieces(side: Side): Piece[] {
  return factory.createPieces(side);
}

/** Build a valid layout for a side: flag in base, mines in last 2 rows, etc. */
function buildValidLayout(side: Side, pieces: Piece[]): LayoutEntry[] {
  const layout: LayoutEntry[] = [];
  const bases = board.getBasePositionsFor(side);
  const mineRows = board.getMineRows(side);
  const forbiddenBombRow = board.getForbiddenBombRow(side);
  const camps = new Set(board.getCampPositions().map((p) => `${p.row},${p.col}`));

  // Place flag in first base.
  const flag = pieces.find((p) => p.type === 'flag')!;
  layout.push({ pieceId: flag.id, position: bases[0] });

  // Place mines in mine rows.
  const mines = pieces.filter((p) => p.type === 'mine');
  let mineIdx = 0;
  for (const r of mineRows) {
    for (let c = 0; c < 5 && mineIdx < mines.length; c++) {
      const key = `${r},${c}`;
      if (camps.has(key)) continue;
      if (bases.some((b) => b.row === r && b.col === c)) continue;
      layout.push({ pieceId: mines[mineIdx].id, position: { row: r, col: c } });
      mineIdx++;
    }
  }

  // Place bombs not in forbidden row.
  const bombs = pieces.filter((p) => p.type === 'bomb');
  const otherPieces = pieces.filter(
    (p) => p.type !== 'flag' && p.type !== 'mine' && p.type !== 'bomb',
  );

  const placedPos = new Set(layout.map((e) => `${e.position.row},${e.position.col}`));
  const toPlace = [...bombs, ...otherPieces];
  let idx = 0;
  for (let r = 0; r < 12 && idx < toPlace.length; r++) {
    for (let c = 0; c < 5 && idx < toPlace.length; c++) {
      const key = `${r},${c}`;
      if (placedPos.has(key)) continue;
      if (camps.has(key)) continue;
      if (bases.some((b) => b.row === r && b.col === c)) continue;
      // Bombs cannot be in forbidden row.
      if (toPlace[idx].type === 'bomb' && r === forbiddenBombRow) continue;
      layout.push({ pieceId: toPlace[idx].id, position: { row: r, col: c } });
      placedPos.add(key);
      idx++;
    }
  }

  return layout;
}

describe('validateLayout', () => {
  it('accepts a valid layout', () => {
    const pieces = makePieces('red');
    const layout = buildValidLayout('red', pieces);
    const result = validateLayout(layout, pieces, 'red', board);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects layout when flag is not in base', () => {
    const pieces = makePieces('red');
    const layout = buildValidLayout('red', pieces);
    // Move flag out of base.
    const flagEntry = layout.find((e) => pieces.find((p) => p.id === e.pieceId)?.type === 'flag')!;
    flagEntry.position = { row: 2, col: 2 };
    const result = validateLayout(layout, pieces, 'red', board);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('军旗'))).toBe(true);
  });

  it('rejects layout when mine is not in last two rows', () => {
    const pieces = makePieces('red');
    const layout = buildValidLayout('red', pieces);
    const mineEntry = layout.find((e) => pieces.find((p) => p.id === e.pieceId)?.type === 'mine')!;
    mineEntry.position = { row: 5, col: 0 }; // not in rows 0-1
    const result = validateLayout(layout, pieces, 'red', board);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('地雷'))).toBe(true);
  });

  it('rejects layout when bomb is in first row', () => {
    const pieces = makePieces('red');
    const layout = buildValidLayout('red', pieces);
    const bombEntry = layout.find((e) => pieces.find((p) => p.id === e.pieceId)?.type === 'bomb')!;
    bombEntry.position = { row: 0, col: 0 };
    const result = validateLayout(layout, pieces, 'red', board);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('炸弹'))).toBe(true);
  });

  it('rejects layout when a piece is in a camp', () => {
    const pieces = makePieces('red');
    const layout = buildValidLayout('red', pieces);
    const camps = board.getCampPositions();
    // Place a blank piece in a camp.
    const blankEntry = layout.find((e) => pieces.find((p) => p.id === e.pieceId)?.type === 'blank')!;
    blankEntry.position = camps[0];
    const result = validateLayout(layout, pieces, 'red', board);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('行营'))).toBe(true);
  });
});

describe('validateLevelAllocation', () => {
  it('accepts allocation within budget and range', () => {
    const pieces = makePieces('red');
    const blanks = pieces.filter((p) => p.type === 'blank');
    const allocations: Record<string, number> = {};
    for (const b of blanks.slice(0, 10)) allocations[b.id] = 9;
    const result = validateLevelAllocation(allocations, pieces, rules);
    expect(result.valid).toBe(true);
  });

  it('rejects allocation exceeding budget', () => {
    const pieces = makePieces('red');
    const blanks = pieces.filter((p) => p.type === 'blank');
    const allocations: Record<string, number> = {};
    for (const b of blanks) allocations[b.id] = 9; // 16 * 9 = 144 > 100
    const result = validateLevelAllocation(allocations, pieces, rules);
    expect(result.valid).toBe(false);
  });

  it('rejects rank out of range', () => {
    const pieces = makePieces('red');
    const blanks = pieces.filter((p) => p.type === 'blank');
    const allocations: Record<string, number> = { [blanks[0].id]: 15 };
    const result = validateLevelAllocation(allocations, pieces, rules);
    expect(result.valid).toBe(false);
  });

  it('applies allocation to piece attributes', () => {
    const pieces = makePieces('red');
    const blanks = pieces.filter((p) => p.type === 'blank');
    const allocations: Record<string, number> = { [blanks[0].id]: 7 };
    applyLevelAllocation(allocations, pieces);
    expect(blanks[0].attributes.rank).toBe(7);
  });
});
