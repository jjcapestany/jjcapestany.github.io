// Barrel for the entity classes — keeps `import { ... } from './entities'` stable
// while the implementations live in focused per-entity files.
export { CELL, pixel, shade } from './sprite';
export { Player, xpForLevel, SWORD_REACH, type Weapon } from './player';
export { Arrow, Explosion, EnemyBullet, Particle } from './projectiles';
export { PagePickup, HealPickup } from './pickups';
export { Enemy, type EnemyKind } from './enemy';
export { Boss } from './boss';
export { BOSSES, type BossConfig, type BossKind, type BossBehavior } from './bosses';
