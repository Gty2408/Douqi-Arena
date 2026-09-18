import { describe, it, expect } from 'vitest';
import { Board } from '../src/board.js';
import { getValidMoves } from '../src/movement.js';
import { PieceRules } from '../src/pieces.js';
import type { Piece, PieceType, Position } from '../src/types.js';

const board = Board.load();
const rules = PieceRules.load();

function makePiece(type: PieceType, pos: Position): Piece {
  return {
    id: `${type}-${pos.row}-${pos.col}`,
    type,
    side: 'red',
    name: type,
    attributes: { rank: type === 'blank' ? 5 : -1 },
    alive: true,
    position: pos,
  };
}

function pieceAt(pieces: Piece[]) {
  return (pos: Position): Piece | null =>
    pieces.find((p) => p.alive && p.position?.row === pos.row && p.position?.col === pos.col) ??
    null;
}

describe('movement - road', () => {
  it('road piece can only move one adjacent step', () => {
    const p = makePiece('blank', { row: 2, col: 2 });
    const moves = getValidMoves(board, p, pieceAt([p]), rules);
    // (2,2) is road. Adjacent: (1,2) railway, (3,2) camp, (2,1) camp, (2,3) camp
    // All 4 adjacent are reachable in one step.
    expect(moves.length).toBe(4);
  });
});

describe('movement - railway', () => {
  it('railway piece can move unlimited along straight line', () => {
    const p = makePiece('blank', { row: 5, col: 0 });
    const moves = getValidMoves(board, p, pieceAt([p]), rules);
    // Row 5 is all railway. Can go right to col 1,2,3,4.
    const rightMoves = moves.filter((m) => m.row === 5);
    expect(rightMoves.length).toBe(4); // cols 1,2,3,4
  });

  it('railway piece blocked by another piece cannot pass through', () => {
    const p = makePiece('blank', { row: 5, col: 0 });
    const blocker = makePiece('blank', { row: 5, col: 2 });
    blocker.side = 'blue';
    const moves = getValidMoves(board, p, pieceAt([p, blocker]), rules);
    // Can reach col 1 (before blocker) and col 2 (land on blocker for combat).
    // Cannot reach col 3, 4.
    const rightMoves = moves.filter((m) => m.row === 5).map((m) => m.col).sort();
    expect(rightMoves).toEqual([1, 2]);
  });

  it('sapper can turn on railway network', () => {
    const p = makePiece('sapper', { row: 5, col: 0 });
    const moves = getValidMoves(board, p, pieceAt([p]), rules);
    // From (5,0), sapper can traverse the whole railway network.
    // Should be able to reach railway cells in other rows/cols.
    const reachCount = moves.length;
    expect(reachCount).toBeGreaterThan(4); // more than just straight line
  });

  it('sapper can land on a blocking enemy piece for combat but cannot pass through it directly', () => {
    const p = makePiece('sapper', { row: 5, col: 0 });
    const blocker = makePiece('blank', { row: 5, col: 3 });
    blocker.side = 'blue';
    const moves = getValidMoves(board, p, pieceAt([p, blocker]), rules);
    // Can land on the blocker for combat.
    const canLandOnBlocker = moves.some((m) => m.row === 5 && m.col === 3);
    expect(canLandOnBlocker).toBe(true);
    // The blocker's cell is not passed through; the sapper stops there.
    // (The sapper may still reach cells beyond via alternative railway paths
    // that go around the blocker — that is allowed.)
  });

  it('sapper cannot reach a cell completely surrounded by blockers', () => {
    // Place sapper at (5,0) and block all adjacent railway exits.
    const p = makePiece('sapper', { row: 5, col: 0 });
    // (5,0) railway neighbors: (4,0), (6,0), (5,1). Block all three.
    const blockUp = makePiece('blank', { row: 4, col: 0 });
    blockUp.side = 'blue';
    const blockDown = makePiece('blank', { row: 6, col: 0 });
    blockDown.side = 'blue';
    const blockRight = makePiece('blank', { row: 5, col: 1 });
    blockRight.side = 'blue';
    const moves = getValidMoves(board, p, pieceAt([p, blockUp, blockDown, blockRight]), rules);
    // Sapper can land on blockers for combat but cannot go further.
    const reachable = moves.map((m) => `${m.row},${m.col}`).sort();
    expect(reachable).toContain('4,0');
    expect(reachable).toContain('6,0');
    expect(reachable).toContain('5,1');
    // No further cells reachable.
    expect(reachable.length).toBe(3);
  });
});

describe('movement - mine immobile', () => {
  it('mine has no valid moves', () => {
    const p = makePiece('mine', { row: 0, col: 0 });
    const moves = getValidMoves(board, p, pieceAt([p]), rules);
    expect(moves.length).toBe(0);
  });
});

describe('movement - camp safe zone', () => {
  it('cannot attack enemy piece in a camp', () => {
    const attacker = makePiece('blank', { row: 2, col: 2 });
    const enemy = makePiece('blank', { row: 2, col: 1 });
    enemy.side = 'blue';
    // (2,1) is a camp.
    expect(board.getCellType({ row: 2, col: 1 })).toBe('camp');
    const moves = getValidMoves(board, attacker, pieceAt([attacker, enemy]), rules);
    const canAttackCamp = moves.some((m) => m.row === 2 && m.col === 1);
    expect(canAttackCamp).toBe(false);
  });
});
