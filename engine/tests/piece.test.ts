import { describe, it, expect } from 'vitest';
import { PieceFactory, PieceRules } from '../src/pieces.js';

describe('PieceFactory', () => {
  const rules = PieceRules.load();
  const factory = new PieceFactory(rules);

  it('creates 25 pieces per side', () => {
    const red = factory.createPieces('red');
    expect(red.length).toBe(25);
  });

  it('has correct counts for each type', () => {
    const red = factory.createPieces('red');
    const counts: Record<string, number> = {};
    for (const p of red) counts[p.type] = (counts[p.type] ?? 0) + 1;
    expect(counts.flag).toBe(1);
    expect(counts.mine).toBe(3);
    expect(counts.bomb).toBe(2);
    expect(counts.sapper).toBe(3);
    expect(counts.blank).toBe(16);
  });

  it('blank pieces default to rank 0', () => {
    const red = factory.createPieces('red');
    const blanks = red.filter((p) => p.type === 'blank');
    expect(blanks.length).toBe(16);
    for (const b of blanks) {
      expect(b.attributes.rank).toBe(0);
    }
  });

  it('default names are correct', () => {
    const red = factory.createPieces('red');
    const names = new Set(red.map((p) => p.name));
    expect(names.has('军旗')).toBe(true);
    expect(names.has('地雷')).toBe(true);
    expect(names.has('炸弹')).toBe(true);
    expect(names.has('工兵')).toBe(true);
    expect(names.has('白板')).toBe(true);
    // All blanks are named "白板"
    const blanks = red.filter((p) => p.type === 'blank');
    expect(blanks.every((p) => p.name === '白板')).toBe(true);
  });

  it('each piece has a unique id', () => {
    const red = factory.createPieces('red');
    const ids = new Set(red.map((p) => p.id));
    expect(ids.size).toBe(25);
  });
});
