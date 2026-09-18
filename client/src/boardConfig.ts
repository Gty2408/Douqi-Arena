// Client-side board configuration mirroring engine/data/board-config.json.
export type CellType = 'road' | 'railway' | 'camp' | 'base';

export interface BoardCellDef {
  row: number;
  col: number;
  type: CellType;
}

export const BOARD_ROWS = 12;
export const BOARD_COLS = 5;

export const boardCells: BoardCellDef[] = [
  { row: 0, col: 0, type: 'railway' }, { row: 0, col: 1, type: 'base' }, { row: 0, col: 2, type: 'railway' }, { row: 0, col: 3, type: 'base' }, { row: 0, col: 4, type: 'railway' },
  { row: 1, col: 0, type: 'railway' }, { row: 1, col: 1, type: 'railway' }, { row: 1, col: 2, type: 'railway' }, { row: 1, col: 3, type: 'railway' }, { row: 1, col: 4, type: 'railway' },
  { row: 2, col: 0, type: 'railway' }, { row: 2, col: 1, type: 'camp' }, { row: 2, col: 2, type: 'road' }, { row: 2, col: 3, type: 'camp' }, { row: 2, col: 4, type: 'railway' },
  { row: 3, col: 0, type: 'railway' }, { row: 3, col: 1, type: 'road' }, { row: 3, col: 2, type: 'camp' }, { row: 3, col: 3, type: 'road' }, { row: 3, col: 4, type: 'railway' },
  { row: 4, col: 0, type: 'railway' }, { row: 4, col: 1, type: 'camp' }, { row: 4, col: 2, type: 'road' }, { row: 4, col: 3, type: 'camp' }, { row: 4, col: 4, type: 'railway' },
  { row: 5, col: 0, type: 'railway' }, { row: 5, col: 1, type: 'railway' }, { row: 5, col: 2, type: 'railway' }, { row: 5, col: 3, type: 'railway' }, { row: 5, col: 4, type: 'railway' },
  { row: 6, col: 0, type: 'railway' }, { row: 6, col: 1, type: 'railway' }, { row: 6, col: 2, type: 'railway' }, { row: 6, col: 3, type: 'railway' }, { row: 6, col: 4, type: 'railway' },
  { row: 7, col: 0, type: 'railway' }, { row: 7, col: 1, type: 'camp' }, { row: 7, col: 2, type: 'road' }, { row: 7, col: 3, type: 'camp' }, { row: 7, col: 4, type: 'railway' },
  { row: 8, col: 0, type: 'railway' }, { row: 8, col: 1, type: 'road' }, { row: 8, col: 2, type: 'camp' }, { row: 8, col: 3, type: 'road' }, { row: 8, col: 4, type: 'railway' },
  { row: 9, col: 0, type: 'railway' }, { row: 9, col: 1, type: 'camp' }, { row: 9, col: 2, type: 'road' }, { row: 9, col: 3, type: 'camp' }, { row: 9, col: 4, type: 'railway' },
  { row: 10, col: 0, type: 'railway' }, { row: 10, col: 1, type: 'railway' }, { row: 10, col: 2, type: 'railway' }, { row: 10, col: 3, type: 'railway' }, { row: 10, col: 4, type: 'railway' },
  { row: 11, col: 0, type: 'railway' }, { row: 11, col: 1, type: 'base' }, { row: 11, col: 2, type: 'railway' }, { row: 11, col: 3, type: 'base' }, { row: 11, col: 4, type: 'railway' },
];

export function getCellType(row: number, col: number): CellType | undefined {
  return boardCells.find((c) => c.row === row && c.col === col)?.type;
}
