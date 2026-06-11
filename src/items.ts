// Permanent equipped items. Each scales off BOTH the character's level and the
// item's own level (raised by picking it again). Every item is an 'attack' item
// that adds a new automatic way to damage enemies — no flat stat boosters.
//
// The milestone screen offers 3 from the pool; once the player holds 3 uniques
// it only offers owned items (so it becomes "level up what you have").
export interface Item {
  id: string;
  name: string;
  color: string;
  // primary scaling number — per-hit/tick/burst damage for the attack
  value: (charLevel: number, itemLevel: number) => number;
  radius?: (charLevel: number, itemLevel: number) => number; // for area items
  describe: (charLevel: number, itemLevel: number) => string;
}

export const ITEMS: Item[] = [
  {
    id: 'aura',
    name: 'STINKY AURA',
    color: '#9be35a',
    value: (cl, il) => (4 + Math.floor(cl / 2)) * il, // damage per 0.5s tick
    radius: (_cl, il) => 60 + 14 * il,
    describe: (cl, il) => `${(4 + Math.floor(cl / 2)) * il * 2} DMG/S AREA`,
  },
  {
    id: 'wheels',
    name: 'CHEESE WHEELS',
    color: '#ffd23f',
    value: (cl) => 3 + Math.floor(cl / 3), // per 0.2s contact tick; level adds wheels
    describe: (cl, il) => `${1 + il} WHEELS, ${3 + Math.floor(cl / 3)} DMG`,
  },
  {
    id: 'nova',
    name: 'CHEESE NOVA',
    color: '#ff9d3f',
    value: (cl, il) => (6 + Math.floor(cl / 2)) * il, // per burst
    radius: (_cl, il) => 90 + il * 15,
    describe: (cl, il) => `${(6 + Math.floor(cl / 2)) * il} BURST DMG`,
  },
  {
    id: 'bolts',
    name: 'CURD BOLTS',
    color: '#fff3b0',
    value: (cl, il) => (4 + Math.floor(cl / 2)) * il, // per homing bolt
    describe: (cl, il) => `${(4 + Math.floor(cl / 2)) * il} HOMING DMG`,
  },
  {
    id: 'crumbs',
    name: 'CRUMB TRAIL',
    color: '#e8b04a',
    value: (cl, il) => (2 + Math.floor(cl / 3)) * il, // per 0.4s tick on a crumb
    describe: (cl, il) => `${(2 + Math.floor(cl / 3)) * il} DMG TRAIL`,
  },
];
