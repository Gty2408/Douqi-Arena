import type { CombatResult, CombatResultType, Piece } from './types.js';

/**
 * Unified combat resolution interface.
 *
 * Rules:
 * - Blank vs Blank: higher rank wins; equal rank -> mutual destruction.
 * - Bomb vs anything (except flag): mutual destruction.
 * - Mine vs Sapper: sapper wins (mine dies).
 * - Mine vs Bomb: mutual destruction.
 * - Mine vs other (non-sapper, non-bomb): defender (mine) wins, attacker dies.
 * - Flag touched by anything: FLAG_CAPTURED (the flag's side loses).
 *
 * The function is data-driven for blank pieces (reads attributes.rank) and
 * uses explicit type checks only for the special pieces with fixed behavior.
 */
export function resolveCombat(attacker: Piece, defender: Piece): CombatResult {
  const aType = attacker.type;
  const dType = defender.type;

  // Flag capture: any piece touching the flag captures it.
  if (dType === 'flag') {
    return result('flag_captured', attacker, defender);
  }

  // Bomb: mutual destruction with anything except flag (handled above).
  if (aType === 'bomb' || dType === 'bomb') {
    return result('mutual', attacker, defender);
  }

  // Mine as defender.
  if (dType === 'mine') {
    if (aType === 'sapper') {
      return result('attacker_wins', attacker, defender);
    }
    // Bomb already handled above. Any other attacker dies to the mine.
    return result('defender_wins', attacker, defender);
  }

  // Mine as attacker (mines can't move, but handle for completeness).
  if (aType === 'mine') {
    if (dType === 'sapper') {
      return result('defender_wins', attacker, defender);
    }
    return result('mutual', attacker, defender);
  }

  // Blank vs blank (and sapper vs blank, etc.) — compare ranks.
  // Any non-special combat is resolved by rank comparison.
  const aRank = attacker.attributes.rank ?? 0;
  const dRank = defender.attributes.rank ?? 0;

  if (aRank > dRank) return result('attacker_wins', attacker, defender);
  if (aRank < dRank) return result('defender_wins', attacker, defender);
  return result('mutual', attacker, defender);
}

function result(
  type: CombatResultType,
  attacker: Piece,
  defender: Piece,
): CombatResult {
  return { type, attackerId: attacker.id, defenderId: defender.id };
}
