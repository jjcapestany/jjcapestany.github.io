import { W, H, WALL, DOOR_HALF } from './constants';
import { Input } from './input';
import { Player, Arrow, Explosion, Enemy, SWORD_REACH } from './entities';
import { Room } from './room';
import { SPECS, type Spec } from './specs';
import { ITEMS, type Item } from './items';
import { loadSave, writeSave, totalRuns, type SaveData } from './save';

type Phase = 'select' | 'playing' | 'powerup';

const FONT = '"Press Start 2P", monospace';
const ARROW_DMG = 2;
const SWORD_DMG = 3;
const BLAST_DMG = 3;

export class Game {
  input: Input;
  player = new Player();
  private phase: Phase = 'select';
  private spec: Spec | null = null;
  private time = 0;
  private save: SaveData = loadSave();
  // Visited rooms, cached by "rx,ry". Rooms are deterministic from their
  // coordinates, so this also guarantees a room looks the same on return.
  // Only a 5x5 window of rooms around the player is kept "live"; rooms that
  // scroll outside it are discarded and regenerate fresh (shifting world).
  private rooms = new Map<string, Room>();
  private rx = 0;
  private ry = 0;
  private room: Room;
  private roomsExplored = 0; // monotonic; drives difficulty + tier
  private arrows: Arrow[] = [];
  private explosions: Explosion[] = [];
  private swordHit = new Set<Enemy>(); // enemies already struck by the current swing
  // milestone powerups: granted at levels 10, 20, ... the first time, once a room is clear
  private lastMilestoneAwarded = 0;
  private milestoneLevel = 0;
  private powerupOptions: Item[] = [];
  private selectedPowerup = -1; // highlighted but not yet confirmed
  // automatic attack-item state
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

  constructor(canvas: HTMLCanvasElement) {
    this.input = new Input(canvas);
    this.room = this.getRoom(0, 0);
    this.populate(this.room); // start room — never spawns enemies
    // each page load counts as a visit
    this.save.visits += 1;
    writeSave(this.save);
  }

  // Spawn a room's enemies the first time it's entered. The first room (0,0) is
  // always safe; everywhere else, strength scales with how many rooms you've
  // explored so far.
  private populate(room: Room): void {
    if (room.populated) return;
    room.populated = true;
    if (room.rx === 0 && room.ry === 0) return;
    const difficulty = this.roomsExplored;
    const tier = Math.floor(this.roomsExplored / 15); // big jump every 15 rooms
    const count = 2 + Math.min(2, tier); // fewer enemies, tankier ones
    const safe = 170; // keep enemies away from where the player just entered
    for (let i = 0; i < count; i++) {
      let x = 0;
      let y = 0;
      let tries = 0;
      do {
        x = WALL + 40 + Math.random() * (W - 2 * WALL - 80);
        y = WALL + 40 + Math.random() * (H - 2 * WALL - 80);
        tries++;
      } while (Math.hypot(x - this.player.x, y - this.player.y) < safe && tries < 24);
      room.enemies.push(new Enemy(x, y, difficulty, tier));
    }
  }

  // Drop rooms more than 2 away from the player so only a 5x5 window persists.
  private pruneRooms(): void {
    for (const key of [...this.rooms.keys()]) {
      const c = key.indexOf(',');
      const kx = Number(key.slice(0, c));
      const ky = Number(key.slice(c + 1));
      if (Math.max(Math.abs(kx - this.rx), Math.abs(ky - this.ry)) > 2) this.rooms.delete(key);
    }
  }

  private getRoom(rx: number, ry: number): Room {
    const key = `${rx},${ry}`;
    let room = this.rooms.get(key);
    if (!room) {
      room = new Room(rx, ry);
      this.rooms.set(key, room);
    }
    return room;
  }

  private changeRoom(dx: number, dy: number, newX: number, newY: number): void {
    this.rx += dx;
    this.ry += dy;
    // only count genuinely new rooms (a fresh one, or one regenerated after it
    // scrolled out of the window) — backtracking within the 5x5 is free
    if (!this.rooms.has(`${this.rx},${this.ry}`)) this.roomsExplored += 1;
    this.room = this.getRoom(this.rx, this.ry);
    this.player.x = newX;
    this.player.y = newY;
    this.populate(this.room); // after positioning, so enemies avoid the entrance
    this.pruneRooms(); // keep only the 5x5 window centred on the player
    this.clearEffects(); // effects don't follow you between rooms
  }

  private clearEffects(): void {
    this.arrows = [];
    this.explosions = [];
    this.curdBolts = [];
    this.crumbs = [];
    this.rings = [];
  }

  // Keep the player inside the walls, but let them step through an existing
  // door into the neighbouring room — arriving at the matching door opposite.
  private updateBounds(): void {
    const p = this.player;
    const r = p.radius;
    const minX = WALL + r;
    const maxX = W - WALL - r;
    const minY = WALL + r;
    const maxY = H - WALL - r;
    const inDoorX = Math.abs(p.x - W / 2) < DOOR_HALF;
    const inDoorY = Math.abs(p.y - H / 2) < DOOR_HALF;
    const doors = this.room.doors;

    if (p.x < minX) {
      if (inDoorY && doors.west) return this.changeRoom(-1, 0, maxX, p.y);
      p.x = minX;
    } else if (p.x > maxX) {
      if (inDoorY && doors.east) return this.changeRoom(1, 0, minX, p.y);
      p.x = maxX;
    }

    if (p.y < minY) {
      if (inDoorX && doors.north) return this.changeRoom(0, -1, p.x, maxY);
      p.y = minY;
    } else if (p.y > maxY) {
      if (inDoorX && doors.south) return this.changeRoom(0, 1, p.x, minY);
      p.y = maxY;
    }
  }

  update(dt: number): void {
    this.time += dt;
    if (this.phase === 'select') {
      this.updateSelect();
      return;
    }
    if (this.phase === 'powerup') {
      this.updatePowerup();
      return;
    }
    this.player.update(dt, this.input);
    this.updateBounds();
    this.handleFiring();
    this.updateArrows(dt);
    for (const ex of this.explosions) ex.update(dt);
    this.explosions = this.explosions.filter((e) => e.alive);
    this.updateEnemies(dt);
    this.applySwordHits();
    this.updateItemAttacks(dt);
    this.reapEnemies();
    this.checkMilestone();
  }

  // Automatic attack-items that damage enemies on their own, independent of your
  // weapon. Each is driven here off the equipped item levels.
  private updateItemAttacks(dt: number): void {
    this.updateAura(dt);
    this.updateWheels(dt);
    this.updateNova(dt);
    this.updateBolts(dt);
    this.updateCrumbs(dt);
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter((r) => r.t < r.dur);
  }

  private itemDamage(id: string): number {
    const lvl = this.player.getItemLevel(id);
    return ITEMS.find((i) => i.id === id)!.value(this.player.level, lvl);
  }

  private nearestEnemyTo(x: number, y: number): Enemy | null {
    let best: Enemy | null = null;
    let bd = Infinity;
    for (const e of this.room.enemies) {
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  // STINKY AURA — continuous damage to everything in a radius around you.
  private updateAura(dt: number): void {
    const lvl = this.player.getItemLevel('aura');
    if (lvl <= 0) return;
    this.auraTick -= dt;
    if (this.auraTick > 0) return;
    this.auraTick = 0.5;
    const r = ITEMS.find((i) => i.id === 'aura')!.radius!(this.player.level, lvl);
    const dmg = this.itemDamage('aura');
    for (const e of this.room.enemies) {
      if (Math.hypot(e.x - this.player.x, e.y - this.player.y) <= r + e.radius) e.hurt(dmg);
    }
  }

  // CHEESE WHEELS — orbiting wheels that damage whatever they roll over.
  private updateWheels(dt: number): void {
    const lvl = this.player.getItemLevel('wheels');
    if (lvl <= 0) return;
    this.wheelAngle += dt * 2.4;
    this.wheelTick -= dt;
    if (this.wheelTick > 0) return;
    this.wheelTick = 0.2;
    const dmg = this.itemDamage('wheels');
    const count = 1 + lvl;
    const orbit = 78;
    for (let k = 0; k < count; k++) {
      const a = this.wheelAngle + (k * Math.PI * 2) / count;
      const wx = this.player.x + Math.cos(a) * orbit;
      const wy = this.player.y + Math.sin(a) * orbit;
      for (const e of this.room.enemies) {
        if (Math.hypot(e.x - wx, e.y - wy) <= 11 + e.radius) e.hurt(dmg);
      }
    }
  }

  // CHEESE NOVA — periodic shockwave burst from the player.
  private updateNova(dt: number): void {
    const lvl = this.player.getItemLevel('nova');
    if (lvl <= 0) return;
    this.novaTick -= dt;
    if (this.novaTick > 0) return;
    this.novaTick = Math.max(0.8, 2.5 - lvl * 0.2);
    const def = ITEMS.find((i) => i.id === 'nova')!;
    const r = def.radius!(this.player.level, lvl);
    const dmg = this.itemDamage('nova');
    for (const e of this.room.enemies) {
      if (Math.hypot(e.x - this.player.x, e.y - this.player.y) <= r + e.radius) e.hurt(dmg);
    }
    this.rings.push({ x: this.player.x, y: this.player.y, t: 0, dur: 0.4, r, color: def.color });
  }

  // CURD BOLTS — periodically fire a homing glob at the nearest enemy.
  private updateBolts(dt: number): void {
    const lvl = this.player.getItemLevel('bolts');
    if (lvl > 0) {
      this.boltTick -= dt;
      if (this.boltTick <= 0) {
        this.boltTick = Math.max(0.3, 1.0 - lvl * 0.1);
        const target = this.nearestEnemyTo(this.player.x, this.player.y);
        if (target) {
          const a = Math.atan2(target.y - this.player.y, target.x - this.player.x);
          this.curdBolts.push({ x: this.player.x, y: this.player.y, angle: a, life: 2 });
        }
      }
    }
    const dmg = this.itemDamage('bolts');
    for (const b of this.curdBolts) {
      b.life -= dt;
      const target = this.nearestEnemyTo(b.x, b.y);
      if (target) {
        let d = Math.atan2(target.y - b.y, target.x - b.x) - b.angle;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        b.angle += Math.max(-6 * dt, Math.min(6 * dt, d)); // steer toward it
      }
      b.x += Math.cos(b.angle) * 320 * dt;
      b.y += Math.sin(b.angle) * 320 * dt;
      for (const e of this.room.enemies) {
        if (Math.hypot(e.x - b.x, e.y - b.y) <= 6 + e.radius) {
          e.hurt(dmg);
          b.life = 0;
          break;
        }
      }
    }
    this.curdBolts = this.curdBolts.filter((b) => b.life > 0 && b.x > 0 && b.x < W && b.y > 0 && b.y < H);
  }

  // CRUMB TRAIL — drop damaging crumbs as you move.
  private updateCrumbs(dt: number): void {
    const lvl = this.player.getItemLevel('crumbs');
    if (lvl > 0) {
      const moving = this.input.isDown('w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright');
      this.crumbTick -= dt;
      if (this.crumbTick <= 0 && moving) {
        this.crumbTick = 0.3;
        this.crumbs.push({ x: this.player.x, y: this.player.y, life: 3 });
      }
    }
    this.crumbDmgTick -= dt;
    const doDamage = this.crumbDmgTick <= 0;
    if (doDamage) this.crumbDmgTick = 0.4;
    const dmg = this.itemDamage('crumbs');
    for (const c of this.crumbs) {
      c.life -= dt;
      if (doDamage && lvl > 0) {
        for (const e of this.room.enemies) {
          if (Math.hypot(e.x - c.x, e.y - c.y) <= 22 + e.radius) e.hurt(dmg);
        }
      }
    }
    this.crumbs = this.crumbs.filter((c) => c.life > 0);
  }

  // When you first reach a level milestone (10, 20, ...) and the room is clear,
  // pause to offer a powerup choice.
  private checkMilestone(): void {
    if (this.room.enemies.length > 0) return;
    const next = this.lastMilestoneAwarded + 10;
    if (this.player.level >= next) this.openPowerup(next);
  }

  private openPowerup(level: number): void {
    this.milestoneLevel = level;
    this.powerupOptions = this.rollPowerupOptions();
    this.selectedPowerup = -1; // nothing chosen until confirmed
    this.phase = 'powerup';
  }

  // Offer 3 items. Until the player holds 3 uniques, draw from the whole pool;
  // after that, only offer owned items so the screen becomes "level up what you
  // have" instead of handing out a 4th unique.
  private rollPowerupOptions(): Item[] {
    const owned = this.player.equipped.map((e) => e.id);
    const pool = owned.length >= 3 ? ITEMS.filter((i) => owned.includes(i.id)) : ITEMS.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 3);
  }

  private confirmRect(): { x: number; y: number; w: number; h: number } {
    const w = 240;
    const h = 48;
    return { x: (W - w) / 2, y: 512, w, h };
  }

  private updatePowerup(): void {
    // keys just highlight a card; they never commit
    for (let i = 0; i < this.powerupOptions.length; i++) {
      if (this.input.isDown(String(i + 1))) this.selectedPowerup = i;
    }
    if (this.input.isDown('enter') && this.selectedPowerup >= 0) {
      this.applyPowerup();
      return;
    }
    if (!this.input.consumeClick()) return;
    // a click on a card only selects it
    for (let i = 0; i < this.powerupOptions.length; i++) {
      if (this.hovered(this.cardRect(i))) {
        this.selectedPowerup = i;
        return;
      }
    }
    // ...applying only happens via the confirm button
    if (this.selectedPowerup >= 0 && this.hovered(this.confirmRect())) this.applyPowerup();
  }

  private applyPowerup(): void {
    this.player.addItem(this.powerupOptions[this.selectedPowerup].id);
    this.lastMilestoneAwarded = this.milestoneLevel;
    // if more milestones are already pending, offer the next one immediately
    const next = this.lastMilestoneAwarded + 10;
    if (this.player.level >= next) this.openPowerup(next);
    else this.phase = 'playing';
  }

  private updateEnemies(dt: number): void {
    const p = this.player;
    for (const e of this.room.enemies) {
      e.update(dt, p.x, p.y);
      if (p.invuln <= 0 && e.alive) {
        const dx = p.x - e.x;
        const dy = p.y - e.y;
        const dist = Math.hypot(dx, dy);
        if (dist < p.radius + e.radius) {
          p.hp -= e.damage;
          p.invuln = 1.0;
          const k = 26 / (dist || 1);
          p.x += dx * k;
          p.y += dy * k;
          if (p.hp <= 0) {
            this.respawn();
            return;
          }
        }
      }
    }
  }

  // Sword hits everything inside the 180° arc within reach, once per swing.
  private applySwordHits(): void {
    const p = this.player;
    if (!p.swingActive) return;
    for (const e of this.room.enemies) {
      if (this.swordHit.has(e)) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      if (Math.hypot(dx, dy) > SWORD_REACH + e.radius) continue;
      let d = Math.atan2(dy, dx) - p.swingAim;
      d = Math.atan2(Math.sin(d), Math.cos(d)); // normalise to [-π, π]
      if (Math.abs(d) <= Math.PI / 2) {
        e.hurt(this.damageFor(SWORD_DMG));
        this.swordHit.add(e);
      }
    }
  }

  // Remove dead enemies and award their XP.
  private reapEnemies(): void {
    const survivors: Enemy[] = [];
    for (const e of this.room.enemies) {
      if (e.alive) survivors.push(e);
      else this.player.gainXp(e.xpReward);
    }
    this.room.enemies = survivors;
  }

  private respawn(): void {
    const p = this.player;
    p.hp = p.maxHp;
    p.invuln = 1.5;
    this.rx = 0;
    this.ry = 0;
    this.room = this.getRoom(0, 0);
    this.pruneRooms();
    p.x = W / 2;
    p.y = H / 2;
    this.clearEffects();
  }

  // All weapons scale off character level so offense keeps pace as you grow,
  // with item/Sharp-Edge damage layered on top.
  private damageFor(base: number): number {
    return base + Math.floor(this.player.level / 2) + this.player.damageBonus;
  }

  private handleFiring(): void {
    const p = this.player;
    if (!this.input.mouseDown || p.fireCooldown > 0) return;
    if (p.weapon === 'bow') {
      const a = p.aim;
      this.arrows.push(new Arrow(p.x + Math.cos(a) * 18, p.y + Math.sin(a) * 18, a));
      p.fireCooldown = 0.35;
    } else if (p.weapon === 'sword') {
      p.startSwing();
      this.swordHit.clear(); // fresh swing can hit everything again
    } else if (p.weapon === 'wand') {
      // call down a blast at the cursor, clamped inside the room
      const x = Math.max(WALL, Math.min(W - WALL, this.input.mouseX));
      const y = Math.max(WALL, Math.min(H - WALL, this.input.mouseY));
      const blast = new Explosion(x, y, this.spec?.color ?? '#6c9cff');
      this.explosions.push(blast);
      for (const e of this.room.enemies) {
        if (Math.hypot(e.x - x, e.y - y) <= blast.maxRadius + e.radius) e.hurt(this.damageFor(BLAST_DMG));
      }
      p.fireCooldown = 0.45;
    }
  }

  private updateArrows(dt: number): void {
    for (const ar of this.arrows) {
      ar.update(dt);
      // arrows stop at the walls
      if (ar.x < WALL || ar.x > W - WALL || ar.y < WALL || ar.y > H - WALL) {
        ar.alive = false;
        continue;
      }
      // ...or on the first enemy they strike
      for (const e of this.room.enemies) {
        if (e.alive && Math.hypot(e.x - ar.x, e.y - ar.y) < e.radius + ar.radius) {
          e.hurt(this.damageFor(ARROW_DMG));
          ar.alive = false;
          break;
        }
      }
    }
    this.arrows = this.arrows.filter((a) => a.alive);
  }

  // Pixel-art world — rendered into the low-res buffer so it stays chunky.
  drawWorld(ctx: CanvasRenderingContext2D): void {
    if (this.phase === 'select') return; // world is visible while playing or choosing a powerup
    this.room.draw(ctx);
    this.drawAura(ctx);
    this.drawCrumbs(ctx);
    this.drawRings(ctx);
    for (const e of this.room.enemies) e.draw(ctx);
    this.drawWheels(ctx);
    this.drawBolts(ctx);
    for (const ar of this.arrows) ar.draw(ctx);
    this.player.draw(ctx);
    for (const ex of this.explosions) ex.draw(ctx);
  }

  private drawWheels(ctx: CanvasRenderingContext2D): void {
    const lvl = this.player.getItemLevel('wheels');
    if (lvl <= 0) return;
    const count = 1 + lvl;
    const orbit = 78;
    for (let k = 0; k < count; k++) {
      const a = this.wheelAngle + (k * Math.PI * 2) / count;
      const wx = this.player.x + Math.cos(a) * orbit;
      const wy = this.player.y + Math.sin(a) * orbit;
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

  private drawAura(ctx: CanvasRenderingContext2D): void {
    const lvl = this.player.getItemLevel('aura');
    if (lvl <= 0) return;
    const def = ITEMS.find((i) => i.id === 'aura')!;
    const r = def.radius!(this.player.level, lvl);
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 4);
    ctx.save();
    ctx.fillStyle = def.color;
    ctx.globalAlpha = 0.1 + 0.05 * pulse;
    ctx.beginPath();
    ctx.arc(this.player.x, this.player.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2;
    ctx.strokeStyle = def.color;
    ctx.beginPath();
    ctx.arc(this.player.x, this.player.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // UI — rendered at full resolution on the main canvas so text stays sharp.
  drawOverlay(ctx: CanvasRenderingContext2D): void {
    if (this.phase === 'select') {
      this.drawSelect(ctx);
      return;
    }
    if (this.phase === 'powerup') {
      this.drawStatus(ctx);
      this.drawPowerup(ctx);
      return;
    }
    this.drawMinimap(ctx);
    this.drawStatus(ctx);
    this.drawItems(ctx);
  }

  // Bottom-right tray: one slot per item, filling in as you collect uniques.
  private drawItems(ctx: CanvasRenderingContext2D): void {
    const box = 44;
    const gap = 8;
    const n = ITEMS.length;
    const x0 = W - 18 - (n * box + (n - 1) * gap);
    const y0 = H - 18 - box;

    ctx.textAlign = 'left';
    ctx.fillStyle = '#8a83a8';
    ctx.font = `8px ${FONT}`;
    ctx.fillText('ITEMS', x0, y0 - 7);

    let hovered = -1;
    for (let i = 0; i < n; i++) {
      const def = ITEMS[i];
      const lvl = this.player.getItemLevel(def.id);
      const bx = x0 + i * (box + gap);
      const over =
        this.input.mouseX >= bx &&
        this.input.mouseX <= bx + box &&
        this.input.mouseY >= y0 &&
        this.input.mouseY <= y0 + box;

      ctx.fillStyle = lvl > 0 ? '#171226' : 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(bx, y0, box, box);
      ctx.lineWidth = lvl > 0 && over ? 3 : 2;
      ctx.strokeStyle = lvl > 0 ? def.color : '#3a3a44';
      ctx.strokeRect(bx, y0, box, box);

      if (lvl > 0) {
        this.drawItemIcon(ctx, def.id, bx + box / 2, y0 + box / 2 - 1, def.color);
        // level number in the bottom-right corner
        ctx.textAlign = 'right';
        ctx.fillStyle = '#fff3b0';
        ctx.font = `8px ${FONT}`;
        ctx.fillText(String(lvl), bx + box - 4, y0 + box - 4);
        if (over) hovered = i;
      }
    }

    if (hovered >= 0) this.drawItemTooltip(ctx, ITEMS[hovered], y0);
    ctx.textAlign = 'left';
  }

  private drawItemIcon(ctx: CanvasRenderingContext2D, id: string, cx: number, cy: number, color: string): void {
    if (id === 'rind') {
      // health cross
      ctx.fillStyle = color;
      ctx.fillRect(cx - 3, cy - 9, 6, 18);
      ctx.fillRect(cx - 9, cy - 3, 18, 6);
    } else if (id === 'edge') {
      // little sword
      ctx.fillStyle = '#cfd2e0';
      ctx.fillRect(cx - 2, cy - 11, 4, 15);
      ctx.fillStyle = '#d9a441';
      ctx.fillRect(cx - 6, cy + 3, 12, 3);
      ctx.fillStyle = '#6b4423';
      ctx.fillRect(cx - 1, cy + 6, 2, 5);
    } else if (id === 'whey') {
      // lightning bolt (speed)
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(cx + 3, cy - 11);
      ctx.lineTo(cx - 7, cy + 2);
      ctx.lineTo(cx - 1, cy + 2);
      ctx.lineTo(cx - 3, cy + 11);
      ctx.lineTo(cx + 7, cy - 3);
      ctx.lineTo(cx + 1, cy - 3);
      ctx.closePath();
      ctx.fill();
    } else {
      // concentric rings (aura)
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawItemTooltip(ctx: CanvasRenderingContext2D, def: Item, trayY: number): void {
    const lvl = this.player.getItemLevel(def.id);
    const tw = 250;
    const th = 64;
    const tx = W - 18 - tw;
    const ty = trayY - 12 - th;
    const pad = 12;

    ctx.fillStyle = 'rgba(8, 6, 14, 0.95)';
    ctx.fillRect(tx, ty, tw, th);
    ctx.lineWidth = 2;
    ctx.strokeStyle = def.color;
    ctx.strokeRect(tx, ty, tw, th);

    ctx.textAlign = 'left';
    ctx.fillStyle = def.color;
    ctx.font = `12px ${FONT}`;
    ctx.fillText(def.name, tx + pad, ty + 22);
    ctx.fillStyle = '#8a83a8';
    ctx.font = `9px ${FONT}`;
    ctx.fillText(`LEVEL ${lvl}`, tx + pad, ty + 40);
    ctx.fillStyle = '#fff3b0';
    ctx.font = `10px ${FONT}`;
    ctx.fillText(def.describe(this.player.level, lvl), tx + pad, ty + 56);
  }

  private drawPowerup(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(16, 12, 28, 0.82)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.font = `30px ${FONT}`;
    ctx.fillText(`LEVEL ${this.milestoneLevel}`, W / 2, 110);
    ctx.fillStyle = '#fff3b0';
    ctx.font = `14px ${FONT}`;
    ctx.fillText('CHOOSE A POWER', W / 2, 158);
    ctx.fillStyle = '#8a83a8';
    ctx.font = `9px ${FONT}`;
    ctx.fillText('SELECT A CARD, THEN CONFIRM', W / 2, 188);

    for (let i = 0; i < this.powerupOptions.length; i++) {
      const item = this.powerupOptions[i];
      const r = this.cardRect(i);
      const selected = i === this.selectedPowerup;
      const hot = selected || this.hovered(r);
      const cx = r.x + r.w / 2;
      const owned = this.player.getItemLevel(item.id);
      const nextLevel = owned + 1;

      ctx.fillStyle = selected ? '#1f2e1f' : hot ? '#241a36' : '#1a1428';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = selected ? '#5ad36a' : item.color;
      ctx.fillRect(r.x, r.y, r.w, 6);
      ctx.lineWidth = selected || hot ? 4 : 2;
      ctx.strokeStyle = selected ? '#5ad36a' : hot ? '#ffd23f' : '#4a4360';
      ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);

      ctx.fillStyle = '#ffd23f';
      ctx.font = `16px ${FONT}`;
      this.wrapText(ctx, item.name, cx, r.y + 52, r.w - 24, 24);
      ctx.fillStyle = owned > 0 ? '#5ad36a' : '#8a83a8';
      ctx.font = `10px ${FONT}`;
      ctx.fillText(owned > 0 ? `LVL ${owned} -> ${nextLevel}` : 'NEW ITEM', cx, r.y + 104);
      ctx.fillStyle = '#fff3b0';
      ctx.font = `12px ${FONT}`;
      this.wrapText(ctx, item.describe(this.player.level, nextLevel), cx, r.y + 140, r.w - 28, 24);

      ctx.fillStyle = selected ? '#5ad36a' : hot ? '#ffd23f' : '#6a6388';
      ctx.font = `12px ${FONT}`;
      ctx.fillText(selected ? 'SELECTED' : `PRESS ${i + 1}`, cx, r.y + r.h - 20);
    }

    // confirm button — only active once a card is selected
    const cr = this.confirmRect();
    const ready = this.selectedPowerup >= 0;
    const chot = ready && this.hovered(cr);
    ctx.fillStyle = ready ? (chot ? '#5ad36a' : '#243524') : '#161620';
    ctx.fillRect(cr.x, cr.y, cr.w, cr.h);
    ctx.lineWidth = 3;
    ctx.strokeStyle = ready ? '#5ad36a' : '#3a3a44';
    ctx.strokeRect(cr.x, cr.y, cr.w, cr.h);
    ctx.fillStyle = ready ? (chot ? '#0d1a0d' : '#ffffff') : '#55556a';
    ctx.font = `16px ${FONT}`;
    ctx.fillText('CONFIRM', cr.x + cr.w / 2, cr.y + cr.h / 2 + 6);
  }

  // --- specialization select ---

  private cardRect(i: number): { x: number; y: number; w: number; h: number } {
    const w = 252;
    const h = 246;
    const gap = 24;
    const total = SPECS.length * w + (SPECS.length - 1) * gap;
    return { x: (W - total) / 2 + i * (w + gap), y: 234, w, h };
  }

  private hovered(r: { x: number; y: number; w: number; h: number }): boolean {
    const mx = this.input.mouseX;
    const my = this.input.mouseY;
    return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
  }

  private updateSelect(): void {
    const clicked = this.input.consumeClick();
    for (let i = 0; i < SPECS.length; i++) {
      const pickedByKey = this.input.isDown(String(i + 1));
      if ((clicked && this.hovered(this.cardRect(i))) || pickedByKey) {
        this.selectSpec(SPECS[i]);
        return;
      }
    }
  }

  private selectSpec(spec: Spec): void {
    this.spec = spec;
    this.player.beginRun();
    this.player.hatColor = spec.color;
    this.player.weapon = spec.id === 'cheddar' ? 'bow' : spec.id === 'gouda' ? 'sword' : 'wand';
    this.lastMilestoneAwarded = 0;

    // fresh world for the run
    this.roomsExplored = 0;
    this.rooms.clear();
    this.rx = 0;
    this.ry = 0;
    this.room = this.getRoom(0, 0);
    this.populate(this.room);
    this.player.x = W / 2;
    this.player.y = H / 2;
    this.clearEffects();
    this.auraTick = 0;
    this.phase = 'playing';

    // remember this choice for next time
    this.save.lastSpec = spec.id;
    this.save.runs[spec.id] = (this.save.runs[spec.id] ?? 0) + 1;
    if (!this.save.unlocked.includes(spec.id)) this.save.unlocked.push(spec.id);
    writeSave(this.save);
  }

  private drawSelect(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#100c1c';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.font = `40px ${FONT}`;
    ctx.fillText('CHEESE WIZARD', W / 2, 110);
    ctx.fillStyle = '#fff3b0';
    ctx.font = `16px ${FONT}`;
    ctx.fillText('CHOOSE YOUR PATH', W / 2, 174);

    for (let i = 0; i < SPECS.length; i++) {
      const spec = SPECS[i];
      const r = this.cardRect(i);
      const hot = this.hovered(r);
      const cx = r.x + r.w / 2;

      // hard-edged panel with a double border
      ctx.fillStyle = hot ? '#241a36' : '#1a1428';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = spec.color;
      ctx.fillRect(r.x, r.y, r.w, 6); // top accent bar
      ctx.lineWidth = hot ? 4 : 2;
      ctx.strokeStyle = hot ? spec.color : '#4a4360';
      ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);

      ctx.fillStyle = spec.color;
      ctx.font = `16px ${FONT}`;
      this.wrapText(ctx, spec.name.toUpperCase(), cx, r.y + 48, r.w - 24, 24);
      ctx.fillStyle = '#b8b0d0';
      ctx.font = `11px ${FONT}`;
      ctx.fillText(spec.title.toUpperCase(), cx, r.y + 98);

      ctx.fillStyle = '#fff3b0';
      ctx.font = `12px ${FONT}`;
      spec.perks.forEach((perk, p) => ctx.fillText(perk.toUpperCase(), cx, r.y + 142 + p * 30));

      ctx.fillStyle = hot ? spec.color : '#6a6388';
      ctx.font = `12px ${FONT}`;
      ctx.fillText(`PRESS ${i + 1}`, cx, r.y + r.h - 20);

      // marker on the spec you played last time
      if (spec.id === this.save.lastSpec) {
        ctx.fillStyle = spec.color;
        ctx.font = `10px ${FONT}`;
        ctx.fillText('LAST PICK', cx, r.y - 14);
      }
    }

    if (Math.floor(this.time * 2) % 2 === 0) {
      ctx.fillStyle = '#ffd23f';
      ctx.font = `14px ${FONT}`;
      ctx.fillText('CLICK A CARD OR PRESS 1-3', W / 2, H - 52);
    }

    // persisted stats — proof it remembers you across visits
    ctx.fillStyle = '#6a6388';
    ctx.font = `10px ${FONT}`;
    ctx.fillText(`VISITS ${this.save.visits}    RUNS ${totalRuns(this.save)}`, W / 2, H - 22);
  }

  private wrapText(
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

  private drawStatus(ctx: CanvasRenderingContext2D): void {
    if (!this.spec) return;
    const p = this.player;
    ctx.textAlign = 'left';

    const bx = 20;
    const bw = 260;
    const bh = 12;

    // HP bar
    const hpY = H - 72;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(bx, hpY, bw, bh);
    ctx.fillStyle = '#5ad36a';
    ctx.fillRect(bx, hpY, bw * Math.max(0, p.hp / p.maxHp), bh);
    ctx.strokeStyle = '#4a4360';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, hpY, bw, bh);
    ctx.fillStyle = '#ffffff';
    ctx.font = `8px ${FONT}`;
    ctx.fillText(`HP ${Math.ceil(p.hp)}/${p.maxHp}`, bx + 6, hpY + 9);

    // XP bar
    const by = H - 46;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = this.spec.color;
    ctx.fillRect(bx, by, bw * Math.min(1, p.xp / p.xpToNext), bh);
    ctx.strokeStyle = '#4a4360';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = '#fff3b0';
    ctx.font = `8px ${FONT}`;
    ctx.fillText(`XP ${Math.floor(p.xp)}/${p.xpToNext}`, bx + 6, by + 9);

    // level + spec
    ctx.fillStyle = this.spec.color;
    ctx.fillRect(20, H - 26, 12, 12);
    ctx.fillStyle = '#fff3b0';
    ctx.font = `12px ${FONT}`;
    ctx.fillText(`LV ${p.level}  ${this.spec.name.toUpperCase()}`, 38, H - 16);
  }

  // A fixed 3x3 window centred on the current room: the centre cell is always
  // the current room, the 8 surrounding slots show explored neighbours
  // (orthogonal and diagonal) when they've been visited.
  // 5x5 window centred on the player — the rooms that are currently "live".
  private drawMinimap(ctx: CanvasRenderingContext2D): void {
    const span = 2; // 2 each way -> 5x5
    const cell = 14;
    const step = 22;
    const stub = (step - cell) / 2;
    const thick = 2;
    const pad = 9;
    const ox = 18;
    const oy = 18;
    const cx0 = ox + pad;
    const cy0 = oy + pad;
    const panel = (2 * span + 1) * step - (step - cell) + pad * 2;

    ctx.save();
    ctx.fillStyle = 'rgba(8, 6, 14, 0.7)';
    ctx.fillRect(ox, oy, panel, panel);
    ctx.strokeStyle = '#4a4360';
    ctx.lineWidth = 2;
    ctx.strokeRect(ox + 1, oy + 1, panel - 2, panel - 2);

    for (let gy = -span; gy <= span; gy++) {
      for (let gx = -span; gx <= span; gx++) {
        const room = this.rooms.get(`${this.rx + gx},${this.ry + gy}`);
        if (!room) continue;
        const px = cx0 + (gx + span) * step;
        const py = cy0 + (gy + span) * step;
        const midX = px + cell / 2;
        const midY = py + cell / 2;

        // door stubs pointing toward each opening
        ctx.fillStyle = '#8a83a8';
        if (room.doors.east) ctx.fillRect(px + cell, midY - thick / 2, stub, thick);
        if (room.doors.west) ctx.fillRect(px - stub, midY - thick / 2, stub, thick);
        if (room.doors.south) ctx.fillRect(midX - thick / 2, py + cell, thick, stub);
        if (room.doors.north) ctx.fillRect(midX - thick / 2, py - stub, thick, stub);

        const current = gx === 0 && gy === 0;
        ctx.fillStyle = current ? '#ffd23f' : '#8a83a8';
        ctx.fillRect(px, py, cell, cell);
      }
    }
    ctx.restore();
  }
}
