import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/engine.js';
import type { LayoutEntry, Position } from '../src/types.js';

function buildSimpleLayout(engine: GameEngine, side: 'red' | 'blue'): LayoutEntry[] {
  const pieces = engine.getPieces(side);
  const board = engine.board;
  const bases = board.getBasePositionsFor(side);
  const mines = pieces.filter((p) => p.type === 'mine');
  const bombs = pieces.filter((p) => p.type === 'bomb');
  const flag = pieces.find((p) => p.type === 'flag')!;
  const sappers = pieces.filter((p) => p.type === 'sapper');
  const blanks = pieces.filter((p) => p.type === 'blank');
  const camps = new Set(board.getCampPositions().map((p) => `${p.row},${p.col}`));
  const mineRows = board.getMineRows(side);
  const forbiddenBombRow = board.getForbiddenBombRow(side);

  const layout: LayoutEntry[] = [];
  const placed = new Set<string>();

  // Flag in base.
  layout.push({ pieceId: flag.id, position: bases[0] });
  placed.add(`${bases[0].row},${bases[0].col}`);

  // Mines in mine rows.
  let mi = 0;
  for (const r of mineRows) {
    for (let c = 0; c < 5 && mi < mines.length; c++) {
      const key = `${r},${c}`;
      if (placed.has(key) || camps.has(key)) continue;
      if (bases.some((b) => b.row === r && b.col === c)) continue;
      layout.push({ pieceId: mines[mi].id, position: { row: r, col: c } });
      placed.add(key);
      mi++;
    }
  }

  // Fill remaining with bombs, sappers, blanks.
  const rest = [...bombs, ...sappers, ...blanks];
  let idx = 0;
  for (let r = 0; r < 12 && idx < rest.length; r++) {
    for (let c = 0; c < 5 && idx < rest.length; c++) {
      const key = `${r},${c}`;
      if (placed.has(key) || camps.has(key)) continue;
      if (bases.some((b) => b.row === r && b.col === c)) continue;
      if (rest[idx].type === 'bomb' && r === forbiddenBombRow) continue;
      layout.push({ pieceId: rest[idx].id, position: { row: r, col: c } });
      placed.add(key);
      idx++;
    }
  }

  return layout;
}

describe('GameEngine - full game flow', () => {
  it('completes setup and starts', () => {
    const engine = new GameEngine();
    const redLayout = buildSimpleLayout(engine, 'red');
    const blueLayout = buildSimpleLayout(engine, 'blue');

    expect(engine.submitLayout('red', redLayout).ok).toBe(true);
    expect(engine.submitLayout('blue', blueLayout).ok).toBe(true);
    expect(engine.start().ok).toBe(true);
    expect(engine.state.phase).toBe('playing');
    expect(engine.state.turn).toBe('red');
  });

  it('rejects move when not your turn', () => {
    const engine = new GameEngine();
    engine.submitLayout('red', buildSimpleLayout(engine, 'red'));
    engine.submitLayout('blue', buildSimpleLayout(engine, 'blue'));
    engine.start();

    // Blue tries to move first.
    const bluePieces = engine.getPieces('blue').filter((p) => p.position);
    const from = bluePieces[0].position!;
    const result = engine.move('blue', from, { row: from.row, col: from.col });
    expect(result.ok).toBe(false);
  });

  it('capturing flag ends the game', () => {
    const engine = new GameEngine();
    engine.submitLayout('red', buildSimpleLayout(engine, 'red'));
    engine.submitLayout('blue', buildSimpleLayout(engine, 'blue'));
    engine.start();

    // Manually place a red blank piece adjacent to blue flag.
    const blueFlag = engine.getPieces('blue').find((p) => p.type === 'flag')!;
    const redBlank = engine.getPieces('red').find((p) => p.type === 'blank' && p.alive)!;
    const flagPos = blueFlag.position!;
    // Place red piece right above the flag.
    redBlank.position = { row: flagPos.row - 1, col: flagPos.col };

    const result = engine.move('red', redBlank.position!, flagPos);
    expect(result.ok).toBe(true);
    expect(result.winner).toBe('red');
    expect(engine.state.phase).toBe('ended');
  });

  it('getStateFor enforces dark chess isolation', () => {
    const engine = new GameEngine();
    engine.submitLayout('red', buildSimpleLayout(engine, 'red'));
    engine.submitLayout('blue', buildSimpleLayout(engine, 'blue'));
    engine.start();

    const redView = engine.getStateFor('red');
    // Red should see no enemy names.
    for (const ep of redView.enemyPieces) {
      expect((ep as any).name).toBeUndefined();
      expect((ep as any).attributes).toBeUndefined();
    }
    // Red's own pieces have names.
    expect(redView.pieces.length).toBeGreaterThan(0);
  });

  it('rename works and is not visible to opponent', () => {
    const engine = new GameEngine();
    const redBlank = engine.getPieces('red').find((p) => p.type === 'blank')!;
    const renameResult = engine.rename('red', redBlank.id, '虎将');
    expect(renameResult.ok).toBe(true);
    expect(redBlank.name).toBe('虎将');

    // Submit layouts and start so state is serialized.
    engine.submitLayout('red', buildSimpleLayout(engine, 'red'));
    engine.submitLayout('blue', buildSimpleLayout(engine, 'blue'));
    engine.start();

    const blueView = engine.getStateFor('blue');
    const enemy = blueView.enemyPieces.find((p) => p.id === redBlank.id);
    expect((enemy as any).name).toBeUndefined();
  });
});
