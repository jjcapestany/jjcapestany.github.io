import type { EnemyKind } from './enemy';

// --- BOSSES: the Pretender Melts ---------------------------------------------
// One per difficulty tier (every 15 rooms). Each is a famous "melt" that has the
// audacity to be called a grilled cheese; you fight to it and correct the
// record. Per-boss behaviour, stats and sprites give them identity. THE MELT is
// the final boss and beating it wins the run.
export type BossKind = 'pattymelt' | 'tunamelt' | 'reuben' | 'croque' | 'themelt';

// How a boss fights. Each maps to a distinct movement + attack routine in
// Boss.update so every Pretender Melt reads and plays differently.
//   lunger    – chase + telegraphed lunge, spawns adds (Patty Melt)
//   bullethell– keeps distance, fires radial volleys (Tuna Melt)
//   armored   – tanky charges, exposes a punish window after each (Reuben)
//   splitter  – mid-range caster, summons a Madame elite at half HP (Croque)
//   omni      – cycles bullet-hell / lunge / swarm phases (THE MELT)
export type BossBehavior = 'lunger' | 'bullethell' | 'armored' | 'splitter' | 'omni';

export interface BossConfig {
  id: BossKind;
  name: string;
  taunt: string; // deadpan culinary fatwa, shown on entry
  threshold: number; // roomsExplored required before this boss is due
  behavior: BossBehavior;
  addKind: EnemyKind; // what its spawned filling-adds are
  sprite: string[];
  palette: Record<string, string>;
  color: string; // glow + particle colour
  hpMul: number;
  dmgMul: number;
  speedMul: number;
  final?: boolean;
}

export const BOSSES: BossConfig[] = [
  {
    id: 'pattymelt',
    name: 'THE PATTY MELT',
    taunt: 'YOU ADDED A PATTY.\nTHIS IS NOT A GRILLED CHEESE.',
    threshold: 15,
    behavior: 'lunger',
    addKind: 'chaser',
    sprite: [
      '.bBBBBBBBBb.',
      'bBBBBBBBBBBb',
      'BBEBBBBBBEBB',
      'cccccccccccc',
      '.pppppppppp.',
      '.pppppppppp.',
      'cccccccccccc',
      'bBBBBBBBBBBb',
      '.bBBBBBBBBb.',
    ],
    palette: { B: '#caa24a', b: '#9c6b2e', c: '#ffd23f', p: '#5a3826', E: '#ff3030' },
    color: '#ffd23f',
    hpMul: 1,
    dmgMul: 1,
    speedMul: 1,
  },
  {
    id: 'tunamelt',
    name: 'THE TUNA MELT',
    taunt: 'IT SMELLS LIKE A CRIME.\nTHAT IS BECAUSE IT IS ONE.',
    threshold: 30,
    behavior: 'bullethell',
    addKind: 'chaser',
    sprite: [
      '.cccccccccc.',
      'ccEcccccEccc',
      'ccttttttttcc',
      'ccttttttttcc',
      '.cccccccccc.',
      '.BBBBBBBBBB.',
      '..BBBBBBBB..',
    ],
    palette: { B: '#caa24a', c: '#ffe27a', t: '#c79a5e', E: '#1d1d1d' },
    color: '#ffe27a',
    hpMul: 1.3,
    dmgMul: 1,
    speedMul: 1.1,
  },
  {
    id: 'reuben',
    name: 'THE REUBEN',
    taunt: '"IT IS BASICALLY A GRILLED CHEESE."\nIT IS NOT.',
    threshold: 45,
    behavior: 'armored',
    addKind: 'chaser',
    sprite: [
      'RRRRRRRRRRRR',
      'RssssssssssR',
      'EmmmmmmmmmmE',
      'mmmmmmmmmmmm',
      'ssssssssssss',
      'RRRRRRRRRRRR',
    ],
    palette: { R: '#5f4326', m: '#b3402f', s: '#cbb56a', E: '#ffe27a' },
    color: '#ff5a5a',
    hpMul: 1.7,
    dmgMul: 1.3,
    speedMul: 0.9,
  },
  {
    id: 'croque',
    name: 'LE CROQUE MONSIEUR',
    taunt: 'A FOREIGN HERESY.\nHAM IS NOT A SEASONING.',
    threshold: 60,
    behavior: 'splitter',
    addKind: 'darter',
    sprite: [
      'nnnnnnnnnnnn',
      'nBBBBBBBBBBn',
      'BEBBBBBBBBEB',
      'hhhhhhhhhhhh',
      'BBBBBBBBBBBB',
      '.nnnnnnnnnn.',
    ],
    palette: { n: '#f3ead2', B: '#d8b15a', h: '#dd8aa0', E: '#7a3b1f' },
    color: '#b96cff',
    hpMul: 2,
    dmgMul: 1.2,
    speedMul: 1.1,
  },
  {
    id: 'themelt',
    name: 'THE MELT',
    taunt: 'EVERY FORBIDDEN FILLING AT ONCE.\nEND THIS.',
    threshold: 75,
    behavior: 'omni',
    addKind: 'splitter',
    sprite: [
      'BBBBBBBBBBBB',
      'cWccccccccWc',
      'pphhttpphhtt',
      'tthhpptthhpp',
      'cccccccccccc',
      'BBBBBBBBBBBB',
      '.BBBBBBBBBB.',
    ],
    palette: { B: '#caa24a', c: '#ffd23f', p: '#5a3826', h: '#dd8aa0', t: '#c79a5e', W: '#ff3030' },
    color: '#ff2d2d',
    hpMul: 3,
    dmgMul: 1.4,
    speedMul: 1,
    final: true,
  },
];
