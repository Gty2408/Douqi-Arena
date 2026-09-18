import type { PieceRules } from './pieces.js';
import type { Piece } from './types.js';

/**
 * Rename a piece. Name must be <= maxNameLength characters (UTF-8 codepoints).
 * Renaming is free, unlimited, and does not affect game rules.
 * Returns true on success, false if name is too long.
 */
export function renamePiece(
  piece: Piece,
  newName: string,
  rules: PieceRules,
): boolean {
  // Count Unicode code points (characters), not bytes.
  const length = Array.from(newName).length;
  if (length === 0 || length > rules.maxNameLength) return false;
  piece.name = newName;
  return true;
}
