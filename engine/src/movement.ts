import type { Board } from './board.js';
import type { PieceRules } from './pieces.js';
import type { Piece, Position } from './types.js';

/**
 * Determine whether `to` is reachable from `from` for `piece` on `board`.
 * `pieceAt` returns the piece occupying a position (or null).
 *
 * Movement rules:
 * - Road: one orthogonal step onto a road/camp/base cell.
 * - Railway: any number of cells along a straight (row or column) railway line.
 * - Sapper: can turn on the railway network (BFS over railway cells).
 * - All paths stop at the first occupied cell (no jumping, even for sappers).
 * - Camps are safe zones: enemy pieces cannot move into a camp occupied by the
 *   defender's piece; however a piece CAN move into an empty camp.
 * - Mines cannot move.
 */
export function getValidMoves(
  board: Board,
  piece: Piece,
  pieceAt: (pos: Position) => Piece | null,
  rules: PieceRules,
): Position[] {
  const rule = rules.getRule(piece.type);
  if (!rule || !rule.movable || !piece.position) return [];

  const from = piece.position;
  const moves = new Set<string>();
  const addMove = (p: Position) => moves.add(`${p.row},${p.col}`);

  // 1. Road movement: one orthogonal step.
  for (const adj of board.getAdjacent(from)) {
    const occupant = pieceAt(adj);
    // Cannot move onto own piece.
    if (occupant && occupant.side === piece.side) continue;
    // Cannot attack an enemy piece sitting in a camp (safe zone).
    if (occupant && occupant.side !== piece.side) {
      const cellType = board.getCellType(adj);
      if (cellType === 'camp') continue;
    }
    addMove(adj);
  }

  // 2. Railway movement.
  const fromType = board.getCellType(from);
  if (fromType === 'railway') {
    const isSapper = piece.type === 'sapper';
    if (isSapper) {
      // Sapper: BFS over the railway network, can turn, but cannot pass through
      // occupied cells.
      bfsRailway(board, from, piece, pieceAt, addMove);
    } else {
      // Non-sapper: straight lines only (row and column).
      const dirs = [
        { dr: -1, dc: 0 },
        { dr: 1, dc: 0 },
        { dr: 0, dc: -1 },
        { dr: 0, dc: 1 },
      ];
      for (const d of dirs) {
        const line = board.getLineCells(from, d.dr, d.dc, (p) => {
          const occ = pieceAt(p);
          if (occ) {
            // Blocked; if enemy and not in camp, we can still land on it.
            if (occ.side !== piece.side && board.getCellType(p) !== 'camp') {
              addMove(p);
            }
            return true;
          }
          return false;
        });
        for (const p of line) {
          if (board.getCellType(p) === 'railway') addMove(p);
        }
      }
    }
  }

  // Remove the starting position.
  moves.delete(`${from.row},${from.col}`);

  return Array.from(moves).map((k) => {
    const [r, c] = k.split(',').map(Number);
    return { row: r, col: c };
  });
}

/**
 * BFS over railway cells for the sapper. The sapper can traverse any railway
 * cell reachable via orthogonally adjacent railway cells, turning as needed,
 * but cannot pass through occupied cells. It can land on an occupied enemy
 * cell (combat) unless that cell is a camp.
 */
function bfsRailway(
  board: Board,
  start: Position,
  piece: Piece,
  pieceAt: (pos: Position) => Piece | null,
  addMove: (p: Position) => void,
): void {
  const visited = new Set<string>();
  const queue: Position[] = [start];
  visited.add(`${start.row},${start.col}`);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const adj of board.getAdjacent(cur)) {
      const key = `${adj.row},${adj.col}`;
      if (visited.has(key)) continue;
      const adjType = board.getCellType(adj);
      if (adjType !== 'railway') continue;

      const occ = pieceAt(adj);
      if (occ) {
        // Occupied cell: cannot pass through. If it's an enemy not in a camp,
        // the sapper can land on it (combat), but cannot go further.
        if (occ.side !== piece.side) {
          addMove(adj);
        }
        visited.add(key);
        continue;
      }

      visited.add(key);
      addMove(adj);
      queue.push(adj);
    }
  }
}
