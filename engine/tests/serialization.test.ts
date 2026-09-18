import { describe, it, expect } from 'vitest';
import { serializeStateFor } from '../src/serialization.js';
import type { GameState, Piece, Side } from '../src/types.js';

function makePiece(id: string, type: Piece['type'], side: Side, name: string, rank: number): Piece {
  return {
    id,
    type,
    side,
    name,
    attributes: { rank },
    alive: true,
    position: { row: 0, col: 0 },
  };
}

describe('serializeStateFor - dark chess isolation', () => {
  const redPiece = makePiece('r1', 'blank', 'red', '红方先锋', 5);
  const bluePiece = makePiece('b1', 'blank', 'blue', '蓝方暗子', 7);
  const state: GameState = {
    phase: 'playing',
    turn: 'red',
    pieces: [redPiece, bluePiece],
    winner: null,
    levelAllocations: {},
    remainingPoints: { red: 100, blue: 100 },
  };

  it('red viewer sees own piece with full data', () => {
    const visible = serializeStateFor(state, 'red');
    const own = visible.pieces.find((p) => p.id === 'r1');
    expect(own).toBeDefined();
    expect(own?.name).toBe('红方先锋');
    expect(own?.attributes.rank).toBe(5);
    expect(own?.type).toBe('blank');
  });

  it('red viewer does NOT see enemy piece name or rank', () => {
    const visible = serializeStateFor(state, 'red');
    const enemy = visible.enemyPieces.find((p) => p.id === 'b1');
    expect(enemy).toBeDefined();
    // Must not have name, attributes, or type revealed.
    expect((enemy as any).name).toBeUndefined();
    expect((enemy as any).attributes).toBeUndefined();
    expect((enemy as any).rank).toBeUndefined();
    expect((enemy as any).type).toBeUndefined();
  });

  it('blue viewer sees own piece with full data and not red piece name', () => {
    const visible = serializeStateFor(state, 'blue');
    const own = visible.pieces.find((p) => p.id === 'b1');
    expect(own?.name).toBe('蓝方暗子');
    expect(own?.attributes.rank).toBe(7);

    const enemy = visible.enemyPieces.find((p) => p.id === 'r1');
    expect((enemy as any).name).toBeUndefined();
    expect((enemy as any).attributes).toBeUndefined();
  });

  it('revealedType is sent only when set', () => {
    bluePiece.revealedType = 'blank';
    const visible = serializeStateFor(state, 'red');
    const enemy = visible.enemyPieces.find((p) => p.id === 'b1');
    expect(enemy?.revealedType).toBe('blank');
  });
});
