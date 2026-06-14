import { W } from '../constants';
import { SPECS } from '../specs';

// Shared UI layout + text helpers. Lives apart from the renderers so the game's
// click hit-testing and the screens' drawing agree on the same rectangles.

export const FONT = '"Press Start 2P", monospace';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Card layout shared by the spec-select and powerup screens (both show 3 cards).
export function cardRect(i: number): Rect {
  const w = 252;
  const h = 246;
  const gap = 24;
  const total = SPECS.length * w + (SPECS.length - 1) * gap;
  return { x: (W - total) / 2 + i * (w + gap), y: 234, w, h };
}

export function confirmRect(): Rect {
  const w = 240;
  const h = 48;
  return { x: (W - w) / 2, y: 512, w, h };
}

// "JOURNAL" button on the start screen, bottom-left.
export function journalButtonRect(): Rect {
  return { x: 24, y: 24, w: 150, h: 40 };
}

export function pointIn(r: Rect, mx: number, my: number): boolean {
  return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
}

// Word-wrap centred text within maxWidth, advancing by lineHeight per line.
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
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
      ctx.fillText(line, cx, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, cx, yy);
}
