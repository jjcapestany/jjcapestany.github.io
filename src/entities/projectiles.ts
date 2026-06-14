import { CELL, pixel } from './sprite';

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

// A projectile fired by a spitter enemy or a boss.
export class EnemyBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius = 7;
  damage: number;
  color: string;
  alive = true;

  constructor(x: number, y: number, angle: number, speed: number, damage: number, color: string) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.damage = damage;
    this.color = color;
  }

  update(dt: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    pixel(ctx, this.x, this.y, CELL * 2, this.color);
    pixel(ctx, this.x, this.y, CELL, '#ffffff');
  }
}

// A short-lived debris square for hit/death bursts.
export class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;

  constructor(x: number, y: number, color: string) {
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 150;
    this.x = x;
    this.y = y;
    this.vx = Math.cos(a) * sp;
    this.vy = Math.sin(a) * sp;
    this.maxLife = 0.3 + Math.random() * 0.3;
    this.life = this.maxLife;
    this.color = color;
    this.size = CELL * (1 + Math.floor(Math.random() * 2));
  }

  update(dt: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const fr = Math.exp(-6 * dt);
    this.vx *= fr;
    this.vy *= fr;
    this.life -= dt;
  }

  get dead(): boolean {
    return this.life <= 0;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    ctx.restore();
  }
}
