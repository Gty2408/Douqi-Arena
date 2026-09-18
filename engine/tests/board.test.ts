import { describe, it, expect } from 'vitest';
import { Board } from '../src/board.js';

describe('Board', () => {
  const board = Board.load();

  it('has 12 rows and 5 columns (60 cells)', () => {
    expect(board.rows).toBe(12);
    expect(board.cols).toBe(5);
    let count = 0;
    for (let r = 0; r < 12; r++) {
      for (let c = 0; c < 5; c++) {
        if (board.getCell({ row: r, col: c })) count++;
      }
    }
    expect(count).toBe(60);
  });

  it('has exactly 4 base cells (2 per side)', () => {
    const bases = board.getBasePositions();
    expect(bases.length).toBe(4);
    // Bases at row 0 (red) and row 11 (blue)
    const redBases = board.getBasePositionsFor('red');
    const blueBases = board.getBasePositionsFor('blue');
    expect(redBases.length).toBe(2);
    expect(blueBases.length).toBe(2);
    expect(redBases.every((p) => p.row === 0)).toBe(true);
    expect(blueBases.every((p) => p.row === 11)).toBe(true);
  });

  it('has camp cells in symmetric positions', () => {
    const camps = board.getCampPositions();
    expect(camps.length).toBeGreaterThan(0);
    // Camps should be symmetric top-bottom.
    for (const camp of camps) {
      const mirror = { row: 11 - camp.row, col: camp.col };
      const hasMirror = camps.some((c) => c.row === mirror.row && c.col === mirror.col);
      expect(hasMirror).toBe(true);
    }
  });

  it('returns correct cell types', () => {
    // Bases
    expect(board.getCellType({ row: 0, col: 1 })).toBe('base');
    expect(board.getCellType({ row: 11, col: 3 })).toBe('base');
    // Railway
    expect(board.getCellType({ row: 1, col: 2 })).toBe('railway');
    expect(board.getCellType({ row: 5, col: 0 })).toBe('railway');
    // Road
    expect(board.getCellType({ row: 2, col: 2 })).toBe('road');
    // Camp
    expect(board.getCellType({ row: 2, col: 1 })).toBe('camp');
  });

  it('getAdjacent returns orthogonal neighbors in bounds', () => {
    const adj = board.getAdjacent({ row: 0, col: 0 });
    expect(adj.length).toBe(2); // right and down
    const adj2 = board.getAdjacent({ row: 5, col: 2 });
    expect(adj2.length).toBe(4); // all four
  });
});
