import { Game } from './game';
import { W } from './constants';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ctx = canvas.getContext('2d')!;

// Render everything into a small low-resolution buffer, then scale it up with
// nearest-neighbour sampling — this is what gives the chunky 8-bit pixels.
const BUFFER_W = 320;
const BUFFER_H = 200;
const buffer = document.createElement('canvas');
buffer.width = BUFFER_W;
buffer.height = BUFFER_H;
const bctx = buffer.getContext('2d')!;
const scale = BUFFER_W / W; // logical 960x600 -> 320x200

const game = new Game(canvas);
ctx.imageSmoothingEnabled = false;

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 1 / 20);
  last = now;

  game.update(dt);

  // draw the pixel-art world in logical coordinates, downscaled into the buffer
  bctx.setTransform(1, 0, 0, 1, 0, 0);
  bctx.clearRect(0, 0, BUFFER_W, BUFFER_H);
  bctx.setTransform(scale, 0, 0, scale, 0, 0);
  game.drawWorld(bctx);

  // blit the buffer up to full size, hard pixels (no smoothing)
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(buffer, 0, 0, BUFFER_W, BUFFER_H, 0, 0, canvas.width, canvas.height);

  // draw UI on top at full resolution so text is crisp and readable
  game.drawOverlay(ctx);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
