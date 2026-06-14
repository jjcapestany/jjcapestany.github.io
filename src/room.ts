import { W, H, WALL, DOOR_HALF } from './constants';
import { TOTAL_PAGES } from './journal';
import { shade } from './entities/sprite';
import type { Enemy, PagePickup, HealPickup } from './entities';

export interface Doors {
  north: boolean;
  east: boolean;
  south: boolean;
  west: boolean;
}

// Libraries are rare bonus rooms scattered through the world (~3% of rooms),
// each sealed to a single entrance, holding one journal page and no vermin.
// Deterministic from coordinates so a library stays a library when revisited.
const LIBRARY_RATE = 0.05; // ~5% of rooms

export function isLibraryRoom(rx: number, ry: number): boolean {
  if (rx === 0 && ry === 0) return false; // never the start room
  // run the hash through mulberry32: the FNV low bits are too weak to sample directly
  return mulberry32(hash(rx, ry, 7))() < LIBRARY_RATE;
}

// Which side a library opens on: 0=N, 1=E, 2=S, 3=W. Well-mixed so entrances
// land on every side, not just one.
function libraryEntrance(rx: number, ry: number): number {
  return Math.floor(mulberry32(hash(rx, ry, 13))() * 4);
}

// Safe rooms ("The Pilot Light"): rare calm rooms with a one-time heal in the
// centre, no enemies, normal doors. A room is at most one special type.
const SAFE_RATE = 0.05;

export function isSafeRoom(rx: number, ry: number): boolean {
  if (rx === 0 && ry === 0) return false;
  if (isLibraryRoom(rx, ry)) return false;
  return mulberry32(hash(rx, ry, 21))() < SAFE_RATE;
}

// A library seals every wall but its single entrance. An edge is shared by two
// rooms; if either is a library, this forces that edge open (its entrance) or
// shut (any other wall). A wall always wins over an entrance on the rare edge
// two libraries share. Returns null for edges no library touches.
function libraryEdge(cx: number, cy: number, vertical: boolean): boolean | null {
  let result: boolean | null = null;
  const consider = (rx: number, ry: number, side: number) => {
    if (!isLibraryRoom(rx, ry)) return;
    if (libraryEntrance(rx, ry) === side) {
      if (result !== false) result = true;
    } else {
      result = false;
    }
  };
  if (vertical) {
    consider(cx, cy, 1); // east wall of (cx,cy)
    consider(cx + 1, cy, 3); // west wall of (cx+1,cy)
  } else {
    consider(cx, cy, 2); // south wall of (cx,cy)
    consider(cx, cy + 1, 0); // north wall of (cx,cy+1)
  }
  return result;
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
  // The library is sealed to a single entrance.
  const lib = libraryEdge(cx, cy, vertical);
  if (lib !== null) return lib;
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

// --- dungeon biomes ----------------------------------------------------------
// The vault is one vast, cursed kitchen-larder, and you descend through it: the
// upper stores, the cookline where melts are made, the cold walk-in, the brine
// cellar, the aging cheese caves, and finally the drain at the bottom. The zone
// is fixed by how deep you are (every 15 rooms, lining up with the boss tiers),
// so the world reads as a journey down.
type MotifKind =
  | 'crate'
  | 'sack'
  | 'shelf'
  | 'cooktop'
  | 'grease'
  | 'vent'
  | 'frost'
  | 'strips'
  | 'tub'
  | 'vat'
  | 'brine'
  | 'hook'
  | 'wheel'
  | 'mold'
  | 'drip'
  | 'sludge';

interface Biome {
  name: string;
  floor: string;
  wall: string;
  deco: string;
  motifs: MotifKind[];
}

const BIOMES: Biome[] = [
  { name: 'THE PANTRY', floor: '#241a12', wall: '#5a4632', deco: '#4a3624', motifs: ['crate', 'sack', 'shelf'] },
  { name: 'THE LINE', floor: '#1b1e25', wall: '#464b56', deco: '#3a3f4a', motifs: ['cooktop', 'grease', 'vent'] },
  { name: 'THE WALK-IN', floor: '#16222e', wall: '#3a5260', deco: '#2c4250', motifs: ['frost', 'strips', 'tub'] },
  { name: 'THE BRINE CELLAR', floor: '#1b2416', wall: '#45572d', deco: '#36471e', motifs: ['vat', 'brine', 'hook'] },
  { name: 'THE AGING CAVES', floor: '#1d1730', wall: '#443a58', deco: '#382c4e', motifs: ['wheel', 'mold', 'drip'] },
  { name: 'THE DRAIN', floor: '#190f13', wall: '#38252f', deco: '#2c1c22', motifs: ['sludge', 'grease', 'mold'] },
];

export function biomeForDepth(depth: number): number {
  return Math.min(BIOMES.length - 1, Math.floor(depth / 15));
}

export function biomeName(depth: number): string {
  return BIOMES[biomeForDepth(depth)].name;
}

interface Decoration {
  kind: MotifKind;
  x: number;
  y: number;
  s: number;
  color: string;
}

// Fixed speckle offsets so clustered motifs (frost/mold/grease) hold still
// instead of shimmering every frame.
const SPECKLE: [number, number][] = [
  [-0.7, -0.4],
  [0.1, -0.7],
  [0.6, -0.2],
  [-0.3, 0.5],
  [0.7, 0.5],
  [-0.8, 0.2],
  [0.0, 0.1],
  [0.35, 0.35],
  [-0.45, -0.1],
];

function cluster(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  for (const [dx, dy] of SPECKLE) {
    ctx.fillRect(Math.round((x + dx * s) / 6) * 6, Math.round((y + dy * s) / 6) * 6, 6, 6);
  }
  ctx.restore();
}

// Draw one themed prop as chunky blocks. Self-contained per kind so biomes read
// at a glance.
function drawMotif(ctx: CanvasRenderingContext2D, d: Decoration): void {
  const { x, y, s, color } = d;
  const dark = shade(color, 0.6);
  switch (d.kind) {
    case 'crate':
      ctx.fillStyle = color;
      ctx.fillRect(x - s, y - s, s * 2, s * 2);
      ctx.fillStyle = dark;
      ctx.fillRect(x - s, y - 3, s * 2, 6);
      ctx.fillRect(x - 3, y - s, 6, s * 2);
      ctx.fillRect(x - s, y - s, s * 2, 4);
      break;
    case 'sack':
      ctx.fillStyle = color;
      ctx.fillRect(x - s, y - s * 0.3, s * 2, s * 1.3);
      ctx.fillRect(x - s * 0.6, y - s, s * 1.2, s * 0.7);
      ctx.fillStyle = dark;
      ctx.fillRect(x - s * 0.6, y - s, s * 1.2, 5);
      break;
    case 'shelf': {
      const w = s * 3;
      ctx.fillStyle = dark;
      ctx.fillRect(x - w / 2, y, w, 6);
      ctx.fillStyle = '#caa24a';
      for (let k = -1; k <= 1; k++) ctx.fillRect(x + k * (w / 3) - 5, y - 14, 10, 14);
      break;
    }
    case 'cooktop':
      ctx.fillStyle = '#26282e';
      ctx.fillRect(x - s, y - s, s * 2, s * 2);
      ctx.fillStyle = '#14161a';
      ctx.fillRect(x - s + 4, y - s + 4, s * 2 - 8, s * 2 - 8);
      ctx.fillStyle = '#ff7a1f';
      {
        const o = s * 0.45;
        for (const [sx, sy] of [
          [-o, -o],
          [o, -o],
          [-o, o],
          [o, o],
        ])
          ctx.fillRect(x + sx - 5, y + sy - 5, 10, 10);
      }
      break;
    case 'grease':
      cluster(ctx, x, y, s, '#0d0b08', 0.8);
      cluster(ctx, x, y, s * 0.6, '#2a2418', 0.5);
      break;
    case 'vent':
      ctx.fillStyle = dark;
      ctx.fillRect(x - s, y - s * 0.6, s * 2, s * 1.2);
      ctx.fillStyle = '#101216';
      for (let i = 0; i < 4; i++) ctx.fillRect(x - s + 4, y - s * 0.5 + i * 8, s * 2 - 8, 3);
      break;
    case 'frost':
      cluster(ctx, x, y, s, '#bfe0ff', 0.45);
      break;
    case 'strips':
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#cfe6ff';
      for (let k = -2; k <= 2; k++) ctx.fillRect(x + k * 10 - 3, y - s, 6, s * 2.2);
      ctx.restore();
      break;
    case 'tub':
      ctx.fillStyle = shade(color, 1.25);
      ctx.fillRect(x - s, y - s * 0.5, s * 2, s);
      ctx.fillStyle = '#cfe6ff';
      ctx.fillRect(x - s, y - s * 0.5, s * 2, 4);
      break;
    case 'vat':
      ctx.fillStyle = dark;
      ctx.fillRect(x - s * 0.8, y - s, s * 1.6, s * 2);
      ctx.fillStyle = '#6fae4f';
      ctx.fillRect(x - s * 0.8 + 4, y - s + 4, s * 1.6 - 8, 8);
      ctx.fillStyle = shade(color, 0.45);
      ctx.fillRect(x - s * 0.8, y - s * 0.2, s * 1.6, 4);
      ctx.fillRect(x - s * 0.8, y + s * 0.5, s * 1.6, 4);
      break;
    case 'brine':
      cluster(ctx, x, y, s, '#6fae4f', 0.4);
      break;
    case 'hook':
      ctx.fillStyle = '#8a8a93';
      ctx.fillRect(x - 1, y - s, 3, s * 0.5);
      ctx.fillStyle = '#9c3a2c';
      ctx.fillRect(x - s * 0.5, y - s * 0.5, s, s * 1.3);
      ctx.fillStyle = '#cbb56a';
      ctx.fillRect(x - s * 0.2, y - s * 0.4, 5, s * 1.1);
      break;
    case 'wheel':
      ctx.fillStyle = '#e0b84a';
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#caa24a';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, s, 0.2, 0.75);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#a07d28';
      for (const [hx, hy] of [
        [-0.3, -0.2],
        [0.25, 0.1],
        [0, 0.4],
      ]) {
        ctx.beginPath();
        ctx.arc(x + hx * s, y + hy * s, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'mold':
      cluster(ctx, x, y, s, '#6a4fa0', 0.5);
      cluster(ctx, x, y, s * 0.7, '#7bbf5a', 0.4);
      break;
    case 'drip':
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#8fb0c0';
      ctx.fillRect(x - 1, y - s, 3, s * 1.6);
      ctx.fillRect(x - 3, y + s * 0.6, 7, 7);
      ctx.restore();
      break;
    case 'sludge':
      cluster(ctx, x, y, s, '#2a1014', 0.85);
      cluster(ctx, x, y, s * 0.6, '#5a1e22', 0.5);
      break;
  }
}

export class Room {
  rx: number;
  ry: number;
  readonly doors: Doors;
  readonly isLibrary: boolean;
  readonly isSafe: boolean;
  readonly zone: string; // display name of this room's zone
  enemies: Enemy[] = [];
  pages: PagePickup[] = []; // journal pages dropped on this room's floor
  heal: HealPickup | null = null; // safe room's one-time Pilot Light
  populated = false; // whether we've spawned this room's enemies/pages yet
  private floor: string;
  private wall = '#6b6488';
  private decorations: Decoration[] = [];

  constructor(rx: number, ry: number, depth = 0) {
    this.rx = rx;
    this.ry = ry;
    this.doors = roomDoors(rx, ry);
    this.isLibrary = isLibraryRoom(rx, ry);
    this.isSafe = isSafeRoom(rx, ry);

    // Looks re-randomize every time the room is built, so rooms that scroll out
    // of the 5x5 window and back come back visibly different (shifting world).
    const rand = Math.random;
    if (this.isLibrary) {
      this.floor = '#1a1410'; // warm, dim, lamplit
      this.wall = '#4a3a2a'; // wooden
      this.zone = 'THE LIBRARY';
      return; // shelves are drawn procedurally, not as scatter decorations
    }
    if (this.isSafe) {
      this.floor = '#1c1410'; // warm hearthlight
      this.wall = '#5a4030';
      this.zone = 'THE PILOT LIGHT';
      return;
    }
    // themed zone fixed by depth, so the dungeon reads as a descent
    const b = BIOMES[biomeForDepth(depth)];
    this.floor = b.floor;
    this.wall = b.wall;
    this.zone = b.name;

    const count = 3 + Math.floor(rand() * 4); // 3-6 props
    for (let i = 0; i < count; i++) {
      this.decorations.push({
        kind: b.motifs[Math.floor(rand() * b.motifs.length)],
        // snap to a chunky grid so blocks line up with the pixel look
        x: Math.round((110 + rand() * (W - 220)) / 12) * 12,
        y: Math.round((110 + rand() * (H - 220)) / 12) * 12,
        s: 20 + Math.floor(rand() * 16), // 20-35
        color: b.deco,
      });
    }
  }

  draw(ctx: CanvasRenderingContext2D, collectedPages = 0): void {
    ctx.fillStyle = this.floor;
    ctx.fillRect(0, 0, W, H);

    // chunky floor checkerboard
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    for (let y = 0; y < H; y += 48) {
      for (let x = 0; x < W; x += 48) {
        if (((x + y) / 48) % 2 === 0) ctx.fillRect(x, y, 48, 48);
      }
    }

    if (this.isLibrary) {
      this.drawLibrary(ctx, collectedPages);
    } else if (this.isSafe) {
      this.drawSafe(ctx);
    } else {
      // themed props for this zone
      for (const d of this.decorations) drawMotif(ctx, d);
    }

    // walls — leave a centred gap only on sides that have a door
    ctx.fillStyle = this.wall;
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

  // Bookshelves lining the walls fill with gold spines as the journal fills in;
  // a desk with the Reader sits in the middle. Drawn before the walls.
  private drawLibrary(ctx: CanvasRenderingContext2D, collectedPages: number): void {
    const lit = Math.round((collectedPages / TOTAL_PAGES) * 100); // spines glowing gold
    let drawn = 0;
    const spineW = 7;
    const spineH = 30;
    const gap = 4;

    // a run of book spines along a horizontal shelf at (x0,y) spanning `cols`
    const shelf = (x0: number, y: number, cols: number) => {
      ctx.fillStyle = '#3a2c1c';
      ctx.fillRect(x0 - 4, y + spineH, cols * (spineW + gap) + 4, 5); // shelf board
      for (let i = 0; i < cols; i++) {
        const sx = x0 + i * (spineW + gap);
        const golden = drawn < lit;
        drawn++;
        ctx.fillStyle = golden ? '#ffd23f' : '#6a5b48';
        ctx.fillRect(sx, y + (i % 2), spineW, spineH - (i % 2));
        ctx.fillStyle = golden ? '#cf8f0c' : '#4a3e30';
        ctx.fillRect(sx, y + 5, spineW, 2);
      }
    };

    // left wall and right wall, three shelves each
    const cols = 9;
    for (let row = 0; row < 3; row++) {
      const y = 120 + row * 110;
      shelf(40, y, cols);
      shelf(W - 40 - cols * (spineW + gap) + gap, y, cols);
    }

    // reading desk in the centre with a candle
    const dx = W / 2;
    const dy = H / 2 + 30;
    ctx.fillStyle = '#4a3320';
    ctx.fillRect(dx - 48, dy, 96, 14);
    ctx.fillRect(dx - 44, dy + 14, 8, 22);
    ctx.fillRect(dx + 36, dy + 14, 8, 22);
    // candle
    ctx.fillStyle = '#e8e0c8';
    ctx.fillRect(dx + 30, dy - 14, 5, 14);
    ctx.fillStyle = '#ffb84d';
    ctx.fillRect(dx + 31, dy - 20, 3, 6);

    // the Reader: a small hooded figure seated at the desk
    ctx.fillStyle = '#2a2438';
    ctx.fillRect(dx - 14, dy - 34, 28, 30); // robe
    ctx.fillStyle = '#3a3450';
    ctx.fillRect(dx - 12, dy - 44, 24, 14); // hood
    ctx.fillStyle = '#0a0810';
    ctx.fillRect(dx - 7, dy - 38, 14, 7); // shadowed face
  }

  // A warm pool of hearthlight and a rug under the Pilot Light (the stove itself
  // is the HealPickup, drawn by the game).
  private drawSafe(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#ff9d3f';
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 170, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // rug
    ctx.fillStyle = '#3a2418';
    ctx.fillRect(W / 2 - 78, H / 2 - 54, 156, 108);
    ctx.fillStyle = '#4a2e1e';
    ctx.fillRect(W / 2 - 66, H / 2 - 44, 132, 88);
    ctx.fillStyle = '#3a2418';
    ctx.fillRect(W / 2 - 54, H / 2 - 34, 108, 68);
  }
}
