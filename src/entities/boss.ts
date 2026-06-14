import { W, H, WALL } from '../constants';
import { CELL } from './sprite';
import { Enemy } from './enemy';
import type { BossConfig } from './bosses';

// A Pretender Melt. Reuses Enemy so every weapon/item damages it for free, but
// replaces movement/attacks with a per-behaviour routine (see BossBehavior) and
// draws a big sprite with its own boss health bar. Bosses enrage below a third
// HP. Outward-facing requests (shots / adds / Madame) are drained by the game,
// which owns the projectile and enemy lists.
export class Boss extends Enemy {
  readonly isBoss = true;
  readonly config: BossConfig;
  wantsSpawn = 0; // how many filling-adds to spawn (of config.addKind)
  wantsMadame = false; // Croque's one-time elite summon
  shots: { angle: number; speed: number }[] = []; // queued projectiles
  armorMul = 1; // damage taken multiplier (Reuben raises/lowers this)
  exposed = false; // armored punish window (for the visual)
  introT = 2.6; // entry-banner timer
  private bphase = 'chase'; // generic phase token; meaning is per-behaviour
  private bt = 1.4; // phase timer
  private bLungeAngle = 0;
  private spawnTimer = 4;
  private volleyTimer = 1.6;
  private shotSpin = 0; // rotates radial volleys so they don't align
  private omniMode = 0;
  private omniTimer = 4;
  private madames = 0; // how many Madame elites Croque has summoned
  private pulse = 0;

  constructor(x: number, y: number, difficulty: number, cfg: BossConfig) {
    super(x, y, difficulty, 0, 'chaser');
    this.config = cfg;
    // bosses are meant to be a wall, not a speed bump: ~2.3x the old HP and ~1.6x
    // the damage, scaling harder with depth.
    this.maxHp = Math.round((260 + difficulty * 20) * cfg.hpMul);
    this.hp = this.maxHp;
    this.speed = Math.min(165, (55 + difficulty * 1.3) * cfg.speedMul);
    this.damage = Math.round((15 + difficulty * 0.8) * cfg.dmgMul);
    this.xpReward = Math.round(this.maxHp * 0.55);
    this.radius = cfg.final ? 50 : 40;
    this.color = cfg.color;
    this.canSplit = false;
    this.sprite = cfg.sprite;
    this.palette = cfg.palette;
    this.cell = cfg.final ? CELL * 3 : CELL * 2; // whole buffer pixels -> crisp
  }

  // Two escalating gears: pressured under half HP, frenzied under a quarter.
  private get enraged(): boolean {
    return this.hp < this.maxHp * 0.5;
  }
  private get frenzied(): boolean {
    return this.hp < this.maxHp * 0.25;
  }

  // A radial burst of projectiles, used as a shared "get off me" mechanic.
  private burst(n: number, speed: number, offset = 0): void {
    for (let i = 0; i < n; i++) this.shots.push({ angle: offset + (i * Math.PI * 2) / n, speed });
  }

  // Armored bosses soak most damage outside their exposed window.
  hurt(dmg: number): void {
    super.hurt(dmg * this.armorMul);
  }

  update(dt: number, tx: number, ty: number): void {
    // knockback impulse — bosses shrug it off faster than vermin
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const fr = Math.exp(-13 * dt);
    this.vx *= fr;
    this.vy *= fr;

    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ang = Math.atan2(dy, dx);
    const enraged = this.enraged;
    this.bt -= dt;
    this.pulse += dt * 4;
    this.armorMul = 1; // routines re-assert this each frame

    let mv: [number, number];
    switch (this.config.behavior) {
      case 'bullethell':
        mv = this.actBulletHell(dt, dist, ang, enraged);
        break;
      case 'armored':
        mv = this.actArmored(dist, ang, enraged);
        break;
      case 'splitter':
        mv = this.actSplitter(dt, dist, ang, enraged);
        break;
      case 'omni':
        mv = this.actOmni(dt, dist, ang, enraged);
        break;
      default:
        mv = this.actLunger(dt, dist, ang, enraged);
    }

    this.x += mv[0] * dt;
    this.y += mv[1] * dt;
    this.x = Math.min(W - WALL - this.radius, Math.max(WALL + this.radius, this.x));
    this.y = Math.min(H - WALL - this.radius, Math.max(WALL + this.radius, this.y));
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.introT = Math.max(0, this.introT - dt);
  }

  // PATTY MELT — chase, telegraphed lunge, periodic Tomato adds; the lunge slams
  // out a shockwave of bullets once it's hurt, and it presses harder when low.
  private actLunger(dt: number, dist: number, ang: number, enraged: boolean): [number, number] {
    const spd = this.speed * (enraged ? 1.6 : 1);
    if (this.bphase === 'windup') {
      this.bLungeAngle = ang;
      if (this.bt <= 0) ((this.bphase = 'lunge'), (this.bt = 0.32));
      return [0, 0];
    }
    if (this.bphase === 'lunge') {
      if (this.bt <= 0) {
        this.bphase = 'recover';
        this.bt = enraged ? 0.45 : 0.85;
        if (enraged) this.burst(this.frenzied ? 12 : 8, 150, Math.random() * Math.PI); // landing slam
      }
      return [Math.cos(this.bLungeAngle) * spd * 5.5, Math.sin(this.bLungeAngle) * spd * 5.5];
    }
    if (this.bphase === 'recover') {
      if (this.bt <= 0) ((this.bphase = 'chase'), (this.bt = enraged ? 0.8 : 1.3));
      return [Math.cos(ang) * spd * 0.2, Math.sin(ang) * spd * 0.2];
    }
    // chase
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) ((this.spawnTimer = enraged ? 2.5 : 4.5), (this.wantsSpawn = enraged ? 3 : 2));
    const reach = this.frenzied ? 300 : 240;
    if (dist < reach && this.bt <= 0) ((this.bphase = 'windup'), (this.bt = this.frenzied ? 0.4 : 0.6));
    return [Math.cos(ang) * spd, Math.sin(ang) * spd];
  }

  // TUNA MELT — hold a distance band, strafe, fire a rotating ring of mayo plus
  // an aimed spread; adds a counter-rotating ring when frenzied.
  private actBulletHell(dt: number, dist: number, ang: number, enraged: boolean): [number, number] {
    const spd = this.speed * (enraged ? 1.35 : 1);
    const want = 260;
    const dir = dist > want + 60 ? 1 : dist < want - 40 ? -1 : 0;
    const mvx = Math.cos(ang) * spd * dir - Math.sin(ang) * spd * 0.5;
    const mvy = Math.sin(ang) * spd * dir + Math.cos(ang) * spd * 0.5;
    this.volleyTimer -= dt;
    if (this.volleyTimer <= 0) {
      this.volleyTimer = enraged ? 1.1 : 1.9;
      this.shotSpin += 0.45;
      this.burst(enraged ? 18 : 12, 150, this.shotSpin);
      if (this.frenzied) this.burst(14, 110, -this.shotSpin); // second ring, opposite spin
      for (let k = -1; k <= 1; k++) this.shots.push({ angle: ang + k * 0.16, speed: 250 });
    }
    return [mvx, mvy];
  }

  // REUBEN — heavy armor; commits to a faster charge, slams a burst on impact
  // when low, then stands exposed for a shorter punish window the angrier it is.
  private actArmored(dist: number, ang: number, enraged: boolean): [number, number] {
    const spd = this.speed * (enraged ? 1.5 : 1);
    this.armorMul = 0.45; // tanky by default
    if (this.bphase === 'windup') {
      this.bLungeAngle = ang;
      if (this.bt <= 0) ((this.bphase = 'charge'), (this.bt = enraged ? 0.55 : 0.7));
      return [0, 0];
    }
    if (this.bphase === 'charge') {
      if (this.bt <= 0) {
        this.bphase = 'exposed';
        this.bt = enraged ? 1.0 : 1.5; // shorter window when angry
        if (this.frenzied) this.burst(10, 150, Math.random() * Math.PI);
      }
      return [Math.cos(this.bLungeAngle) * spd * 6.5, Math.sin(this.bLungeAngle) * spd * 6.5];
    }
    if (this.bphase === 'exposed') {
      this.armorMul = 1.6; // guard down — take extra damage
      this.exposed = true;
      if (this.bt <= 0) ((this.bphase = 'advance'), (this.bt = 0), (this.exposed = false));
      return [Math.cos(ang) * spd * 0.1, Math.sin(ang) * spd * 0.1];
    }
    // advance (also the initial state)
    if (dist < 340 && this.bt <= 0) ((this.bphase = 'windup'), (this.bt = enraged ? 0.5 : 0.7));
    return [Math.cos(ang) * spd, Math.sin(ang) * spd];
  }

  // CROQUE MONSIEUR — mid-range caster; lobs egg-spreads and fast fried-egg adds,
  // summons a Madame elite at half HP and a second at a quarter, faster all the
  // while.
  private actSplitter(dt: number, dist: number, ang: number, enraged: boolean): [number, number] {
    if (this.madames === 0 && this.hp <= this.maxHp * 0.55) ((this.madames = 1), (this.wantsMadame = true));
    else if (this.madames === 1 && this.hp <= this.maxHp * 0.25) ((this.madames = 2), (this.wantsMadame = true));
    const spd = this.speed * (this.madames > 0 ? 1.5 : 1);
    const want = 210;
    const dir = dist > want + 50 ? 1 : dist < want - 30 ? -1 : 0;
    const mvx = Math.cos(ang) * spd * dir - Math.sin(ang) * spd * 0.7;
    const mvy = Math.sin(ang) * spd * dir + Math.cos(ang) * spd * 0.7;
    this.volleyTimer -= dt;
    if (this.volleyTimer <= 0) {
      this.volleyTimer = enraged ? 1.0 : 1.8;
      for (let k = -2; k <= 2; k++) this.shots.push({ angle: ang + k * 0.2, speed: 215 });
      if (this.frenzied) this.burst(10, 150, Math.random() * Math.PI);
    }
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) ((this.spawnTimer = enraged ? 4 : 6), (this.wantsSpawn = enraged ? 3 : 2));
    return [mvx, mvy];
  }

  // THE MELT — cycles through three guises; the rotation tightens and every
  // guise turns up the volume as it loses HP.
  private actOmni(dt: number, dist: number, ang: number, enraged: boolean): [number, number] {
    this.omniTimer -= dt;
    if (this.omniTimer <= 0) {
      this.omniTimer = enraged ? 2.6 : 3.6;
      this.omniMode = (this.omniMode + 1) % 3;
      this.bphase = 'chase';
      this.bt = 0;
    }
    const spd = this.speed * (enraged ? 1.2 : 1);
    if (this.omniMode === 0) {
      // orbit + dense rotating rings
      this.volleyTimer -= dt;
      if (this.volleyTimer <= 0) {
        this.volleyTimer = enraged ? 0.7 : 1;
        this.shotSpin += 0.3;
        this.burst(enraged ? 20 : 16, 160, this.shotSpin);
      }
      return [-Math.sin(ang) * spd * 0.9, Math.cos(ang) * spd * 0.9];
    }
    if (this.omniMode === 1) {
      return this.actLunger(dt, dist, ang, true); // always-enraged lunges
    }
    // swarm
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) ((this.spawnTimer = enraged ? 1.1 : 1.5), (this.wantsSpawn = enraged ? 4 : 3));
    return [Math.cos(ang) * spd * 0.6, Math.sin(ang) * spd * 0.6];
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // menacing pulsing glow
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(this.pulse);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // armor shield / exposed crack (Reuben)
    if (this.config.behavior === 'armored') {
      ctx.save();
      if (this.exposed) {
        ctx.globalAlpha = 0.5 + 0.3 * Math.sin(this.pulse * 3);
        ctx.strokeStyle = '#ff3030';
        ctx.lineWidth = 3;
      } else {
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = '#7fd8ff';
        ctx.lineWidth = 5;
      }
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // lunge / charge telegraph
    if (this.bphase === 'windup') {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#ff3030';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const flash = this.hitFlash > 0;
    const cell = this.cell;
    const cols = this.sprite[0].length;
    const ox = Math.round((this.x - (cols / 2) * cell) / CELL) * CELL;
    const oy = Math.round((this.y - (this.sprite.length / 2) * cell) / CELL) * CELL;
    for (let r = 0; r < this.sprite.length; r++) {
      const row = this.sprite[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === '.') continue;
        ctx.fillStyle = flash ? '#ffffff' : this.palette[ch] ?? this.palette.B ?? '#caa24a';
        ctx.fillRect(ox + c * cell, oy + r * cell, cell, cell);
      }
    }
  }
}
