import { W, H, WALL, DOOR_HALF } from './constants';
import { Input } from './input';
import { Player, Arrow, Explosion, Enemy, Boss, BOSSES, EnemyBullet, Particle, PagePickup, HealPickup, SWORD_REACH, type EnemyKind } from './entities';
import { Room } from './room';
import { SPECS, type Spec } from './specs';
import { ITEMS, type Item } from './items';
import { TOTAL_PAGES } from './journal';
import { ItemAttacks } from './systems/item-attacks';
import { loadSave, writeSave, type SaveData } from './save';
import { FONT, cardRect, confirmRect, journalButtonRect, pointIn } from './ui/layout';
import { drawFloaters, drawMinimap, drawStatus, drawItems, drawBoss, type Floater } from './ui/hud';
import { drawSelect, drawPowerup, drawWon, drawGameOver } from './ui/screens';
import { drawJournal, journalCellAt, journalBackRect } from './ui/journal';

type Phase = 'select' | 'playing' | 'powerup' | 'won' | 'journal' | 'gameover';

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
  private powerupTitle = ''; // overrides the LEVEL header for boss rewards
  // boss / Pretender Melt state
  private bossesDefeated = 0;
  private bossActive = false; // current room is an uncleared boss arena (doors sealed)
  // journal / collectibles
  private journalReturn: Phase = 'select'; // where closing the journal goes back to
  private journalViewing = -1; // page id being read, or -1 for the grid
  private toast = { text: '', sub: '', life: 0 }; // brief banner (page found / healed)
  // run stats (for the game-over screen)
  private enemiesDefeated = 0;
  private pagesFoundThisRun = 0;
  private runStart = 0; // this.time at the start of the run
  private newBest = false;
  private gameOverAt = 0; // this.time when the run ended (input locked briefly after)
  // automatic attack-items (own their own state + rendering)
  private items = new ItemAttacks();
  // enemy fire + juice
  private enemyBullets: EnemyBullet[] = [];
  private particles: Particle[] = [];
  private damageNumbers: Floater[] = [];
  private shake = 0;
  private hitStop = 0;

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
    // a library is a calm bonus room: no vermin, one page waiting in the centre
    if (room.isLibrary) {
      const id = this.pickUncollectedPage();
      if (id !== null) room.pages.push(new PagePickup(W / 2, H / 2, id));
      return;
    }
    // a safe room: no vermin, a one-time heal in the centre
    if (room.isSafe) {
      room.heal = new HealPickup(W / 2, H / 2);
      return;
    }
    if (room.rx === 0 && room.ry === 0) return;
    const difficulty = this.roomsExplored;
    const tier = Math.floor(this.roomsExplored / 15); // big jump every 15 rooms
    // room crowd scales with character level: 2-4 at lv1-9, 3-5 at 10-19, 4-6 at
    // 20-29, and so on (+1 to the band every 10 levels)
    const band = Math.floor(this.player.level / 10);
    const count = 2 + band + Math.floor(Math.random() * 3);
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
      room.enemies.push(new Enemy(x, y, difficulty, tier, this.pickKind(difficulty, tier)));
    }
  }

  private pickUncollectedPage(): number | null {
    const have = new Set(this.save.pages);
    // also avoid duplicating a page already lying in a currently-live room
    for (const r of this.rooms.values()) for (const p of r.pages) have.add(p.pageId);
    const free: number[] = [];
    for (let id = 1; id <= TOTAL_PAGES; id++) if (!have.has(id)) free.push(id);
    if (free.length === 0) return null;
    return free[Math.floor(Math.random() * free.length)];
  }

  // Weighted enemy-type pool: chasers always, fancier archetypes mixed in as you
  // explore deeper so each room becomes a different problem.
  private pickKind(difficulty: number, tier: number): EnemyKind {
    const pool: EnemyKind[] = ['chaser', 'chaser'];
    if (difficulty >= 2) pool.push('darter', 'spitter');
    if (difficulty >= 5) pool.push('splitter');
    if (difficulty >= 8 || tier >= 1) pool.push('bruiser');
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // True when the next Pretender Melt is owed: you've explored deep enough to
  // reach the threshold of the boss you haven't beaten yet.
  private bossDue(): boolean {
    if (this.bossActive || this.bossesDefeated >= BOSSES.length) return false;
    return this.roomsExplored >= BOSSES[this.bossesDefeated].threshold;
  }

  // Turn the current room into a sealed boss arena: no vermin, just the boss.
  private setupBossRoom(): void {
    const cfg = BOSSES[this.bossesDefeated];
    this.room.populated = true;
    this.room.enemies = [new Boss(W / 2, H * 0.32, this.roomsExplored, cfg)];
    this.bossActive = true;
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
      // depth = how far you've pushed; sets the room's themed zone
      room = new Room(rx, ry, this.roomsExplored);
      this.rooms.set(key, room);
    }
    return room;
  }

  private changeRoom(dx: number, dy: number, newX: number, newY: number): void {
    this.rx += dx;
    this.ry += dy;
    const isNew = !this.rooms.has(`${this.rx},${this.ry}`);
    this.room = this.getRoom(this.rx, this.ry);
    const special = this.room.isLibrary || this.room.isSafe;
    // count genuinely new rooms toward difficulty, but special rooms (library /
    // safe) are free bonus stops — they never ramp the danger
    if (isNew && !special) this.roomsExplored += 1;
    this.player.x = newX;
    this.player.y = newY;
    if (this.bossDue() && !special) this.setupBossRoom();
    else this.populate(this.room); // after positioning, so enemies avoid the entrance
    this.pruneRooms(); // keep only the 5x5 window centred on the player
    this.clearEffects(); // effects don't follow you between rooms
  }

  private clearEffects(): void {
    this.arrows = [];
    this.explosions = [];
    this.items.clear();
    this.enemyBullets = [];
    this.particles = [];
    this.damageNumbers = [];
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
    // every door is shut while the room is locked: a boss arena, or any room
    // that still has living enemies — clear it to move on
    const doors = this.roomLocked() ? { north: false, east: false, south: false, west: false } : this.room.doors;

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
    if (this.phase === 'won') {
      if (this.input.consumeClick() || this.input.isDown('enter')) this.phase = 'select';
      return;
    }
    if (this.phase === 'gameover') {
      const click = this.input.consumeClick(); // consume + discard during the lock
      if (this.gameOverReady && (click || this.input.consumeKey('enter'))) this.phase = 'select';
      return;
    }
    if (this.phase === 'journal') {
      this.updateJournal();
      return;
    }
    if (this.toast.life > 0) this.toast.life -= dt;
    this.shake = Math.max(0, this.shake - dt * 40);
    // brief freeze on impactful hits for punch — everything else holds still
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      return;
    }
    this.player.update(dt, this.input);
    this.updateBounds();
    if (this.phase !== 'playing') return; // a door may have led into the library/boss
    this.handleFiring();
    this.updateArrows(dt);
    for (const ex of this.explosions) ex.update(dt);
    this.explosions = this.explosions.filter((e) => e.alive);
    this.updateEnemies(dt);
    this.applySwordHits();
    this.updateItemAttacks(dt);
    this.updateEnemyBullets(dt);
    this.updateFloaters(dt);
    this.updatePages(dt);
    this.reapEnemies();
    // a boss death may have already opened a reward/win screen this frame
    if (this.phase === 'playing') this.checkMilestone();
  }

  // Float the room's pages, collect any the player walks onto (saved
  // immediately so it survives leaving the site), and open the journal when the
  // player reads at the library desk.
  private updatePages(dt: number): void {
    const p = this.player;
    for (const pg of this.room.pages) pg.update(dt);
    // collection
    const remaining: PagePickup[] = [];
    for (const pg of this.room.pages) {
      if (Math.hypot(p.x - pg.x, p.y - pg.y) < p.radius + pg.radius) {
        if (!this.save.pages.includes(pg.pageId)) {
          this.save.pages.push(pg.pageId);
          writeSave(this.save);
        }
        this.pagesFoundThisRun += 1;
        this.toast = { text: `PAGE ${pg.pageId} FOUND`, sub: 'READ IT IN A LIBRARY OR ON THE START SCREEN', life: 2.5 };
      } else {
        remaining.push(pg);
      }
    }
    this.room.pages = remaining;

    // the Pilot Light — rest on it once, while hurt, to heal half your max HP
    const heal = this.room.heal;
    if (heal) {
      heal.update(dt);
      if (
        !heal.used &&
        p.hp < p.maxHp &&
        Math.hypot(p.x - heal.x, p.y - heal.y) < p.radius + heal.radius
      ) {
        heal.used = true;
        p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.5);
        for (let i = 0; i < 16; i++) this.particles.push(new Particle(heal.x, heal.y - 6, '#5ad36a'));
        this.toast = { text: 'THE PILOT LIGHT WARMS YOU', sub: 'HP RESTORED', life: 2.5 };
      }
    }

    // read at the library desk
    if (this.room.isLibrary && Math.hypot(p.x - W / 2, p.y - (H / 2 + 30)) < 90 && this.input.consumeKey('e')) {
      this.openJournal('playing');
    }
  }

  private openJournal(from: Phase): void {
    this.journalReturn = from;
    this.journalViewing = -1;
    this.phase = 'journal';
  }

  private updateJournal(): void {
    if (this.input.consumeKey('escape')) {
      if (this.journalViewing > 0) this.journalViewing = -1;
      else this.phase = this.journalReturn;
      return;
    }
    if (!this.input.consumeClick()) return;
    const mx = this.input.mouseX;
    const my = this.input.mouseY;
    if (pointIn(journalBackRect(), mx, my)) {
      if (this.journalViewing > 0) this.journalViewing = -1;
      else this.phase = this.journalReturn;
      return;
    }
    if (this.journalViewing < 0) {
      const id = journalCellAt(mx, my);
      if (id !== null && this.save.pages.includes(id)) this.journalViewing = id;
    }
  }

  // --- combat juice + shared damage application ---

  private damageEnemy(e: Enemy, dmg: number, sx: number, sy: number): void {
    if (!e.alive) return;
    e.hurt(dmg);
    e.knockback(e.x - sx, e.y - sy, Math.min(240, 50 + dmg * 6));
    // show what actually landed, so armored bosses read honestly (a small grey
    // number = soaked by armor; the colour cues "this isn't the window").
    const armor = e instanceof Boss ? e.armorMul : 1;
    const shown = Math.max(1, Math.round(dmg * armor));
    this.damageNumbers.push({
      x: e.x,
      y: e.y - e.radius,
      vy: -60,
      life: 0.55,
      text: String(shown),
      color: armor < 1 ? '#7fd8ff' : '#fff3b0',
    });
    if (!e.alive) this.onEnemyKilled(e);
  }

  private onEnemyKilled(e: Enemy): void {
    this.enemiesDefeated += 1;
    for (let i = 0; i < 9; i++) this.particles.push(new Particle(e.x, e.y, e.color));
    // no screen shake on kills — shake is reserved for taking damage
    this.hitStop = Math.max(this.hitStop, 0.04);
  }

  private updateEnemyBullets(dt: number): void {
    const p = this.player;
    for (const b of this.enemyBullets) {
      b.update(dt);
      if (b.x < WALL || b.x > W - WALL || b.y < WALL || b.y > H - WALL) {
        b.alive = false;
        continue;
      }
      if (p.invuln <= 0 && Math.hypot(p.x - b.x, p.y - b.y) < p.radius + b.radius) {
        b.alive = false;
        if (this.hurtPlayer(b.damage, b.x, b.y)) break;
      }
    }
    this.enemyBullets = this.enemyBullets.filter((b) => b.alive);
  }

  // Returns true if the hit ended the run (and opened the game-over screen).
  private hurtPlayer(dmg: number, sx: number, sy: number): boolean {
    const p = this.player;
    p.hp -= dmg;
    p.invuln = 1.0;
    const dx = p.x - sx;
    const dy = p.y - sy;
    const d = Math.hypot(dx, dy) || 1;
    p.x += (dx / d) * 26;
    p.y += (dy / d) * 26;
    this.shake = Math.min(14, this.shake + 8); // shake on taking damage
    this.hitStop = Math.max(this.hitStop, 0.06);
    if (p.hp <= 0) {
      this.gameOver();
      return true;
    }
    return false;
  }

  // The run ends. Record a best and show the summary.
  private gameOver(): void {
    this.newBest = this.roomsExplored > this.save.bestRooms;
    if (this.newBest) {
      this.save.bestRooms = this.roomsExplored;
      writeSave(this.save);
    }
    this.gameOverAt = this.time;
    this.phase = 'gameover';
  }

  // Input is locked for a beat after dying so a frantic click doesn't skip the
  // summary.
  private get gameOverReady(): boolean {
    return this.time - this.gameOverAt > 1.2;
  }

  private updateFloaters(dt: number): void {
    for (const f of this.damageNumbers) {
      f.y += f.vy * dt;
      f.life -= dt;
    }
    this.damageNumbers = this.damageNumbers.filter((f) => f.life > 0);
    for (const pt of this.particles) pt.update(dt);
    this.particles = this.particles.filter((pt) => !pt.dead);
  }

  // Drive the automatic attack-items. They own their own state and rendering;
  // we just hand them the world (player, enemies, input, damage hook).
  private updateItemAttacks(dt: number): void {
    this.items.update(dt, {
      player: this.player,
      enemies: this.room.enemies,
      input: this.input,
      damageEnemy: (e, dmg, sx, sy) => this.damageEnemy(e, dmg, sx, sy),
    });
  }

  // When you first reach a level milestone (10, 20, ...) and the room is clear,
  // pause to offer a powerup choice.
  private checkMilestone(): void {
    if (this.room.enemies.length > 0) return;
    const next = this.lastMilestoneAwarded + 10;
    if (this.player.level >= next) this.openPowerup(next);
  }

  private openPowerup(level: number, title = ''): void {
    this.milestoneLevel = level;
    this.powerupTitle = title;
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
    const mx = this.input.mouseX;
    const my = this.input.mouseY;
    // a click on a card only selects it
    for (let i = 0; i < this.powerupOptions.length; i++) {
      if (pointIn(cardRect(i), mx, my)) {
        this.selectedPowerup = i;
        return;
      }
    }
    // ...applying only happens via the confirm button
    if (this.selectedPowerup >= 0 && pointIn(confirmRect(), mx, my)) this.applyPowerup();
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
    const adds: Enemy[] = [];
    for (const e of this.room.enemies) {
      e.update(dt, p.x, p.y);

      // spitters request a shot — spawn it here
      if (e.wantsFire) {
        e.wantsFire = false;
        this.enemyBullets.push(new EnemyBullet(e.x, e.y, e.fireAngle, 230, e.damage, '#c7ff8a'));
      }

      if (e instanceof Boss) {
        // queued projectiles (Tuna mayo rings, Croque egg-spreads, ...)
        if (e.shots.length) {
          const bdmg = Math.max(1, Math.round(e.damage * 0.6));
          for (const s of e.shots)
            this.enemyBullets.push(new EnemyBullet(e.x, e.y, s.angle, s.speed, bdmg, e.color));
          e.shots.length = 0;
        }
        // filling-adds, capped so the arena never truly swarms
        if (e.wantsSpawn > 0) {
          const here = this.room.enemies.length + adds.length;
          for (let i = 0; i < e.wantsSpawn && here + i < 11; i++) {
            const a = Math.random() * Math.PI * 2;
            const ax = Math.max(WALL + 20, Math.min(W - WALL - 20, e.x + Math.cos(a) * 50));
            const ay = Math.max(WALL + 20, Math.min(H - WALL - 20, e.y + Math.sin(a) * 50));
            adds.push(new Enemy(ax, ay, this.roomsExplored, this.bossesDefeated, e.config.addKind));
          }
          e.wantsSpawn = 0;
        }
        // Croque's Madame — a one-time elite, bypasses the add cap
        if (e.wantsMadame) {
          e.wantsMadame = false;
          const mx = Math.max(WALL + 20, Math.min(W - WALL - 20, e.x + 60));
          const madame = new Enemy(mx, e.y, this.roomsExplored, this.bossesDefeated, 'bruiser');
          madame.maxHp = Math.round(madame.maxHp * 1.6);
          madame.hp = madame.maxHp;
          adds.push(madame);
        }
      }

      if (p.invuln <= 0 && e.alive) {
        const dist = Math.hypot(p.x - e.x, p.y - e.y);
        if (dist < p.radius + e.radius && this.hurtPlayer(e.damage, e.x, e.y)) return;
      }
    }
    if (adds.length) this.room.enemies.push(...adds);
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
        this.damageEnemy(e, this.damageFor(SWORD_DMG), p.x, p.y);
        this.swordHit.add(e);
      }
    }
  }

  // Remove dead enemies, award their XP, and spawn splitter children.
  private reapEnemies(): void {
    const survivors: Enemy[] = [];
    for (const e of this.room.enemies) {
      if (e.alive) {
        survivors.push(e);
        continue;
      }
      this.player.gainXp(e.xpReward);
      if (e instanceof Boss) {
        this.onBossDefeated(e);
        continue;
      }
      if (e.canSplit) {
        for (const off of [-1, 1]) {
          const child = new Enemy(e.x + off * 16, e.y, this.roomsExplored, e.tier, 'chaser');
          child.maxHp = Math.max(1, Math.round(e.maxHp * 0.35));
          child.hp = child.maxHp;
          child.canSplit = false;
          survivors.push(child);
        }
      }
    }
    this.room.enemies = survivors;
  }

  // A Pretender Melt has been corrected. Unseal the room, celebrate, and either
  // win the run (final boss) or hand out a guaranteed reward.
  private onBossDefeated(boss: Boss): void {
    this.bossActive = false;
    this.bossesDefeated += 1;
    for (let i = 0; i < 28; i++) this.particles.push(new Particle(boss.x, boss.y, boss.color));
    this.hitStop = Math.max(this.hitStop, 0.12); // freeze for punch; no shake on a kill
    if (boss.config.final) {
      this.phase = 'won';
      return;
    }
    // guaranteed reward, framed as a purist victory rather than a level-up
    this.openPowerup(this.lastMilestoneAwarded, 'HERESY PURGED'); // milestone stays put
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
        if (Math.hypot(e.x - x, e.y - y) <= blast.maxRadius + e.radius) this.damageEnemy(e, this.damageFor(BLAST_DMG), x, y);
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
          this.damageEnemy(e, this.damageFor(ARROW_DMG), ar.x, ar.y);
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
    ctx.save();
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }
    this.room.draw(ctx, this.save.pages.length);
    this.drawSeals(ctx);
    this.items.drawUnder(ctx, this.player, this.time);
    for (const pg of this.room.pages) pg.draw(ctx);
    if (this.room.heal) this.room.heal.draw(ctx);
    for (const e of this.room.enemies) e.draw(ctx);
    this.items.drawOver(ctx, this.player);
    for (const b of this.enemyBullets) b.draw(ctx);
    for (const ar of this.arrows) ar.draw(ctx);
    this.player.draw(ctx);
    for (const ex of this.explosions) ex.draw(ctx);
    for (const pt of this.particles) pt.draw(ctx);
    ctx.restore();
  }

  // The room is locked (no exits) during a boss fight or while any vermin live.
  private roomLocked(): boolean {
    return this.bossActive || this.room.enemies.length > 0;
  }

  // Bars across every open doorway while the room is locked. Toasted bread for a
  // boss arena, plain stone elsewhere.
  private drawSeals(ctx: CanvasRenderingContext2D): void {
    if (!this.roomLocked()) return;
    const t = WALL;
    const d = this.room.doors;
    const gx = W / 2 - DOOR_HALF;
    const gw = DOOR_HALF * 2;
    const gy = H / 2 - DOOR_HALF;
    const gh = DOOR_HALF * 2;
    ctx.fillStyle = this.bossActive ? '#caa24a' : '#6b6488';
    if (d.north) ctx.fillRect(gx, 0, gw, t);
    if (d.south) ctx.fillRect(gx, H - t, gw, t);
    if (d.west) ctx.fillRect(0, gy, t, gh);
    if (d.east) ctx.fillRect(W - t, gy, t, gh);
    // inner accent line
    ctx.fillStyle = this.bossActive ? '#9c6b2e' : '#4a4360';
    if (d.north) ctx.fillRect(gx, t - 3, gw, 3);
    if (d.south) ctx.fillRect(gx, H - t, gw, 3);
    if (d.west) ctx.fillRect(t - 3, gy, 3, gh);
    if (d.east) ctx.fillRect(W - t, gy, 3, gh);
  }

  // UI — rendered at full resolution on the main canvas so text stays sharp.
  // The phase decides which screen; rendering itself lives in ui/.
  drawOverlay(ctx: CanvasRenderingContext2D): void {
    const mx = this.input.mouseX;
    const my = this.input.mouseY;
    if (this.phase === 'select') {
      drawSelect(ctx, { time: this.time, save: this.save, mx, my });
      return;
    }
    if (this.phase === 'powerup') {
      if (this.spec) drawStatus(ctx, this.player, this.spec);
      drawPowerup(ctx, {
        options: this.powerupOptions,
        selected: this.selectedPowerup,
        milestoneLevel: this.milestoneLevel,
        title: this.powerupTitle,
        player: this.player,
        mx,
        my,
      });
      return;
    }
    if (this.phase === 'won') {
      drawWon(ctx, { roomsExplored: this.roomsExplored, level: this.player.level, time: this.time });
      return;
    }
    if (this.phase === 'journal') {
      drawJournal(ctx, { collected: this.save.pages, viewing: this.journalViewing, mx, my });
      return;
    }
    if (this.phase === 'gameover') {
      drawGameOver(ctx, {
        enemies: this.enemiesDefeated,
        rooms: this.roomsExplored,
        level: this.player.level,
        bosses: this.bossesDefeated,
        pages: this.pagesFoundThisRun,
        seconds: this.time - this.runStart,
        bestRooms: this.save.bestRooms,
        newBest: this.newBest,
        ready: this.gameOverReady,
        time: this.time,
      });
      return;
    }
    drawFloaters(ctx, this.damageNumbers);
    drawMinimap(ctx, this.rooms, this.rx, this.ry);
    // current zone name, under the minimap
    ctx.textAlign = 'left';
    ctx.fillStyle = this.room.isLibrary ? '#caa24a' : this.room.isSafe ? '#ff9d3f' : '#8a83a8';
    ctx.font = `9px ${FONT}`;
    ctx.fillText(this.room.zone, 20, 152);
    if (this.spec) drawStatus(ctx, this.player, this.spec);
    drawItems(ctx, this.player, mx, my);
    if (this.bossActive) {
      const boss = this.room.enemies.find((e) => e instanceof Boss) as Boss | undefined;
      if (boss) drawBoss(ctx, boss);
    }
    this.drawReaderPrompt(ctx);
    this.drawToast(ctx);
  }

  // "PRESS E TO READ" near the library desk.
  private drawReaderPrompt(ctx: CanvasRenderingContext2D): void {
    const p = this.player;
    if (!this.room.isLibrary) return;
    if (Math.hypot(p.x - W / 2, p.y - (H / 2 + 30)) >= 90) return;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.font = `12px ${FONT}`;
    ctx.fillText('PRESS E TO READ', W / 2, H / 2 - 60);
  }

  // Brief banner for a page pickup or a heal.
  private drawToast(ctx: CanvasRenderingContext2D): void {
    if (this.toast.life <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.toast.life);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe27a';
    ctx.font = `14px ${FONT}`;
    ctx.fillText(this.toast.text, W / 2, 80);
    if (this.toast.sub) {
      ctx.fillStyle = '#8a83a8';
      ctx.font = `9px ${FONT}`;
      ctx.fillText(this.toast.sub, W / 2, 100);
    }
    ctx.restore();
  }

  // --- specialization select ---

  private updateSelect(): void {
    const clicked = this.input.consumeClick();
    const mx = this.input.mouseX;
    const my = this.input.mouseY;
    if (clicked && pointIn(journalButtonRect(), mx, my)) {
      this.openJournal('select');
      return;
    }
    for (let i = 0; i < SPECS.length; i++) {
      const pickedByKey = this.input.isDown(String(i + 1));
      if ((clicked && pointIn(cardRect(i), mx, my)) || pickedByKey) {
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
    this.bossesDefeated = 0;
    this.bossActive = false;
    this.enemiesDefeated = 0;
    this.pagesFoundThisRun = 0;
    this.runStart = this.time;
    this.rooms.clear();
    this.rx = 0;
    this.ry = 0;
    this.room = this.getRoom(0, 0);
    this.populate(this.room);
    this.player.x = W / 2;
    this.player.y = H / 2;
    this.clearEffects();
    this.phase = 'playing';

    // remember this choice for next time
    this.save.lastSpec = spec.id;
    this.save.runs[spec.id] = (this.save.runs[spec.id] ?? 0) + 1;
    if (!this.save.unlocked.includes(spec.id)) this.save.unlocked.push(spec.id);
    writeSave(this.save);
  }

}
