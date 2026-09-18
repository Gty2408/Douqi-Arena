import { describe, it, expect } from 'vitest';
import { resolveCombat } from '../src/combat.js';
import type { Piece, PieceType, Side } from '../src/types.js';

function makePiece(type: PieceType, rank: number, side: Side = 'red', id?: string): Piece {
  return {
    id: id ?? `${type}-${rank}`,
    type,
    side,
    name: type,
    attributes: { rank },
    alive: true,
    position: null,
  };
}

describe('resolveCombat - blank pieces', () => {
  it('higher rank wins', () => {
    const a = makePiece('blank', 5);
    const d = makePiece('blank', 3, 'blue');
    expect(resolveCombat(a, d).type).toBe('attacker_wins');
  });

  it('lower rank loses', () => {
    const a = makePiece('blank', 2);
    const d = makePiece('blank', 7, 'blue');
    expect(resolveCombat(a, d).type).toBe('defender_wins');
  });

  it('equal rank mutual destruction', () => {
    const a = makePiece('blank', 4);
    const d = makePiece('blank', 4, 'blue');
    expect(resolveCombat(a, d).type).toBe('mutual');
  });
});

describe('resolveCombat - bomb', () => {
  it('bomb vs blank -> mutual', () => {
    const a = makePiece('bomb', -1);
    const d = makePiece('blank', 9, 'blue');
    expect(resolveCombat(a, d).type).toBe('mutual');
  });

  it('blank vs bomb -> mutual', () => {
    const a = makePiece('blank', 9);
    const d = makePiece('bomb', -1, 'blue');
    expect(resolveCombat(a, d).type).toBe('mutual');
  });

  it('bomb vs bomb -> mutual', () => {
    const a = makePiece('bomb', -1);
    const d = makePiece('bomb', -1, 'blue');
    expect(resolveCombat(a, d).type).toBe('mutual');
  });

  it('bomb vs mine -> mutual', () => {
    const a = makePiece('bomb', -1);
    const d = makePiece('mine', -1, 'blue');
    expect(resolveCombat(a, d).type).toBe('mutual');
  });
});

describe('resolveCombat - mine', () => {
  it('sapper vs mine -> sapper wins', () => {
    const a = makePiece('sapper', 1);
    const d = makePiece('mine', -1, 'blue');
    expect(resolveCombat(a, d).type).toBe('attacker_wins');
  });

  it('blank vs mine -> defender (mine) wins', () => {
    const a = makePiece('blank', 9);
    const d = makePiece('mine', -1, 'blue');
    expect(resolveCombat(a, d).type).toBe('defender_wins');
  });

  it('sapper vs blank with lower rank -> sapper wins', () => {
    const a = makePiece('sapper', 1);
    const d = makePiece('blank', 0, 'blue');
    expect(resolveCombat(a, d).type).toBe('attacker_wins');
  });

  it('sapper vs blank with higher rank -> sapper loses', () => {
    const a = makePiece('sapper', 1);
    const d = makePiece('blank', 5, 'blue');
    expect(resolveCombat(a, d).type).toBe('defender_wins');
  });
});

describe('resolveCombat - flag', () => {
  it('any piece vs flag -> flag_captured', () => {
    const a = makePiece('blank', 0);
    const d = makePiece('flag', -1, 'blue');
    expect(resolveCombat(a, d).type).toBe('flag_captured');
  });

  it('bomb vs flag -> flag_captured', () => {
    const a = makePiece('bomb', -1);
    const d = makePiece('flag', -1, 'blue');
    expect(resolveCombat(a, d).type).toBe('flag_captured');
  });
});
