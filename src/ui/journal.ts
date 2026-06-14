import { W, H } from '../constants';
import { PAGES, TOTAL_PAGES, getPage } from '../journal';
import { FONT, type Rect, pointIn, wrapText } from './layout';

// Grid layout for the 99-page index.
const COLS = 11;
const CELL_W = 64;
const CELL_H = 40;
const GAP = 8;
const GRID_W = COLS * CELL_W + (COLS - 1) * GAP;
const OX = (W - GRID_W) / 2;
const OY = 132;

function cellRect(i: number): Rect {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  return { x: OX + col * (CELL_W + GAP), y: OY + row * (CELL_H + GAP), w: CELL_W, h: CELL_H };
}

// Page id (1..99) under the cursor in grid view, or null.
export function journalCellAt(mx: number, my: number): number | null {
  for (let i = 0; i < TOTAL_PAGES; i++) {
    if (pointIn(cellRect(i), mx, my)) return i + 1;
  }
  return null;
}

export function journalBackRect(): Rect {
  return { x: 24, y: H - 60, w: 150, h: 40 };
}

export interface JournalView {
  collected: number[]; // collected page ids
  viewing: number; // page id being read, or -1 for the grid
  mx: number;
  my: number;
}

export function drawJournal(ctx: CanvasRenderingContext2D, v: JournalView): void {
  ctx.fillStyle = '#0d0a16';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';

  if (v.viewing > 0) {
    drawPageDetail(ctx, v.viewing);
  } else {
    drawGrid(ctx, v);
  }

  // back button (returns to grid from a page, or out of the journal from the grid)
  const back = journalBackRect();
  const hot = pointIn(back, v.mx, v.my);
  ctx.fillStyle = hot ? '#241a36' : '#1a1428';
  ctx.fillRect(back.x, back.y, back.w, back.h);
  ctx.lineWidth = 2;
  ctx.strokeStyle = hot ? '#ffd23f' : '#4a4360';
  ctx.strokeRect(back.x, back.y, back.w, back.h);
  ctx.fillStyle = '#fff3b0';
  ctx.font = `12px ${FONT}`;
  ctx.fillText(v.viewing > 0 ? 'BACK' : 'CLOSE', back.x + back.w / 2, back.y + 25);
}

function drawGrid(ctx: CanvasRenderingContext2D, v: JournalView): void {
  const found = v.collected.length;
  ctx.fillStyle = '#ffd23f';
  ctx.font = `22px ${FONT}`;
  ctx.fillText("THE READER'S JOURNAL", W / 2, 64);
  ctx.fillStyle = '#8a83a8';
  ctx.font = `12px ${FONT}`;
  ctx.fillText(`${found} / ${TOTAL_PAGES} PAGES FOUND`, W / 2, 96);

  const has = new Set(v.collected);
  for (let i = 0; i < TOTAL_PAGES; i++) {
    const id = i + 1;
    const r = cellRect(i);
    const owned = has.has(id);
    const hot = owned && pointIn(r, v.mx, v.my);

    ctx.fillStyle = owned ? (hot ? '#2a2140' : '#1d1730') : 'rgba(255,255,255,0.03)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.lineWidth = 2;
    ctx.strokeStyle = owned ? (hot ? '#ffd23f' : '#5a4f78') : '#241f33';
    ctx.strokeRect(r.x, r.y, r.w, r.h);

    if (owned) {
      ctx.fillStyle = '#fff3b0';
      ctx.font = `12px ${FONT}`;
      ctx.fillText(String(id), r.x + r.w / 2, r.y + r.h / 2 + 5);
    } else {
      ctx.fillStyle = '#3a3450';
      ctx.font = `10px ${FONT}`;
      ctx.fillText('?', r.x + r.w / 2, r.y + r.h / 2 + 4);
    }
  }

  ctx.fillStyle = '#6a6388';
  ctx.font = `9px ${FONT}`;
  ctx.fillText('CLICK A FOUND PAGE TO READ IT', W / 2, OY + 9 * (CELL_H + GAP) + 18);
}

function drawPageDetail(ctx: CanvasRenderingContext2D, id: number): void {
  const page = getPage(id) ?? PAGES[0];
  const px = 140;
  const py = 96;
  const pw = W - px * 2;
  const ph = H - py - 110;

  // parchment panel
  ctx.fillStyle = '#efe6cd';
  ctx.fillRect(px, py, pw, ph);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#7a6a44';
  ctx.strokeRect(px, py, pw, ph);

  ctx.fillStyle = '#6a5a36';
  ctx.font = `10px ${FONT}`;
  ctx.fillText(`PAGE ${id} OF ${TOTAL_PAGES}`, W / 2, py + 30);

  ctx.fillStyle = '#2a2014';
  ctx.font = `16px ${FONT}`;
  wrapText(ctx, page.title.toUpperCase(), W / 2, py + 64, pw - 80, 24);

  // body, left-aligned for readability, then restore centre
  ctx.textAlign = 'left';
  ctx.fillStyle = '#3a3022';
  ctx.font = `11px ${FONT}`;
  wrapTextLeft(ctx, page.text, px + 40, py + 108, pw - 80, 22);
  ctx.textAlign = 'center';
}

// Left-aligned word wrap (the shared wrapText is centre-aligned).
function wrapTextLeft(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): void {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, yy);
}
