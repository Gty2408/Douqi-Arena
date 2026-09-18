import type { GameState, HiddenPiece, Piece, Side, VisiblePiece, VisibleState } from './types.js';

/**
 * Serialize the game state for a specific side, enforcing dark-chess isolation.
 *
 * - The viewer's own pieces are sent in full (name, attributes, type).
 * - Enemy pieces are sent as HiddenPiece: only id, side, alive, position, and
 *   an optional revealedType (set only after the piece has been involved in a
 *   combat). No name, no rank, no full attributes.
 *
 * This is the single enforcement point for information isolation — the server
 * must always call this before sending state to a client.
 */
export function serializeStateFor(state: GameState, viewer: Side): VisibleState {
  const ownPieces: VisiblePiece[] = [];
  const enemyPieces: HiddenPiece[] = [];

  for (const piece of state.pieces) {
    if (piece.side === viewer) {
      ownPieces.push({
        id: piece.id,
        type: piece.type,
        side: piece.side,
        name: piece.name,
        attributes: { ...piece.attributes },
        alive: piece.alive,
        position: piece.position ? { ...piece.position } : null,
      });
    } else {
      enemyPieces.push({
        id: piece.id,
        side: piece.side,
        alive: piece.alive,
        position: piece.position ? { ...piece.position } : null,
        // revealedType is intentionally omitted here; it is populated by the
        // GameEngine after a combat involves the piece.
        ...(piece.revealedType ? { revealedType: piece.revealedType } : {}),
      });
    }
  }

  return {
    phase: state.phase,
    turn: state.turn,
    yourSide: viewer,
    pieces: ownPieces,
    enemyPieces,
    winner: state.winner,
    remainingPoints: state.remainingPoints[viewer] ?? 0,
  };
}

/**
 * A combat result notification that does not leak the defender's full info.
 * Only the result type and the piece ids are sent.
 */
export interface CombatNotification {
  type: 'attacker_wins' | 'defender_wins' | 'mutual' | 'flag_captured';
  attackerId: string;
  defenderId: string;
  attackerSide: Side;
  defenderSide: Side;
  /** The side that captured the flag (only when type === 'flag_captured'). */
  capturerSide?: Side;
}

export function buildCombatNotification(
  attacker: Piece,
  defender: Piece,
  resultType: CombatNotification['type'],
): CombatNotification {
  const notif: CombatNotification = {
    type: resultType,
    attackerId: attacker.id,
    defenderId: defender.id,
    attackerSide: attacker.side,
    defenderSide: defender.side,
  };
  if (resultType === 'flag_captured') {
    notif.capturerSide = attacker.side;
  }
  return notif;
}
