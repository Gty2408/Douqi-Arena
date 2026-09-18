import { useEffect, useRef } from 'react';
import { BOARD_COLS, BOARD_ROWS, boardCells, getCellType } from '../boardConfig';
import type { CombatNotification, HiddenPiece, Position, VisiblePiece, VisibleState } from '../types';

interface Props {
  state: VisibleState;
  selectedPieceId: string | null;
  validMoves: Position[];
  combat: CombatNotification | null;
  /** Width of the canvas in pixels. */
  width: number;
  height: number;
}

const PADDING = 40;

export default function BoardCanvas({ state, selectedPieceId, validMoves, combat, width, height }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cellW = (width - PADDING * 2) / BOARD_COLS;
    const cellH = (height - PADDING * 2) / BOARD_ROWS;

    const toX = (col: number) => PADDING + col * cellW + cellW / 2;
    const toY = (row: number) => PADDING + row * cellH + cellH / 2;

    const draw = () => {
      timeRef.current += 0.016;
      const t = timeRef.current;
      ctx.clearRect(0, 0, width, height);

      // Stone background
      const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, width);
      bgGrad.addColorStop(0, '#15151c');
      bgGrad.addColorStop(1, '#0a0a0e');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Subtle stone texture noise
      ctx.globalAlpha = 0.03;
      for (let i = 0; i < 200; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? '#d4a843' : '#4a9ebb';
        ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
      }
      ctx.globalAlpha = 1;

      // Draw connections first (under pieces)
      drawConnections(ctx, cellW, cellH, toX, toY, t);

      // Draw cells
      for (const cell of boardCells) {
        drawCell(ctx, cell.row, cell.col, toX, toY, cellW, cellH, t);
      }

      // Draw valid move indicators
      for (const m of validMoves) {
        const x = toX(m.col);
        const y = toY(m.row);
        ctx.beginPath();
        ctx.arc(x, y, Math.min(cellW, cellH) * 0.18, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(74, 158, 187, 0.4)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(74, 158, 187, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw pieces
      const allPieces: Array<{ piece: VisiblePiece | HiddenPiece; isOwn: boolean }> = [
        ...state.pieces.filter((p) => p.alive && p.position).map((p) => ({ piece: p, isOwn: true })),
        ...state.enemyPieces.filter((p) => p.alive && p.position).map((p) => ({ piece: p, isOwn: false })),
      ];

      for (const { piece, isOwn } of allPieces) {
        drawPiece(ctx, piece, isOwn, toX, toY, cellW, cellH, t, selectedPieceId === piece.id, combat);
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [state, selectedPieceId, validMoves, combat, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} style={{ display: 'block' }} />;
}

function drawConnections(
  ctx: CanvasRenderingContext2D,
  cellW: number,
  cellH: number,
  toX: (c: number) => number,
  toY: (r: number) => number,
  t: number,
) {
  // Draw railway lines (bright gold, thick)
  ctx.strokeStyle = '#d4a843';
  ctx.lineWidth = 3;
  ctx.shadowColor = 'rgba(212, 168, 67, 0.5)';
  ctx.shadowBlur = 6;

  // Horizontal railway rows: 0, 1, 5, 6, 10, 11
  const railRows = [0, 1, 5, 6, 10, 11];
  for (const r of railRows) {
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(r));
    ctx.lineTo(toX(BOARD_COLS - 1), toY(r));
    ctx.stroke();
  }
  // Vertical railway cols: 0, 4
  for (const c of [0, BOARD_COLS - 1]) {
    ctx.beginPath();
    ctx.moveTo(toX(c), toY(0));
    ctx.lineTo(toX(c), toY(BOARD_ROWS - 1));
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // Flowing particles along railways
  ctx.fillStyle = 'rgba(240, 201, 90, 0.8)';
  for (const r of railRows) {
    const offset = ((t * 60) % cellW) + PADDING;
    for (let x = offset; x < toX(BOARD_COLS - 1); x += cellW * 1.5) {
      ctx.beginPath();
      ctx.arc(x, toY(r), 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw road lines (dark gold, thin) between adjacent road/camp/base cells
  ctx.strokeStyle = 'rgba(138, 109, 59, 0.5)';
  ctx.lineWidth = 1.5;
  for (const cell of boardCells) {
    if (cell.type === 'railway') continue;
    const neighbors = [
      { row: cell.row + 1, col: cell.col },
      { row: cell.row, col: cell.col + 1 },
    ];
    for (const n of neighbors) {
      const nType = getCellType(n.row, n.col);
      if (!nType || nType === 'railway') continue;
      ctx.beginPath();
      ctx.moveTo(toX(cell.col), toY(cell.row));
      ctx.lineTo(toX(n.col), toY(n.row));
      ctx.stroke();
    }
  }
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  row: number,
  col: number,
  toX: (c: number) => number,
  toY: (r: number) => number,
  cellW: number,
  cellH: number,
  t: number,
) {
  const type = getCellType(row, col);
  if (!type) return;
  const x = toX(col);
  const y = toY(row);
  const r = Math.min(cellW, cellH) * 0.22;

  if (type === 'camp') {
    // Camp: circular groove with blue glow
    const pulse = 0.5 + 0.5 * Math.sin(t * 2);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(26, 26, 36, 0.9)';
    ctx.fill();
    ctx.strokeStyle = `rgba(74, 158, 187, ${0.4 + pulse * 0.3})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowColor = 'rgba(74, 158, 187, 0.6)';
    ctx.shadowBlur = 8 + pulse * 4;
    ctx.stroke();
    ctx.shadowBlur = 0;
  } else if (type === 'base') {
    // Base: square platform with dark red glow
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.5);
    ctx.fillStyle = 'rgba(26, 26, 36, 0.9)';
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.strokeStyle = `rgba(139, 46, 46, ${0.5 + pulse * 0.3})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - r, y - r, r * 2, r * 2);
    ctx.shadowColor = 'rgba(139, 46, 46, 0.5)';
    ctx.shadowBlur = 6;
    ctx.strokeRect(x - r, y - r, r * 2, r * 2);
    ctx.shadowBlur = 0;
  } else {
    // Road / railway: circular dark groove
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(26, 26, 36, 0.7)';
    ctx.fill();
    ctx.strokeStyle = type === 'railway' ? 'rgba(212, 168, 67, 0.3)' : 'rgba(138, 109, 59, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawPiece(
  ctx: CanvasRenderingContext2D,
  piece: VisiblePiece | HiddenPiece,
  isOwn: boolean,
  toX: (c: number) => number,
  toY: (r: number) => number,
  cellW: number,
  cellH: number,
  t: number,
  selected: boolean,
  combat: CombatNotification | null,
) {
  if (!piece.position) return;
  const x = toX(piece.position.col);
  const y = toY(piece.position.row);
  const r = Math.min(cellW, cellH) * 0.3;

  const inCombat = !!(combat && (combat.attackerId === piece.id || combat.defenderId === piece.id));

  // Selection ring
  if (selected) {
    ctx.beginPath();
    ctx.arc(x, y, r + 6, 0, Math.PI * 2);
    ctx.strokeStyle = '#f0c95a';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(240, 201, 90, 0.8)';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  if (isOwn) {
    drawOwnPiece(ctx, piece as VisiblePiece, x, y, r, t, inCombat);
  } else {
    drawHiddenPiece(ctx, piece as HiddenPiece, x, y, r, t);
  }
}

function drawOwnPiece(
  ctx: CanvasRenderingContext2D,
  piece: VisiblePiece,
  x: number,
  y: number,
  r: number,
  t: number,
  inCombat: boolean,
) {
  const rank = piece.attributes.rank ?? 0;
  const glowIntensity = piece.type === 'blank' ? rank / 9 : 0.6;
  const sideColor = piece.side === 'red' ? '#c94a2e' : '#4a9ebb';

  // Base circle - jade-like
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  const baseGrad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
  baseGrad.addColorStop(0, '#2a2a38');
  baseGrad.addColorStop(1, '#15151c');
  ctx.fillStyle = baseGrad;
  ctx.fill();

  // Side-colored rim
  ctx.strokeStyle = sideColor;
  ctx.lineWidth = 2;
  ctx.shadowColor = sideColor;
  ctx.shadowBlur = 4 + glowIntensity * 8;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Inner glow based on rank
  if (glowIntensity > 0) {
    ctx.beginPath();
    ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(212, 168, 67, ${glowIntensity * 0.2})`;
    ctx.fill();
  }

  // Type-specific icon and name
  drawPieceSymbol(ctx, piece.type, x, y, r, t);

  // Rank number for blank pieces
  if (piece.type === 'blank' && rank > 0) {
    ctx.fillStyle = '#f0c95a';
    ctx.font = `bold ${r * 0.8}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(rank), x, y + r * 0.05);
  }

  // Name label below
  ctx.fillStyle = 'rgba(232, 224, 208, 0.9)';
  ctx.font = `${Math.max(9, r * 0.4)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(piece.name, x, y + r + 2);
}

function drawHiddenPiece(
  ctx: CanvasRenderingContext2D,
  piece: HiddenPiece,
  x: number,
  y: number,
  r: number,
  t: number,
) {
  // Dark stone back with flowing runes
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(x, y, 1, x, y, r);
  grad.addColorStop(0, '#1c1c28');
  grad.addColorStop(1, '#0a0a10');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(138, 109, 59, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Flowing dark rune pattern
  ctx.strokeStyle = `rgba(212, 168, 67, ${0.15 + 0.1 * Math.sin(t * 2)})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.6, t % (Math.PI * 2), t % (Math.PI * 2) + Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.4, -t % (Math.PI * 2), -t % (Math.PI * 2) + Math.PI);
  ctx.stroke();

  // If revealed after combat, show the type
  if (piece.revealedType) {
    drawPieceSymbol(ctx, piece.revealedType, x, y, r * 0.7, t);
  }
}

function drawPieceSymbol(
  ctx: CanvasRenderingContext2D,
  type: string,
  x: number,
  y: number,
  r: number,
  t: number,
) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  switch (type) {
    case 'flag': {
      const pulse = 0.5 + 0.5 * Math.sin(t * 3);
      ctx.fillStyle = `rgba(201, 74, 46, ${0.7 + pulse * 0.3})`;
      ctx.shadowColor = 'rgba(201, 74, 46, 0.8)';
      ctx.shadowBlur = 10;
      ctx.font = `bold ${r}px sans-serif`;
      ctx.fillText('旗', x, y);
      ctx.shadowBlur = 0;
      break;
    }
    case 'mine': {
      ctx.fillStyle = '#4a2e5e';
      ctx.font = `${r * 0.9}px sans-serif`;
      ctx.fillText('雷', x, y);
      // Chain effect
      ctx.strokeStyle = 'rgba(74, 46, 94, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.85, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'bomb': {
      const pulse = 0.5 + 0.5 * Math.sin(t * 5);
      ctx.fillStyle = `rgba(201, 74, 46, ${0.6 + pulse * 0.4})`;
      ctx.shadowColor = 'rgba(201, 74, 46, 0.7)';
      ctx.shadowBlur = 8;
      ctx.font = `bold ${r * 0.9}px sans-serif`;
      ctx.fillText('炸', x, y);
      ctx.shadowBlur = 0;
      break;
    }
    case 'sapper': {
      ctx.fillStyle = '#2e8a9e';
      ctx.font = `${r * 0.85}px sans-serif`;
      ctx.fillText('工', x, y);
      break;
    }
    default:
      break;
  }
}
