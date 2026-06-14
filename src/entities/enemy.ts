import { W, H, WALL } from '../constants';
import { CELL } from './sprite';

// Cheese-thieving vermin (the "Fillings"). Each archetype has its own silhouette
// + behaviour; difficulty tiers (every 15 rooms) make them bigger and add a
// coloured glow.
//   m body   E eye   h horn   w fang
export type EnemyKind = 'chaser' | 'darter' | 'spitter' | 'bruiser' | 'splitter';

interface Archetype {
  sprite: string[];
  palette: Record<string, string>;
  hpMul: number;
  speedMul: number;
  dmgMul: number;
  radius: number;
  color: string; // representative colour for death particles / glow
}

const ARCHETYPES: Record<EnemyKind, Archetype> = {
  chaser: {
    sprite: [
      '.m......m.',
      '.mm....mm.',
      '..mmmmmm..',
      '.mmmmmmmm.',
      '.mEmmmmEm.',
      '.mmmmmmmm.',
      '..mmmmmm..',
      '...mmmm...',
    ],
    palette: { m: '#9a93a8', E: '#ff5a5a' },
    hpMul: 1,
    speedMul: 1,
    dmgMul: 1,
    radius: 13,
    color: '#9a93a8',
  },
  darter: {
    sprite: [
      '..........',
      '...m..m...',
      '..mmmmmm..',
      '.mEmmmmEm.',
      '.mmmmmmmm.',
      '..mmmmmm..',
      '...mmmm...',
      '..........',
    ],
    palette: { m: '#4ad0c0', E: '#ffffff' },
    hpMul: 0.6,
    speedMul: 1.9,
    dmgMul: 0.8,
    radius: 11,
    color: '#4ad0c0',
  },
  spitter: {
    sprite: [
      '..........',
      '..mmmmmm..',
      '.mmmmmmmm.',
      '.mEmmmmEm.',
      'mmmmmmmmmw',
      '.mmmmmmmm.',
      '..mmmmmm..',
      '..........',
    ],
    palette: { m: '#7bbf5a', E: '#1d1d1d', w: '#ffd23f' },
    hpMul: 0.8,
    speedMul: 0.8,
    dmgMul: 1,
    radius: 13,
    color: '#7bbf5a',
  },
  bruiser: {
    sprite: [
      'h........h',
      'hh.mmmm.hh',
      '..mmmmmm..',
      '.mmmmmmmm.',
      '.mEmmmmEm.',
      '.mmmmmmmm.',
      '.mwwmmwwm.',
      '..mmmmmm..',
    ],
    palette: { m: '#c0533f', E: '#ffe27a', h: '#2a1810', w: '#ffffff' },
    hpMul: 2.4,
    speedMul: 0.7,
    dmgMul: 1.6,
    radius: 18,
    color: '#c0533f',
  },
  splitter: {
    sprite: [
      '..........',
      '..mmmmmm..',
      '.mmmmmmmm.',
      '.mEmmmmEm.',
      '.mmm..mmm.',
      '.mmmmmmmm.',
      '..mmmmmm..',
      '..........',
    ],
    palette: { m: '#e0883a', E: '#2a1d10' },
    hpMul: 1.2,
    speedMul: 0.95,
    dmgMul: 1,
    radius: 14,
    color: '#e0883a',
  },
};

export class Enemy {
  x: number;
  y: number;
  vx = 0; // knockback velocity
  vy = 0;
  maxHp: number;
  hp: number;
  speed: number;
  radius: number;
  damage: number;
  xpReward: number;
  tier: number;
  kind: EnemyKind;
  color: string;
  canSplit: boolean;
  hitFlash = 0;
  alive = true;
  // behaviour state
  wantsFire = false;
  fireAngle = 0;
  private wobble = Math.random() * Math.PI * 2;
  private fireTimer: number;
  private state: 'approach' | 'windup' | 'lunge' | 'recover' = 'approach';
  private stateT = 0;
  private lungeAngle = 0;
  protected sprite: string[];
  protected palette: Record<string, string>;
  protected cell: number;

  constructor(x: number, y: number, difficulty: number, tier: number, kind: EnemyKind) {
    this.x = x;
    this.y = y;
    this.tier = tier;
    this.kind = kind;
    const a = ARCHETYPES[kind];
    const tierMult = 1 + tier * 0.9; // big jump every tier
    // scales harder, faster with depth (a roguelike talent system will later give
    // the player tools to keep up)
    this.maxHp = Math.max(1, Math.round((12 + difficulty * 2.0) * tierMult * a.hpMul));
    this.hp = this.maxHp;
    this.speed = Math.min(245, (52 + difficulty * 1.9 + tier * 13) * a.speedMul);
    this.damage = Math.round((6 + difficulty * 0.9) * (1 + tier * 0.55) * a.dmgMul);
    this.xpReward = Math.round((12 + this.maxHp * 0.5 + difficulty * 1.5) * 1.25);
    // Sprite cells must be whole buffer pixels (CELL = 1 buffer px) or the
    // upscale smears them, so size grows in integer steps. Radius tracks the
    // sprite so the hitbox stays matched as they get bigger.
    const scale = 1 + Math.min(2, Math.floor(tier / 2)); // 1, 1, 2, 2, 3
    this.radius = Math.round(a.radius * scale);
    this.color = a.color;
    this.canSplit = kind === 'splitter';
    this.fireTimer = 1 + Math.random();
    this.sprite = a.sprite;
    this.palette = a.palette;
    this.cell = CELL * scale;
  }

  knockback(dx: number, dy: number, force: number): void {
    const d = Math.hypot(dx, dy) || 1;
    this.vx += (dx / d) * force;
    this.vy += (dy / d) * force;
  }

  update(dt: number, tx: number, ty: number): void {
    // knockback impulse, decaying
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const fr = Math.exp(-9 * dt);
    this.vx *= fr;
    this.vy *= fr;

    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ang = Math.atan2(dy, dx);
    let mvx = 0;
    let mvy = 0;

    if (this.kind === 'darter') {
      this.wobble += dt * 9;
      const a = ang + Math.sin(this.wobble) * 0.7;
      mvx = Math.cos(a) * this.speed;
      mvy = Math.sin(a) * this.speed;
    } else if (this.kind === 'spitter') {
      const want = 230;
      const dir = dist > want + 50 ? 1 : dist < want ? -1 : 0;
      mvx = Math.cos(ang) * this.speed * dir - Math.sin(ang) * this.speed * 0.4;
      mvy = Math.sin(ang) * this.speed * dir + Math.cos(ang) * this.speed * 0.4;
      this.fireTimer -= dt;
      if (this.fireTimer <= 0 && dist < 520) {
        this.fireTimer = 1.6;
        this.wantsFire = true;
        this.fireAngle = ang;
      }
    } else if (this.kind === 'bruiser') {
      this.stateT -= dt;
      if (this.state === 'approach') {
        mvx = Math.cos(ang) * this.speed;
        mvy = Math.sin(ang) * this.speed;
        if (dist < 210) {
          this.state = 'windup';
          this.stateT = 0.5;
        }
      } else if (this.state === 'windup') {
        this.lungeAngle = ang;
        if (this.stateT <= 0) {
          this.state = 'lunge';
          this.stateT = 0.3;
        }
      } else if (this.state === 'lunge') {
        mvx = Math.cos(this.lungeAngle) * this.speed * 4.5;
        mvy = Math.sin(this.lungeAngle) * this.speed * 4.5;
        if (this.stateT <= 0) {
          this.state = 'recover';
          this.stateT = 0.7;
        }
      } else {
        mvx = Math.cos(ang) * this.speed * 0.3;
        mvy = Math.sin(ang) * this.speed * 0.3;
        if (this.stateT <= 0) this.state = 'approach';
      }
    } else {
      // chaser / splitter
      mvx = Math.cos(ang) * this.speed;
      mvy = Math.sin(ang) * this.speed;
    }

    this.x += mvx * dt;
    this.y += mvy * dt;
    this.x = Math.min(W - WALL - this.radius, Math.max(WALL + this.radius, this.x));
    this.y = Math.min(H - WALL - this.radius, Math.max(WALL + this.radius, this.y));
    this.hitFlash = Math.max(0, this.hitFlash - dt);
  }

  hurt(dmg: number): void {
    this.hp -= dmg;
    this.hitFlash = 0.1;
    if (this.hp <= 0) this.alive = false;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // bruiser lunge telegraph
    if (this.kind === 'bruiser' && this.state === 'windup') {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#ff5a5a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const flash = this.hitFlash > 0;
    const cell = this.cell;
    const cols = this.sprite[0].length;
    // snap to the buffer-pixel grid (CELL), not the cell size, so it stays crisp
    const ox = Math.round((this.x - (cols / 2) * cell) / CELL) * CELL;
    const oy = Math.round((this.y - (this.sprite.length / 2) * cell) / CELL) * CELL;
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
