export const WORLD_RADIUS = 58;

export const NEST_POSITION = { x: -26, z: 22, radius: 10 };
export const DANGER_ZONE = { x: 24, z: -18, radius: 18 };

export const PLAYER_BASE_STATS = {
  speed: 11.5,
  health: 120,
  biteDamage: 22,
};

export const UPGRADE_DEFS = [
  {
    key: "speed",
    label: "Spring Tendons",
    costs: [16, 26, 40],
    description: "+12% dash stride",
  },
  {
    key: "health",
    label: "Plated Ribs",
    costs: [18, 32, 48],
    description: "+28 max health",
  },
  {
    key: "bite",
    label: "Crushing Jaws",
    costs: [20, 34, 52],
    description: "+9 bite damage",
  },
  {
    key: "crest",
    label: "Sunspine Crest",
    costs: [44],
    description: "Unlock a radiant back frill",
  },
];

export const FOOD_SPAWNS = [
  { x: -20, z: 9, dna: 3, rare: false },
  { x: -12, z: 14, dna: 3, rare: false },
  { x: -4, z: 5, dna: 3, rare: false },
  { x: 2, z: 14, dna: 3, rare: false },
  { x: 10, z: 4, dna: 4, rare: false },
  { x: 15, z: 17, dna: 4, rare: false },
  { x: -17, z: 30, dna: 4, rare: false },
  { x: -6, z: 31, dna: 3, rare: false },
  { x: 11, z: 29, dna: 4, rare: false },
  { x: 20, z: 24, dna: 4, rare: false },
  { x: 29, z: 11, dna: 4, rare: false },
  { x: -27, z: -1, dna: 3, rare: false },
  { x: -16, z: -13, dna: 4, rare: false },
  { x: -4, z: -17, dna: 4, rare: false },
  { x: 6, z: -10, dna: 4, rare: false },
  { x: 18, z: -5, dna: 5, rare: true },
  { x: 25, z: -7, dna: 6, rare: true },
  { x: 31, z: -15, dna: 6, rare: true },
  { x: 36, z: -22, dna: 6, rare: true },
  { x: 16, z: -27, dna: 6, rare: true },
  { x: 22, z: -31, dna: 7, rare: true },
  { x: 30, z: -34, dna: 7, rare: true },
];

export const SCAVENGER_SPAWNS = [
  { x: -10, z: -2 },
  { x: 6, z: 7 },
  { x: 19, z: 18 },
  { x: -19, z: -18 },
];

export const PREDATOR_SPAWNS = [
  { x: 18, z: -18 },
  { x: 29, z: -25 },
  { x: 34, z: -11 },
];

export const ENEMY_DEFS = {
  scavenger: {
    label: "scavenger",
    color: 0xa88b68,
    accent: 0xefe2b5,
    speed: 8.8,
    health: 44,
    damage: 9,
    reward: 9,
    aggroRadius: 9,
    leashRadius: 13,
    attackRange: 2.4,
    scale: 0.95,
  },
  predator: {
    label: "predator",
    color: 0x6f503c,
    accent: 0xff8d5c,
    speed: 11.8,
    health: 92,
    damage: 18,
    reward: 18,
    aggroRadius: 16,
    leashRadius: 22,
    attackRange: 3.1,
    scale: 1.35,
  },
};
