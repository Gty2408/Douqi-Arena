import { describe, it, expect } from 'vitest';
import { PieceRules } from '../src/pieces.js';
import { renamePiece } from '../src/rename.js';
import type { Piece } from '../src/types.js';

const rules = PieceRules.load();

function makePiece(): Piece {
  return {
    id: 'test',
    type: 'blank',
    side: 'red',
    name: '白板',
    attributes: { rank: 0 },
    alive: true,
    position: null,
  };
}

describe('renamePiece', () => {
  it('renames piece with valid name (<=3 chars)', () => {
    const p = makePiece();
    expect(renamePiece(p, '先锋', rules)).toBe(true);
    expect(p.name).toBe('先锋');
  });

  it('rejects empty name', () => {
    const p = makePiece();
    expect(renamePiece(p, '', rules)).toBe(false);
  });

  it('rejects name longer than 3 chars', () => {
    const p = makePiece();
    expect(renamePiece(p, '一二三四', rules)).toBe(false);
  });

  it('allows exactly 3 chars', () => {
    const p = makePiece();
    expect(renamePiece(p, '大将军', rules)).toBe(true);
    expect(p.name).toBe('大将军');
  });

  it('allows renaming multiple times freely', () => {
    const p = makePiece();
    renamePiece(p, '甲', rules);
    expect(p.name).toBe('甲');
    renamePiece(p, '乙', rules);
    expect(p.name).toBe('乙');
  });
});
