import { W, H } from '../constants';
import { ITEMS } from '../items';
import type { Player, Enemy } from '../entities';
import type { Input } from '../input';

// What the auto-attack items need from the world each frame. Passed in rather
// than reaching into Game, so this subsystem owns only its own state.
export interface ItemWorld {
  player: Player;
  enemies: Enemy[];
  input: Input;
  damageEnemy(e: Enemy, dmg: number, sx: number, sy: number): void;
}

// The automatic attack-items: they damage enemies on their own, independent of
// the equipped weapon, scaling off character level × item level. This holds all
// of their runtime state and rendering; the game just feeds it the world.
export class ItemAttacks {
  private auraTick = 0;
  private wheelAngle = 0;
  private wheelTick = 0;
  private novaTick = 0;
  private boltTick = 0;
  private crumbTick = 0;
  private crumbDmgTick = 0;
  private curdBolts: { x: number; y: number; angle: number; life: number }[] = [];
  private crumbs: { x: number; y: number; life: number }[] = [];
  private rings: { x: number; y: number; t: number; dur: number; r: number; color: string }[] = [];

  // Effects don't follow you between rooms (matches Game.clearEffects).
  clear(): void {
    this.curdBolts = [];
    this.crumbs = [];
    this.rings = [];
    this.auraTick = 0;
  }

  update(dt: number, w: ItemWorld): void {
    this.updateAura(dt, w);
    this.updateWheels(dt, w);
    this.updateNova(dt, w);
    this.updateBolts(dt, w);
    this.updateCrumbs(dt, w);
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter((r) => r.t < r.dur);
  }

  private itemDamage(player: Player, id: string): number {
    const lvl = player.getItemLevel(id);
    return ITEMS.find((i) => i.id === id)!.value(player.level, lvl);
  }

  private nearestEnemyTo(enemies: Enemy[], x: number, y: number): Enemy | null {
    let best: Enemy | null = null;
    let bd = Infinity;
    for (const e of enemies) {
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  // STINKY AURA — continuous damage to everything in a radius around you.
  private updateAura(dt: number, w: ItemWorld): void {
    const lvl = w.player.getItemLevel('aura');
    if (lvl <= 0) return;
    this.auraTick -= dt;
    if (this.auraTick > 0) return;
    this.auraTick = 0.5;
    const r = ITEMS.find((i) => i.id === 'aura')!.radius!(w.player.level, lvl);
    const dmg = this.itemDamage(w.player, 'aura');
    for (const e of w.enemies) {
      if (Math.hypot(e.x - w.player.x, e.y - w.player.y) <= r + e.radius)
        w.damageEnemy(e, dmg, w.player.x, w.player.y);
    }
  }

  // CHEESE WHEELS — orbiting wheels that damage whatever they roll over.
  private updateWheels(dt: number, w: ItemWorld): void {
    const lvl = w.player.getItemLevel('wheels');
    if (lvl <= 0) return;
    this.wheelAngle += dt * 2.4;
    this.wheelTick -= dt;
    if (this.wheelTick > 0) return;
    this.wheelTick = 0.2;
    const dmg = this.itemDamage(w.player, 'wheels');
    const count = 1 + lvl;
    const orbit = 78;
    for (let k = 0; k < count; k++) {
      const a = this.wheelAngle + (k * Math.PI * 2) / count;
      const wx = w.player.x + Math.cos(a) * orbit;
      const wy = w.player.y + Math.sin(a) * orbit;
      for (const e of w.enemies) {
        if (Math.hypot(e.x - wx, e.y - wy) <= 11 + e.radius) w.damageEnemy(e, dmg, wx, wy);
      }
    }
  }

  // CHEESE NOVA — periodic shockwave burst from the player.
  private updateNova(dt: number, w: ItemWorld): void {
    const lvl = w.player.getItemLevel('nova');
    if (lvl <= 0) return;
    this.novaTick -= dt;
    if (this.novaTick > 0) return;
    this.novaTick = Math.max(0.8, 2.5 - lvl * 0.2);
    const def = ITEMS.find((i) => i.id === 'nova')!;
    const r = def.radius!(w.player.level, lvl);
    const dmg = this.itemDamage(w.player, 'nova');
    for (const e of w.enemies) {
      if (Math.hypot(e.x - w.player.x, e.y - w.player.y) <= r + e.radius)
        w.damageEnemy(e, dmg, w.player.x, w.player.y);
    }
    this.rings.push({ x: w.player.x, y: w.player.y, t: 0, dur: 0.4, r, color: def.color });
  }

  // CURD BOLTS — periodically fire a homing glob at the nearest enemy.
  private updateBolts(dt: number, w: ItemWorld): void {
    const lvl = w.player.getItemLevel('bolts');
    if (lvl > 0) {
      this.boltTick -= dt;
      if (this.boltTick <= 0) {
        this.boltTick = Math.max(0.3, 1.0 - lvl * 0.1);
        const target = this.nearestEnemyTo(w.enemies, w.player.x, w.player.y);
        if (target) {
          const a = Math.atan2(target.y - w.player.y, target.x - w.player.x);
          this.curdBolts.push({ x: w.player.x, y: w.player.y, angle: a, life: 2 });
        }
      }
    }
    const dmg = this.itemDamage(w.player, 'bolts');
    for (const b of this.curdBolts) {
      b.life -= dt;
      const target = this.nearestEnemyTo(w.enemies, b.x, b.y);
      if (target) {
        let d = Math.atan2(target.y - b.y, target.x - b.x) - b.angle;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        b.angle += Math.max(-6 * dt, Math.min(6 * dt, d)); // steer toward it
      }
      b.x += Math.cos(b.angle) * 320 * dt;
      b.y += Math.sin(b.angle) * 320 * dt;
      for (const e of w.enemies) {
        if (Math.hypot(e.x - b.x, e.y - b.y) <= 6 + e.radius) {
          w.damageEnemy(e, dmg, b.x, b.y);
          b.life = 0;
          break;
        }
      }
    }
    this.curdBolts = this.curdBolts.filter((b) => b.life > 0 && b.x > 0 && b.x < W && b.y > 0 && b.y < H);
  }

  // CRUMB TRAIL — drop damaging crumbs as you move.
  private updateCrumbs(dt: number, w: ItemWorld): void {
    const lvl = w.player.getItemLevel('crumbs');
    if (lvl > 0) {
      const moving = w.input.isDown('w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright');
      this.crumbTick -= dt;
      if (this.crumbTick <= 0 && moving) {
        this.crumbTick = 0.3;
        this.crumbs.push({ x: w.player.x, y: w.player.y, life: 3 });
      }
    }
    this.crumbDmgTick -= dt;
    const doDamage = this.crumbDmgTick <= 0;
    if (doDamage) this.crumbDmgTick = 0.4;
    const dmg = this.itemDamage(w.player, 'crumbs');
    for (const c of this.crumbs) {
      c.life -= dt;
      if (doDamage && lvl > 0) {
        for (const e of w.enemies) {
          if (Math.hypot(e.x - c.x, e.y - c.y) <= 22 + e.radius) w.damageEnemy(e, dmg, c.x, c.y);
        }
      }
    }
    this.crumbs = this.crumbs.filter((c) => c.life > 0);
  }

  // Drawn under the enemies: ground-level effects.
  drawUnder(ctx: CanvasRenderingContext2D, player: Player, time: number): void {
    this.drawAura(ctx, player, time);
    this.drawCrumbs(ctx);
    this.drawRings(ctx);
  }

  // Drawn over the enemies: orbiting wheels and homing bolts.
  drawOver(ctx: CanvasRenderingContext2D, player: Player): void {
    this.drawWheels(ctx, player);
    this.drawBolts(ctx);
  }

  private drawWheels(ctx: CanvasRenderingContext2D, player: Player): void {
    const lvl = player.getItemLevel('wheels');
    if (lvl <= 0) return;
    const count = 1 + lvl;
    const orbit = 78;
    for (let k = 0; k < count; k++) {
      const a = this.wheelAngle + (k * Math.PI * 2) / count;
      const wx = player.x + Math.cos(a) * orbit;
      const wy = player.y + Math.sin(a) * orbit;
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(wx, wy, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#e0a818';
      ctx.stroke();
      ctx.fillStyle = '#cf8f0c';
      ctx.beginPath();
      ctx.arc(wx - 3, wy - 2, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(wx + 3, wy + 2, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawBolts(ctx: CanvasRenderingContext2D): void {
    for (const b of this.curdBolts) {
      ctx.fillStyle = '#fff3b0';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#cf8f0c';
      ctx.beginPath();
      ctx.arc(b.x, b.y - 1, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawCrumbs(ctx: CanvasRenderingContext2D): void {
    for (const c of this.crumbs) {
      ctx.save();
      ctx.globalAlpha = 0.55 * Math.min(1, c.life / 3);
      ctx.fillStyle = '#e8b04a';
      ctx.fillRect(c.x - 9, c.y - 3, 6, 6);
      ctx.fillRect(c.x + 2, c.y + 1, 5, 5);
      ctx.fillRect(c.x - 2, c.y + 5, 4, 4);
      ctx.restore();
    }
  }

  private drawRings(ctx: CanvasRenderingContext2D): void {
    for (const ring of this.rings) {
      const p = ring.t / ring.dur;
      ctx.save();
      ctx.globalAlpha = 0.5 * (1 - p);
      ctx.lineWidth = 4;
      ctx.strokeStyle = ring.color;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r * p, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawAura(ctx: CanvasRenderingContext2D, player: Player, time: number): void {
    const lvl = player.getItemLevel('aura');
    if (lvl <= 0) return;
    const def = ITEMS.find((i) => i.id === 'aura')!;
    const r = def.radius!(player.level, lvl);
    const pulse = 0.5 + 0.5 * Math.sin(time * 4);
    ctx.save();
    ctx.fillStyle = def.color;
    ctx.globalAlpha = 0.1 + 0.05 * pulse;
    ctx.beginPath();
    ctx.arc(player.x, player.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2;
    ctx.strokeStyle = def.color;
    ctx.beginPath();
    ctx.arc(player.x, player.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
