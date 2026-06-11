import { W, H, WALL } from './constants';
import type { Input } from './input';

// XP needed to go from `level` to the next: 100 at level 1, +10% each level.
export function xpForLevel(level: number): number {
  return Math.round(100 * Math.pow(1.1, level - 1));
}

// Hand-drawn pixel-art sprite: a cheese wedge (🧀) in a wizard hat. No face.
//   H hat   B brim   S star   C cheese   o hole
const WIZARD_SPRITE = [
  '......HH......',
  '.....HHHH.....',
  '.....HHHH.....',
  '....HHHHHH....',
  '....HHSSHH....',
  '...HHHHHHHH...',
  '..BBBBBBBBBB..',
  '......CC......',
  '.....CCCC.....',
  '....CCCCCC....',
  '...CCCooCCC...',
  '...CCCooCCC...',
  '..CCCCCCCCCC..',
  '.CCooCCCCooCC.',
  '.CCooCCCCooCC.',
  '..CCCCCCCCCC..',
];

const CELL = 3; // logical px per sprite pixel (== 1 buffer pixel)
const BODY_CENTER_ROW = 11;
const SWING_DURATION = 0.12; // seconds for a full 180° sweep — snappy
export const SWORD_REACH = 100; // how far the blade extends

export type Weapon = 'wand' | 'bow' | 'sword';

// Darken a #rrggbb colour by a factor, for the hat's shaded brim.
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `rgb(${r}, ${g}, ${b})`;
}

// Draw a square snapped to the pixel grid, so everything stays crisp while moving.
function pixel(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  const gx = Math.round((x - size / 2) / CELL) * CELL;
  const gy = Math.round((y - size / 2) / CELL) * CELL;
  ctx.fillStyle = color;
  ctx.fillRect(gx, gy, size, size);
}

export class Player {
  x = W / 2;
  y = H / 2;
  radius = 16;
  aim = 0;
  level = 1;
  xp = 0;
  xpToNext = xpForLevel(1);
  baseMaxHp = 100; // grows with level; items add on top
  maxHp = 100;
  hp = 100;
  hpPerLevel = 10; // base HP gained each level (item-modifiable later)
  moveSpeedBase = 270;
  moveSpeed = 270;
  damageBonus = 0;
  equipped: { id: string; level: number }[] = [];
  invuln = 0;
  hatColor = '#6c4bb8';
  weapon: Weapon = 'wand';
  fireCooldown = 0;
  // sword swing state (also used for the melee hit arc)
  swingActive = false;
  swingT = 0;
  swingAim = 0;
  swingDir = 1;

  update(dt: number, input: Input): void {
    let mx = 0;
    let my = 0;
    if (input.isDown('w', 'arrowup')) my -= 1;
    if (input.isDown('s', 'arrowdown')) my += 1;
    if (input.isDown('a', 'arrowleft')) mx -= 1;
    if (input.isDown('d', 'arrowright')) mx += 1;
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len;
      my /= len;
    }
    const speed = this.moveSpeed;
    this.x += mx * speed * dt;
    this.y += my * speed * dt;

    this.aim = Math.atan2(input.mouseY - this.y, input.mouseX - this.x);
    this.fireCooldown -= dt;
    this.invuln -= dt;

    if (this.swingActive) {
      this.swingT += dt;
      if (this.swingT >= SWING_DURATION) this.swingActive = false;
    }
  }

  gainXp(amount: number): void {
    this.xp += amount;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level += 1;
      this.xpToNext = xpForLevel(this.level);
      this.baseMaxHp += this.hpPerLevel;
      this.recompute(); // leveling also strengthens level-scaling items
    }
  }

  // Equip an item, or level it up if already owned; then recompute stats.
  addItem(id: string): void {
    const owned = this.equipped.find((e) => e.id === id);
    if (owned) owned.level += 1;
    else this.equipped.push({ id, level: 1 });
    this.recompute();
  }

  getItemLevel(id: string): number {
    return this.equipped.find((e) => e.id === id)?.level ?? 0;
  }

  // Items are all attack-type now, so max HP just tracks the level-based base.
  recompute(): void {
    const newMax = this.baseMaxHp;
    if (newMax > this.maxHp) this.hp += newMax - this.maxHp; // heal the gain
    this.maxHp = newMax;
    if (this.hp > this.maxHp) this.hp = this.maxHp;
  }

  // Reset run-state when (re)starting with a specialization.
  beginRun(): void {
    this.level = 1;
    this.xp = 0;
    this.xpToNext = xpForLevel(1);
    this.baseMaxHp = 100;
    this.maxHp = 100;
    this.hp = 100;
    this.hpPerLevel = 10;
    this.moveSpeedBase = 270;
    this.moveSpeed = 270;
    this.damageBonus = 0;
    this.equipped = [];
    this.invuln = 0;
  }

  // Begin a 180° sword swing centred on the current aim, alternating side each time.
  startSwing(): void {
    this.swingActive = true;
    this.swingT = 0;
    this.swingAim = this.aim;
    this.swingDir *= -1;
    this.fireCooldown = SWING_DURATION + 0.1;
  }

  // Current blade angle — sweeps aim±90° over the swing, or rests at aim when idle.
  get swingAngle(): number {
    if (!this.swingActive) return this.aim;
    const t = this.swingT / SWING_DURATION;
    return this.swingAim + (t - 0.5) * Math.PI * this.swingDir;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // blink while briefly invulnerable after taking a hit
    if (this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 1) return;

    // cheese wedge sprite
    const colors: Record<string, string> = {
      H: this.hatColor,
      B: shade(this.hatColor, 0.55),
      S: '#fff3b0',
      C: '#ffd23f',
      o: '#cf8f0c',
    };
    const ox = Math.round((this.x - (WIZARD_SPRITE[0].length / 2) * CELL) / CELL) * CELL;
    const oy = Math.round((this.y - (BODY_CENTER_ROW + 0.5) * CELL) / CELL) * CELL;
    for (let r = 0; r < WIZARD_SPRITE.length; r++) {
      const row = WIZARD_SPRITE[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === '.') continue;
        ctx.fillStyle = colors[ch];
        ctx.fillRect(ox + c * CELL, oy + r * CELL, CELL, CELL);
      }
    }

    // weapon drawn on top, aimed at the cursor
    if (this.weapon === 'bow') this.drawBow(ctx);
    else if (this.weapon === 'sword') this.drawSword(ctx);
    else this.drawWand(ctx);
  }

  private drawSword(ctx: CanvasRenderingContext2D): void {
    const ba = this.swingAngle;
    const fx = Math.cos(ba);
    const fy = Math.sin(ba);
    const gx = -fy; // guard axis (perpendicular)
    const gy = fx;

    // a single white swoosh tracing the swept arc — a tapered crescent (thick in
    // the middle, pointed at the ends) like a slash mark
    if (this.swingActive) {
      const t = this.swingT / SWING_DURATION;
      const start = this.swingAim - (Math.PI / 2) * this.swingDir;
      const N = 16;
      const outer = SWORD_REACH;
      const thick = 34;
      let alpha = 0.9;
      if (t > 0.6) alpha *= Math.max(0, (1 - t) / 0.4); // fade out as the swing ends

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const s = i / N;
        const ang = start + (ba - start) * s;
        const x = this.x + Math.cos(ang) * outer;
        const y = this.y + Math.sin(ang) * outer;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      for (let i = N; i >= 0; i--) {
        const s = i / N;
        const ang = start + (ba - start) * s;
        const r = outer - thick * Math.sin(Math.PI * s);
        ctx.lineTo(this.x + Math.cos(ang) * r, this.y + Math.sin(ang) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // pommel (knob at the base)
    pixel(ctx, this.x + fx * 3, this.y + fy * 3, CELL * 2, '#d9a441');
    // grip
    for (let d = 6; d <= 15; d += CELL) {
      pixel(ctx, this.x + fx * d, this.y + fy * d, CELL, '#6b4423');
    }
    // crossguard — perpendicular bar, a couple of cells thick
    for (let gd = 16; gd <= 19; gd += CELL) {
      for (let w = -9; w <= 9; w += CELL) {
        pixel(ctx, this.x + fx * gd + gx * w, this.y + fy * gd + gy * w, CELL, '#d9a441');
      }
    }
    // blade — full width out of the guard, tapering to a point, with a bright fuller
    const bladeStart = 22;
    const tipLen = 16;
    const bladeHalf = 3;
    for (let d = bladeStart; d <= SWORD_REACH; d += CELL) {
      const fromTip = SWORD_REACH - d;
      const hw = fromTip < tipLen ? bladeHalf * (fromTip / tipLen) : bladeHalf;
      for (let w = -hw; w <= hw + 0.01; w += CELL) {
        pixel(ctx, this.x + fx * d + gx * w, this.y + fy * d + gy * w, CELL, '#bcc0d2');
      }
      pixel(ctx, this.x + fx * d, this.y + fy * d, CELL, '#eef2ff'); // centre fuller
    }
  }

  private drawWand(ctx: CanvasRenderingContext2D): void {
    const a = this.aim;
    pixel(ctx, this.x + Math.cos(a) * 21, this.y + Math.sin(a) * 21, CELL, '#8b5a2b');
    pixel(ctx, this.x + Math.cos(a) * 27, this.y + Math.sin(a) * 27, CELL, '#8b5a2b');
    pixel(ctx, this.x + Math.cos(a) * 34, this.y + Math.sin(a) * 34, CELL * 2, '#fff3b0');
  }

  private drawBow(ctx: CanvasRenderingContext2D): void {
    const a = this.aim;
    const fx = Math.cos(a);
    const fy = Math.sin(a);
    const px = -fy; // perpendicular axis (across the bow)
    const py = fx;
    const base = 15; // distance from body to the bowstring
    const depth = 6; // how far the limbs bow forward
    const L = 12; // half the bow's height

    // curved wooden limbs
    for (let t = -L; t <= L; t += CELL) {
      const k = t / L;
      const fwd = base + depth * (1 - k * k);
      pixel(ctx, this.x + fx * fwd + px * t, this.y + fy * fwd + py * t, CELL, '#8b5a2b');
    }
    // string (straight chord between the limb tips)
    for (let t = -L + 2; t <= L - 2; t += CELL) {
      pixel(ctx, this.x + fx * base + px * t, this.y + fy * base + py * t, 2, '#e8e0c8');
    }
    // a fresh arrow nocked and ready when the bow isn't on cooldown
    if (this.fireCooldown <= 0.06) {
      for (let d = base - 2; d <= base + 7; d += CELL) {
        pixel(ctx, this.x + fx * d, this.y + fy * d, CELL, '#caa15a');
      }
      pixel(ctx, this.x + fx * (base + 10), this.y + fy * (base + 10), CELL, '#fff3b0');
    }
  }
}

export class Arrow {
  x: number;
  y: number;
  angle: number;
  radius = 5;
  alive = true;

  constructor(x: number, y: number, angle: number) {
    this.x = x;
    this.y = y;
    this.angle = angle;
  }

  update(dt: number): void {
    const speed = 520;
    this.x += Math.cos(this.angle) * speed * dt;
    this.y += Math.sin(this.angle) * speed * dt;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const fx = Math.cos(this.angle);
    const fy = Math.sin(this.angle);
    const px = -fy;
    const py = fx;
    // shaft
    for (let d = -9; d <= 3; d += CELL) pixel(ctx, this.x + fx * d, this.y + fy * d, CELL, '#8b5a2b');
    // cheese-gold arrowhead
    pixel(ctx, this.x + fx * 6, this.y + fy * 6, CELL, '#ffe680');
    pixel(ctx, this.x + fx * 9, this.y + fy * 9, CELL, '#fff3b0');
    // fletching
    pixel(ctx, this.x - fx * 9 + px * 3, this.y - fy * 9 + py * 3, CELL, '#e0a818');
    pixel(ctx, this.x - fx * 9 - px * 3, this.y - fy * 9 - py * 3, CELL, '#e0a818');
  }
}

// A small "called-down" blast at a target point: a white flash, an expanding
// shockwave ring, and debris sparks flying outward.
export class Explosion {
  x: number;
  y: number;
  color: string;
  t = 0;
  maxT = 0.42;
  maxRadius = 30;
  alive = true;
  private sparks: { a: number; s: number }[] = [];

  constructor(x: number, y: number, color: string) {
    this.x = x;
    this.y = y;
    this.color = color;
    const n = 8;
    for (let i = 0; i < n; i++) {
      this.sparks.push({ a: (i / n) * Math.PI * 2 + Math.random() * 0.5, s: 28 + Math.random() * 40 });
    }
  }

  update(dt: number): void {
    this.t += dt;
    if (this.t >= this.maxT) this.alive = false;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const p = this.t / this.maxT;
    const ease = 1 - (1 - p) * (1 - p);
    ctx.save();

    // expanding shockwave ring
    const r = 6 + this.maxRadius * ease;
    ctx.globalAlpha = Math.max(0, 1 - p);
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2;
      pixel(ctx, this.x + Math.cos(ang) * r, this.y + Math.sin(ang) * r, CELL, this.color);
    }

    // debris sparks flying out
    ctx.globalAlpha = Math.max(0, 1 - p) * 0.9;
    for (const sp of this.sparks) {
      const d = sp.s * ease;
      pixel(ctx, this.x + Math.cos(sp.a) * d, this.y + Math.sin(sp.a) * d, CELL, '#d6c8ff');
    }

    // bright core flash — pops then fades fastest
    const flash = Math.max(0, 1 - p * 2.5);
    if (flash > 0) {
      ctx.globalAlpha = flash * 0.85;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 8 + this.maxRadius * 0.6 * (1 - flash), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = flash;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.x, this.y, 4 + this.maxRadius * 0.4 * (1 - flash), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

// Cheese-thieving vermin. Every difficulty tier (each 15 rooms explored) gets a
// bigger, meaner sprite so the power jump is visible at a glance.
//   m body   E eye   W big eye   h horn   w fang
const ENEMY_SPRITES = [
  [
    '.m......m.',
    '.mm....mm.',
    '..mmmmmm..',
    '.mmmmmmmm.',
    '.mEmmmmEm.',
    '.mmmmmmmm.',
    '..mmmmmm..',
    '...mmmm...',
  ],
  [
    '..m....m..',
    '..mm..mm..',
    '..mmmmmm..',
    '.mmmmmmmm.',
    '.mEmmmmEm.',
    '.mmmmmmmm.',
    '.mwmmmmwm.',
    '..mmmmmm..',
  ],
  [
    'h........h',
    'hh.mmmm.hh',
    '..mmmmmm..',
    '.mmmmmmmm.',
    '.mEmmmmEm.',
    '.mmmmmmmm.',
    '.mwwmmwwm.',
    '..mmmmmm..',
  ],
  [
    'h..mmmm..h',
    '.hmmmmmmh.',
    '.mmmmmmmm.',
    'mWWmmmmWWm',
    'mmmmmmmmmm',
    '.mmmmmmmm.',
    '.mwwmmwwm.',
    '..mmmmmm..',
  ],
];
const ENEMY_PALETTES: Record<string, string>[] = [
  { m: '#9a93a8', E: '#ff5a5a', W: '#ff5a5a', h: '#6a6478', w: '#ffffff' },
  { m: '#b9824f', E: '#ffd23f', W: '#ffd23f', h: '#7a5230', w: '#ffffff' },
  { m: '#c0533f', E: '#ffe27a', W: '#ffffff', h: '#2a1810', w: '#ffffff' },
  { m: '#8a4fc0', E: '#b6ff6a', W: '#b6ff6a', h: '#241640', w: '#e0d0ff' },
];

export class Enemy {
  x: number;
  y: number;
  maxHp: number;
  hp: number;
  speed: number;
  radius: number;
  damage: number;
  xpReward: number;
  tier: number;
  hitFlash = 0;
  alive = true;
  private sprite: string[];
  private palette: Record<string, string>;
  private cell: number;

  constructor(x: number, y: number, difficulty: number, tier: number) {
    this.x = x;
    this.y = y;
    this.tier = tier;
    const tierMult = 1 + tier * 0.8; // big jump every tier
    this.maxHp = Math.round((12 + difficulty * 1.5) * tierMult);
    this.hp = this.maxHp;
    this.speed = Math.min(175, 50 + difficulty * 1.5 + tier * 12);
    this.damage = Math.round((5 + difficulty * 0.5) * (1 + tier * 0.4));
    this.xpReward = Math.round(12 + this.maxHp * 0.5 + difficulty * 1.5);
    this.radius = 13 + tier * 4;
    const idx = Math.min(tier, ENEMY_SPRITES.length - 1);
    this.sprite = ENEMY_SPRITES[idx];
    this.palette = ENEMY_PALETTES[idx];
    this.cell = CELL + Math.min(tier, 4);
  }

  update(dt: number, tx: number, ty: number): void {
    const ang = Math.atan2(ty - this.y, tx - this.x);
    this.x += Math.cos(ang) * this.speed * dt;
    this.y += Math.sin(ang) * this.speed * dt;
    this.x = Math.min(W - WALL - this.radius, Math.max(WALL + this.radius, this.x));
    this.y = Math.min(H - WALL - this.radius, Math.max(WALL + this.radius, this.y));
    this.hitFlash = Math.max(0, this.hitFlash - dt);
  }

  hurt(dmg: number): void {
    this.hp -= dmg;
    this.hitFlash = 0.12;
    if (this.hp <= 0) this.alive = false;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const flash = this.hitFlash > 0;
    const cell = this.cell;
    const cols = this.sprite[0].length;
    const ox = Math.round((this.x - (cols / 2) * cell) / cell) * cell;
    const oy = Math.round((this.y - 4 * cell) / cell) * cell;
    for (let r = 0; r < this.sprite.length; r++) {
      const row = this.sprite[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === '.') continue;
        ctx.fillStyle = flash ? '#ffffff' : this.palette[ch] ?? this.palette.m;
        ctx.fillRect(ox + c * cell, oy + r * cell, cell, cell);
      }
    }

    // health bar once damaged
    if (this.hp < this.maxHp) {
      const w = this.radius * 1.8;
      const bx = this.x - w / 2;
      const by = this.y - this.radius - 8;
      ctx.fillStyle = '#3a3030';
      ctx.fillRect(bx, by, w, 3);
      ctx.fillStyle = '#5ad36a';
      ctx.fillRect(bx, by, w * Math.max(0, this.hp / this.maxHp), 3);
    }
  }
}
