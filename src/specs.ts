// A specialization is the root of the wizard's talent path. For now it sets the
// starting flavour, accent colour, and a couple of perk blurbs; the talent
// trees that branch off each one get built on top of this.
export interface Spec {
  id: string;
  name: string; // the cheese
  title: string; // the archetype
  color: string; // accent — also tints the wizard's hat
  description: string;
  perks: string[];
}

export const SPECS: Spec[] = [
  {
    id: 'cheddar',
    name: 'Aged Cheddar',
    title: 'The Sharpshooter',
    color: '#ff9d3f',
    description: 'Sharp, aged, precise. Punishes from range.',
    perks: ['+ Bolt damage', '+ Critical strikes'],
  },
  {
    id: 'gouda',
    name: 'Smoked Gouda',
    title: 'The Warden',
    color: '#d8643c',
    description: 'Hearty and smoke-hardened. Stands its ground.',
    perks: ['+ Max health', '+ Damage resistance'],
  },
  {
    id: 'stilton',
    name: 'Blue Stilton',
    title: 'The Sorcerer',
    color: '#6c9cff',
    description: 'Veined with arcane mould. Spreads its magic wide.',
    perks: ['+ Spell area', '+ Lingering decay'],
  },
];
