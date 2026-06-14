// Shared pixel-art drawing helpers. Everything in the world is drawn on a chunky
// grid so it stays crisp while moving.

export const CELL = 3; // logical px per sprite pixel (== 1 buffer pixel)

// Darken a #rrggbb colour by a factor, e.g. for a sprite's shaded underside.
export function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `rgb(${r}, ${g}, ${b})`;
}

// Draw a square snapped to the pixel grid, so everything stays crisp while moving.
export function pixel(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  const gx = Math.round((x - size / 2) / CELL) * CELL;
  const gy = Math.round((y - size / 2) / CELL) * CELL;
  ctx.fillStyle = color;
  ctx.fillRect(gx, gy, size, size);
}
