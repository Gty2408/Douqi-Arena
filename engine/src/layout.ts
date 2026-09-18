import type { Board } from './board.js';
import type { PieceRules } from './pieces.js';
import type { LayoutEntry, LayoutValidationResult, Piece, Side } from './types.js';

/**
 * Validate a player's layout.
 *
 * Rules:
 * - Flag must be in one of the side's base cells.
 * - Mines must be in the last two rows of the side's territory.
 * - Bombs cannot be in the first (back) row.
 * - Camps cannot contain any piece.
 * - All 25 pieces must be placed exactly once on distinct cells.
 */
export function validateLayout(
  layout: LayoutEntry[],
  pieces: Piece[],
  side: Side,
  board: Board,
): LayoutValidationResult {
  const errors: string[] = [];
  const pieceById = new Map(pieces.map((p) => [p.id, p]));

  // Check all pieces placed exactly once.
  const placedIds = new Set(layout.map((e) => e.pieceId));
  if (placedIds.size !== pieces.length) {
    errors.push(`布局必须包含全部 ${pieces.length} 枚棋子`);
  }

  // Check distinct positions.
  const posSet = new Set(layout.map((e) => `${e.position.row},${e.position.col}`));
  if (posSet.size !== layout.length) {
    errors.push('棋子位置不能重复');
  }

  const mineRows = board.getMineRows(side);
  const forbiddenBombRow = board.getForbiddenBombRow(side);
  const basePositions = board.getBasePositionsFor(side);
  const campPositions = new Set(board.getCampPositions().map((p) => `${p.row},${p.col}`));

  let flagPlaced = false;

  for (const entry of layout) {
    const piece = pieceById.get(entry.pieceId);
    if (!piece) continue;
    const pos = entry.position;

    // Camp cannot hold pieces.
    if (campPositions.has(`${pos.row},${pos.col}`)) {
      errors.push(`行营不能放置棋子（${piece.name} 在 (${pos.row},${pos.col})）`);
    }

    if (piece.type === 'flag') {
      flagPlaced = true;
      const inBase = basePositions.some((b) => b.row === pos.row && b.col === pos.col);
      if (!inBase) {
        errors.push('军旗必须放置在大本营');
      }
    }

    if (piece.type === 'mine') {
      if (!mineRows.includes(pos.row)) {
        errors.push('地雷必须放置在后两排');
      }
    }

    if (piece.type === 'bomb') {
      if (pos.row === forbiddenBombRow) {
        errors.push('炸弹不能放置在第一排');
      }
    }
  }

  if (!flagPlaced) {
    errors.push('军旗必须放置');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate level point allocation for blank pieces.
 * - Total allocated points must not exceed the level budget (100).
 * - Each piece's rank must be within [minRank, maxRank].
 */
export function validateLevelAllocation(
  allocations: Record<string, number>,
  pieces: Piece[],
  rules: PieceRules,
): LayoutValidationResult {
  const errors: string[] = [];
  const blankPieces = pieces.filter((p) => p.type === 'blank');
  const blankIds = new Set(blankPieces.map((p) => p.id));

  let total = 0;
  for (const [id, rank] of Object.entries(allocations)) {
    if (!blankIds.has(id)) {
      errors.push(`棋子 ${id} 不是白板棋子，不能分配等级`);
      continue;
    }
    if (rank < rules.minRank || rank > rules.maxRank) {
      errors.push(`棋子 ${id} 等级 ${rank} 超出范围 [${rules.minRank}, ${rules.maxRank}]`);
    }
    total += rank;
  }

  if (total > rules.levelBudget) {
    errors.push(`等级点总和 ${total} 超过预算 ${rules.levelBudget}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Apply level allocations to blank pieces. Mutates piece attributes.
 */
export function applyLevelAllocation(
  allocations: Record<string, number>,
  pieces: Piece[],
): void {
  for (const piece of pieces) {
    if (piece.type === 'blank' && allocations[piece.id] !== undefined) {
      piece.attributes.rank = allocations[piece.id];
    }
  }
}
