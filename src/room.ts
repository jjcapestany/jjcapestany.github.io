import { W, H, WALL, DOOR_HALF } from './constants';
import type { Enemy } from './entities';

export interface Doors {
  north: boolean;
  east: boolean;
  south: boolean;
  west: boolean;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(...vals: number[]): number {
  let h = 2166136261 >>> 0;
  for (const v of vals) {
    h = Math.imul(h ^ (v & 0xffff), 16777619);
    h = Math.imul(h ^ ((v >> 16) & 0xffff), 16777619);
  }
  return h >>> 0;
}

// A door lives on the EDGE shared by two rooms, not on a single room, so both
// sides always agree on whether it exists (and stay consistent even when a room
// resets). A high fixed chance weights rooms toward 3-4 openings.
function edgeHasDoor(cx: number, cy: number, vertical: boolean): boolean {
  // Guarantee the start room is never sealed in: its east edge is always open.
  if (vertical && cx === 0 && cy === 0) return true;
  return mulberry32(hash(cx, cy, vertical ? 1 : 0))() < 0.72;
}

export function roomDoors(rx: number, ry: number): Doors {
  return {
    east: edgeHasDoor(rx, ry, true),
    west: edgeHasDoor(rx - 1, ry, true),
    south: edgeHasDoor(rx, ry, false),
    north: edgeHasDoor(rx, ry - 1, false),
  };
}

interface Decoration {
  x: number;
  y: number;
  r: number;
  color: string;
}

export class Room {
  rx: number;
  ry: number;
  readonly doors: Doors;
  enemies: Enemy[] = [];
  populated = false; // whether we've spawned this room's enemies yet
  private floor: string;
  private decorations: Decoration[] = [];

  constructor(rx: number, ry: number) {
    this.rx = rx;
    this.ry = ry;
    this.doors = roomDoors(rx, ry);

    // Looks re-randomize every time the room is built, so rooms that scroll out
    // of the 5x5 window and back come back visibly different (shifting world).
    const rand = Math.random;
    // pick from a small flat retro palette instead of any-hue HSL
    const hues = [200, 260, 320, 20, 90, 150];
    const hue = hues[Math.floor(rand() * hues.length)];
    this.floor = `hsl(${hue}, 30%, 14%)`;
    const decoColor = `hsl(${hue}, 32%, 22%)`;

    const count = 2 + Math.floor(rand() * 4);
    for (let i = 0; i < count; i++) {
      // snap to a chunky grid so blocks line up with the pixel look
      const r = (3 + Math.floor(rand() * 4)) * 12;
      this.decorations.push({
        x: Math.round((100 + rand() * (W - 200)) / 12) * 12,
        y: Math.round((100 + rand() * (H - 200)) / 12) * 12,
        r,
        color: decoColor,
      });
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this.floor;
    ctx.fillRect(0, 0, W, H);

    // chunky floor checkerboard
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    for (let y = 0; y < H; y += 48) {
      for (let x = 0; x < W; x += 48) {
        if (((x + y) / 48) % 2 === 0) ctx.fillRect(x, y, 48, 48);
      }
    }

    // decorations as solid blocks
    for (const d of this.decorations) {
      ctx.fillStyle = d.color;
      ctx.fillRect(d.x - d.r, d.y - d.r, d.r * 2, d.r * 2);
    }

    // walls — leave a centred gap only on sides that have a door
    ctx.fillStyle = '#6b6488';
    const t = WALL;
    const segH = W / 2 - DOOR_HALF;
    const segV = H / 2 - DOOR_HALF;

    if (this.doors.north) {
      ctx.fillRect(0, 0, segH, t);
      ctx.fillRect(W / 2 + DOOR_HALF, 0, segH, t);
    } else {
      ctx.fillRect(0, 0, W, t);
    }
    if (this.doors.south) {
      ctx.fillRect(0, H - t, segH, t);
      ctx.fillRect(W / 2 + DOOR_HALF, H - t, segH, t);
    } else {
      ctx.fillRect(0, H - t, W, t);
    }
    if (this.doors.west) {
      ctx.fillRect(0, 0, t, segV);
      ctx.fillRect(0, H / 2 + DOOR_HALF, t, segV);
    } else {
      ctx.fillRect(0, 0, t, H);
    }
    if (this.doors.east) {
      ctx.fillRect(W - t, 0, t, segV);
      ctx.fillRect(W - t, H / 2 + DOOR_HALF, t, segV);
    } else {
      ctx.fillRect(W - t, 0, t, H);
    }
  }
}
