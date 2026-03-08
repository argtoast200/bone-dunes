import * as THREE from "three";

import {
  BIOME_DEFS,
  DANGER_ZONE,
  ENEMY_DEFS,
  FOOD_SPAWNS,
  MIGRATION_EVENT_DEFS,
  NEST_POSITION,
  ORIGIN_POOL,
  PLAYER_BASE_STATS,
  SPECIES_DEFS,
  UPGRADE_DEFS,
  WORLD_RADIUS,
} from "./config";
import {
  DEFAULT_ALIGNMENT,
  createDefaultBiomeProgress,
  DEFAULT_SAVE,
  clearSave,
  createEvolutionDraft,
  createRandomCreatureProfile,
  createSpeciesCreature,
  loadSave,
  MAX_SPECIES_CREATURES,
  saveProgress,
} from "./save";
import { buildWorld, getBiomeDefAtPosition, getBiomeKeyAtPosition, getTerrainHeight } from "./world";

const FIXED_STEP = 1 / 60;
const GAMEPAD_FOCUS_CLASS = "is-gamepad-focused";
const PLAYER_HEIGHT = 2.2;
const CAMERA_HEIGHT = 5.8;
const CAMERA_DISTANCE = 10.5;
const ATTACK_WINDUP_DURATION = 0.095;
const ATTACK_STRIKE_DURATION = 0.11;
const ATTACK_RECOVERY_DURATION = 0.19;
const ATTACK_DURATION = ATTACK_WINDUP_DURATION + ATTACK_STRIKE_DURATION + ATTACK_RECOVERY_DURATION;
const ATTACK_LUNGE_DURATION = 0.18;
const ATTACK_LUNGE_SPEED = 10.8;
const MOVE_TARGET_STOP_DISTANCE = 1.25;
const MOVE_TARGET_SLOW_DISTANCE = 5.8;
const CAMERA_SIDE_OFFSET = 1.35;
const CAMERA_LOOKAHEAD = 0.22;
const SPRINT_SPEED_BONUS = 1.32;
const SPRINT_DRAIN_RATE = 0.62;
const SPRINT_RECHARGE_RATE = 0.32;
const SPRINT_SAFE_RECHARGE_RATE = 0.6;
const DANGER_REWARD_MULTIPLIER = 1.35;
const LOW_HEALTH_THRESHOLD = 0.38;
const FERAL_SURGE_MAX_TIMER = 8;
const FERAL_SURGE_SPEED_BONUS = 0.07;
const FERAL_SURGE_COOLDOWN_BONUS = 0.22;
const FERAL_SURGE_RECOVERY_BONUS = 0.18;
const IMPACT_SLOW_DURATION = 0.085;
const KILL_IMPACT_SLOW_DURATION = 0.12;
const CAMERA_FOV_KICK_DECAY = 7.5;
const EDITOR_CAMERA_DISTANCE = 5.9;
const EDITOR_CAMERA_HEIGHT = 3.2;
const EDITOR_LOOK_HEIGHT = 1.92;
const EDITOR_ORBIT_SPEED = 0.32;
const SPECIES_RING_GEOMETRY = new THREE.RingGeometry(0.94, 1, 40);
const EFFECT_RING_GEOMETRY = new THREE.RingGeometry(0.34, 0.62, 18);
const EFFECT_SHARD_GEOMETRY = new THREE.OctahedronGeometry(0.18, 0);
const EFFECT_BITE_ARC_GEOMETRY = new THREE.TorusGeometry(1.05, 0.11, 4, 16, Math.PI * 0.95);
const ECOSYSTEM_EVENT_MIN_DELAY = 18;
const ECOSYSTEM_EVENT_MAX_DELAY = 28;
const NEST_ATTACK_RANGE = 4.9;
const CARCASS_TTL = 18;
const MAX_CARCASSES = 6;
const PLAYER_TERRAIN_SAMPLE_RADIUS = 1.15;
const PLAYER_DUST_INTERVAL = 0.08;
const GAMEPAD_MOVE_DEADZONE = 0.18;
const GAMEPAD_LOOK_DEADZONE = 0.22;
const NEWBORN_SIZE_FLOOR = 0.6;
const NEWBORN_TRAIT_FLOOR = 0.38;
const SPECIES_XP_PASSIVE_RATE = 0.52;
const NEWBORN_GROWTH_PASSIVE_RATE = 1.14;
const FAST_EVOLVE_COST_MULTIPLIER = 0.82;
const SPRINT_HUD_HOLD = 1.15;
const COMBAT_HUD_HOLD = 1.4;
const HUD_MAP_RANGE = 26;
const SPECIES_DISPLAY_NAME = "Boney Snapper";
const BABY_STAGE_THRESHOLD = 0.35;
const ELDER_KILL_TARGET = 8;
const SOCIAL_INTERACT_RANGE = 8.4;
const SOCIAL_CHAIN_WINDOW = 5.5;
const SOCIAL_COOLDOWN = 0.85;
const SOCIAL_EMOTE_DURATION = 0.7;
const BIOME_MASTERY_MAX = 100;
const SHORE_READY_THRESHOLD = 0.58;
const BLOCKED_BROWSER_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ShiftLeft",
  "ShiftRight",
  "Space",
  "KeyF",
  "Escape",
]);
const SOCIAL_VERBS = [
  { key: "sing", code: "KeyQ", label: "Sing", shortLabel: "Q", phrase: "bone-hum" },
  { key: "pose", code: "KeyE", label: "Pose", shortLabel: "E", phrase: "crest flare" },
  { key: "charm", code: "KeyR", label: "Charm", shortLabel: "R", phrase: "glow sway" },
];
const SOCIAL_VERB_BY_CODE = Object.fromEntries(SOCIAL_VERBS.map((verb) => [verb.code, verb.key]));
const SOCIAL_VERB_BY_KEY = Object.fromEntries(SOCIAL_VERBS.map((verb) => [verb.key, verb]));
const SPECIES_PATH_DEFS = {
  nestling: {
    key: "nestling",
    label: "Nursery Drifter",
    shortLabel: "Drifter",
    summary: "Soft-bodied swimmer still learning whether the line belongs in water or on land.",
    favoredBiomes: ["Origin Waters", "Sunlit Shallows"],
    biomeSpeed: { originWaters: 1.04, sunlitShallows: 1.02, glowMarsh: 0.96, boneDunes: 0.94, jawBasin: 0.9 },
    biomeTraction: { originWaters: 1.04, sunlitShallows: 1.02, glowMarsh: 0.98, boneDunes: 0.94, jawBasin: 0.9 },
    biomeTurn: { originWaters: 1.08, sunlitShallows: 1.03, glowMarsh: 0.98, boneDunes: 0.96, jawBasin: 0.92 },
    biomeSprintDrain: { originWaters: 0.94, sunlitShallows: 0.98, glowMarsh: 1.02, boneDunes: 1.08, jawBasin: 1.12 },
    biomeAttack: { originWaters: 0.98, sunlitShallows: 1, glowMarsh: 0.98, boneDunes: 0.96, jawBasin: 0.94 },
  },
  waterGlider: {
    key: "waterGlider",
    label: "Water Glider",
    shortLabel: "Glider",
    summary: "Tail-and-crest bodies carve clean lines through water and hug the shoreline with speed.",
    favoredBiomes: ["Origin Waters", "Sunlit Shallows"],
    biomeSpeed: { originWaters: 1.14, sunlitShallows: 1.11, glowMarsh: 1, boneDunes: 0.9, jawBasin: 0.88 },
    biomeTraction: { originWaters: 1.1, sunlitShallows: 1.08, glowMarsh: 1.02, boneDunes: 0.92, jawBasin: 0.9 },
    biomeTurn: { originWaters: 1.16, sunlitShallows: 1.12, glowMarsh: 1.02, boneDunes: 0.94, jawBasin: 0.92 },
    biomeSprintDrain: { originWaters: 0.84, sunlitShallows: 0.9, glowMarsh: 0.96, boneDunes: 1.08, jawBasin: 1.12 },
    biomeAttack: { originWaters: 1.04, sunlitShallows: 1.03, glowMarsh: 1, boneDunes: 0.98, jawBasin: 0.96 },
  },
  marshAmbusher: {
    key: "marshAmbusher",
    label: "Marsh Ambusher",
    shortLabel: "Ambusher",
    summary: "Glow-and-spike bodies sit deep in soft ground, then explode into close-range strikes.",
    favoredBiomes: ["Glow Marsh", "Sunlit Shallows"],
    biomeSpeed: { originWaters: 0.98, sunlitShallows: 1.01, glowMarsh: 1.08, boneDunes: 0.97, jawBasin: 0.96 },
    biomeTraction: { originWaters: 1, sunlitShallows: 1.02, glowMarsh: 1.18, boneDunes: 0.96, jawBasin: 1.01 },
    biomeTurn: { originWaters: 0.99, sunlitShallows: 1.02, glowMarsh: 1.08, boneDunes: 0.98, jawBasin: 0.99 },
    biomeSprintDrain: { originWaters: 0.98, sunlitShallows: 0.98, glowMarsh: 0.86, boneDunes: 1.02, jawBasin: 1.04 },
    biomeAttack: { originWaters: 0.99, sunlitShallows: 1.02, glowMarsh: 1.1, boneDunes: 1, jawBasin: 1.02 },
  },
  duneRunner: {
    key: "duneRunner",
    label: "Dune Runner",
    shortLabel: "Runner",
    summary: "Long-legged chase bodies cross open sand cleanly and turn speed into long hunts.",
    favoredBiomes: ["Bone Dunes", "Sunlit Shallows"],
    biomeSpeed: { originWaters: 0.92, sunlitShallows: 1.03, glowMarsh: 0.98, boneDunes: 1.13, jawBasin: 1.05 },
    biomeTraction: { originWaters: 0.94, sunlitShallows: 1.02, glowMarsh: 0.96, boneDunes: 1.1, jawBasin: 1.04 },
    biomeTurn: { originWaters: 0.96, sunlitShallows: 1.04, glowMarsh: 0.98, boneDunes: 1.09, jawBasin: 1.03 },
    biomeSprintDrain: { originWaters: 1.06, sunlitShallows: 0.96, glowMarsh: 1.02, boneDunes: 0.8, jawBasin: 0.9 },
    biomeAttack: { originWaters: 0.98, sunlitShallows: 1.01, glowMarsh: 0.99, boneDunes: 1.04, jawBasin: 1.02 },
  },
  basinBruiser: {
    key: "basinBruiser",
    label: "Basin Bruiser",
    shortLabel: "Bruiser",
    summary: "Jaw-and-horn frames absorb punishment, push bodies around, and own hard ground.",
    favoredBiomes: ["Jaw Basin", "Bone Dunes"],
    biomeSpeed: { originWaters: 0.86, sunlitShallows: 0.92, glowMarsh: 0.97, boneDunes: 1, jawBasin: 1.06 },
    biomeTraction: { originWaters: 0.9, sunlitShallows: 0.95, glowMarsh: 1.02, boneDunes: 1.05, jawBasin: 1.12 },
    biomeTurn: { originWaters: 0.9, sunlitShallows: 0.95, glowMarsh: 0.98, boneDunes: 1, jawBasin: 1.02 },
    biomeSprintDrain: { originWaters: 1.12, sunlitShallows: 1.06, glowMarsh: 1, boneDunes: 0.98, jawBasin: 0.92 },
    biomeAttack: { originWaters: 0.98, sunlitShallows: 1.02, glowMarsh: 1.04, boneDunes: 1.07, jawBasin: 1.14 },
  },
};

const vectorA = new THREE.Vector3();
const vectorB = new THREE.Vector3();
const vectorC = new THREE.Vector3();
const vectorD = new THREE.Vector3();
const vectorE = new THREE.Vector3();
const vectorF = new THREE.Vector3();
const vectorG = new THREE.Vector3();
const upVector = new THREE.Vector3(0, 1, 0);
const TRAIT_LIMITS = Object.fromEntries(UPGRADE_DEFS.map((upgrade) => [upgrade.key, upgrade.costs.length]));
const TRAIT_TITLES = {
  jaw: "Jawmaw",
  horns: "Hookhorn",
  crest: "Suncrest",
  tail: "Whiptail",
  legs: "Longstride",
  spikes: "Spikehide",
  glow: "Glowstripe",
};
const PATTERN_LABELS = ["Bloomstripe", "Scatterback", "Ribscribe"];
const BIOME_ORDER = Object.values(BIOME_DEFS)
  .sort((left, right) => left.order - right.order)
  .map((biome) => biome.key);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function damp(current, target, smoothing, dt) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-smoothing * dt));
}

function dampVector(current, target, smoothing, dt) {
  const factor = 1 - Math.exp(-smoothing * dt);
  current.lerp(target, factor);
}

function moveVectorToward(current, target, maxDelta, workVector) {
  const delta = workVector.subVectors(target, current);
  const distance = delta.length();
  if (distance <= maxDelta || distance <= 0.00001) {
    current.copy(target);
    return;
  }
  current.addScaledVector(delta, maxDelta / distance);
}

function getSpawnOffset(radius) {
  const angle = Math.random() * Math.PI * 2;
  const distance = radius * (0.3 + Math.random() * 0.7);
  return {
    x: Math.cos(angle) * distance,
    z: Math.sin(angle) * distance,
  };
}

function getDistance2D(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function computeRunScore({ sessionDna, scavengersDefeated, predatorsDefeated, herbivoresDefeated, timeAlive }) {
  const survivalBonus = Math.max(0, timeAlive - 25) * 0.8;
  return Math.round(sessionDna * 6 + scavengersDefeated * 10 + predatorsDefeated * 26 + herbivoresDefeated * 7 + survivalBonus);
}

function normalizeAngle(angle) {
  let value = angle;
  while (value > Math.PI) {
    value -= Math.PI * 2;
  }
  while (value < -Math.PI) {
    value += Math.PI * 2;
  }
  return value;
}

function applyAxisDeadzone(value, deadzone) {
  const magnitude = Math.abs(value);
  if (magnitude <= deadzone) {
    return 0;
  }

  const normalized = (magnitude - deadzone) / (1 - deadzone);
  return Math.sign(value) * clamp(normalized, 0, 1);
}

function sampleTerrainResponse(position, direction, output) {
  const sample = PLAYER_TERRAIN_SAMPLE_RADIUS;
  const gradientX = (
    getTerrainHeight(position.x + sample, position.z)
    - getTerrainHeight(position.x - sample, position.z)
  ) / (sample * 2);
  const gradientZ = (
    getTerrainHeight(position.x, position.z + sample)
    - getTerrainHeight(position.x, position.z - sample)
  ) / (sample * 2);
  const slope = clamp(Math.hypot(gradientX, gradientZ) * 2.1, 0, 1);
  const sand = clamp(
    Math.abs(Math.sin(position.x * 0.09 + position.z * 0.05) * 0.58 + Math.cos(position.z * 0.08 - position.x * 0.06) * 0.42),
    0,
    1,
  );
  const uphill = direction.lengthSq() > 0.0001
    ? Math.max(0, direction.x * gradientX + direction.z * gradientZ) * 2.8
    : 0;
  output.slope = slope;
  output.sand = sand;
  output.uphill = uphill;
  output.speedFactor = clamp(1 - slope * 0.16 - sand * 0.08 - uphill * 0.14, 0.74, 1);
  output.traction = clamp(1 - slope * 0.18 - sand * 0.08, 0.68, 1);
  output.dust = clamp(0.35 + sand * 0.4 + slope * 0.24 + uphill * 0.18, 0.2, 1);
  return output;
}

function makeCreatureModel({
  bodyColor,
  accentColor,
  markingColor = accentColor,
  scale = 1,
  aggressive = false,
  eyeColor = aggressive ? 0xffd09a : 0xfef7df,
}) {
  const group = new THREE.Group();

  const skinMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor,
    flatShading: true,
    roughness: 0.92,
    metalness: 0.04,
  });

  const accentMaterial = new THREE.MeshStandardMaterial({
    color: accentColor,
    flatShading: true,
    roughness: 0.82,
    metalness: 0.08,
    emissive: accentColor,
    emissiveIntensity: 0.08,
  });

  const markingMaterial = new THREE.MeshStandardMaterial({
    color: markingColor,
    flatShading: true,
    roughness: 0.38,
    metalness: 0.04,
    emissive: markingColor,
    emissiveIntensity: 0.12,
    transparent: true,
    opacity: 0.74,
  });

  const eyeMaterial = new THREE.MeshBasicMaterial({ color: eyeColor });

  const body = new THREE.Mesh(new THREE.OctahedronGeometry(1.45 * scale, 0), skinMaterial);
  body.scale.set(1.2, 0.95, 1.7);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const back = new THREE.Mesh(new THREE.OctahedronGeometry(1.1 * scale, 0), accentMaterial);
  back.position.set(0, 0.2 * scale, -0.7 * scale);
  back.scale.set(0.9, 0.7, 1.1);
  back.castShadow = true;
  group.add(back);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.35 * scale, 2.1 * scale);
  group.add(headPivot);

  const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95 * scale, 0), skinMaterial);
  head.scale.set(0.9, 0.75, 1.25);
  head.castShadow = true;
  headPivot.add(head);

  const jaw = new THREE.Mesh(new THREE.ConeGeometry(0.55 * scale, 1 * scale, 5), accentMaterial);
  jaw.position.set(0, -0.5 * scale, 0.65 * scale);
  jaw.rotation.x = Math.PI * 0.48;
  jaw.castShadow = true;
  headPivot.add(jaw);

  const jawFangs = [];
  [-1, 1].forEach((sign) => {
    const fang = new THREE.Mesh(new THREE.ConeGeometry(0.08 * scale, 0.4 * scale, 4), accentMaterial);
    fang.position.set(sign * 0.28 * scale, 0.08 * scale, 0.2 * scale);
    fang.rotation.x = Math.PI * 0.12;
    fang.rotation.z = sign * 0.18;
    jaw.add(fang);
    jawFangs.push(fang);
  });

  const hornGroup = new THREE.Group();
  headPivot.add(hornGroup);
  const hornLeft = new THREE.Mesh(new THREE.ConeGeometry(0.18 * scale, 0.75 * scale, 4), accentMaterial);
  hornLeft.position.set(-0.38 * scale, 0.5 * scale, 0.05 * scale);
  hornLeft.rotation.z = 0.28;
  hornGroup.add(hornLeft);

  const hornRight = hornLeft.clone();
  hornRight.position.x *= -1;
  hornRight.rotation.z *= -1;
  hornGroup.add(hornRight);

  const eyeLeft = new THREE.Mesh(new THREE.SphereGeometry(0.13 * scale, 6, 6), eyeMaterial);
  eyeLeft.position.set(-0.28 * scale, 0.1 * scale, 0.64 * scale);
  headPivot.add(eyeLeft);

  const eyeRight = eyeLeft.clone();
  eyeRight.position.x *= -1;
  headPivot.add(eyeRight);

  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 0.2 * scale, -2.1 * scale);
  group.add(tailGroup);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.45 * scale, 1.8 * scale, 5), accentMaterial);
  tail.rotation.x = -Math.PI * 0.55;
  tail.castShadow = true;
  tailGroup.add(tail);

  const tailBlade = new THREE.Mesh(new THREE.BoxGeometry(0.14 * scale, 0.48 * scale, 0.9 * scale), markingMaterial);
  tailBlade.position.set(0, 0.66 * scale, -0.9 * scale);
  tailBlade.rotation.x = -Math.PI * 0.22;
  tailGroup.add(tailBlade);

  const crestGroup = new THREE.Group();
  for (let index = 0; index < 4; index += 1) {
    const frill = new THREE.Mesh(new THREE.ConeGeometry(0.2 * scale, 0.85 * scale, 4), accentMaterial);
    frill.position.set(0, 0.8 * scale + index * 0.1 * scale, -1 * scale + index * 0.7 * scale);
    frill.rotation.z = Math.PI / 2;
    crestGroup.add(frill);
  }
  group.add(crestGroup);

  const spikeGroup = new THREE.Group();
  const spikes = [];
  [
    [-0.82, 0.22, 0.82, 0.15],
    [0.82, 0.22, 0.82, -0.15],
    [-0.92, 0.34, -0.15, 0.22],
    [0.92, 0.34, -0.15, -0.22],
    [-0.68, 0.44, -1.08, 0.3],
    [0.68, 0.44, -1.08, -0.3],
  ].forEach(([x, y, z, roll]) => {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.13 * scale, 0.74 * scale, 4), accentMaterial);
    spike.position.set(x * scale, y * scale, z * scale);
    spike.rotation.z = Math.PI / 2 + roll;
    spike.rotation.x = 0.16;
    spikeGroup.add(spike);
    spikes.push(spike);
  });
  group.add(spikeGroup);

  const markingsGroup = new THREE.Group();
  const stripePattern = new THREE.Group();
  for (let index = 0; index < 3; index += 1) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.16 * scale, 0.14 * scale, 1.55 * scale), markingMaterial);
    stripe.position.set((index - 1) * 0.38 * scale, 0.48 * scale, -0.15 * scale);
    stripe.rotation.x = Math.PI * 0.12;
    stripePattern.add(stripe);
  }
  const scatterPattern = new THREE.Group();
  [
    [-0.56, 0.28, 0.68],
    [0.46, 0.44, 0.18],
    [-0.24, 0.56, -0.72],
    [0.58, 0.24, -0.88],
  ].forEach(([x, y, z], index) => {
    const blotch = new THREE.Mesh(new THREE.SphereGeometry((index % 2 === 0 ? 0.18 : 0.13) * scale, 6, 6), markingMaterial);
    blotch.position.set(x * scale, y * scale, z * scale);
    blotch.scale.z = 0.55;
    scatterPattern.add(blotch);
  });
  const ribPattern = new THREE.Group();
  [-1, 1].forEach((sign) => {
    for (let index = 0; index < 3; index += 1) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.12 * scale, 0.1 * scale, 0.72 * scale), markingMaterial);
      rib.position.set(sign * 0.68 * scale, 0.24 * scale + index * 0.2 * scale, 0.48 * scale - index * 0.7 * scale);
      rib.rotation.y = sign * 0.54;
      rib.rotation.z = sign * 0.16;
      ribPattern.add(rib);
    }
  });
  markingsGroup.add(stripePattern);
  markingsGroup.add(scatterPattern);
  markingsGroup.add(ribPattern);
  group.add(markingsGroup);

  const legPivots = [];
  const legMeshes = [];
  const footMeshes = [];
  const legOffsets = [
    [-0.75, -0.45, 0.85],
    [0.75, -0.45, 0.85],
    [-0.75, -0.45, -0.6],
    [0.75, -0.45, -0.6],
  ];

  legOffsets.forEach(([x, y, z], index) => {
    const pivot = new THREE.Group();
    pivot.position.set(x * scale, y * scale, z * scale);

    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * scale, 0.24 * scale, 1.45 * scale, 5), skinMaterial);
    leg.position.y = -0.7 * scale;
    leg.castShadow = true;
    pivot.add(leg);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.34 * scale, 0.18 * scale, 0.6 * scale), accentMaterial);
    foot.position.set(0, -1.42 * scale, 0.18 * scale);
    foot.castShadow = true;
    pivot.add(foot);

    legPivots[index] = pivot;
    legMeshes[index] = leg;
    footMeshes[index] = foot;
    group.add(pivot);
  });

  return {
    group,
    refs: {
      materials: {
        skin: skinMaterial,
        accent: accentMaterial,
        markings: markingMaterial,
      },
      headPivot,
      head,
      jaw,
      jawFangs,
      tail,
      tailGroup,
      tailBlade,
      back,
      body,
      hornGroup,
      hornLeft,
      hornRight,
      crestGroup,
      spikeGroup,
      spikes,
      markingsGroup,
      patternGroups: [stripePattern, scatterPattern, ribPattern],
      legPivots,
      legMeshes,
      footMeshes,
      modelScale: scale,
    },
  };
}

function createFoodMesh(rare = false) {
  const group = new THREE.Group();

  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(rare ? 0.75 : 0.55, 0),
    new THREE.MeshStandardMaterial({
      color: rare ? 0xff9a6d : 0x89ffd9,
      emissive: rare ? 0xff7046 : 0x51ffd8,
      emissiveIntensity: rare ? 0.9 : 0.65,
      flatShading: true,
      roughness: 0.55,
    }),
  );
  core.castShadow = true;
  group.add(core);

  const petals = new THREE.Mesh(
    new THREE.TorusGeometry(rare ? 0.6 : 0.48, 0.1, 4, 8),
    new THREE.MeshStandardMaterial({
      color: rare ? 0xf7d0a7 : 0xd6fff4,
      flatShading: true,
      roughness: 0.88,
    }),
  );
  petals.rotation.x = Math.PI / 2;
  group.add(petals);

  return group;
}

function createEnemy(type) {
  const spec = ENEMY_DEFS[type];
  const profile = {
    bodyHue: 0,
    accentHue: 0,
    markingsHue: 0,
    size: Number((0.96 + Math.random() * 0.08).toFixed(3)),
    patternType: spec.patternBias ?? Math.floor(Math.random() * 3),
    patternScale: Number((0.9 + Math.random() * 0.2).toFixed(3)),
  };
  const model = makeCreatureModel({
    bodyColor: spec.color,
    accentColor: spec.accent,
    markingColor: spec.accent,
    scale: spec.scale,
    aggressive: spec.family === "predator",
  });
  const enemy = {
    ...model,
    type: spec.family,
    variant: type,
    spec,
    traits: { ...spec.traits },
    profile,
    baseScale: profile.size,
    baseBackGlow: 0.08,
    baseMarkingGlow: 0.1,
    mass: clamp(spec.scale * (spec.poise ?? 1) * (spec.family === "predator" ? 0.98 : spec.family === "scavenger" ? 0.82 : 0.68), 0.72, 2.8),
    collisionRadius: spec.scale * (spec.family === "predator" ? 1.55 : 1.3),
    velocity: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    state: "idle",
    hp: spec.health,
    maxHp: spec.health,
    cooldown: 0,
    deadTimer: 0,
    roamTimer: 0,
    attackTelegraph: 0,
    attackVector: new THREE.Vector3(),
    circleSign: Math.random() < 0.5 ? -1 : 1,
    bob: Math.random() * Math.PI * 2,
    hitFlash: 0,
    impactPulse: 0,
    staggerTimer: 0,
    fleeTimer: 0,
    hitDirection: new THREE.Vector3(),
    threatGlow: 0,
    recoilLift: 0,
    recoilTilt: 0,
    socialPulse: 0,
  };
  applyCreatureAppearance(enemy, enemy.traits, enemy.profile, {
    body: spec.color,
    accent: spec.accent,
    markings: spec.accent,
  });

  return enemy;
}

function getTraitLevels(saveData) {
  return UPGRADE_DEFS.reduce((traits, upgrade) => {
    traits[upgrade.key] = clamp(Math.round(saveData.upgrades?.[upgrade.key] ?? 0), 0, TRAIT_LIMITS[upgrade.key]);
    return traits;
  }, {});
}

function computeSpeciesPath(upgrades, profile = null) {
  const scores = {
    waterGlider: upgrades.tail * 1.12 + upgrades.crest * 0.94 + upgrades.glow * 0.18 - upgrades.spikes * 0.12,
    marshAmbusher: upgrades.glow * 1.02 + upgrades.spikes * 0.86 + upgrades.crest * 0.22 + upgrades.jaw * 0.16,
    duneRunner: upgrades.legs * 1.08 + upgrades.tail * 0.68 + upgrades.jaw * 0.14 - upgrades.spikes * 0.08,
    basinBruiser: upgrades.jaw * 0.96 + upgrades.horns * 0.92 + upgrades.spikes * 0.84 + upgrades.tail * 0.12,
  };
  const winner = Object.entries(scores).sort((left, right) => right[1] - left[1])[0];
  const winnerKey = winner && winner[1] >= 0.9 ? winner[0] : "nestling";
  const pathDef = SPECIES_PATH_DEFS[winnerKey] ?? SPECIES_PATH_DEFS.nestling;
  const size = profile?.size ?? 1;
  const shoreReadiness = clamp(
    0.18
      + upgrades.legs * 0.22
      + upgrades.tail * 0.13
      + upgrades.spikes * 0.07
      + upgrades.horns * 0.04
      + Math.max(0, size - 0.94) * 0.18
      + (winnerKey === "duneRunner" ? 0.08 : winnerKey === "basinBruiser" ? 0.06 : winnerKey === "waterGlider" ? -0.03 : 0),
    0.12,
    1,
  );

  let shoreLabel = "Water-bound";
  let shoreSummary = "This body still belongs to the nursery waters.";
  if (shoreReadiness >= 0.84) {
    shoreLabel = "Land-forged";
    shoreSummary = "This line can leave the water and stay efficient on hard ground.";
  } else if (shoreReadiness >= SHORE_READY_THRESHOLD) {
    shoreLabel = "Shore-ready";
    shoreSummary = "This body can break onto land without losing its rhythm.";
  } else if (shoreReadiness >= 0.38) {
    shoreLabel = "Shore-soft";
    shoreSummary = "This line can test the shoreline, but long land runs still cost momentum.";
  }

  return {
    ...pathDef,
    score: Number((winner?.[1] ?? 0).toFixed(2)),
    shoreReadiness,
    shoreLabel,
    shoreSummary,
  };
}

function computePlayerStats(upgrades, profile = null) {
  const size = profile?.size ?? 1;
  const mass = clamp(
    1 + (size - 1) * 1.4 + upgrades.spikes * 0.15 + upgrades.jaw * 0.08 + upgrades.horns * 0.05 - upgrades.legs * 0.06,
    0.84,
    1.7,
  );
  const momentumScale = Math.pow(mass, 0.72);
  const path = computeSpeciesPath(upgrades, profile);
  return {
    speed: PLAYER_BASE_STATS.speed * (1 + upgrades.legs * 0.1),
    health: PLAYER_BASE_STATS.health + upgrades.spikes * 16,
    biteDamage: PLAYER_BASE_STATS.biteDamage + upgrades.jaw * 7 + upgrades.horns * 4,
    biteCooldown: PLAYER_BASE_STATS.biteCooldown * (1 - upgrades.glow * 0.08),
    knockback: PLAYER_BASE_STATS.knockback * (1 + upgrades.tail * 0.18),
    defense: clamp(PLAYER_BASE_STATS.defense + upgrades.spikes * 0.09, 0, 0.3),
    intimidation: PLAYER_BASE_STATS.intimidation + upgrades.horns * 0.12 + upgrades.crest * 0.18,
    attackReach: 4.35 + upgrades.jaw * 0.28 + upgrades.horns * 0.18,
    lungeSpeed: ATTACK_LUNGE_SPEED * (1 + upgrades.legs * 0.04 + upgrades.jaw * 0.03 + upgrades.tail * 0.04) / Math.pow(mass, 0.08),
    mass,
    acceleration: (32 + upgrades.legs * 2.2 + upgrades.tail * 0.7) / momentumScale,
    braking: (29 + upgrades.legs * 1.9 + upgrades.tail * 1.05) / momentumScale,
    coastDrag: (8.2 + upgrades.tail * 0.45) / momentumScale,
    turnRate: (7.4 + upgrades.legs * 0.72 - upgrades.spikes * 0.14) / Math.pow(mass, 0.58),
    attackDrive: (11 + upgrades.jaw * 0.65 + upgrades.horns * 0.45 + upgrades.tail * 0.5) / Math.pow(mass, 0.08),
    attackCarry: 3.8 + upgrades.tail * 0.7 + upgrades.horns * 0.28,
    collisionRadius: 1.7 * size + upgrades.spikes * 0.08,
    bodyPush: 3.8 + upgrades.tail * 0.65 + upgrades.horns * 0.35 + upgrades.spikes * 0.25,
    impactResist: 1 + upgrades.spikes * 0.14 + Math.max(0, size - 1) * 0.45,
    path,
    shoreReadiness: path.shoreReadiness,
  };
}

function normalizeAlignment(alignment) {
  const total = (alignment.aggressive ?? 0) + (alignment.social ?? 0) + (alignment.adaptive ?? 0);
  if (total <= 0.001) {
    return { ...DEFAULT_ALIGNMENT };
  }

  return {
    aggressive: alignment.aggressive / total,
    social: alignment.social / total,
    adaptive: alignment.adaptive / total,
  };
}

function shiftAlignment(alignment, key, amount) {
  const next = {
    aggressive: Math.max(0.01, alignment.aggressive ?? DEFAULT_ALIGNMENT.aggressive),
    social: Math.max(0.01, alignment.social ?? DEFAULT_ALIGNMENT.social),
    adaptive: Math.max(0.01, alignment.adaptive ?? DEFAULT_ALIGNMENT.adaptive),
  };
  next[key] = Math.max(0.01, next[key] + amount);
  return normalizeAlignment(next);
}

function getDominantBiomeKey(mastery, fallback = "originWaters") {
  let winner = fallback;
  let bestScore = mastery?.[fallback] ?? 0;
  BIOME_ORDER.forEach((biomeKey) => {
    const score = mastery?.[biomeKey] ?? 0;
    if (score > bestScore + 0.001) {
      bestScore = score;
      winner = biomeKey;
    }
  });
  return winner;
}

function getBlueprintLabel(traitKey) {
  return UPGRADE_DEFS.find((upgrade) => upgrade.key === traitKey)?.label ?? traitKey;
}

function getUpgradeUnlockRoutes(upgrade) {
  if (Array.isArray(upgrade?.unlockRoutes) && upgrade.unlockRoutes.length) {
    return upgrade.unlockRoutes;
  }
  if (upgrade?.unlock) {
    return [upgrade.unlock];
  }
  return [];
}

function describeBlueprintUnlockRoute(route) {
  if (!route || route.type === "starter") {
    return "Starter instinct";
  }

  if (route.type === "frontier") {
    const biome = BIOME_DEFS[route.biomeKey];
    if (!biome) {
      return "Master a frontier";
    }
    return `Master ${biome.label}${Number.isFinite(route.mastery) ? ` (${Math.round(route.mastery)})` : ""}`;
  }

  const species = route.speciesId ? SPECIES_DEFS[route.speciesId] : null;
  if (!species) {
    return "Discover in the dunes";
  }

  if (route.type === "ally") {
    return `Befriend ${species.name}`;
  }

  return `Defeat ${species.name}`;
}

function getBlueprintUnlockText(upgrade) {
  const routes = getUpgradeUnlockRoutes(upgrade);
  if (!routes.length || routes.some((route) => route.type === "starter")) {
    return "Starter instinct";
  }

  const uniqueRoutes = routes
    .map((route) => describeBlueprintUnlockRoute(route))
    .filter((label, index, labels) => labels.indexOf(label) === index);

  return uniqueRoutes.join(" or ");
}

function createPaletteFromProfile(profile) {
  return {
    body: new THREE.Color().setHSL(profile.bodyHue, 0.34, 0.43).getHex(),
    accent: new THREE.Color().setHSL(profile.accentHue, 0.74, 0.62).getHex(),
    markings: new THREE.Color().setHSL(profile.markingsHue, 0.86, 0.64).getHex(),
  };
}

function describeTraitLevel(key, level) {
  if (level <= 0) {
    return "Dormant";
  }

  switch (key) {
    case "jaw":
      return `+${level * 7} bite damage`;
    case "horns":
      return `+${level * 4} damage, +${Math.round(level * 12)}% intimidation`;
    case "crest":
      return `${level === 1 ? "Open" : "Great"} crest, +${Math.round(level * 18)}% scavenger pressure`;
    case "tail":
      return `+${Math.round(level * 18)}% knockback`;
    case "legs":
      return `+${Math.round(level * 10)}% speed`;
    case "spikes":
      return `+${level * 16} health, ${Math.round(level * 9)}% defense`;
    case "glow":
      return `-${Math.round(level * 8)}% bite recovery`;
    default:
      return "Mutating";
  }
}

function buildCreatureIdentity(profile, traits) {
  const leadTrait = Object.entries(traits)
    .filter(([, level]) => level > 0)
    .sort((left, right) => right[1] - left[1])[0]?.[0];
  const sizeWord = profile.size > 1.05 ? "Great" : profile.size < 0.95 ? "Lean" : "Dune";
  const patternWord = PATTERN_LABELS[profile.patternType] ?? PATTERN_LABELS[0];
  const traitWord = TRAIT_TITLES[leadTrait] ?? "Nestling";
  return `${sizeWord} ${traitWord} ${patternWord}`;
}

function getTraitTotal(traits) {
  return Object.values(traits).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
}

function getCreatureMaturity(creature) {
  return clamp(creature?.growth ?? 1, 0, 1);
}

function getCreatureStage(maturity) {
  if (maturity >= 0.999) {
    return "adult";
  }
  if (maturity >= 0.55) {
    return "juvenile";
  }
  return "newborn";
}

function describeCreatureStage(maturity) {
  const stage = getCreatureStage(maturity);
  if (stage === "adult") {
    return "Adult";
  }
  if (stage === "juvenile") {
    return "Growing";
  }
  return "Newborn";
}

function computeCreatureMaturityTarget(creatureOrTraits, profileArg = null) {
  const traits = creatureOrTraits?.traits ?? creatureOrTraits ?? DEFAULT_SAVE.upgrades;
  const profile = creatureOrTraits?.profile ?? profileArg ?? DEFAULT_SAVE.creatureProfile;
  const traitComplexity = getTraitTotal(traits);
  const sizeWeight = Math.max(0, (profile.size ?? 1) - 0.9);
  const patternWeight = Math.max(0, (profile.patternScale ?? 1) - 0.92);
  return Math.round(26 + traitComplexity * 13 + sizeWeight * 46 + patternWeight * 12);
}

function computeRemainingMaturityPoints(creature) {
  const target = computeCreatureMaturityTarget(creature);
  return Math.max(0, target * (1 - getCreatureMaturity(creature)));
}

function getFastEvolveCost(creature) {
  return Math.max(1, Math.ceil(computeRemainingMaturityPoints(creature) * FAST_EVOLVE_COST_MULTIPLIER));
}

function getCreatureMaturationDisplay(creature) {
  const maturity = getCreatureMaturity(creature);
  if (maturity < BABY_STAGE_THRESHOLD) {
    const progress = clamp(maturity / BABY_STAGE_THRESHOLD, 0, 1);
    return {
      key: "baby",
      label: `Baby ${SPECIES_DISPLAY_NAME}`,
      progress,
      detail: `${Math.round(progress * 100)}% to adolescent`,
    };
  }

  if (maturity < 0.999) {
    const progress = clamp((maturity - BABY_STAGE_THRESHOLD) / (1 - BABY_STAGE_THRESHOLD), 0, 1);
    return {
      key: "adolescent",
      label: `Adolescent ${SPECIES_DISPLAY_NAME}`,
      progress,
      detail: `${Math.round(maturity * 100)}% to fully grown`,
    };
  }

  const elderTargetTime = Math.max(18, computeCreatureMaturityTarget(creature) * 0.58);
  const elderProgress = clamp(
    Math.max((creature?.activeTime ?? 0) / elderTargetTime, (creature?.killCount ?? 0) / ELDER_KILL_TARGET),
    0,
    1,
  );
  if (elderProgress >= 0.999) {
    return {
      key: "elder",
      label: `Elder ${SPECIES_DISPLAY_NAME}`,
      progress: 1,
      detail: "Line elder",
    };
  }

  return {
    key: "grown",
    label: `Fully Grown ${SPECIES_DISPLAY_NAME}`,
    progress: 1,
    detail: "Season this body into an elder",
  };
}

function getCreatureRuntimeState(creature) {
  const maturity = getCreatureMaturity(creature);
  const sizeScale = THREE.MathUtils.lerp(NEWBORN_SIZE_FLOOR, 1, maturity);
  const traitScale = THREE.MathUtils.lerp(NEWBORN_TRAIT_FLOOR, 1, maturity);
  const runtimeTraits = Object.entries(creature.traits).reduce((traits, [key, value]) => {
    traits[key] = value > 0 ? Number((value * traitScale).toFixed(3)) : 0;
    return traits;
  }, {});

  return {
    maturity,
    sizeScale,
    traitScale,
    stage: getCreatureStage(maturity),
    maturityTarget: computeCreatureMaturityTarget(creature),
    runtimeTraits,
    runtimeProfile: {
      ...creature.profile,
      size: Number(((creature.profile.size ?? 1) * sizeScale).toFixed(3)),
      patternScale: Number(THREE.MathUtils.lerp(0.88, creature.profile.patternScale ?? 1, 0.58 + maturity * 0.42).toFixed(3)),
    },
  };
}

function compareTraitSets(left, right) {
  return Object.keys(DEFAULT_SAVE.upgrades).every((key) => (left?.[key] ?? 0) === (right?.[key] ?? 0));
}

function compareProfiles(left, right) {
  return ["bodyHue", "accentHue", "markingsHue", "size", "patternType", "patternScale"].every((key) => {
    const a = left?.[key];
    const b = right?.[key];
    if (Number.isFinite(a) || Number.isFinite(b)) {
      return Math.abs((a ?? 0) - (b ?? 0)) < 0.0001;
    }
    return a === b;
  });
}

function mutateEggProfile(profile, traits) {
  const traitWeight = getTraitTotal(traits);
  return {
    bodyHue: (profile.bodyHue + (Math.random() - 0.5) * 0.025 + 1) % 1,
    accentHue: (profile.accentHue + (Math.random() - 0.5) * 0.035 + 1) % 1,
    markingsHue: (profile.markingsHue + (Math.random() - 0.5) * 0.045 + 1) % 1,
    size: clamp(profile.size + (Math.random() - 0.5) * (0.03 + traitWeight * 0.0025), 0.82, 1.24),
    patternType: Math.random() < 0.18 ? Math.floor(Math.random() * PATTERN_LABELS.length) : profile.patternType,
    patternScale: clamp(profile.patternScale + (Math.random() - 0.5) * 0.08, 0.8, 1.35),
  };
}

function applyCreatureAppearance(creature, traits, profile, palette) {
  const resolvedPalette = palette ?? createPaletteFromProfile(profile);
  const sizeScale = profile.size ?? 1;
  creature.traits = { ...traits };
  creature.profile = { ...profile };
  creature.baseScale = sizeScale;
  creature.group.scale.setScalar(creature.baseScale);

  const { refs } = creature;
  refs.materials.skin.color.set(resolvedPalette.body);
  refs.materials.accent.color.set(resolvedPalette.accent);
  refs.materials.accent.emissive.set(resolvedPalette.accent);
  refs.materials.markings.color.set(resolvedPalette.markings);
  refs.materials.markings.emissive.set(resolvedPalette.markings);

  refs.body.scale.set(1.16 + traits.spikes * 0.05, 0.93 + traits.spikes * 0.04, 1.66 + traits.legs * 0.04);
  refs.back.scale.set(0.88 + traits.crest * 0.08, 0.68 + traits.glow * 0.05, 1.06 + traits.tail * 0.06);
  refs.head.scale.set(0.9 + traits.jaw * 0.04, 0.75 + traits.horns * 0.02, 1.25 + traits.jaw * 0.08);
  refs.jaw.scale.set(1 + traits.jaw * 0.12, 1 + traits.jaw * 0.08, 1 + traits.jaw * 0.2);
  refs.jawFangs.forEach((fang, index) => {
    fang.scale.setScalar(1 + traits.jaw * 0.12 + traits.horns * 0.06);
    fang.position.x = (index === 0 ? -1 : 1) * (0.28 + traits.jaw * 0.03) * refs.modelScale;
  });
  refs.hornGroup.visible = traits.horns > 0;
  refs.hornLeft.scale.set(1 + traits.horns * 0.34, 1 + traits.horns * 0.34, 1 + traits.horns * 0.44);
  refs.hornRight.scale.copy(refs.hornLeft.scale);
  refs.hornLeft.position.y = (0.5 + traits.horns * 0.05) * refs.modelScale;
  refs.hornRight.position.y = refs.hornLeft.position.y;
  refs.crestGroup.visible = traits.crest > 0;
  refs.crestGroup.scale.set(1, 0.86 + traits.crest * 0.22, 0.96 + traits.crest * 0.12);
  refs.tail.scale.set(1 + traits.tail * 0.06, 1 + traits.tail * 0.14, 1 + traits.tail * 0.08);
  refs.tailBlade.visible = traits.tail > 0;
  refs.tailBlade.scale.set(0.9 + traits.tail * 0.18, 0.9 + traits.tail * 0.12, 0.9 + traits.tail * 0.22);
  refs.spikeGroup.visible = traits.spikes > 0;
  refs.spikes.forEach((spike, index) => {
    const tier = index < 2 ? 1 : index < 4 ? 2 : 3;
    const active = traits.spikes >= tier;
    spike.visible = active;
    spike.scale.setScalar(active ? 0.9 + traits.spikes * 0.18 : 0.01);
  });
  refs.patternGroups.forEach((group, index) => {
    group.visible = index === profile.patternType;
    group.scale.setScalar(profile.patternScale ?? 1);
  });
  refs.markingsGroup.visible = true;
  refs.materials.markings.opacity = 0.2 + traits.glow * 0.12;
  creature.baseBackGlow = 0.08 + traits.glow * 0.08 + traits.crest * 0.16;
  creature.baseMarkingGlow = 0.08 + traits.glow * 0.22;

  const legStretch = 1 + traits.legs * 0.14;
  refs.legMeshes.forEach((leg, index) => {
    leg.scale.y = legStretch;
    refs.footMeshes[index].position.y = -1.42 * refs.modelScale * legStretch;
    refs.legPivots[index].position.y = -0.45 * refs.modelScale - traits.legs * 0.05 * refs.modelScale;
  });
}

function getZoneName(position) {
  const nestDistance = Math.hypot(position.x - NEST_POSITION.x, position.z - NEST_POSITION.z);
  if (nestDistance <= NEST_POSITION.radius + 1.5) {
    return "nest";
  }

  const dangerDistance = Math.hypot(position.x - DANGER_ZONE.x, position.z - DANGER_ZONE.z);
  if (dangerDistance <= DANGER_ZONE.radius) {
    return "danger";
  }

  return "dunes";
}

function sortByDistance(position, items, mapFn) {
  return items
    .map((item) => ({ item, distance: getDistance2D(position, item.group.position) }))
    .sort((left, right) => left.distance - right.distance)
    .map(({ item, distance }) => mapFn(item, distance));
}

function pickRandom(items) {
  if (!items.length) {
    return null;
  }
  return items[Math.floor(Math.random() * items.length)];
}

function createSpeciesNestMarker(species) {
  const group = new THREE.Group();

  const ring = new THREE.Mesh(
    SPECIES_RING_GEOMETRY,
    new THREE.MeshBasicMaterial({
      color: species.territory.color,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.scale.set(species.territory.radius, species.territory.radius, 1);
  ring.position.y = 0.08;
  group.add(ring);

  const pulse = new THREE.Mesh(
    new THREE.RingGeometry(species.territory.radius * 0.82, species.territory.radius * 0.86, 42),
    new THREE.MeshBasicMaterial({
      color: species.uiColor,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  pulse.rotation.x = -Math.PI / 2;
  pulse.position.y = 0.1;
  group.add(pulse);

  const marker = new THREE.Group();
  group.add(marker);

  const coreMaterial = new THREE.MeshStandardMaterial({
    color: species.territory.landmark === "spire" ? 0x724b39 : species.territory.landmark === "burrow" ? 0x82624c : 0x8a6b4f,
    flatShading: true,
    roughness: 0.96,
    metalness: 0.04,
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: species.uiColor,
    emissive: species.uiColor,
    emissiveIntensity: 0.2,
    flatShading: true,
    roughness: 0.72,
  });

  if (species.nest.type === "boneDen") {
    const left = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.82, 4.8, 5), coreMaterial);
    left.position.set(-2.2, 2.1, 0);
    left.rotation.z = 0.08;
    left.castShadow = true;
    marker.add(left);

    const right = left.clone();
    right.position.x *= -1;
    right.rotation.z *= -1;
    marker.add(right);

    const top = new THREE.Mesh(new THREE.CapsuleGeometry(0.65, 4.2, 4, 8), coreMaterial);
    top.position.set(0, 4.9, 0);
    top.rotation.z = Math.PI / 2;
    top.castShadow = true;
    marker.add(top);

    const fang = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.6, 5), accentMaterial);
    fang.position.set(0, 6.7, 0.4);
    fang.rotation.z = 0.12;
    fang.castShadow = true;
    marker.add(fang);
  } else if (species.nest.type === "burrow") {
    const mound = new THREE.Mesh(new THREE.SphereGeometry(3.6, 10, 10), coreMaterial);
    mound.scale.set(1.1, 0.42, 1);
    mound.position.y = 1.15;
    mound.castShadow = true;
    mound.receiveShadow = true;
    marker.add(mound);

    const mouth = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.45, 0.9, 20),
      new THREE.MeshBasicMaterial({ color: 0x16100c }),
    );
    mouth.position.set(0, 0.24, 1.1);
    mouth.rotation.x = Math.PI / 2;
    marker.add(mouth);

    for (let index = 0; index < 3; index += 1) {
      const glowStone = new THREE.Mesh(new THREE.OctahedronGeometry(0.46 + index * 0.08, 0), accentMaterial);
      glowStone.position.set(-1.5 + index * 1.4, 1.2 + Math.sin(index) * 0.18, -0.6 + Math.cos(index) * 0.4);
      glowStone.castShadow = true;
      marker.add(glowStone);
    }
  } else if (species.nest.type === "reef") {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.4, 0.85, 7), coreMaterial);
    plate.position.y = 0.4;
    plate.castShadow = true;
    plate.receiveShadow = true;
    marker.add(plate);

    for (let index = 0; index < 5; index += 1) {
      const angle = (index / 5) * Math.PI * 2 + 0.3;
      const fan = new THREE.Mesh(
        new THREE.ConeGeometry(0.42, 1.8, 4),
        accentMaterial,
      );
      fan.position.set(Math.cos(angle) * 1.9, 1 + Math.sin(index * 1.7) * 0.18, Math.sin(angle) * 1.9);
      fan.scale.set(0.8, 1.1 + (index % 2) * 0.18, 0.24);
      fan.rotation.set(0.28, angle, 0.12);
      fan.castShadow = true;
      marker.add(fan);
    }

    const pearl = new THREE.Mesh(new THREE.OctahedronGeometry(0.82, 0), accentMaterial);
    pearl.position.set(0, 1.55, 0);
    pearl.scale.set(0.9, 1.2, 0.9);
    pearl.castShadow = true;
    marker.add(pearl);
  } else {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.4, 1.1, 8), coreMaterial);
    base.position.y = 0.55;
    base.castShadow = true;
    base.receiveShadow = true;
    marker.add(base);

    for (let index = 0; index < 6; index += 1) {
      const angle = (index / 6) * Math.PI * 2;
      const shard = new THREE.Mesh(new THREE.ConeGeometry(0.28, 2.1, 4), accentMaterial);
      shard.position.set(Math.cos(angle) * 2.6, 1.4, Math.sin(angle) * 2.6);
      shard.rotation.z = Math.PI / 2;
      shard.rotation.y = angle;
      shard.castShadow = true;
      marker.add(shard);
    }

    const pile = new THREE.Mesh(new THREE.DodecahedronGeometry(1.15, 0), coreMaterial);
    pile.position.set(0, 1.6, 0);
    pile.scale.set(1.2, 0.8, 1.4);
    pile.castShadow = true;
    marker.add(pile);
  }

  group.userData.marker = marker;
  return { group, ring, pulse, marker };
}

function createCarcassMesh(color) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.78, 0),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.08,
      flatShading: true,
      roughness: 0.95,
    }),
  );
  body.scale.set(1.3, 0.42, 0.92);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const rib = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.08, 4, 10, Math.PI * 0.92),
    new THREE.MeshStandardMaterial({
      color: 0xe8d8b6,
      flatShading: true,
      roughness: 0.92,
    }),
  );
  rib.rotation.set(Math.PI * 0.55, 0, Math.PI * 0.5);
  rib.position.y = 0.18;
  group.add(rib);

  return group;
}

export class SporeSliceGame {
  constructor(container, onStateChange) {
    this.container = container;
    this.onStateChange = onStateChange;
    this.manualStepping = false;
    this.animationFrame = 0;
    this.lastFrameTime = 0;
    this.elapsed = 0;
    this.saveData = loadSave();
    this.saveData.speciesCreatures = (this.saveData.speciesCreatures ?? []).map((creature) => createSpeciesCreature(creature));
    if (!this.saveData.speciesCreatures.length) {
      const starterCreature = createSpeciesCreature({
        traits: DEFAULT_SAVE.upgrades,
        profile: DEFAULT_SAVE.creatureProfile,
        growth: 1,
      });
      this.saveData.speciesCreatures = [starterCreature];
      this.saveData.activeCreatureId = starterCreature.id;
      this.saveData.evolutionDraft = createEvolutionDraft(starterCreature);
    }
    if (!this.saveData.speciesCreatures.some((creature) => creature.id === this.saveData.activeCreatureId)) {
      this.saveData.activeCreatureId = this.saveData.speciesCreatures[0].id;
    }
    if (!this.saveData.evolutionDraft) {
      const draftBase = this.saveData.speciesCreatures.find((creature) => creature.id === this.saveData.activeCreatureId) ?? this.saveData.speciesCreatures[0];
      this.saveData.evolutionDraft = createEvolutionDraft(draftBase);
    }
    this.saveData.traitBlueprints = {
      ...DEFAULT_SAVE.traitBlueprints,
      ...(this.saveData.traitBlueprints ?? {}),
    };
    this.saveData.biomeProgress = {
      ...createDefaultBiomeProgress({
        legacy:
          this.saveData.dna > 0
          || (this.saveData.speciesXp ?? 0) > 0
          || this.saveData.speciesCreatures.length > 1,
      }),
      ...(this.saveData.biomeProgress ?? {}),
      mastery: {
        ...createDefaultBiomeProgress({
          legacy:
            this.saveData.dna > 0
            || (this.saveData.speciesXp ?? 0) > 0
            || this.saveData.speciesCreatures.length > 1,
        }).mastery,
        ...(this.saveData.biomeProgress?.mastery ?? {}),
      },
    };
    this.saveData.biomeProgress.dominantBiome = getDominantBiomeKey(
      this.saveData.biomeProgress.mastery,
      this.saveData.biomeProgress.dominantBiome,
    );
    this.saveData.speciesRelations = Object.keys(DEFAULT_SAVE.speciesRelations).reduce((relations, speciesId) => {
      relations[speciesId] = {
        ...DEFAULT_SAVE.speciesRelations[speciesId],
        ...(this.saveData.speciesRelations?.[speciesId] ?? {}),
      };
      return relations;
    }, {});
    this.checkFrontierBlueprintUnlocks();
    const initialActiveCreature =
      this.saveData.speciesCreatures.find((creature) => creature.id === this.saveData.activeCreatureId)
      ?? this.saveData.speciesCreatures[0];
    this.activeCreatureRuntime = getCreatureRuntimeState(initialActiveCreature);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 220);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute("aria-label", "Bone dunes 3D view");

    this.clock = new THREE.Clock();
    this.state = {
      mode: "menu",
      zone: "nest",
      message: "Life begins in the origin waters. Feed there, push outward, then return to the species nest to evolve.",
      objective: "Start in water, unlock new frontiers, then grow the line into the dunes and beyond.",
      dna: this.saveData.dna,
      speciesXp: this.saveData.speciesXp ?? 0,
      bestRun: this.saveData.bestRun ?? 0,
      upgrades: { ...this.activeCreatureRuntime.runtimeTraits },
      creatureProfile: { ...this.activeCreatureRuntime.runtimeProfile },
      alignment: normalizeAlignment(this.saveData.alignment ?? DEFAULT_ALIGNMENT),
      hasSave:
        this.saveData.dna > 0
        || (this.saveData.speciesXp ?? 0) > 0
        || this.saveData.speciesCreatures.length > 1
        || Object.values(initialActiveCreature.traits).some(Boolean),
      editorOpen: false,
      pauseMenuOpen: false,
      editorTab: "evolution",
      lastEvolution: null,
      ecosystemNotice: "The dunes are still settling.",
      startedAt: 0,
      respawnTimer: 0,
      biome: getBiomeKeyAtPosition(NEST_POSITION),
    };

    this.playerStats = computePlayerStats(this.state.upgrades, this.state.creatureProfile);
    this.input = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
      attackQueued: false,
      attackHeld: false,
    };
    this.virtualInput = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      attackHeld: false,
    };
    this.gamepad = {
      connected: false,
      label: "",
      index: null,
      moveX: 0,
      moveY: 0,
      lookX: 0,
      lookY: 0,
      sprint: false,
      attackHeld: false,
      attackPressed: false,
      startPressed: false,
      selectPressed: false,
      dpadUpPressed: false,
      dpadDownPressed: false,
      dpadLeftPressed: false,
      dpadRightPressed: false,
      fullscreenPressed: false,
      prevAttackHeld: false,
      prevStartHeld: false,
      prevSelectHeld: false,
      prevDpadUpHeld: false,
      prevDpadDownHeld: false,
      prevDpadLeftHeld: false,
      prevDpadRightHeld: false,
      prevFullscreenHeld: false,
    };
    this.gamepadTestState = null;
    this.overlayFocusFrame = null;

    this.playerVelocity = new THREE.Vector3();
    this.cameraTarget = new THREE.Vector3();
    this.cameraGoal = new THREE.Vector3();
    this.cameraMomentum = new THREE.Vector3();
    this.pointerNdc = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.moveTarget = {
      active: false,
      position: new THREE.Vector3(),
    };
    this.effects = [];
    this.cameraShake = 0;
    this.cameraBaseFov = 60;
    this.cameraFovKick = 0;
    this.impactSlow = 0;
    this.zoneTransition = 0;
    this.lastZone = this.state.zone;
    this.surge = {
      timer: 0,
      level: 0,
      pulse: 0,
    };
    this.evolutionFx = {
      timer: 0,
      trait: null,
    };
    this.socialEncounter = {
      speciesId: null,
      enemyId: null,
      progress: 0,
      timer: 0,
      cooldown: 0,
      lastVerb: null,
    };
    this.runStats = {
      sessionDna: 0,
      scavengersDefeated: 0,
      predatorsDefeated: 0,
      herbivoresDefeated: 0,
      timeAlive: 0,
      score: 0,
      bestRun: this.saveData.bestRun ?? 0,
      summary: "Fresh line. Gather DNA, lay a new egg, then grow it in the dunes.",
    };
    this.player = this.buildPlayer();
    this.foods = [];
    this.enemies = [];
    this.carcasses = [];
    this.pickupPulse = new THREE.Group();
    this.scene.add(this.pickupPulse);

    this.world = buildWorld(this.scene);
    this.ecosystem = this.buildEcosystem();
    this.moveTargetMarker = this.buildMoveTargetMarker();
    this.setupLights();
    this.spawnFoods();
    this.spawnEnemies();

    this.scene.add(this.player.group);
    this.scene.add(this.moveTargetMarker.group);
    this.resetPlayerToNest(true);
    this.applyUpgradeVisuals();
    this.persistProgress();
    this.resize = this.resize.bind(this);
    this.tick = this.tick.bind(this);
    this.handleKey = this.handleKey.bind(this);
    this.handleGamepadConnection = this.handleGamepadConnection.bind(this);
    this.handleGamepadDisconnection = this.handleGamepadDisconnection.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleContextMenu = this.handleContextMenu.bind(this);
    this.handleBlur = this.handleBlur.bind(this);

    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this.handleKey);
    window.addEventListener("keyup", this.handleKey);
    window.addEventListener("gamepadconnected", this.handleGamepadConnection);
    window.addEventListener("gamepaddisconnected", this.handleGamepadDisconnection);
    window.addEventListener("blur", this.handleBlur);
    this.renderer.domElement.addEventListener("mousedown", this.handleMouseDown);
    this.renderer.domElement.addEventListener("mouseup", this.handleMouseUp);
    this.renderer.domElement.addEventListener("contextmenu", this.handleContextMenu);

    this.installTestingHooks();
    this.resize();
    this.emitState();
    this.render();
    if (new URLSearchParams(window.location.search).get("autostart") === "1") {
      this.startGame();
    }
    this.animationFrame = window.requestAnimationFrame(this.tick);
  }

  buildPlayer() {
    const model = makeCreatureModel({
      bodyColor: 0x966f58,
      accentColor: 0x6ff4d9,
      markingColor: 0x78ffe5,
      scale: 1.15,
    });

    const trailShadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.55, 20),
      new THREE.MeshBasicMaterial({
        color: 0x10201c,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
      }),
    );
    trailShadow.rotation.x = -Math.PI / 2;
    trailShadow.position.y = -PLAYER_HEIGHT + 0.05;
    model.group.add(trailShadow);

    const groundMarker = new THREE.Mesh(
      new THREE.RingGeometry(1.15, 1.62, 28),
      new THREE.MeshBasicMaterial({
        color: 0x84ffe6,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    groundMarker.rotation.x = -Math.PI / 2;
    groundMarker.position.y = -PLAYER_HEIGHT + 0.08;
    model.group.add(groundMarker);

    model.group.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });

    return {
      ...model,
      velocity: this.playerVelocity,
      moveVelocity: new THREE.Vector3(),
      impulseVelocity: new THREE.Vector3(),
      previousVelocity: new THREE.Vector3(),
      yaw: Math.PI,
      health: this.playerStats.health,
      maxHealth: this.playerStats.health,
      sprintCharge: 1,
      attackTimer: 0,
      attackCooldown: 0,
      attackPhase: "idle",
      attackPhaseTimer: 0,
      attackLungeTimer: 0,
      attackResolved: false,
      attackDidConnect: false,
      attackResult: "ready",
      attackResultTimer: 0,
      attackDirection: new THREE.Vector3(0, 0, 1),
      invulnerability: 0,
      hurtTint: 0,
      pickupPulse: 0,
      attackRecoil: 0,
      attackImpact: 0,
      stepCycle: 0,
      attackSwingId: 0,
      baseScale: 1,
      baseBackGlow: 0.12,
      baseMarkingGlow: 0.14,
      evolutionTimer: 0,
      evolutionTrait: null,
      socialTimer: 0,
      socialVerb: null,
      socialSuccess: 0,
      lean: 0,
      bank: 0,
      turnMomentum: 0,
      dustTimer: 0,
      terrain: {
        slope: 0,
        sand: 0,
        uphill: 0,
        speedFactor: 1,
        traction: 1,
        dust: 0.4,
        attackFactor: 1,
        shoreReadiness: 0,
        shoreStrain: 0,
      },
      isSprinting: false,
      sprintHudTimer: 0,
      combatHudTimer: 0,
      groundMarker,
    };
  }

  getSpeciesCreatureById(creatureId) {
    return this.saveData.speciesCreatures.find((creature) => creature.id === creatureId) ?? null;
  }

  getActiveCreature() {
    return this.getSpeciesCreatureById(this.saveData.activeCreatureId) ?? this.saveData.speciesCreatures[0] ?? null;
  }

  getDraftBaseCreature() {
    return this.getSpeciesCreatureById(this.saveData.evolutionDraft?.baseCreatureId) ?? this.getActiveCreature();
  }

  resetEvolutionDraft(baseCreature = this.getActiveCreature()) {
    if (!baseCreature) {
      return;
    }
    this.saveData.evolutionDraft = createEvolutionDraft(baseCreature);
  }

  isDraftModified() {
    const draft = this.saveData.evolutionDraft;
    const baseCreature = this.getDraftBaseCreature();
    if (!draft || !baseCreature) {
      return false;
    }
    return !compareTraitSets(draft.traits, baseCreature.traits) || !compareProfiles(draft.profile, baseCreature.profile);
  }

  getSpeciesRelation(speciesId) {
    if (!speciesId) {
      return null;
    }

    if (!this.saveData.speciesRelations?.[speciesId]) {
      this.saveData.speciesRelations[speciesId] = {
        ...(DEFAULT_SAVE.speciesRelations?.[speciesId] ?? {
          status: "wary",
          rapport: 0,
          friendship: 0,
          dominance: 0,
          allyUnlocked: false,
          alphaUnlocked: false,
        }),
      };
    }

    return this.saveData.speciesRelations[speciesId];
  }

  isTraitBlueprintUnlocked(traitKey) {
    return Boolean(this.saveData.traitBlueprints?.[traitKey]);
  }

  unlockTraitBlueprints(traitKeys) {
    const nextUnlocks = [];
    traitKeys.forEach((traitKey) => {
      if (!traitKey) {
        return;
      }
      if (!this.isTraitBlueprintUnlocked(traitKey)) {
        this.saveData.traitBlueprints[traitKey] = true;
        nextUnlocks.push(traitKey);
      } else {
        this.saveData.traitBlueprints[traitKey] = true;
      }
    });
    return nextUnlocks;
  }

  getSatisfiedFrontierRoute(upgrade) {
    const frontierRoute = getUpgradeUnlockRoutes(upgrade).find((route) => route.type === "frontier");
    if (!frontierRoute) {
      return null;
    }

    const mastery = this.saveData.biomeProgress?.mastery?.[frontierRoute.biomeKey] ?? 0;
    return mastery >= (frontierRoute.mastery ?? 0) ? frontierRoute : null;
  }

  checkFrontierBlueprintUnlocks({ announce = false } = {}) {
    const pendingUnlocks = [];

    UPGRADE_DEFS.forEach((upgrade) => {
      if (this.isTraitBlueprintUnlocked(upgrade.key)) {
        return;
      }

      const route = this.getSatisfiedFrontierRoute(upgrade);
      if (!route) {
        return;
      }

      pendingUnlocks.push({
        traitKey: upgrade.key,
        route,
      });
    });

    if (!pendingUnlocks.length) {
      return false;
    }

    const routeByTrait = new Map(pendingUnlocks.map((entry) => [entry.traitKey, entry.route]));
    const unlocked = this.unlockTraitBlueprints(pendingUnlocks.map((entry) => entry.traitKey));
    if (!unlocked.length) {
      return false;
    }

    if (announce) {
      const groupedByBiome = unlocked.reduce((groups, traitKey) => {
        const route = routeByTrait.get(traitKey);
        if (!route) {
          return groups;
        }
        if (!groups[route.biomeKey]) {
          groups[route.biomeKey] = [];
        }
        groups[route.biomeKey].push(traitKey);
        return groups;
      }, {});

      Object.entries(groupedByBiome).forEach(([biomeKey, traitKeys]) => {
        const biome = BIOME_DEFS[biomeKey];
        if (!biome) {
          return;
        }
        this.announceBlueprintUnlock(
          traitKeys,
          {
            id: biome.key,
            name: biome.label,
            uiColor: biome.uiColor,
          },
          "frontier",
        );
      });
    }

    return true;
  }

  announceBlueprintUnlock(traitKeys, source, mode = "ally") {
    if (!traitKeys.length) {
      return;
    }

    const labels = traitKeys.map((traitKey) => getBlueprintLabel(traitKey));
    const summary = `${labels.join(labels.length > 1 ? " and " : "")} can now be grown in Creature Evolution.`;
    this.player.evolutionTimer = Math.max(this.player.evolutionTimer, 1.15);
    this.player.evolutionTrait = traitKeys[0];
    this.evolutionFx.timer = Math.max(this.evolutionFx.timer, 1.15);
    this.evolutionFx.trait = traitKeys[0];
    this.state.lastEvolution = {
      key: `blueprint-${source?.id ?? traitKeys[0]}`,
      label:
        mode === "ally"
          ? "Blueprint Befriended"
          : mode === "frontier"
            ? "Blueprint Adapted"
            : "Blueprint Claimed",
      summary,
    };
    this.state.message = mode === "ally"
      ? `${source.name} trust your line. ${summary}`
      : mode === "frontier"
        ? `${source.name} reshape the egg line. ${summary}`
        : `${source.name} yield new anatomy. ${summary}`;
    this.setEcosystemNotice(
      mode === "ally"
        ? `${source.name} now greet your species instead of striking first.`
        : mode === "frontier"
          ? `${source.name} now leave a permanent mark on your species anatomy.`
          : `${source.name} now remember your line as a threat.`,
      4.2,
    );
    this.spawnBurst(this.player.group.position, {
      color: source?.uiColor ?? 0x9fffe6,
      ttl: 0.8,
      size: 1.5,
      shards: 11,
    });
    this.spawnAttackArc(this.player.group.position.clone().setY(this.player.group.position.y + 0.52), this.player.yaw, {
      color: source?.uiColor ?? 0x9fffe6,
      ttl: 0.3,
      size: 1.2,
    });
    this.cameraShake = Math.max(this.cameraShake, 0.14);
  }

  clearSocialEncounter() {
    this.socialEncounter.speciesId = null;
    this.socialEncounter.enemyId = null;
    this.socialEncounter.progress = 0;
    this.socialEncounter.timer = 0;
    this.socialEncounter.cooldown = 0;
    this.socialEncounter.lastVerb = null;
  }

  getSocialOpportunity() {
    if (this.state.mode !== "playing" || this.state.respawnTimer > 0) {
      return null;
    }

    let bestEnemy = null;
    let bestScore = Number.POSITIVE_INFINITY;
    const currentEnemy = this.socialEncounter.enemyId
      ? this.enemies.find((enemy) => enemy.group.userData.enemyId === this.socialEncounter.enemyId && enemy.deadTimer <= 0 && enemy.group.visible)
      : null;

    this.enemies.forEach((enemy) => {
      if (enemy.deadTimer > 0 || !enemy.group.visible) {
        return;
      }

      const distance = getDistance2D(enemy.group.position, this.player.group.position);
      if (distance > SOCIAL_INTERACT_RANGE + 1.2) {
        return;
      }

      const relation = this.getSpeciesRelation(enemy.speciesId);
      const heated = enemy.attackTelegraph > 0.05 || enemy.need === "hunting" || enemy.need === "defending";
      const score = distance
        + (enemy === currentEnemy ? -1.6 : 0)
        + (relation?.status === "friendly" ? 1.2 : relation?.status === "hostile" ? 1.8 : 0)
        + (heated ? 1.4 : 0);

      if (score < bestScore) {
        bestScore = score;
        bestEnemy = enemy;
      }
    });

    if (!bestEnemy) {
      return null;
    }

    const species = bestEnemy.species;
    const relation = this.getSpeciesRelation(bestEnemy.speciesId);
    const sameEncounter = this.socialEncounter.speciesId === bestEnemy.speciesId && this.socialEncounter.enemyId === bestEnemy.group.userData.enemyId;
    const progress = sameEncounter && this.socialEncounter.timer > 0 ? this.socialEncounter.progress : 0;
    const expectedVerbKey = species.socialPattern[Math.min(progress, species.socialPattern.length - 1)] ?? species.socialPattern[0];
    const expectedVerb = SOCIAL_VERB_BY_KEY[expectedVerbKey] ?? SOCIAL_VERBS[0];
    const distance = getDistance2D(bestEnemy.group.position, this.player.group.position);
    const heated = bestEnemy.attackTelegraph > 0.05 || bestEnemy.need === "hunting" || bestEnemy.need === "defending";
    const hostile = relation?.status === "hostile";
    const canAttempt =
      distance <= SOCIAL_INTERACT_RANGE
      && this.socialEncounter.cooldown <= 0
      && this.player.attackPhase === "idle"
      && !this.state.editorOpen
      && (!hostile && !heated || relation?.status === "friendly");

    return {
      enemyId: bestEnemy.group.userData.enemyId,
      speciesId: bestEnemy.speciesId,
      speciesName: species.name,
      species,
      relation,
      distance,
      progress,
      sequence: species.socialPattern.map((verbKey) => SOCIAL_VERB_BY_KEY[verbKey]?.label ?? verbKey),
      expectedVerbKey,
      expectedVerbLabel: expectedVerb.label,
      expectedVerbHotkey: expectedVerb.shortLabel,
      canAttempt,
      status: relation?.status ?? "wary",
      hint: hostile
        ? `${species.name} remember your violence.`
        : heated
          ? `${species.name} are too riled up right now.`
          : species.socialPrompt,
    };
  }

  aggravateSpecies(speciesId, { dominance = 0, heavy = false, announce = false } = {}) {
    const relation = this.getSpeciesRelation(speciesId);
    const species = SPECIES_DEFS[speciesId];
    if (!relation || !species) {
      return { relation: null, species: null, becameHostile: false };
    }

    const becameHostile = relation.status !== "hostile";
    const betrayed = relation.status === "friendly";
    relation.status = "hostile";
    relation.rapport = clamp(relation.rapport - (heavy ? 54 : 22), -120, 120);
    relation.dominance += dominance;
    if (this.socialEncounter.speciesId === speciesId) {
      this.clearSocialEncounter();
    }

    if (announce && (betrayed || becameHostile)) {
      this.setEcosystemNotice(
        betrayed
          ? `${species.name} turn on your line after the betrayal.`
          : `${species.name} snap into hostility.`,
        4,
      );
    }

    this.persistProgress();
    return { relation, species, becameHostile, betrayed };
  }

  claimSpeciesDominance(speciesId, { dominance = 1, heavy = false } = {}) {
    const { relation, species } = this.aggravateSpecies(speciesId, {
      dominance,
      heavy,
      announce: true,
    });
    if (!relation || !species) {
      return [];
    }

    const unlocked = relation.alphaUnlocked ? [] : this.unlockTraitBlueprints(species.alphaUnlocks ?? []);
    relation.alphaUnlocked = true;
    if (unlocked.length) {
      this.announceBlueprintUnlock(unlocked, species, "alpha");
    }
    this.state.hasSave = true;
    this.persistProgress();
    return unlocked;
  }

  befriendSpecies(speciesId, sourceEnemy = null) {
    const relation = this.getSpeciesRelation(speciesId);
    const species = SPECIES_DEFS[speciesId];
    if (!relation || !species) {
      return [];
    }

    relation.status = "friendly";
    relation.rapport = clamp(relation.rapport + 58, -120, 120);
    relation.friendship += 1;
    const unlocked = relation.allyUnlocked ? [] : this.unlockTraitBlueprints(species.allyUnlocks ?? []);
    relation.allyUnlocked = true;
    this.state.alignment = shiftAlignment(this.state.alignment, "social", 0.038);
    this.state.hasSave = true;
    this.enemies.forEach((enemy) => {
      if (enemy.speciesId !== speciesId || enemy.deadTimer > 0) {
        return;
      }
      enemy.territoryAlert = 0;
      enemy.attackTelegraph = 0;
      enemy.attackTargetId = null;
      enemy.attackTargetKind = "player";
      enemy.targetCreatureId = null;
      enemy.socialPulse = Math.max(enemy.socialPulse, enemy === sourceEnemy ? 1 : 0.45);
      enemy.cooldown = Math.max(enemy.cooldown, 0.3);
    });
    if (sourceEnemy) {
      sourceEnemy.socialPulse = 1;
    }
    if (unlocked.length) {
      this.announceBlueprintUnlock(unlocked, species, "ally");
    } else {
      this.state.message = `${species.name} accept your signal and stand down.`;
      this.setEcosystemNotice(`${species.name} now greet your species instead of flaring up.`, 3.8);
    }
    this.persistProgress();
    return unlocked;
  }

  performSocialVerb(verbKey) {
    const verb = SOCIAL_VERB_BY_KEY[verbKey];
    if (!verb || this.state.mode !== "playing" || this.state.editorOpen || this.state.respawnTimer > 0) {
      return false;
    }

    const opportunity = this.getSocialOpportunity();
    this.player.socialTimer = SOCIAL_EMOTE_DURATION;
    this.player.socialVerb = verbKey;
    this.player.socialSuccess = 0.35;

    if (!opportunity) {
      this.state.message = `${verb.label} fades into empty dunes.`;
      this.socialEncounter.cooldown = SOCIAL_COOLDOWN * 0.6;
      return false;
    }

    const targetEnemy = this.enemies.find((enemy) => enemy.group.userData.enemyId === opportunity.enemyId) ?? null;
    if (targetEnemy) {
      targetEnemy.socialPulse = Math.max(targetEnemy.socialPulse, 0.55);
    }

    if (!opportunity.canAttempt) {
      if (targetEnemy) {
        targetEnemy.territoryAlert = Math.max(targetEnemy.territoryAlert, targetEnemy.type === "herbivore" ? 0.38 : 0.62);
      }
      this.state.message = opportunity.hint;
      this.socialEncounter.cooldown = SOCIAL_COOLDOWN;
      return false;
    }

    if (opportunity.status === "friendly") {
      this.state.alignment = shiftAlignment(this.state.alignment, "social", 0.012);
      this.state.message = `${opportunity.speciesName} echo your ${verb.label.toLowerCase()} back to the line.`;
      if (targetEnemy) {
        targetEnemy.socialPulse = 1;
      }
      this.socialEncounter.cooldown = SOCIAL_COOLDOWN * 0.8;
      this.persistProgress();
      return true;
    }

    if (verbKey === opportunity.expectedVerbKey) {
      const nextProgress = opportunity.progress + 1;
      this.socialEncounter.cooldown = 0;
      this.socialEncounter.speciesId = opportunity.speciesId;
      this.socialEncounter.enemyId = opportunity.enemyId;
      this.socialEncounter.progress = nextProgress;
      this.socialEncounter.timer = SOCIAL_CHAIN_WINDOW;
      this.socialEncounter.lastVerb = verbKey;
      this.player.socialSuccess = 1;
      this.state.alignment = shiftAlignment(this.state.alignment, "social", 0.02);
      if (targetEnemy) {
        targetEnemy.socialPulse = 1;
      }

      if (nextProgress >= opportunity.sequence.length) {
        this.clearSocialEncounter();
        this.befriendSpecies(opportunity.speciesId, targetEnemy);
        this.socialEncounter.cooldown = SOCIAL_COOLDOWN * 0.55;
      } else {
        const nextVerbKey = opportunity.species.socialPattern[nextProgress];
        const nextVerb = SOCIAL_VERB_BY_KEY[nextVerbKey] ?? SOCIAL_VERBS[0];
        this.state.message = `${opportunity.speciesName} answer your ${verb.label.toLowerCase()}. Finish with ${nextVerb.label}.`;
        this.setEcosystemNotice(`${opportunity.speciesName} are listening to your line.`, 2.8);
        this.persistProgress();
      }

      return true;
    }

    if (targetEnemy) {
      targetEnemy.territoryAlert = Math.max(targetEnemy.territoryAlert, targetEnemy.type === "herbivore" ? 0.48 : 0.72);
    }
    this.clearSocialEncounter();
    this.socialEncounter.cooldown = SOCIAL_COOLDOWN;
    this.state.alignment = shiftAlignment(this.state.alignment, "adaptive", 0.012);
    this.state.message = `Wrong signal. ${opportunity.speciesName} recoil from your ${verb.label.toLowerCase()}.`;
    this.setEcosystemNotice(`${opportunity.speciesName} reject the display.`, 3);
    this.persistProgress();
    return false;
  }

  setEditorTab(tab) {
    if (!["evolution", "species"].includes(tab) || this.state.editorTab === tab) {
      return false;
    }
    this.state.editorTab = tab;
    this.state.message = tab === "evolution"
      ? "Spend DNA on the next body plan, then lay the egg at the nest."
      : "Switch bodies, watch hatchlings grow, or fast evolve them with species XP.";
    this.emitState();
    this.queueOverlayFocus();
    return true;
  }

  togglePauseMenu(forceOpen) {
    if (this.state.mode !== "playing" || this.state.respawnTimer > 0 || this.state.editorOpen) {
      return false;
    }
    const nextOpen = typeof forceOpen === "boolean" ? forceOpen : !this.state.pauseMenuOpen;
    this.state.pauseMenuOpen = nextOpen;
    if (nextOpen) {
      this.handleBlur();
      this.clearMoveTarget();
      this.input.attackQueued = false;
      this.state.message = this.state.zone === "nest"
        ? "Pause menu open. Resume or enter Creature Evolution from the nest."
        : "Pause menu open. Resume the hunt or return to the nest to evolve.";
    } else {
      this.state.message = "Hunt resumed.";
      this.clearOverlayButtonFocus();
      this.renderer.domElement.focus();
    }
    this.emitState();
    if (nextOpen) {
      this.queueOverlayFocus();
    }
    return true;
  }

  openPauseEvolution() {
    if (!this.state.pauseMenuOpen || this.state.zone !== "nest" || this.state.respawnTimer > 0) {
      return false;
    }
    this.state.pauseMenuOpen = false;
    this.clearOverlayButtonFocus();
    return this.toggleEditor(true);
  }

  applyActiveCreatureState({ preserveHealthRatio = true } = {}) {
    const activeCreature = this.getActiveCreature();
    if (!activeCreature) {
      return;
    }

    this.activeCreatureRuntime = getCreatureRuntimeState(activeCreature);
    this.state.upgrades = { ...this.activeCreatureRuntime.runtimeTraits };
    this.state.creatureProfile = { ...this.activeCreatureRuntime.runtimeProfile };

    if (!this.player) {
      this.playerStats = computePlayerStats(this.state.upgrades, this.state.creatureProfile);
      return;
    }

    const previousHealthRatio = preserveHealthRatio && this.player.maxHealth > 0 ? this.player.health / this.player.maxHealth : 1;
    this.playerStats = computePlayerStats(this.state.upgrades, this.state.creatureProfile);
    this.player.maxHealth = this.playerStats.health;
    this.player.health = preserveHealthRatio
      ? clamp(this.playerStats.health * previousHealthRatio, 0, this.player.maxHealth)
      : this.player.maxHealth;
    this.applyUpgradeVisuals();
    this.player.group.scale.setScalar(this.player.baseScale);
  }

  grantSpeciesXp(points, { matureActive = false, source = "time" } = {}) {
    if (!Number.isFinite(points) || points <= 0) {
      return;
    }

    this.state.speciesXp += points;
    this.state.hasSave = true;
    const activeCreature = this.getActiveCreature();
    if (!activeCreature) {
      return;
    }

    if (source === "time") {
      activeCreature.activeTime += points / Math.max(0.0001, NEWBORN_GROWTH_PASSIVE_RATE);
    }

    if (matureActive && activeCreature.growth < 1) {
      const previousGrowth = activeCreature.growth;
      const targetPoints = computeCreatureMaturityTarget(activeCreature);
      activeCreature.growth = clamp(activeCreature.growth + points / Math.max(1, targetPoints), 0, 1);
      if (activeCreature.growth !== previousGrowth) {
        this.applyActiveCreatureState({ preserveHealthRatio: true });
        if (activeCreature.growth >= 1 && previousGrowth < 1) {
          this.player.evolutionTimer = 1.15;
          this.player.evolutionTrait = "growth";
          this.evolutionFx.timer = 1.15;
          this.evolutionFx.trait = "growth";
          this.spawnBurst(this.player.group.position, {
            color: 0x9affdf,
            ttl: 0.62,
            size: 1.4,
            shards: 10,
          });
          this.state.lastEvolution = {
            key: "growth",
            label: "Maturation Complete",
            summary: `${buildCreatureIdentity(activeCreature.profile, activeCreature.traits)} reaches adult mass.`,
          };
          this.state.message = `${buildCreatureIdentity(activeCreature.profile, activeCreature.traits)} matures into an adult body.`;
        }
      }
    }
  }

  switchSpeciesCreature(creatureId) {
    if (this.state.mode !== "playing" || this.state.zone !== "nest" || this.state.respawnTimer > 0) {
      return false;
    }

    const nextCreature = this.getSpeciesCreatureById(creatureId);
    if (!nextCreature || nextCreature.id === this.saveData.activeCreatureId) {
      return false;
    }

    this.saveData.activeCreatureId = nextCreature.id;
    this.applyActiveCreatureState({ preserveHealthRatio: false });
    this.player.sprintCharge = 1;
    this.player.attackCooldown = 0;
    this.player.attackPhase = "idle";
    this.player.attackResult = "ready";
    this.player.evolutionTimer = 0.9;
    this.player.evolutionTrait = "swap";
    this.evolutionFx.timer = 0.9;
    this.evolutionFx.trait = "swap";
    this.cameraFovKick = Math.max(this.cameraFovKick, 1.8);
    this.state.message = `${buildCreatureIdentity(nextCreature.profile, nextCreature.traits)} steps out of the nest.`;
    if (!this.isDraftModified()) {
      this.resetEvolutionDraft(nextCreature);
    }
    this.persistProgress();
    this.emitState();
    return true;
  }

  layEgg() {
    if (this.state.mode !== "playing" || this.state.zone !== "nest" || this.state.respawnTimer > 0) {
      return false;
    }

    if (!this.isDraftModified() || this.saveData.speciesCreatures.length >= MAX_SPECIES_CREATURES) {
      return false;
    }

    const draft = this.saveData.evolutionDraft;
    const highestGeneration = this.saveData.speciesCreatures.reduce((maxValue, creature) => Math.max(maxValue, creature.generation), 0);
    const hatchling = createSpeciesCreature({
      traits: draft.traits,
      profile: mutateEggProfile(draft.profile, draft.traits),
      growth: 0,
      generation: highestGeneration + 1,
      activeTime: 0,
      killCount: 0,
    });

    this.saveData.speciesCreatures.push(hatchling);
    this.saveData.activeCreatureId = hatchling.id;
    this.applyActiveCreatureState({ preserveHealthRatio: false });
    this.player.health = this.player.maxHealth;
    this.player.sprintCharge = 1;
    this.player.attackCooldown = 0;
    this.player.evolutionTimer = 1.45;
    this.player.evolutionTrait = "egg";
    this.evolutionFx.timer = 1.45;
    this.evolutionFx.trait = "egg";
    this.spawnBurst(this.player.group.position, {
      color: 0x9fffe7,
      ttl: 0.8,
      size: 1.7,
      shards: 12,
    });
    this.spawnAttackArc(this.player.group.position.clone().setY(this.player.group.position.y + 0.55), this.player.yaw, {
      color: 0xb6ffe9,
      ttl: 0.3,
      size: 1.45,
    });
    this.cameraShake = Math.max(this.cameraShake, 0.18);
    this.state.editorTab = "species";
    this.state.lastEvolution = {
      key: "egg",
      label: "New Egg Laid",
      summary: `${buildCreatureIdentity(hatchling.profile, hatchling.traits)} hatches into the origin waters and must grow into its full mass.`,
    };
    this.state.message = `${buildCreatureIdentity(hatchling.profile, hatchling.traits)} hatches into the origin waters. Feed there to speed maturation.`;
    this.resetEvolutionDraft(hatchling);
    this.resetPlayerToNest(true);
    this.persistProgress();
    this.emitState();
    return true;
  }

  fastEvolveCreature(creatureId) {
    if (this.state.mode !== "playing" || this.state.zone !== "nest" || this.state.respawnTimer > 0) {
      return false;
    }

    const creature = this.getSpeciesCreatureById(creatureId);
    if (!creature || creature.growth >= 1) {
      return false;
    }

    const cost = getFastEvolveCost(creature);
    if (this.state.speciesXp < cost) {
      return false;
    }

    this.state.speciesXp -= cost;
    creature.growth = 1;
    creature.activeTime += 4;
    if (creature.id === this.saveData.activeCreatureId) {
      this.applyActiveCreatureState({ preserveHealthRatio: true });
      this.player.evolutionTimer = 1.25;
      this.player.evolutionTrait = "growth";
      this.evolutionFx.timer = 1.25;
      this.evolutionFx.trait = "growth";
    }
    this.spawnBurst(this.player.group.position, {
      color: 0x8ffff1,
      ttl: 0.64,
      size: 1.5,
      shards: 11,
    });
    this.state.lastEvolution = {
      key: "fast-evolve",
      label: "Fast Evolve",
      summary: `${buildCreatureIdentity(creature.profile, creature.traits)} finishes growing for ${cost} XP.`,
    };
    this.state.message = `${buildCreatureIdentity(creature.profile, creature.traits)} surges into adulthood.`;
    this.persistProgress();
    this.emitState();
    return true;
  }

  updateSpeciesProgress(dt) {
    if (this.state.mode !== "playing" || this.state.editorOpen || this.state.respawnTimer > 0) {
      return;
    }

    const activeCreature = this.getActiveCreature();
    if (!activeCreature) {
      return;
    }

    const speciesXpBefore = Math.floor(this.state.speciesXp);
    const growthBefore = activeCreature.growth;
    this.grantSpeciesXp(dt * SPECIES_XP_PASSIVE_RATE, {
      matureActive: activeCreature.growth < 1,
      source: "time",
    });
    this.updateBiomeProgress(dt);

    if (Math.floor(this.state.speciesXp) !== speciesXpBefore || Math.floor(growthBefore * 20) !== Math.floor(activeCreature.growth * 20)) {
      this.persistProgress();
    }
  }

  updateBiomeProgress(dt) {
    const biome = this.getCurrentBiome(this.player.group.position);
    const activeCreature = this.getActiveCreature();
    const dominantBefore = this.saveData.biomeProgress.dominantBiome;
    const alreadyDiscovered = this.saveData.biomeProgress.discoveredBiomes.includes(biome.key);
    const discovered = this.discoverBiome(biome.key, {
      announce: this.state.mode === "playing" && !alreadyDiscovered,
    });
    const masteryChanged = this.addBiomeMastery(
      biome.key,
      dt * ((activeCreature?.growth ?? 1) < 1 ? biome.newbornMasteryRate : biome.masteryRate),
    );

    let unlocked = false;
    BIOME_ORDER.forEach((biomeKey) => {
      if (!this.isBiomeUnlocked(biomeKey) && this.canUnlockBiome(biomeKey)) {
        unlocked = this.unlockBiome(biomeKey, { announce: this.state.mode === "playing" }) || unlocked;
      }
    });
    const frontierBlueprintUnlocked = this.checkFrontierBlueprintUnlocks({
      announce: this.state.mode === "playing",
    });

    const dominantAfter = this.saveData.biomeProgress.dominantBiome;
    if (dominantAfter !== dominantBefore && this.state.mode === "playing") {
      const dominantBiome = BIOME_DEFS[dominantAfter];
      this.setEcosystemNotice(`${dominantBiome.label} is now shaping the species line.`, 3.8);
    }

    if ((discovered || masteryChanged || unlocked || frontierBlueprintUnlocked) && this.state.mode === "playing") {
      this.state.hasSave = true;
      this.persistProgress();
    }
  }

  buildMoveTargetMarker() {
    const group = new THREE.Group();
    group.visible = false;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.72, 1.02, 24),
      new THREE.MeshBasicMaterial({
        color: 0x85ffe8,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);

    const pulse = new THREE.Mesh(
      new THREE.RingGeometry(1.08, 1.26, 24),
      new THREE.MeshBasicMaterial({
        color: 0xbffff3,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    pulse.rotation.x = -Math.PI / 2;
    pulse.position.y = 0.02;
    group.add(pulse);

    const spike = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.72, 5),
      new THREE.MeshBasicMaterial({
        color: 0xdffff8,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      }),
    );
    spike.position.y = 0.48;
    group.add(spike);

    return { group, ring, pulse, spike };
  }

  buildEcosystem() {
    const territories = [];
    const nests = [];

    Object.values(SPECIES_DEFS).forEach((species) => {
      const marker = createSpeciesNestMarker(species);
      const y = getTerrainHeight(species.nest.x, species.nest.z);
      marker.group.position.set(species.nest.x, y, species.nest.z);
      this.scene.add(marker.group);

      const nest = {
        id: `nest-${species.id}`,
        speciesId: species.id,
        species,
        group: marker.group,
        ring: marker.ring,
        pulse: marker.pulse,
        marker: marker.marker,
        hp: species.nest.hp,
        maxHp: species.nest.hp,
        destroyed: false,
        alert: 0,
        respawnTimer: species.respawnDelay * (0.45 + Math.random() * 0.4),
      };
      nests.push(nest);
      territories.push({
        id: `territory-${species.id}`,
        speciesId: species.id,
        label: species.territory.label,
        x: species.territory.x,
        z: species.territory.z,
        radius: species.territory.radius,
        color: species.territory.color,
        ring: marker.ring,
        pulse: marker.pulse,
        alert: 0,
      });
    });

    return {
      territories,
      nests,
      activeEvent: null,
      eventTimer: ECOSYSTEM_EVENT_MIN_DELAY + Math.random() * (ECOSYSTEM_EVENT_MAX_DELAY - ECOSYSTEM_EVENT_MIN_DELAY),
      noticeTimer: 0,
      lastNotice: "Bone Dunes ecosystem stabilizing.",
    };
  }

  getNestForSpecies(speciesId) {
    return this.ecosystem.nests.find((nest) => nest.speciesId === speciesId) ?? null;
  }

  setEcosystemNotice(message, duration = 3.2) {
    this.state.ecosystemNotice = message;
    this.ecosystem.lastNotice = message;
    this.ecosystem.noticeTimer = duration;
  }

  getTerritoryForSpecies(speciesId) {
    return this.ecosystem.territories.find((territory) => territory.speciesId === speciesId) ?? null;
  }

  getCurrentTerritoryForPosition(position) {
    let bestTerritory = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    this.ecosystem.territories.forEach((territory) => {
      const distance = Math.hypot(position.x - territory.x, position.z - territory.z);
      if (distance <= territory.radius + 1 && distance < bestDistance) {
        bestDistance = distance;
        bestTerritory = territory;
      }
    });

    return bestTerritory;
  }

  getCurrentBiome(position = this.player?.group?.position ?? NEST_POSITION) {
    return getBiomeDefAtPosition(position);
  }

  isBiomeUnlocked(biomeKey) {
    return this.saveData.biomeProgress?.unlockedBiomes?.includes(biomeKey);
  }

  discoverBiome(biomeKey, { announce = false } = {}) {
    if (!biomeKey || this.saveData.biomeProgress.discoveredBiomes.includes(biomeKey)) {
      return false;
    }

    this.saveData.biomeProgress.discoveredBiomes.push(biomeKey);
    this.saveData.biomeProgress.discoveredBiomes.sort((left, right) => BIOME_DEFS[left].order - BIOME_DEFS[right].order);
    if (announce) {
      const biome = BIOME_DEFS[biomeKey];
      this.state.message = `${biome.label} discovered. ${biome.summary}`;
      this.setEcosystemNotice(`${biome.label} becomes part of your species route.`, 3.6);
    }
    return true;
  }

  canUnlockBiome(biomeKey) {
    if (!biomeKey || this.isBiomeUnlocked(biomeKey)) {
      return true;
    }

    const activeCreature = this.getActiveCreature();
    const originMastery = this.saveData.biomeProgress.mastery.originWaters ?? 0;
    const dunesMastery = this.saveData.biomeProgress.mastery.boneDunes ?? 0;
    switch (biomeKey) {
      case "originWaters":
      case "sunlitShallows":
        return true;
      case "glowMarsh":
        return (this.state.speciesXp ?? 0) >= 6
          || originMastery >= 18
          || (this.getSpeciesRelation("burrowingHerbivore")?.status === "friendly");
      case "boneDunes":
        return (this.state.speciesXp ?? 0) >= 8
          || (activeCreature?.growth ?? 0) >= 0.55
          || getTraitTotal(activeCreature?.traits ?? this.state.upgrades) > 0;
      case "jawBasin":
        return (this.state.speciesXp ?? 0) >= 18
          || dunesMastery >= 16
          || (this.getSpeciesRelation("boneStalker")?.status === "hostile")
          || Boolean(this.getSpeciesRelation("boneStalker")?.alphaUnlocked);
      default:
        return false;
    }
  }

  unlockBiome(biomeKey, { announce = true } = {}) {
    if (!biomeKey || this.isBiomeUnlocked(biomeKey)) {
      return false;
    }

    this.discoverBiome(biomeKey, { announce: false });
    this.saveData.biomeProgress.unlockedBiomes.push(biomeKey);
    this.saveData.biomeProgress.unlockedBiomes.sort((left, right) => BIOME_DEFS[left].order - BIOME_DEFS[right].order);
    if (announce) {
      const biome = BIOME_DEFS[biomeKey];
      this.state.message = `${biome.label} opens to the species. ${biome.summary}`;
      this.setEcosystemNotice(`${biome.label} frontier unlocked. ${biome.pressure}.`, 4.2);
    }
    return true;
  }

  addBiomeMastery(biomeKey, amount) {
    if (!biomeKey || !Number.isFinite(amount) || amount <= 0) {
      return false;
    }

    const mastery = this.saveData.biomeProgress.mastery;
    const before = mastery[biomeKey] ?? 0;
    const after = clamp(before + amount, 0, BIOME_MASTERY_MAX);
    if (Math.abs(after - before) <= 0.0001) {
      return false;
    }

    mastery[biomeKey] = after;
    const dominantBefore = this.saveData.biomeProgress.dominantBiome;
    this.saveData.biomeProgress.dominantBiome = getDominantBiomeKey(mastery, dominantBefore);
    return Math.floor(before) !== Math.floor(after) || dominantBefore !== this.saveData.biomeProgress.dominantBiome;
  }

  getNextBiomeUnlock() {
    const nextKey = BIOME_ORDER.find((biomeKey) => !this.isBiomeUnlocked(biomeKey));
    if (!nextKey) {
      return null;
    }

    const biome = BIOME_DEFS[nextKey];
    return {
      key: biome.key,
      label: biome.label,
      hint: biome.unlockHint,
    };
  }

  getPreferredSpawnPoint(creature = this.getActiveCreature()) {
    const hatchling = (creature?.growth ?? 1) < 1;
    if (hatchling) {
      return {
        x: ORIGIN_POOL.spawnX,
        z: ORIGIN_POOL.spawnZ,
        yaw: Math.PI * 0.58,
        biomeKey: "originWaters",
      };
    }

    return {
      x: NEST_POSITION.x,
      z: NEST_POSITION.z,
      yaw: Math.PI,
      biomeKey: "sunlitShallows",
    };
  }

  getClosestFoodTarget(creature, maxDistance = 18) {
    let bestFood = null;
    let bestDistance = maxDistance;

    this.foods.forEach((food) => {
      if (!food.active) {
        return;
      }

      const distance = getDistance2D(creature.group.position, food.group.position);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestFood = food;
      }
    });

    return bestFood ? { food: bestFood, distance: bestDistance } : null;
  }

  getClosestCarcassTarget(creature, maxDistance = 18, predicate = () => true) {
    let bestCarcass = null;
    let bestDistance = maxDistance;

    this.carcasses.forEach((carcass) => {
      if (!predicate(carcass)) {
        return;
      }

      const distance = getDistance2D(creature.group.position, carcass.group.position);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestCarcass = carcass;
      }
    });

    return bestCarcass ? { carcass: bestCarcass, distance: bestDistance } : null;
  }

  getClosestCreatureTarget(creature, predicate, maxDistance = 18) {
    let bestTarget = null;
    let bestDistance = maxDistance;

    this.enemies.forEach((other) => {
      if (other === creature || other.deadTimer > 0) {
        return;
      }

      const distance = getDistance2D(creature.group.position, other.group.position);
      if (distance >= bestDistance || !predicate(other, distance)) {
        return;
      }

      bestDistance = distance;
      bestTarget = other;
    });

    return bestTarget ? { enemy: bestTarget, distance: bestDistance } : null;
  }

  resetEcosystemState() {
    this.carcasses.forEach((carcass) => {
      this.scene.remove(carcass.group);
    });
    this.carcasses = [];

    this.ecosystem.activeEvent = null;
    this.ecosystem.eventTimer = ECOSYSTEM_EVENT_MIN_DELAY + Math.random() * (ECOSYSTEM_EVENT_MAX_DELAY - ECOSYSTEM_EVENT_MIN_DELAY);
    this.ecosystem.noticeTimer = 0;
    this.ecosystem.lastNotice = "Bone Dunes ecosystem stabilizing.";
    this.state.ecosystemNotice = "The dunes are still settling.";

    this.ecosystem.territories.forEach((territory) => {
      territory.alert = 0;
      territory.ring.material.opacity = 0.12;
      territory.pulse.material.opacity = 0.08;
      territory.pulse.scale.setScalar(1);
    });

    this.ecosystem.nests.forEach((nest) => {
      nest.hp = nest.maxHp;
      nest.destroyed = false;
      nest.alert = 0;
      nest.respawnTimer = nest.species.respawnDelay * (0.45 + Math.random() * 0.4);
      nest.ring.material.opacity = 0.12;
      nest.pulse.material.opacity = 0.08;
      nest.marker.position.set(0, 0, 0);
      nest.marker.rotation.set(0, 0, 0);
      nest.marker.scale.setScalar(1);
    });

    this.enemies.forEach((enemy) => {
      enemy.migrationGoal = null;
      enemy.migrationWeight = 0;
      enemy.territoryAlert = 0;
      enemy.targetCreatureId = null;
      enemy.targetFoodId = null;
      enemy.targetCarcassId = null;
      enemy.attackTargetId = null;
      enemy.attackTargetKind = "player";
    });
  }

  triggerMigrationEvent(key = null) {
    const candidates = MIGRATION_EVENT_DEFS.filter((eventDef) => {
      if (key && eventDef.key !== key) {
        return false;
      }

      const nest = this.getNestForSpecies(eventDef.speciesId);
      if (!nest || nest.destroyed) {
        return false;
      }

      return this.enemies.some((enemy) => enemy.speciesId === eventDef.speciesId && enemy.deadTimer <= 0);
    });

    if (!candidates.length) {
      return false;
    }

    const eventDef = key ? candidates[0] : pickRandom(candidates);
    if (!eventDef) {
      return false;
    }

    if (this.ecosystem.activeEvent) {
      this.clearMigrationEvent();
    }

    this.ecosystem.activeEvent = {
      ...eventDef,
      timer: eventDef.duration,
      duration: eventDef.duration,
    };
    this.ecosystem.eventTimer = eventDef.cooldown + Math.random() * 7;

    const targetTerritory = this.getCurrentTerritoryForPosition(eventDef.target)
      ?? this.ecosystem.territories.reduce((closest, territory) => {
        if (!closest) {
          return territory;
        }
        return getDistance2D(eventDef.target, territory) < getDistance2D(eventDef.target, closest) ? territory : closest;
      }, null);

    this.enemies.forEach((enemy) => {
      if (enemy.speciesId !== eventDef.speciesId || enemy.deadTimer > 0) {
        return;
      }

      const offset = getSpawnOffset(enemy.isLeader ? 2.8 : 4.4);
      enemy.migrationGoal = {
        x: clamp(eventDef.target.x + offset.x * 0.4, -WORLD_RADIUS + 4, WORLD_RADIUS - 4),
        z: clamp(eventDef.target.z + offset.z * 0.4, -WORLD_RADIUS + 4, WORLD_RADIUS - 4),
      };
      enemy.migrationWeight = 1;
      enemy.need = "migrating";
      enemy.territoryAlert = Math.max(enemy.territoryAlert, 0.35);
    });

    const species = SPECIES_DEFS[eventDef.speciesId];
    const locationLabel = targetTerritory?.label ?? "the open dunes";
    this.setEcosystemNotice(`${eventDef.label}: ${species.name} movement is pulling toward ${locationLabel}.`, 4.6);
    this.state.message = `${eventDef.label}. The dunes are moving around you.`;
    return true;
  }

  clearMigrationEvent() {
    if (!this.ecosystem.activeEvent) {
      return;
    }

    const speciesId = this.ecosystem.activeEvent.speciesId;
    this.enemies.forEach((enemy) => {
      if (enemy.speciesId !== speciesId) {
        return;
      }
      enemy.migrationGoal = null;
      enemy.migrationWeight = 0;
    });
    this.ecosystem.activeEvent = null;
  }

  updateCarcasses(dt) {
    for (let index = this.carcasses.length - 1; index >= 0; index -= 1) {
      const carcass = this.carcasses[index];
      carcass.ttl -= dt;
      carcass.fresh = Math.max(0, carcass.fresh - dt * 0.18);
      carcass.beingScavenged = false;
      carcass.group.rotation.y += dt * 0.24;
      carcass.group.position.y = carcass.baseY + Math.sin(this.elapsed * 1.8 + index) * 0.04 * carcass.fresh;
      carcass.group.scale.setScalar(0.9 + carcass.fresh * 0.14);

      if (carcass.ttl <= 0) {
        this.scene.remove(carcass.group);
        this.carcasses.splice(index, 1);
      }
    }
  }

  updateEcosystem(dt) {
    this.updateCarcasses(dt);

    if (this.ecosystem.noticeTimer > 0) {
      this.ecosystem.noticeTimer = Math.max(0, this.ecosystem.noticeTimer - dt);
    }

    const playerTerritory = this.getCurrentTerritoryForPosition(this.player.group.position);
    this.currentTerritory = playerTerritory;

    this.ecosystem.nests.forEach((nest, index) => {
      const relation = this.getSpeciesRelation(nest.speciesId);
      if (!nest.destroyed) {
        nest.alert = Math.max(0, nest.alert - dt * 0.55);
        nest.respawnTimer = Math.max(0, nest.respawnTimer - dt);
        nest.marker.position.y = Math.sin(this.elapsed * (1.4 + index * 0.16)) * 0.12 + nest.alert * 0.24;
        nest.marker.rotation.y += dt * (0.22 + index * 0.03);
        nest.marker.scale.setScalar(
          1
          + nest.alert * 0.06
          + (playerTerritory?.speciesId === nest.speciesId ? 0.03 : 0)
          + (relation?.status === "friendly" ? 0.02 : 0),
        );
      } else {
        nest.alert = 0;
        nest.marker.position.y = damp(nest.marker.position.y, -0.58, 4, dt);
      }
    });

    this.ecosystem.territories.forEach((territory, index) => {
      const nest = this.getNestForSpecies(territory.speciesId);
      const relation = this.getSpeciesRelation(territory.speciesId);
      const playerInside = playerTerritory?.id === territory.id;
      territory.alert = Math.max(0, territory.alert - dt * 0.4);
      if (playerInside && this.state.mode === "playing" && this.state.zone !== "nest" && relation?.status !== "friendly") {
        territory.alert = Math.max(territory.alert, 0.62);
      }
      if (this.ecosystem.activeEvent?.speciesId === territory.speciesId) {
        territory.alert = Math.max(territory.alert, 0.34);
      }

      const liveCount = this.enemies.reduce(
        (count, enemy) => count + (enemy.speciesId === territory.speciesId && enemy.deadTimer <= 0 ? 1 : 0),
        0,
      );
      const presence = liveCount / Math.max(1, SPECIES_DEFS[territory.speciesId].maxPopulation);
      const alertStrength = Math.max(territory.alert, nest?.alert ?? 0);
      territory.ring.rotation.z += dt * (index % 2 === 0 ? 0.04 : -0.04);
      territory.pulse.rotation.z += dt * (index % 2 === 0 ? -0.06 : 0.06);
      territory.pulse.scale.setScalar(1 + Math.sin(this.elapsed * (1.6 + index * 0.28)) * 0.04 + alertStrength * 0.1);
      territory.ring.material.opacity = nest?.destroyed
        ? 0.03
        : 0.05 + presence * 0.04 + alertStrength * 0.17 + (playerInside ? (relation?.status === "friendly" ? 0.03 : 0.08) : 0);
      territory.pulse.material.opacity = nest?.destroyed
        ? 0
        : 0.03 + presence * 0.04 + alertStrength * 0.18 + (playerInside ? (relation?.status === "friendly" ? 0.04 : 0.12) : 0);
    });

    if (this.state.mode !== "playing" || this.state.editorOpen) {
      return;
    }

    if (this.ecosystem.activeEvent) {
      this.ecosystem.activeEvent.timer -= dt;
      if (this.ecosystem.activeEvent.timer <= 0) {
        const label = this.ecosystem.activeEvent.label;
        this.clearMigrationEvent();
        this.setEcosystemNotice(`${label} dissipates and the dunes settle again.`, 3.4);
      }
      return;
    }

    this.ecosystem.eventTimer -= dt;
    if (this.ecosystem.eventTimer <= 0) {
      this.triggerMigrationEvent();
    }
  }

  spawnCreatureFromSpecies(speciesId, options = {}) {
    const species = SPECIES_DEFS[speciesId];
    const variant = options.variant ?? options.leaderVariant ?? pickRandom(species.memberTypes);
    const creature = createEnemy(variant);
    const nest = this.getNestForSpecies(speciesId);
    const packId = options.packId ?? `${speciesId}-pack-${options.groupIndex ?? 0}`;
    const baseX = options.x ?? species.territory.x;
    const baseZ = options.z ?? species.territory.z;
    const offset = getSpawnOffset(options.spawnRadius ?? (species.dietType === "predator" ? 3.8 : 3.1));
    const x = clamp(baseX + offset.x, -WORLD_RADIUS + 5, WORLD_RADIUS - 5);
    const z = clamp(baseZ + offset.z, -WORLD_RADIUS + 5, WORLD_RADIUS - 5);

    creature.speciesId = speciesId;
    creature.species = species;
    creature.speciesName = species.name;
    creature.temperament = species.temperament;
    creature.dietType = species.dietType;
    creature.aggression = species.aggression;
    creature.packId = packId;
    creature.leaderId = options.leaderId ?? null;
    creature.isLeader = Boolean(options.isLeader);
    creature.groupIndex = options.groupIndex ?? 0;
    creature.homeNestId = nest?.id ?? null;
    creature.hunger = 0.18 + Math.random() * 0.32;
    creature.rest = Math.random() * 0.22;
    creature.need = "patrolling";
    creature.targetCreatureId = null;
    creature.targetFoodId = null;
    creature.targetCarcassId = null;
    creature.attackTargetId = null;
    creature.attackTargetKind = "player";
    creature.packTargetId = null;
    creature.migrationGoal = null;
    creature.migrationWeight = 0;
    creature.territoryAlert = 0;
    creature.interactionCooldown = 0;
    creature.grazeTimer = 0;
    creature.labelPulse = Math.random();
    creature.temporary = Boolean(options.temporary);
    creature.deadRewardSource = species.dietType === "predator" ? "predator" : species.dietType === "scavenger" ? "scavenger" : "food";
    creature.group.position.set(x, getTerrainHeight(x, z) + creature.spec.yOffset, z);
    creature.home = new THREE.Vector3(species.territory.x, getTerrainHeight(species.territory.x, species.territory.z) + creature.spec.yOffset, species.territory.z);
    creature.group.rotation.y = Math.random() * Math.PI * 2;
    creature.group.userData.enemyId = `${speciesId}-${packId}-${this.enemies.length}`;
    creature.group.userData.speciesId = speciesId;
    creature.group.userData.speciesName = species.name;
    creature.group.userData.variant = creature.variant;
    this.scene.add(creature.group);
    this.enemies.push(creature);
    return creature;
  }

  spawnBurst(position, { color, ttl = 0.42, size = 1, ring = true, shards = 5, rise = 0.6 } = {}) {
    const group = new THREE.Group();
    group.position.copy(position);

    const entries = [];
    if (ring) {
      const ringMesh = new THREE.Mesh(
        EFFECT_RING_GEOMETRY,
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.72,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.scale.setScalar(size);
      group.add(ringMesh);
      entries.push({ mesh: ringMesh, velocity: new THREE.Vector3(), type: "ring" });
    }

    for (let index = 0; index < shards; index += 1) {
      const shard = new THREE.Mesh(
        EFFECT_SHARD_GEOMETRY,
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.92,
          depthWrite: false,
        }),
      );
      shard.position.set((Math.random() - 0.5) * 0.35 * size, 0.12 * size, (Math.random() - 0.5) * 0.35 * size);
      shard.scale.setScalar(size * (0.7 + Math.random() * 0.6));
      group.add(shard);
      entries.push({
        mesh: shard,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 3.1 * size,
          1.5 + Math.random() * 1.6,
          (Math.random() - 0.5) * 3.1 * size,
        ),
        type: "shard",
      });
    }

    this.scene.add(group);
    this.effects.push({
      group,
      entries,
      ttl,
      rise,
      age: 0,
      size,
    });
  }

  spawnGroundDust(position, { color = 0xd9b487, ttl = 0.2, size = 0.9, shards = 4, rise = 0.06 } = {}) {
    this.spawnBurst(position.clone().setY(getTerrainHeight(position.x, position.z) + 0.28), {
      color,
      ttl,
      size,
      shards,
      ring: false,
      rise,
    });
  }

  spawnAttackArc(position, yaw, { color = 0xffe0af, ttl = 0.16, size = 1 } = {}) {
    const group = new THREE.Group();
    group.position.copy(position);
    group.rotation.set(Math.PI / 2, yaw, 0);

    const arc = new THREE.Mesh(
      EFFECT_BITE_ARC_GEOMETRY,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
      }),
    );
    arc.scale.setScalar(size);
    group.add(arc);

    this.scene.add(group);
    this.effects.push({
      group,
      entries: [{ mesh: arc, velocity: new THREE.Vector3(), type: "arc" }],
      ttl,
      rise: 0,
      age: 0,
      size,
    });
  }

  setupLights() {
    this.hemiLight = new THREE.HemisphereLight(0xffe0ba, 0x5b4638, 1.65);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xffe7c6, 2.2);
    this.keyLight.position.set(-18, 24, 10);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 0.5;
    this.keyLight.shadow.camera.far = 70;
    this.keyLight.shadow.camera.left = -30;
    this.keyLight.shadow.camera.right = 30;
    this.keyLight.shadow.camera.top = 30;
    this.keyLight.shadow.camera.bottom = -30;
    this.scene.add(this.keyLight);

    this.nestLight = new THREE.PointLight(0x76ffe5, 4.6, 26, 2);
    this.nestLight.position.set(NEST_POSITION.x, getTerrainHeight(NEST_POSITION.x, NEST_POSITION.z) + 5, NEST_POSITION.z);
    this.scene.add(this.nestLight);

    this.dangerLight = new THREE.PointLight(0xff6e48, 5.4, 32, 2);
    this.dangerLight.position.set(DANGER_ZONE.x, getTerrainHeight(DANGER_ZONE.x, DANGER_ZONE.z) + 5, DANGER_ZONE.z);
    this.scene.add(this.dangerLight);
  }

  spawnFoods() {
    FOOD_SPAWNS.forEach((spawn, index) => {
      const group = createFoodMesh(spawn.rare);
      const offset = getSpawnOffset(spawn.rare ? 2.4 : 1.8);
      const x = clamp(spawn.x + offset.x, -WORLD_RADIUS + 4, WORLD_RADIUS - 4);
      const z = clamp(spawn.z + offset.z, -WORLD_RADIUS + 4, WORLD_RADIUS - 4);
      const y = getTerrainHeight(x, z) + 1.35;
      group.position.set(x, y, z);
      group.userData.baseY = y;
      group.userData.spawnOrigin = { x, z };
      this.scene.add(group);
      this.foods.push({
        id: `food-${index}`,
        spawn,
        group,
        active: true,
        respawnTimer: 0,
        bobPhase: Math.random() * Math.PI * 2,
      });
    });
  }

  spawnEnemies() {
    Object.values(SPECIES_DEFS).forEach((species) => {
      species.spawnGroups.forEach((group, groupIndex) => {
        const packId = `${species.id}-pack-${groupIndex}`;
        let leader = null;

        for (let index = 0; index < group.count; index += 1) {
          const variant = index === 0
            ? group.leaderVariant
            : pickRandom(species.memberTypes);
          const creature = this.spawnCreatureFromSpecies(species.id, {
            variant,
            x: group.x,
            z: group.z,
            groupIndex,
            packId,
            isLeader: index === 0,
            leaderId: leader?.group.userData.enemyId ?? null,
          });
          creature.spawn = { x: group.x, z: group.z };
          creature.packAnchor = new THREE.Vector3(group.x, 0, group.z);
          if (!leader) {
            leader = creature;
            creature.leaderId = creature.group.userData.enemyId;
          } else {
            creature.leaderId = leader.group.userData.enemyId;
          }
        }
      });
    });
  }

  startGame() {
    if (this.state.mode === "menu") {
      this.clearOverlayButtonFocus();
      this.state.mode = "playing";
      this.state.pauseMenuOpen = false;
      this.clearFeralSurge();
      this.state.message = this.state.hasSave
        ? "Your line still begins in water. Push through new frontier biomes, then bank the gains back at the nest."
        : "A tiny organism wakes in the origin waters. Feed there first, then earn the first push onto shore.";
      this.runStats.summary = "Fresh hunt. All life starts in the water, then branches outward through riskier frontiers.";
      this.state.startedAt = this.elapsed;
      this.state.editorOpen = false;
      this.renderer.domElement.focus();
      this.emitState();
    }
  }

  resize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.render();
  }

  handleGamepadConnection(event) {
    const pad = event.gamepad;
    this.gamepad.connected = true;
    this.gamepad.index = pad.index;
    this.gamepad.label = pad.id || "Controller";
    this.state.message = this.state.mode === "menu"
      ? "Controller ready. D-pad moves through menu options and A confirms."
      : `${this.gamepad.label} linked. Left stick moves, right stick aims, A or RT bites, Start opens pause, D-pad navigates menus, and View opens evolution at the nest.`;
    this.emitState();
    if (this.isOverlayNavigationActive()) {
      this.primeOverlayFocus();
    }
  }

  handleGamepadDisconnection(event) {
    if (this.gamepad.index != null && event.gamepad?.index !== this.gamepad.index && !this.gamepadTestState) {
      return;
    }

    this.gamepad.connected = false;
    this.gamepad.index = null;
    this.gamepad.label = "";
    this.gamepad.moveX = 0;
    this.gamepad.moveY = 0;
    this.gamepad.lookX = 0;
    this.gamepad.lookY = 0;
    this.gamepad.sprint = false;
    this.gamepad.attackHeld = false;
    this.gamepad.prevAttackHeld = false;
    this.gamepad.prevStartHeld = false;
    this.gamepad.prevSelectHeld = false;
    this.gamepad.prevDpadUpHeld = false;
    this.gamepad.prevDpadDownHeld = false;
    this.gamepad.prevDpadLeftHeld = false;
    this.gamepad.prevDpadRightHeld = false;
    this.gamepad.prevFullscreenHeld = false;
    this.clearOverlayButtonFocus();
    this.emitState();
  }

  readGamepadSnapshot() {
    if (this.gamepadTestState) {
      const buttons = this.gamepadTestState.buttons ?? {};
      return {
        connected: this.gamepadTestState.connected !== false,
        id: this.gamepadTestState.id ?? "Test Controller",
        index: this.gamepadTestState.index ?? 0,
        axes: Array.isArray(this.gamepadTestState.axes) ? this.gamepadTestState.axes : [0, 0, 0, 0],
        buttons: Array.from({ length: 16 }, (_, index) => {
          const value = buttons[index] ?? buttons[String(index)] ?? 0;
          const pressed = typeof value === "object" ? Boolean(value.pressed) : Boolean(value);
          const analogValue = typeof value === "object" && Number.isFinite(value.value) ? value.value : Number(value) || 0;
          return { pressed, value: analogValue };
        }),
      };
    }

    if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") {
      return null;
    }

    const pads = navigator.getGamepads();
    if (!pads) {
      return null;
    }

    const preferredPad = this.gamepad.index != null ? pads[this.gamepad.index] : null;
    if (preferredPad) {
      return preferredPad;
    }

    return pads.find((pad) => pad && pad.connected) ?? null;
  }

  pollGamepadInput() {
    const pad = this.readGamepadSnapshot();
    if (!pad || !pad.connected) {
      if (this.gamepad.connected) {
        this.handleGamepadDisconnection({ gamepad: { index: this.gamepad.index } });
      }
      return;
    }

    const newlyConnected = !this.gamepad.connected || this.gamepad.index !== pad.index || this.gamepad.label !== (pad.id || "Controller");
    if (newlyConnected) {
      this.gamepad.connected = true;
      this.gamepad.index = pad.index;
      this.gamepad.label = pad.id || "Controller";
      if (this.state.mode !== "menu") {
        this.state.message = `${this.gamepad.label} linked. Left stick moves, right stick aims, A or RT bites, Start opens pause, D-pad navigates menus, and View opens evolution at the nest.`;
      }
      if (this.isOverlayNavigationActive()) {
        this.primeOverlayFocus();
      }
    }

    const leftX = applyAxisDeadzone(pad.axes?.[0] ?? 0, GAMEPAD_MOVE_DEADZONE);
    const leftY = applyAxisDeadzone(-(pad.axes?.[1] ?? 0), GAMEPAD_MOVE_DEADZONE);
    const rightX = applyAxisDeadzone(pad.axes?.[2] ?? 0, GAMEPAD_LOOK_DEADZONE);
    const rightY = applyAxisDeadzone(-(pad.axes?.[3] ?? 0), GAMEPAD_LOOK_DEADZONE);
    const buttonPressed = (index) => Boolean(pad.buttons?.[index]?.pressed || (pad.buttons?.[index]?.value ?? 0) > 0.45);

    const overlayNavigationActive = this.isOverlayNavigationActive();
    const dpadUpHeld = buttonPressed(12);
    const dpadDownHeld = buttonPressed(13);
    const dpadLeftHeld = buttonPressed(14);
    const dpadRightHeld = buttonPressed(15);
    const dpadX = overlayNavigationActive ? 0 : Number(dpadRightHeld) - Number(dpadLeftHeld);
    const dpadY = overlayNavigationActive ? 0 : Number(dpadUpHeld) - Number(dpadDownHeld);
    const moveX = clamp(leftX + dpadX, -1, 1);
    const moveY = clamp(leftY + dpadY, -1, 1);
    const sprintHeld = buttonPressed(1) || buttonPressed(4) || buttonPressed(10);
    const attackHeld = buttonPressed(0) || buttonPressed(2) || buttonPressed(5) || buttonPressed(7);
    const startHeld = buttonPressed(9);
    const selectHeld = buttonPressed(8);
    const fullscreenHeld = buttonPressed(3);

    this.gamepad.moveX = moveX;
    this.gamepad.moveY = moveY;
    this.gamepad.lookX = rightX;
    this.gamepad.lookY = rightY;
    this.gamepad.sprint = sprintHeld;
    this.gamepad.attackHeld = attackHeld;
    this.gamepad.attackPressed = attackHeld && !this.gamepad.prevAttackHeld;
    this.gamepad.startPressed = startHeld && !this.gamepad.prevStartHeld;
    this.gamepad.selectPressed = selectHeld && !this.gamepad.prevSelectHeld;
    this.gamepad.dpadUpPressed = dpadUpHeld && !this.gamepad.prevDpadUpHeld;
    this.gamepad.dpadDownPressed = dpadDownHeld && !this.gamepad.prevDpadDownHeld;
    this.gamepad.dpadLeftPressed = dpadLeftHeld && !this.gamepad.prevDpadLeftHeld;
    this.gamepad.dpadRightPressed = dpadRightHeld && !this.gamepad.prevDpadRightHeld;
    this.gamepad.fullscreenPressed = fullscreenHeld && !this.gamepad.prevFullscreenHeld;

    if ((Math.abs(moveX) > 0.05 || Math.abs(moveY) > 0.05) && !this.state.editorOpen) {
      this.clearMoveTarget();
    }

    if (this.gamepad.attackPressed) {
      if (overlayNavigationActive) {
        this.activateOverlayFocus();
      } else if (this.state.mode === "menu") {
        this.startGame();
      } else {
        this.queueAttack();
      }
    }

    if (overlayNavigationActive) {
      if (this.gamepad.dpadUpPressed) {
        this.moveOverlayFocus("up");
      } else if (this.gamepad.dpadDownPressed) {
        this.moveOverlayFocus("down");
      } else if (this.gamepad.dpadLeftPressed) {
        this.moveOverlayFocus("left");
      } else if (this.gamepad.dpadRightPressed) {
        this.moveOverlayFocus("right");
      }
    }

    if (this.gamepad.startPressed) {
      if (this.state.mode === "menu") {
        this.startGame();
      } else if (this.state.editorOpen) {
        this.toggleEditor(false);
      } else {
        this.togglePauseMenu();
      }
    }

    if (this.gamepad.selectPressed) {
      if (this.state.pauseMenuOpen && this.state.zone === "nest" && this.state.respawnTimer <= 0) {
        this.openPauseEvolution();
      } else if (this.state.editorOpen) {
        this.setEditorTab("evolution");
      } else if (this.state.zone === "nest" && this.state.respawnTimer <= 0) {
        this.toggleEditor(true);
      }
    }

    if (this.gamepad.fullscreenPressed) {
      this.toggleFullscreen();
    }

    this.gamepad.prevAttackHeld = attackHeld;
    this.gamepad.prevStartHeld = startHeld;
    this.gamepad.prevSelectHeld = selectHeld;
    this.gamepad.prevDpadUpHeld = dpadUpHeld;
    this.gamepad.prevDpadDownHeld = dpadDownHeld;
    this.gamepad.prevDpadLeftHeld = dpadLeftHeld;
    this.gamepad.prevDpadRightHeld = dpadRightHeld;
    this.gamepad.prevFullscreenHeld = fullscreenHeld;
  }

  handleKey(event) {
    const pressed = event.type === "keydown";
    if (BLOCKED_BROWSER_KEYS.has(event.code)) {
      event.preventDefault();
    }

    if (event.code === "Escape" && pressed && this.state.editorOpen) {
      this.toggleEditor(false);
      return;
    }

    if (event.code === "Escape" && pressed && this.state.pauseMenuOpen) {
      this.togglePauseMenu(false);
      return;
    }

    if (event.code === "Escape" && pressed && this.state.mode === "playing") {
      this.togglePauseMenu();
      return;
    }

    if (event.code === "KeyF" && pressed && !event.repeat) {
      this.toggleFullscreen();
      return;
    }

    if (this.state.editorOpen || this.state.pauseMenuOpen) {
      return;
    }

    switch (event.code) {
      case "KeyW":
      case "ArrowUp":
        this.input.forward = pressed;
        if (pressed) {
          this.clearMoveTarget();
        }
        break;
      case "KeyS":
      case "ArrowDown":
        this.input.backward = pressed;
        if (pressed) {
          this.clearMoveTarget();
        }
        break;
      case "KeyA":
      case "ArrowLeft":
        this.input.left = pressed;
        if (pressed) {
          this.clearMoveTarget();
        }
        break;
      case "KeyD":
      case "ArrowRight":
        this.input.right = pressed;
        if (pressed) {
          this.clearMoveTarget();
        }
        break;
      case "ShiftLeft":
      case "ShiftRight":
        this.input.sprint = pressed;
        break;
      case "Space":
        if (pressed && !event.repeat) {
          this.queueAttack();
        }
        break;
      case "KeyQ":
      case "KeyE":
      case "KeyR":
        if (pressed && !event.repeat) {
          this.performSocialVerb(SOCIAL_VERB_BY_CODE[event.code]);
        }
        break;
      default:
        break;
    }
  }

  handleMouseDown(event) {
    this.renderer.domElement.focus();
    if (this.state.editorOpen || this.state.pauseMenuOpen) {
      return;
    }
    if (event.button === 2) {
      event.preventDefault();
      this.input.attackHeld = true;
      this.queueAttack();
      return;
    }

    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    if (this.state.mode !== "playing" || this.state.respawnTimer > 0) {
      return;
    }

    const moveTarget = this.getGroundTargetFromPointer(event.clientX, event.clientY);
    if (moveTarget) {
      this.setMoveTarget(moveTarget);
    }
  }

  handleMouseUp(event) {
    if (event.button === 2) {
      this.input.attackHeld = false;
    }
  }

  handleContextMenu(event) {
    event.preventDefault();
  }

  handleBlur() {
    this.input.forward = false;
    this.input.backward = false;
    this.input.left = false;
    this.input.right = false;
    this.input.sprint = false;
    this.input.attackHeld = false;
    this.clearOverlayButtonFocus();
  }

  setVirtualInput(key, pressed) {
    if (this.state.editorOpen || this.state.pauseMenuOpen) {
      return;
    }
    if (!(key in this.virtualInput)) {
      return;
    }

    this.virtualInput[key] = pressed;
    if (key === "attackHeld" && pressed) {
      this.queueAttack();
    }
  }

  queueAttack() {
    if (this.state.mode !== "playing" || this.state.respawnTimer > 0 || this.state.editorOpen || this.state.pauseMenuOpen) {
      return;
    }
    this.input.attackQueued = true;
  }

  getGroundTargetFromPointer(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = 1 - ((clientY - rect.top) / rect.height) * 2;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);

    const [hit] = this.raycaster.intersectObject(this.world.terrain, false);
    if (!hit) {
      return null;
    }

    const point = hit.point.clone();
    point.x = clamp(point.x, -WORLD_RADIUS + 2, WORLD_RADIUS - 2);
    point.z = clamp(point.z, -WORLD_RADIUS + 2, WORLD_RADIUS - 2);
    point.y = getTerrainHeight(point.x, point.z);
    return point;
  }

  setMoveTarget(target) {
    if (getDistance2D(this.player.group.position, target) <= MOVE_TARGET_STOP_DISTANCE) {
      this.clearMoveTarget();
      return;
    }

    this.moveTarget.active = true;
    this.moveTarget.position.copy(target);
    this.moveTargetMarker.group.visible = true;
    this.moveTargetMarker.group.position.set(target.x, target.y + 0.08, target.z);
  }

  clearMoveTarget() {
    this.moveTarget.active = false;
    this.moveTargetMarker.group.visible = false;
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      this.container.requestFullscreen?.();
      return;
    }

    document.exitFullscreen?.();
  }

  isOverlayNavigationActive() {
    return this.state.mode === "menu" || this.state.pauseMenuOpen || this.state.editorOpen;
  }

  clearOverlayButtonFocus() {
    if (this.overlayFocusFrame != null) {
      window.cancelAnimationFrame(this.overlayFocusFrame);
      this.overlayFocusFrame = null;
    }
    document.querySelectorAll(`.${GAMEPAD_FOCUS_CLASS}`).forEach((element) => {
      element.classList.remove(GAMEPAD_FOCUS_CLASS);
    });
  }

  getOverlayFocusableButtons() {
    const selector = this.state.editorOpen
      ? ".editor-overlay"
      : this.state.pauseMenuOpen
        ? ".pause-overlay"
        : this.state.mode === "menu"
          ? ".menu-overlay"
          : null;
    if (!selector) {
      return [];
    }
    const overlay = document.querySelector(selector);
    if (!overlay) {
      return [];
    }
    return Array.from(overlay.querySelectorAll("button")).filter((button) => {
      if (button.disabled) {
        return false;
      }
      const style = window.getComputedStyle(button);
      if (style.display === "none" || style.visibility === "hidden") {
        return false;
      }
      const rect = button.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
  }

  focusOverlayButton(button) {
    if (!button) {
      return false;
    }
    this.clearOverlayButtonFocus();
    button.classList.add(GAMEPAD_FOCUS_CLASS);
    button.focus({ preventScroll: true });
    button.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "auto",
    });
    return true;
  }

  primeOverlayFocus() {
    const buttons = this.getOverlayFocusableButtons();
    if (!buttons.length) {
      this.queueOverlayFocus();
      return false;
    }
    const active = buttons.includes(document.activeElement) ? document.activeElement : buttons[0];
    return this.focusOverlayButton(active);
  }

  queueOverlayFocus() {
    if (this.overlayFocusFrame != null) {
      window.cancelAnimationFrame(this.overlayFocusFrame);
    }
    this.overlayFocusFrame = window.requestAnimationFrame(() => {
      this.overlayFocusFrame = null;
      if (!this.isOverlayNavigationActive()) {
        this.clearOverlayButtonFocus();
        return;
      }
      const buttons = this.getOverlayFocusableButtons();
      if (!buttons.length) {
        return;
      }
      const active = document.activeElement;
      if (buttons.includes(active)) {
        this.focusOverlayButton(active);
        return;
      }
      this.focusOverlayButton(buttons[0]);
    });
  }

  moveOverlayFocus(direction) {
    const buttons = this.getOverlayFocusableButtons().map((button) => {
      const rect = button.getBoundingClientRect();
      return {
        button,
        rect,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
      };
    });
    if (!buttons.length) {
      return false;
    }

    const active = document.activeElement;
    const current = buttons.find((entry) => entry.button === active) ?? buttons[0];
    const horizontal = direction === "left" || direction === "right";
    const sign = direction === "left" || direction === "up" ? -1 : 1;
    const directional = buttons
      .filter((entry) => entry.button !== current.button)
      .filter((entry) => {
        const delta = horizontal ? entry.centerX - current.centerX : entry.centerY - current.centerY;
        return sign * delta > 8;
      });

    const pickBest = (entries, wrap = false) => {
      if (!entries.length) {
        return null;
      }
      return entries
        .slice()
        .sort((left, right) => {
          const leftPrimary = horizontal ? Math.abs(left.centerX - current.centerX) : Math.abs(left.centerY - current.centerY);
          const rightPrimary = horizontal ? Math.abs(right.centerX - current.centerX) : Math.abs(right.centerY - current.centerY);
          const leftSecondary = horizontal ? Math.abs(left.centerY - current.centerY) : Math.abs(left.centerX - current.centerX);
          const rightSecondary = horizontal ? Math.abs(right.centerY - current.centerY) : Math.abs(right.centerX - current.centerX);
          const leftScore = leftPrimary + leftSecondary * 0.38 + (wrap ? 10 : 0);
          const rightScore = rightPrimary + rightSecondary * 0.38 + (wrap ? 10 : 0);
          return leftScore - rightScore;
        })[0];
    };

    let target = pickBest(directional, false);
    if (!target) {
      const wrapCandidates = buttons
        .filter((entry) => entry.button !== current.button)
        .sort((left, right) => {
          const leftAxis = horizontal ? left.centerX : left.centerY;
          const rightAxis = horizontal ? right.centerX : right.centerY;
          if (leftAxis !== rightAxis) {
            return sign < 0 ? leftAxis - rightAxis : rightAxis - leftAxis;
          }
          const leftCross = horizontal ? left.centerY : left.centerX;
          const rightCross = horizontal ? right.centerY : right.centerX;
          return Math.abs(leftCross - (horizontal ? current.centerY : current.centerX))
            - Math.abs(rightCross - (horizontal ? current.centerY : current.centerX));
        });
      target = pickBest(wrapCandidates.slice(0, 3), true);
    }

    return this.focusOverlayButton(target?.button ?? current.button);
  }

  activateOverlayFocus() {
    const buttons = this.getOverlayFocusableButtons();
    if (!buttons.length) {
      return false;
    }
    const active = buttons.includes(document.activeElement) ? document.activeElement : buttons[0];
    this.focusOverlayButton(active);
    active.click();
    this.queueOverlayFocus();
    return true;
  }

  toggleEditor(forceOpen) {
    const nextOpen = typeof forceOpen === "boolean" ? forceOpen : !this.state.editorOpen;
    if (nextOpen) {
      if (this.state.mode !== "playing" || this.state.zone !== "nest" || this.state.respawnTimer > 0) {
        return false;
      }
      this.handleBlur();
      this.clearMoveTarget();
      this.input.attackQueued = false;
      if (!this.saveData.evolutionDraft) {
        this.resetEvolutionDraft();
      }
      this.state.pauseMenuOpen = false;
      this.state.editorOpen = true;
      this.state.editorTab = "evolution";
      this.state.message = "Species nest open. Spend DNA on an egg plan, lay it, or switch to another body.";
    } else {
      if (!this.state.editorOpen) {
        return false;
      }
      this.state.editorOpen = false;
      this.state.message = "Nest sealed. Take the active body back into the dunes.";
      this.clearOverlayButtonFocus();
      this.renderer.domElement.focus();
    }
    this.emitState();
    if (nextOpen) {
      this.queueOverlayFocus();
    }
    return true;
  }

  installTestingHooks() {
    window.__sporeSliceGameInstance = this;
    window.__setTestGamepadState = (state = null) => {
      this.gamepadTestState = state;
      if (!state) {
        this.handleGamepadDisconnection({ gamepad: { index: this.gamepad.index } });
      }
    };
    window.advanceTime = (ms = 16) => {
      this.manualStepping = true;
      const frames = Math.max(1, Math.round(ms / (FIXED_STEP * 1000)));
      for (let index = 0; index < frames; index += 1) {
        this.update(FIXED_STEP);
      }
      this.render();
    };

    window.render_game_to_text = () => {
      const playerPosition = this.player.group.position;
      const currentTerritory = this.currentTerritory ?? this.getCurrentTerritoryForPosition(playerPosition);
      const activeCreature = this.getActiveCreature();
      const activeMaturation = activeCreature ? getCreatureMaturationDisplay(activeCreature) : null;
      const draft = this.saveData.evolutionDraft ?? createEvolutionDraft(activeCreature);
      const socialOpportunity = this.getSocialOpportunity();
      const blueprintEntries = UPGRADE_DEFS.map((upgrade) => {
        return {
          key: upgrade.key,
          label: upgrade.label,
          unlocked: this.isTraitBlueprintUnlocked(upgrade.key),
          unlockHint: getBlueprintUnlockText(upgrade),
        };
      });
      const closestThreat = this.enemies
        .filter((enemy) => enemy.deadTimer <= 0)
        .reduce((closest, enemy) => Math.min(closest, getDistance2D(enemy.group.position, playerPosition)), Number.POSITIVE_INFINITY);
      const nestDistance = Math.hypot(NEST_POSITION.x - playerPosition.x, NEST_POSITION.z - playerPosition.z);
      const attackHudVisible = this.player.combatHudTimer > 0 || (Number.isFinite(closestThreat) && closestThreat < 11.5);
      const currentBiome = this.getCurrentBiome(playerPosition);
      const dominantBiome = BIOME_DEFS[this.saveData.biomeProgress.dominantBiome] ?? BIOME_DEFS.originWaters;
      const activePath = this.playerStats.path ?? SPECIES_PATH_DEFS.nestling;
      const nextBiomeUnlock = this.getNextBiomeUnlock();
      const nearbyFoods = sortByDistance(playerPosition, this.foods.filter((food) => food.active), (food, distance) => ({
        id: food.id,
        x: Number(food.group.position.x.toFixed(1)),
        z: Number(food.group.position.z.toFixed(1)),
        dna: food.spawn.dna,
        distance: Number(distance.toFixed(1)),
      })).slice(0, 8);

      const nearbyEnemies = sortByDistance(playerPosition, this.enemies.filter((enemy) => enemy.deadTimer <= 0), (enemy, distance) => ({
        type: enemy.type,
        variant: enemy.variant,
        species: enemy.speciesName,
        need: enemy.need,
        state: enemy.state,
        packId: enemy.packId,
        x: Number(enemy.group.position.x.toFixed(1)),
        z: Number(enemy.group.position.z.toFixed(1)),
        hp: Number(enemy.hp.toFixed(0)),
        telegraph: Number(enemy.attackTelegraph.toFixed(2)),
        distance: Number(distance.toFixed(1)),
      })).slice(0, 6);
      const nearbyCarcasses = sortByDistance(playerPosition, this.carcasses, (carcass, distance) => ({
        id: carcass.id,
        species: carcass.speciesName,
        x: Number(carcass.group.position.x.toFixed(1)),
        z: Number(carcass.group.position.z.toFixed(1)),
        fresh: Number(carcass.fresh.toFixed(2)),
        scavenged: carcass.beingScavenged,
        distance: Number(distance.toFixed(1)),
      })).slice(0, 4);
      const nearbyNests = sortByDistance(playerPosition, this.ecosystem.nests.filter((nest) => !nest.destroyed), (nest, distance) => ({
        species: nest.species.name,
        hp: Number(nest.hp.toFixed(0)),
        x: Number(nest.group.position.x.toFixed(1)),
        z: Number(nest.group.position.z.toFixed(1)),
        distance: Number(distance.toFixed(1)),
      })).slice(0, 3);

      return JSON.stringify({
        coordinate_system: "x east/right, z south-to-north on the ground plane, y up",
        mode: this.state.mode,
        zone: this.state.zone,
        biome: {
          key: currentBiome.key,
          label: currentBiome.label,
          summary: currentBiome.summary,
          pressure: currentBiome.pressure,
          unlocked: this.isBiomeUnlocked(currentBiome.key),
          dominant: dominantBiome.label,
          unlockedBiomes: this.saveData.biomeProgress.unlockedBiomes.map((biomeKey) => BIOME_DEFS[biomeKey]?.label ?? biomeKey),
          nextUnlock: nextBiomeUnlock,
        },
        path: {
          key: activePath.key,
          label: activePath.label,
          summary: activePath.summary,
          favoredBiomes: activePath.favoredBiomes,
          shoreLabel: activePath.shoreLabel,
          shoreReadiness: Number((this.player.terrain.shoreReadiness ?? this.playerStats.shoreReadiness ?? 0).toFixed(2)),
        },
        pauseMenuOpen: this.state.pauseMenuOpen,
        editorOpen: this.state.editorOpen,
        editorTab: this.state.editorTab,
        message: this.state.message,
        objective: this.state.objective,
        ecosystemNotice: this.state.ecosystemNotice,
        speciesXp: Math.round(this.state.speciesXp),
        social: socialOpportunity
          ? {
              species: socialOpportunity.speciesName,
              status: socialOpportunity.status,
              distance: Number(socialOpportunity.distance.toFixed(1)),
              expectedVerb: socialOpportunity.expectedVerbLabel,
              expectedHotkey: socialOpportunity.expectedVerbHotkey,
              progress: socialOpportunity.progress,
              sequence: socialOpportunity.sequence,
              hint: socialOpportunity.hint,
            }
          : null,
        gamepad: {
          connected: this.gamepad.connected,
          label: this.gamepad.label,
          moveX: Number(this.gamepad.moveX.toFixed(2)),
          moveY: Number(this.gamepad.moveY.toFixed(2)),
          lookX: Number(this.gamepad.lookX.toFixed(2)),
          lookY: Number(this.gamepad.lookY.toFixed(2)),
          sprint: this.gamepad.sprint,
        },
        territory: currentTerritory
          ? {
              speciesId: currentTerritory.speciesId,
              label: currentTerritory.label,
              alert: Number(currentTerritory.alert.toFixed(2)),
            }
          : null,
        migration: this.ecosystem.activeEvent
          ? {
              key: this.ecosystem.activeEvent.key,
              label: this.ecosystem.activeEvent.label,
              speciesId: this.ecosystem.activeEvent.speciesId,
              timeLeft: Number(this.ecosystem.activeEvent.timer.toFixed(1)),
            }
          : null,
        player: {
          x: Number(playerPosition.x.toFixed(1)),
          y: Number(playerPosition.y.toFixed(1)),
          z: Number(playerPosition.z.toFixed(1)),
          vx: Number(this.player.velocity.x.toFixed(2)),
          vz: Number(this.player.velocity.z.toFixed(2)),
          speed: Number(this.player.velocity.length().toFixed(2)),
          yaw: Number(this.player.yaw.toFixed(2)),
          health: Number(this.player.health.toFixed(0)),
          maxHealth: Number(this.player.maxHealth.toFixed(0)),
          dna: this.state.dna,
          runScore: this.runStats.score,
          atNest: this.state.zone === "nest",
          attackReady: this.player.attackCooldown <= 0,
          biteCooldownPct: Number((1 - this.player.attackCooldown / Math.max(0.01, this.playerStats.biteCooldown)).toFixed(2)),
          attackPhase: this.player.attackPhase,
          attackResult: this.player.attackResult,
          sprintCharge: Number(this.player.sprintCharge.toFixed(2)),
          surgeCharge: Number((this.surge.timer / FERAL_SURGE_MAX_TIMER).toFixed(2)),
          surgeLevel: this.surge.level,
          sprinting: this.player.isSprinting,
          terrainSlow: Number((1 - this.player.terrain.speedFactor).toFixed(2)),
          mass: Number(this.playerStats.mass.toFixed(2)),
          attackImpact: Number(this.player.attackImpact.toFixed(2)),
          pathLabel: activePath.label,
          shoreLabel: activePath.shoreLabel,
          shoreReadiness: Number((this.player.terrain.shoreReadiness ?? this.playerStats.shoreReadiness ?? 0).toFixed(2)),
          identity: activeCreature ? buildCreatureIdentity(activeCreature.profile, activeCreature.traits) : buildCreatureIdentity(this.state.creatureProfile, this.state.upgrades),
          stage: activeCreature ? describeCreatureStage(activeCreature.growth) : "Adult",
          stageLabel: activeMaturation?.label ?? `Fully Grown ${SPECIES_DISPLAY_NAME}`,
          growth: activeCreature ? Number(activeCreature.growth.toFixed(3)) : 1,
        },
        hud: {
          speciesName: SPECIES_DISPLAY_NAME,
          maturationLabel: activeMaturation?.label ?? `Fully Grown ${SPECIES_DISPLAY_NAME}`,
          showSprintHud: this.player.sprintHudTimer > 0.001,
          showAttackHud: attackHudVisible,
          nestDistance: Number(nestDistance.toFixed(1)),
        },
        moveTarget: this.moveTarget.active
          ? {
              x: Number(this.moveTarget.position.x.toFixed(1)),
              z: Number(this.moveTarget.position.z.toFixed(1)),
              distance: Number(getDistance2D(playerPosition, this.moveTarget.position).toFixed(1)),
            }
          : null,
        bestRun: this.state.bestRun,
        summary: this.runStats.summary,
        upgrades: this.state.upgrades,
        creatureProfile: this.state.creatureProfile,
        activeCreature: activeCreature
          ? {
              id: activeCreature.id,
              identity: buildCreatureIdentity(activeCreature.profile, activeCreature.traits),
              generation: activeCreature.generation,
              growth: Number(activeCreature.growth.toFixed(3)),
              growthTarget: computeCreatureMaturityTarget(activeCreature),
              remainingGrowth: Math.ceil(computeRemainingMaturityPoints(activeCreature)),
            }
          : null,
        speciesRoster: this.saveData.speciesCreatures.map((creature) => ({
          id: creature.id,
          identity: buildCreatureIdentity(creature.profile, creature.traits),
          generation: creature.generation,
          growth: Number(creature.growth.toFixed(3)),
          fastEvolveCost: creature.growth >= 1 ? 0 : getFastEvolveCost(creature),
          active: creature.id === this.saveData.activeCreatureId,
        })),
        evolutionDraft: {
          baseCreatureId: draft.baseCreatureId,
          identity: buildCreatureIdentity(draft.profile, draft.traits),
          modified: this.isDraftModified(),
          traits: draft.traits,
          pathLabel: (computePlayerStats(draft.traits, draft.profile).path ?? SPECIES_PATH_DEFS.nestling).label,
          shoreLabel: (computePlayerStats(draft.traits, draft.profile).path ?? SPECIES_PATH_DEFS.nestling).shoreLabel,
        },
        blueprints: blueprintEntries,
        speciesRelations: Object.entries(this.saveData.speciesRelations).map(([speciesId, relation]) => ({
          speciesId,
          species: SPECIES_DEFS[speciesId]?.name ?? speciesId,
          status: relation.status,
          friendship: relation.friendship,
          dominance: relation.dominance,
        })),
        alignment: this.state.alignment,
        food: nearbyFoods,
        carcasses: nearbyCarcasses,
        nests: nearbyNests,
        enemies: nearbyEnemies,
      });
    };
  }

  applyUpgradeVisuals() {
    applyCreatureAppearance(
      this.player,
      this.state.upgrades,
      this.state.creatureProfile,
      createPaletteFromProfile(this.state.creatureProfile),
    );
  }

  updatePlayerStats() {
    this.playerStats = computePlayerStats(this.state.upgrades, this.state.creatureProfile);
    const healthRatio = this.player.maxHealth > 0 ? this.player.health / this.player.maxHealth : 1;
    this.player.maxHealth = this.playerStats.health;
    this.player.health = clamp(this.playerStats.health * healthRatio, 0, this.player.maxHealth);
  }

  persistProgress() {
    saveProgress({
      dna: this.state.dna,
      speciesXp: this.state.speciesXp,
      bestRun: this.state.bestRun,
      speciesCreatures: this.saveData.speciesCreatures,
      activeCreatureId: this.saveData.activeCreatureId,
      evolutionDraft: this.saveData.evolutionDraft,
      upgrades: this.state.upgrades,
      creatureProfile: this.state.creatureProfile,
      alignment: this.state.alignment,
      traitBlueprints: this.saveData.traitBlueprints,
      speciesRelations: this.saveData.speciesRelations,
      biomeProgress: this.saveData.biomeProgress,
    });
  }

  updateRunScore() {
    this.runStats.score = computeRunScore(this.runStats);
    if (this.runStats.score > this.runStats.bestRun) {
      this.runStats.bestRun = this.runStats.score;
      this.state.bestRun = this.runStats.bestRun;
    }
  }

  setImpactPause(duration, fovKick = 0, shake = 0) {
    this.impactSlow = Math.max(this.impactSlow, duration);
    this.cameraFovKick = Math.max(this.cameraFovKick, fovKick);
    if (shake > 0) {
      this.cameraShake = Math.max(this.cameraShake, shake);
    }
  }

  clearFeralSurge() {
    this.surge.timer = 0;
    this.surge.level = 0;
    this.surge.pulse = 0;
  }

  grantFeralSurge(levelGain = 0, duration = 2.2) {
    const wasActive = this.surge.timer > 0.8;
    if (wasActive) {
      if (levelGain > 0) {
        this.surge.level = clamp(this.surge.level + levelGain, 1, 3);
      }
    } else {
      this.surge.level = clamp(Math.max(1, levelGain), 1, 3);
    }

    this.surge.timer = clamp(this.surge.timer + duration, 0, FERAL_SURGE_MAX_TIMER);
    this.surge.pulse = 1;
    return this.surge.level;
  }

  awardDNA(amount, message, options = {}) {
    const source = options.source ?? "food";
    const biome = this.getCurrentBiome(this.player.group.position);
    const rewardMultiplier = (this.state.zone === "danger" ? DANGER_REWARD_MULTIPLIER : 1) * (biome.dnaMultiplier ?? 1);
    const reward = Math.max(1, Math.round(amount * rewardMultiplier));
    this.state.dna += reward;
    this.state.hasSave = true;
    this.runStats.sessionDna += reward;
    if (source === "predator") {
      this.runStats.predatorsDefeated += 1;
    } else if (source === "scavenger") {
      this.runStats.scavengersDefeated += 1;
    } else if (source === "herbivore") {
      this.runStats.herbivoresDefeated += 1;
    }
    const surgeLevel = this.grantFeralSurge(
      source === "predator" ? 2 : source === "scavenger" || source === "rareFood" || source === "herbivore" ? 1 : 0,
      source === "predator" ? 4.6 : source === "scavenger" ? 3.5 : source === "rareFood" ? 3.8 : source === "herbivore" ? 3 : 2.1,
    );
    this.state.alignment = shiftAlignment(
      this.state.alignment,
      source === "predator" || source === "scavenger" || source === "herbivore" ? "aggressive" : "adaptive",
      source === "predator" ? 0.03 : source === "scavenger" ? 0.02 : source === "herbivore" ? 0.014 : source === "rareFood" ? 0.018 : 0.012,
    );
    this.discoverBiome(biome.key, { announce: false });
    this.addBiomeMastery(
      biome.key,
      source === "predator" ? 5.6 : source === "scavenger" ? 3.8 : source === "herbivore" ? 3 : source === "rareFood" ? 3.3 : 1.8,
    );
    this.updateRunScore();
    const bonusLabel = reward > amount
      ? this.state.zone === "danger"
        ? "Danger surge"
        : `${biome.label} bonus`
      : null;
    this.state.message = bonusLabel
      ? `${message} ${bonusLabel}: +${reward - amount} bonus DNA. Feral surge x${surgeLevel}.`
      : `${message} Feral surge x${surgeLevel}.`;
    const activeCreature = this.getActiveCreature();
    this.runStats.summary = this.surge.timer > 0.2
      ? `${this.runStats.sessionDna} DNA gathered. ${Math.round(this.state.speciesXp)} species XP banked. Feral surge x${this.surge.level} is live.`
      : `${this.runStats.sessionDna} DNA gathered. ${activeCreature && activeCreature.growth < 1 ? `${buildCreatureIdentity(activeCreature.profile, activeCreature.traits)} is ${Math.round(activeCreature.growth * 100)}% grown.` : `${Math.round(this.state.speciesXp)} species XP banked for fast evolve.`}`;
    if (options.position) {
      this.spawnBurst(options.position, {
        color: reward > amount ? 0xff9b70 : 0x73ffe5,
        ttl: 0.52,
        size: reward > amount ? 1.35 : 1.05,
        shards: reward > amount ? 8 : 6,
      });
    }
    this.player.pickupPulse = 1;
    this.cameraShake = Math.max(this.cameraShake, reward > amount ? 0.16 : 0.09);
    this.persistProgress();
  }

  purchaseUpgrade(key) {
    const spec = UPGRADE_DEFS.find((entry) => entry.key === key);
    if (!spec || this.state.zone !== "nest" || this.state.mode === "menu") {
      return;
    }

    if (!this.saveData.evolutionDraft) {
      this.resetEvolutionDraft();
    }

    const draft = this.saveData.evolutionDraft;
    const currentLevel = draft.traits[key] ?? 0;
    const cost = spec.costs[currentLevel];
    if (!this.isTraitBlueprintUnlocked(key)) {
      this.state.message = `${spec.label} is still locked. ${getBlueprintUnlockText(spec)} first.`;
      this.emitState();
      return;
    }

    if (cost == null || this.state.dna < cost) {
      return;
    }

    this.state.dna -= cost;
    draft.traits[key] = currentLevel + 1;
    this.state.alignment = shiftAlignment(this.state.alignment, "social", 0.026);
    this.state.hasSave = true;
    this.player.evolutionTimer = 1.45;
    this.player.evolutionTrait = key;
    this.evolutionFx.timer = 1.45;
    this.evolutionFx.trait = key;
    this.state.lastEvolution = {
      key,
      label: spec.label,
      summary: describeTraitLevel(key, draft.traits[key]),
    };
    this.state.message = `${spec.label} added to the egg plan. ${describeTraitLevel(key, draft.traits[key])}.`;
    this.spawnBurst(this.player.group.position, {
      color: 0x93ffe3,
      ttl: 0.72,
      size: 1.55,
      shards: 11,
    });
    this.spawnAttackArc(this.player.group.position.clone().setY(this.player.group.position.y + 0.5), this.player.yaw, {
      color: 0x9fffe6,
      ttl: 0.32,
      size: 1.35,
    });
    this.cameraShake = Math.max(this.cameraShake, 0.16);
    this.cameraFovKick = Math.max(this.cameraFovKick, 2.2);
    this.persistProgress();
    this.emitState();
  }

  resetProgress() {
    this.clearOverlayButtonFocus();
    clearSave();
    const starterCreature = createSpeciesCreature({
      traits: DEFAULT_SAVE.upgrades,
      profile: createRandomCreatureProfile(),
      growth: 0.22,
      generation: 1,
    });
    this.saveData = {
      ...DEFAULT_SAVE,
      speciesXp: 0,
      speciesCreatures: [starterCreature],
      activeCreatureId: starterCreature.id,
      evolutionDraft: createEvolutionDraft(starterCreature),
      upgrades: { ...starterCreature.traits },
      creatureProfile: { ...starterCreature.profile },
      alignment: { ...DEFAULT_ALIGNMENT },
      traitBlueprints: { ...DEFAULT_SAVE.traitBlueprints },
      speciesRelations: Object.keys(DEFAULT_SAVE.speciesRelations).reduce((relations, speciesId) => {
        relations[speciesId] = { ...DEFAULT_SAVE.speciesRelations[speciesId] };
        return relations;
      }, {}),
      biomeProgress: createDefaultBiomeProgress(),
    };
    this.state.dna = 0;
    this.state.speciesXp = 0;
    this.state.bestRun = 0;
    this.state.alignment = { ...this.saveData.alignment };
    this.state.hasSave = false;
    this.state.editorOpen = false;
    this.state.editorTab = "evolution";
    this.state.lastEvolution = null;
    this.state.message = "A fresh organism wakes in the origin waters. Feed there, then push out toward the first land frontier.";
    this.clearSocialEncounter();
    this.runStats = {
      sessionDna: 0,
      scavengersDefeated: 0,
      predatorsDefeated: 0,
      herbivoresDefeated: 0,
      timeAlive: 0,
      score: 0,
      bestRun: 0,
      summary: "Fresh species line. Feed in the origin waters, unlock a frontier, then return to the nest to evolve.",
    };
    this.clearFeralSurge();
    this.applyActiveCreatureState({ preserveHealthRatio: false });
    this.resetEcosystemState();
    this.resetPlayerToNest(true);
    this.foods.forEach((food) => {
      food.active = true;
      food.respawnTimer = 0;
      food.group.visible = true;
    });
    this.enemies.forEach((enemy) => this.respawnEnemy(enemy));
    this.persistProgress();
    this.emitState();
  }

  resetPlayerToNest(initial = false) {
    const resettingAfterDeath = !initial && this.player.health <= 0;
    const spawnTarget = this.getPreferredSpawnPoint();
    const spawnY = getTerrainHeight(spawnTarget.x, spawnTarget.z) + PLAYER_HEIGHT;
    this.player.group.position.set(spawnTarget.x, spawnY, spawnTarget.z);
    this.player.velocity.set(0, 0, 0);
    this.player.moveVelocity.set(0, 0, 0);
    this.player.impulseVelocity.set(0, 0, 0);
    this.player.previousVelocity.set(0, 0, 0);
    this.player.yaw = spawnTarget.yaw;
    this.player.health = this.playerStats.health;
    this.player.maxHealth = this.playerStats.health;
    this.player.sprintCharge = 1;
    this.player.attackCooldown = initial ? 0 : this.playerStats.biteCooldown;
    this.player.attackTimer = 0;
    this.player.attackPhase = "idle";
    this.player.attackPhaseTimer = 0;
    this.player.attackLungeTimer = 0;
    this.player.attackResolved = false;
    this.player.attackDidConnect = false;
    this.player.attackResult = "ready";
    this.player.attackResultTimer = 0;
    this.player.invulnerability = 1.2;
    this.player.hurtTint = 0;
    this.player.pickupPulse = 0;
    this.player.attackRecoil = 0;
    this.player.attackImpact = 0;
    this.player.lean = 0;
    this.player.bank = 0;
    this.player.turnMomentum = 0;
    this.player.dustTimer = 0;
    this.player.isSprinting = false;
    this.player.sprintHudTimer = 0;
    this.player.combatHudTimer = 0;
    this.player.group.scale.setScalar(this.player.baseScale);
    this.player.evolutionTimer = 0;
    this.player.evolutionTrait = null;
    this.player.socialTimer = 0;
    this.player.socialVerb = null;
    this.player.socialSuccess = 0;
    this.state.editorOpen = false;
    this.clearSocialEncounter();
    this.clearFeralSurge();
    this.impactSlow = 0;
    this.cameraFovKick = 0;
    this.cameraMomentum.set(0, 0, 0);
    this.clearMoveTarget();
    this.state.zone = getZoneName(this.player.group.position);
    this.currentBiome = BIOME_DEFS[spawnTarget.biomeKey] ?? this.getCurrentBiome(this.player.group.position);
    this.state.biome = this.currentBiome.key;

    if (resettingAfterDeath) {
      this.runStats = {
        ...this.runStats,
        sessionDna: 0,
        scavengersDefeated: 0,
        predatorsDefeated: 0,
        herbivoresDefeated: 0,
        timeAlive: 0,
        score: 0,
      };
    }
  }

  respawnEnemy(enemy) {
    const nest = this.getNestForSpecies(enemy.speciesId);
    if (enemy.temporary || nest?.destroyed) {
      enemy.deadTimer = 0;
      enemy.group.visible = false;
      return false;
    }

    enemy.deadTimer = 0;
    enemy.hp = enemy.maxHp;
    enemy.cooldown = 0.8;
    enemy.state = "resting";
    enemy.need = "patrolling";
    enemy.attackTelegraph = 0;
    enemy.impactPulse = 0;
    enemy.staggerTimer = 0;
    enemy.fleeTimer = 0;
    enemy.threatGlow = 0;
    enemy.recoilLift = 0;
    enemy.recoilTilt = 0;
    enemy.socialPulse = 0;
    enemy.targetCreatureId = null;
    enemy.targetFoodId = null;
    enemy.targetCarcassId = null;
    enemy.attackTargetId = null;
    enemy.attackTargetKind = "player";
    enemy.hunger = 0.12 + Math.random() * 0.18;
    enemy.rest = Math.random() * 0.16;
    enemy.interactionCooldown = 0;
    enemy.group.scale.setScalar(enemy.baseScale);
    enemy.group.visible = true;
    const baseX = nest?.species.nest.x ?? enemy.spawn.x;
    const baseZ = nest?.species.nest.z ?? enemy.spawn.z;
    const offset = getSpawnOffset(enemy.type === "predator" ? 3.8 : 3.1);
    const x = clamp(baseX + offset.x, -WORLD_RADIUS + 5, WORLD_RADIUS - 5);
    const z = clamp(baseZ + offset.z, -WORLD_RADIUS + 5, WORLD_RADIUS - 5);
    enemy.group.position.set(x, getTerrainHeight(x, z) + enemy.spec.yOffset, z);
    enemy.home.set(
      nest?.species.territory.x ?? enemy.spawn.x,
      getTerrainHeight(nest?.species.territory.x ?? enemy.spawn.x, nest?.species.territory.z ?? enemy.spawn.z) + enemy.spec.yOffset,
      nest?.species.territory.z ?? enemy.spawn.z,
    );
    enemy.velocity.set(0, 0, 0);
    enemy.roamTimer = 0.6 + Math.random() * 1.6;
    enemy.direction.set(Math.sin(enemy.group.rotation.y), 0, Math.cos(enemy.group.rotation.y));
    enemy.migrationGoal = null;
    enemy.migrationWeight = 0;
    enemy.territoryAlert = 0;
    this.spawnBurst(enemy.group.position.clone().setY(enemy.group.position.y - 0.35), {
      color: enemy.species.uiColor,
      ttl: 0.32,
      size: 0.82,
      shards: 4,
      rise: 0.08,
    });
    return true;
  }

  spawnCarcass(creature, attacker = null) {
    const palette = createPaletteFromProfile(creature.profile);
    const carcass = {
      id: `carcass-${Math.round(this.elapsed * 1000)}-${this.carcasses.length}`,
      group: createCarcassMesh(palette.body),
      speciesId: creature.speciesId,
      speciesName: creature.speciesName,
      x: creature.group.position.x,
      z: creature.group.position.z,
      ttl: CARCASS_TTL,
      fresh: 1,
      baseY: getTerrainHeight(creature.group.position.x, creature.group.position.z) + 0.24,
      guardedBy: attacker?.group?.userData?.enemyId ?? null,
      beingScavenged: false,
    };
    carcass.group.position.set(
      creature.group.position.x,
      carcass.baseY,
      creature.group.position.z,
    );
    this.scene.add(carcass.group);
    this.carcasses.push(carcass);

    while (this.carcasses.length > MAX_CARCASSES) {
      const oldest = this.carcasses.shift();
      this.scene.remove(oldest.group);
    }

    return carcass;
  }

  damageNest(nest, amount) {
    if (!nest || nest.destroyed) {
      return false;
    }

    nest.hp = Math.max(0, nest.hp - amount);
    nest.alert = 1;
    const territory = this.getTerritoryForSpecies(nest.speciesId);
    if (territory) {
      territory.alert = 1;
    }
    this.enemies.forEach((enemy) => {
      if (enemy.speciesId === nest.speciesId && enemy.deadTimer <= 0) {
        enemy.territoryAlert = 1;
      }
    });
    this.spawnBurst(nest.group.position.clone().setY(nest.group.position.y + 0.6), {
      color: nest.species.uiColor,
      ttl: 0.46,
      size: 1.05,
      shards: 7,
    });
    this.cameraShake = Math.max(this.cameraShake, 0.12);

    if (nest.hp <= 0) {
      this.claimSpeciesDominance(nest.speciesId, { dominance: 2, heavy: true });
      nest.destroyed = true;
      nest.ring.material.opacity = 0.03;
      nest.pulse.material.opacity = 0;
      nest.marker.rotation.z = -0.12;
      nest.marker.position.y -= 0.6;
      this.setEcosystemNotice(`${nest.species.name} nest broken. Their territory is no longer reinforced.`, 4.4);
      this.state.message = `${nest.species.name} nest collapses under your bite.`;
      return true;
    }

    this.aggravateSpecies(nest.speciesId, { heavy: true, announce: true });
    this.state.message = `${nest.species.name} nest shudders.`;
    return true;
  }

  damagePlayer(amount, sourceDirection) {
    if (this.player.invulnerability > 0 || this.state.respawnTimer > 0) {
      return;
    }

    const finalDamage = amount * (1 - this.playerStats.defense);
    this.player.health = Math.max(0, this.player.health - finalDamage);
    this.player.invulnerability = 0.65;
    this.player.hurtTint = 0.9;
    if (this.player.attackPhase === "windup" || this.player.attackPhase === "strike") {
      this.player.attackPhase = "recovery";
      this.player.attackPhaseTimer = ATTACK_RECOVERY_DURATION * 0.8;
      this.player.attackResolved = true;
      this.player.attackResult = "broken";
      this.player.attackResultTimer = 0.22;
    }
    this.player.attackRecoil = Math.max(this.player.attackRecoil, this.player.health > 0 ? 0.56 : 0.9);
    this.player.attackImpact = Math.max(this.player.attackImpact, this.player.health > 0 ? 0.5 : 0.78);
    this.player.moveVelocity.multiplyScalar(0.38);
    this.player.impulseVelocity.addScaledVector(sourceDirection, 6.2 / Math.max(0.85, this.playerStats.impactResist));
    this.setImpactPause(this.player.health > 0 ? 0.08 : 0.12, this.player.health > 0 ? 2.6 : 4.8);
    this.cameraShake = Math.max(this.cameraShake, this.player.health > 0 ? 0.18 : 0.34);
    this.spawnBurst(this.player.group.position, {
      color: this.player.health > 0 ? 0xff8b72 : 0xff4f3a,
      ttl: this.player.health > 0 ? 0.45 : 0.65,
      size: this.player.health > 0 ? 1.2 : 1.8,
      shards: this.player.health > 0 ? 7 : 10,
    });
    this.spawnGroundDust(this.player.group.position, {
      color: this.player.health > 0 ? 0xd88f68 : 0xb76c52,
      ttl: this.player.health > 0 ? 0.18 : 0.26,
      size: this.player.health > 0 ? 0.88 : 1.18,
      shards: this.player.health > 0 ? 4 : 6,
    });
    this.state.message = this.player.health > 0
      ? "A creature tears into you. Fall back or finish the fight."
      : "You collapse in the dunes.";

    if (this.player.health <= 0) {
      this.state.respawnTimer = 2.3;
      const dnaLoss = Math.min(this.state.dna, 8);
      this.state.dna -= dnaLoss;
      this.state.alignment = shiftAlignment(this.state.alignment, "adaptive", 0.02);
      this.updateRunScore();
      this.clearFeralSurge();
      this.runStats.summary = `${this.runStats.sessionDna} DNA secured before collapse. Species XP remains banked at ${Math.round(this.state.speciesXp)}.`;
      this.persistProgress();
      this.state.message = dnaLoss > 0
        ? `You lose ${dnaLoss} DNA and reform at the nest.`
        : "You reform at the nest.";
    }
  }

  damageEnemy(enemy, amount, sourceDirection, options = {}) {
    if (enemy.deadTimer > 0) {
      return { defeated: false, killed: false };
    }

    const sourceKind = options.sourceKind ?? "player";
    const attacker = options.attacker ?? null;
    const adjustedDamage = amount * (enemy.variant === "armoredScavenger" ? 0.88 : 1);
    enemy.hp = Math.max(0, enemy.hp - adjustedDamage);
    enemy.hitFlash = 0.36;
    enemy.impactPulse = enemy.hp <= 0 ? 1 : 0.82;
    enemy.threatGlow = 1;
    enemy.attackTelegraph = 0;
    enemy.staggerTimer = enemy.hp <= 0 ? 0.34 : (enemy.type === "predator" ? 0.22 : enemy.type === "herbivore" ? 0.4 : 0.34) / (enemy.spec.poise ?? 1);
    enemy.fleeTimer = enemy.type !== "predator" && enemy.hp > 0 ? 0.48 : 0;
    enemy.cooldown = Math.max(enemy.cooldown, enemy.type === "predator" ? 0.55 : 0.42);
    if (sourceDirection) {
      enemy.hitDirection.copy(sourceDirection);
    }
    enemy.recoilLift = Math.max(enemy.recoilLift, enemy.hp <= 0 ? 1 : enemy.type === "predator" ? 0.42 : enemy.type === "herbivore" ? 0.78 : 0.66);
    enemy.recoilTilt = Math.max(enemy.recoilTilt, enemy.type === "predator" ? 0.34 : enemy.type === "herbivore" ? 0.58 : 0.48);
    enemy.state = enemy.type === "predator" ? "staggered" : enemy.type === "herbivore" ? "panicked" : "reeling";
    enemy.need = enemy.type === "predator" ? "defending" : "fleeing";
    enemy.targetCreatureId = sourceKind === "creature" && attacker ? attacker.group.userData.enemyId : null;
    if (sourceKind === "player") {
      this.player.attackRecoil = Math.max(this.player.attackRecoil, enemy.hp <= 0 ? 1 : 0.7);
      this.player.attackImpact = Math.max(this.player.attackImpact, enemy.hp <= 0 ? 1 : enemy.type === "predator" ? 0.78 : 0.64);
      this.setImpactPause(
        enemy.hp <= 0 ? KILL_IMPACT_SLOW_DURATION : IMPACT_SLOW_DURATION,
        enemy.hp <= 0 ? 5.4 : 3.2,
        enemy.type === "predator" ? 0.18 : 0.1,
      );
    }
    this.cameraShake = Math.max(this.cameraShake, enemy.type === "predator" ? 0.16 : 0.09);
    this.spawnBurst(enemy.group.position, {
      color: enemy.type === "predator" ? 0xff9b70 : 0xffe2b1,
      ttl: enemy.hp <= 0 ? 0.58 : 0.34,
      size: enemy.hp <= 0 ? 1.4 : 1,
      shards: enemy.hp <= 0 ? 9 : 5,
    });
    this.spawnBurst(enemy.group.position.clone().setY(getTerrainHeight(enemy.group.position.x, enemy.group.position.z) + 0.4), {
      color: enemy.type === "predator" ? 0xc58c5f : 0xd8b287,
      ttl: 0.22,
      size: enemy.type === "predator" ? 0.95 : 0.8,
      shards: enemy.type === "predator" ? 5 : 4,
      ring: false,
      rise: 0.08,
    });
    this.state.alignment = shiftAlignment(this.state.alignment, "aggressive", enemy.type === "predator" ? 0.012 : 0.008);
    if (sourceKind === "player" && enemy.hp > 0) {
      const relation = this.getSpeciesRelation(enemy.speciesId);
      if (relation && relation.status !== "hostile") {
        this.aggravateSpecies(enemy.speciesId, {
          heavy: enemy.type === "predator",
          announce: true,
        });
      }
    }

    if (enemy.hp <= 0) {
      enemy.deadTimer = enemy.temporary ? 0.8 : enemy.species.respawnDelay + Math.random() * 2.4;
      enemy.group.visible = false;
      const carcass = this.spawnCarcass(enemy, attacker);
      if (sourceKind === "creature" && attacker) {
        attacker.hunger = Math.max(0, attacker.hunger - (attacker.type === "predator" ? 0.42 : 0.24));
        attacker.rest = Math.max(0, attacker.rest - 0.08);
        attacker.targetCarcassId = carcass.id;
      }
      if (sourceKind === "player") {
        const unlockedAlpha = this.claimSpeciesDominance(enemy.speciesId, {
          dominance: enemy.type === "predator" ? 2 : 1,
          heavy: enemy.type === "predator",
        });
        const activeCreature = this.getActiveCreature();
        if (activeCreature) {
          activeCreature.killCount += 1;
        }
        this.grantSpeciesXp(
          enemy.type === "predator" ? 14 : enemy.type === "scavenger" ? 9 : 7,
          {
            matureActive: true,
            source: "kill",
          },
        );
        this.awardDNA(
          enemy.spec.reward,
          `You defeat a ${enemy.species.name.toLowerCase()} and harvest ${enemy.spec.reward} DNA.`,
          {
            position: enemy.group.position,
            source: enemy.type === "herbivore" ? "herbivore" : enemy.type,
          },
        );
        if (unlockedAlpha.length) {
          this.state.message = `${this.state.message} ${unlockedAlpha.map((traitKey) => getBlueprintLabel(traitKey)).join(" and ")} unlocked in Creature Evolution.`;
        }
      } else if (attacker && attacker.speciesId !== enemy.speciesId) {
        this.setEcosystemNotice(
          `${attacker.species.name} brings down a ${enemy.species.name.toLowerCase()}.`,
          3.6,
        );
      }
      return { defeated: true, killed: true };
    }

    return { defeated: false, killed: false };
  }

  findAttackTarget() {
    let bestTarget = null;
    let bestScore = Number.POSITIVE_INFINITY;
    const forward = vectorD.set(Math.sin(this.player.yaw), 0, Math.cos(this.player.yaw));

    this.enemies.forEach((enemy) => {
      if (enemy.deadTimer > 0) {
        return;
      }

      vectorA.subVectors(enemy.group.position, this.player.group.position).setY(0);
      const distance = vectorA.length();
      const range = Math.max(this.playerStats.attackReach + 0.4, enemy.type === "predator" ? 5.4 : 4.7);
      if (distance >= range) {
        return;
      }

      if (distance > 0.001) {
        vectorA.divideScalar(distance);
      }

      const alignment = vectorA.dot(forward);
      const score = distance + (1 - alignment) * 1.35;
      if (score >= bestScore) {
        return;
      }

      bestScore = score;
      bestTarget = enemy;
    });

    return bestTarget;
  }

  triggerAttack() {
    if (this.player.attackCooldown > 0 || this.state.mode !== "playing" || this.player.attackPhase !== "idle" || this.state.editorOpen) {
      return;
    }

    this.clearSocialEncounter();
    this.player.attackTimer = ATTACK_DURATION;
    this.player.attackCooldown = this.playerStats.biteCooldown;
    this.player.attackPhase = "windup";
    this.player.attackPhaseTimer = ATTACK_WINDUP_DURATION;
    this.player.attackLungeTimer = 0;
    this.player.attackResolved = false;
    this.player.attackDidConnect = false;
    this.player.attackResult = "snap";
    this.player.attackResultTimer = 0.18;
    this.player.attackRecoil = Math.max(this.player.attackRecoil, 0.52);
    this.player.attackImpact = 0;
    this.player.impulseVelocity.multiplyScalar(0.76);
    this.cameraFovKick = Math.max(this.cameraFovKick, 1.45);
    this.player.attackSwingId += 1;

    const lockedTarget = this.findAttackTarget();
    if (lockedTarget) {
      vectorA.subVectors(lockedTarget.group.position, this.player.group.position).setY(0);
      if (vectorA.lengthSq() > 0.0001) {
        vectorA.normalize();
        this.player.attackDirection.copy(vectorA);
        this.player.yaw = Math.atan2(vectorA.x, vectorA.z);
      }
    } else {
      this.player.attackDirection.set(Math.sin(this.player.yaw), 0, Math.cos(this.player.yaw));
    }
  }

  resolvePlayerAttack() {
    const forward = vectorD.copy(this.player.attackDirection);
    if (forward.lengthSq() <= 0.0001) {
      forward.set(Math.sin(this.player.yaw), 0, Math.cos(this.player.yaw));
    } else {
      forward.normalize();
    }
    const playerPosition = this.player.group.position;
    const biteReachBonus = this.state.upgrades.jaw * 0.12 + this.state.upgrades.horns * 0.05;
    const biteRange = this.playerStats.attackReach + (this.state.upgrades.horns > 0 ? 0.1 : 0);
    const biteWidth = 1.38 + this.state.upgrades.jaw * 0.09 + this.state.upgrades.horns * 0.08;
    const mouthPosition = playerPosition.clone().addScaledVector(forward, 2.2 + biteReachBonus);

    this.spawnAttackArc(mouthPosition, this.player.yaw, {
      color: 0xffe1b0,
      ttl: 0.2,
      size: 1.08 + this.state.upgrades.jaw * 0.1 + this.state.upgrades.horns * 0.06,
    });
    this.spawnBurst(mouthPosition, {
      color: 0xffcb8f,
      ttl: 0.2,
      size: 0.82 + this.state.upgrades.jaw * 0.05,
      shards: 6,
      rise: 0.12,
    });
    this.spawnGroundDust(mouthPosition, {
      color: 0xcf9f73,
      ttl: 0.18,
      size: 0.78 + this.state.upgrades.tail * 0.05,
      shards: 4,
    });

    let hitCount = 0;
    let killedTarget = false;

    this.enemies.forEach((enemy) => {
      if (enemy.deadTimer > 0) {
        return;
      }

      vectorA.subVectors(enemy.group.position, playerPosition);
      const horizontalDistance = Math.hypot(vectorA.x, vectorA.z);
      const range = enemy.type === "predator" ? biteRange + 0.62 : biteRange;
      if (horizontalDistance > range + 0.85 || horizontalDistance <= 0.0001) {
        return;
      }

      vectorA.y = 0;
      const forwardDistance = vectorA.dot(forward);
      if (forwardDistance <= 0.35 || forwardDistance > range + 0.7) {
        return;
      }
      const lateralDistance = Math.abs(vectorA.x * forward.z - vectorA.z * forward.x);
      const lateralAllowance = biteWidth + Math.max(0, forwardDistance - 2.1) * 0.16 + (enemy.type === "predator" ? 0.18 : 0);
      if (lateralDistance > lateralAllowance) {
        return;
      }

      const massRatio = clamp(this.playerStats.mass / Math.max(0.7, enemy.mass), 0.58, 1.65);
      const impactStrength = (enemy.type === "predator" ? 5.6 : enemy.type === "herbivore" ? 8.8 : 7.9)
        * this.playerStats.knockback
        * massRatio
        * (this.player.terrain.attackFactor ?? 1);
      enemy.velocity.addScaledVector(vectorC.copy(forward), impactStrength / Math.max(0.85, enemy.mass));
      this.player.impulseVelocity.addScaledVector(
        forward,
        this.playerStats.attackCarry * (this.player.terrain.attackFactor ?? 1) * (enemy.type === "predator" ? 0.08 : 0.16),
      );
      if (enemy.type === "predator") {
        this.player.impulseVelocity.addScaledVector(forward, -enemy.mass * 0.16);
      }
      const result = this.damageEnemy(enemy, this.playerStats.biteDamage, forward);
      hitCount += 1;
      killedTarget = killedTarget || result.killed;
    });

    if (hitCount > 0) {
      this.player.attackDidConnect = true;
      this.player.attackResult = killedTarget ? "kill" : "hit";
      this.player.attackResultTimer = killedTarget ? 0.34 : 0.26;
      this.cameraShake = Math.max(this.cameraShake, killedTarget ? 0.22 : 0.12);
      return;
    }

    let nestHit = false;
    this.ecosystem.nests.forEach((nest) => {
      if (nestHit || nest.destroyed) {
        return;
      }

      vectorA.subVectors(nest.group.position, playerPosition);
      const horizontalDistance = Math.hypot(vectorA.x, vectorA.z);
      if (horizontalDistance > NEST_ATTACK_RANGE) {
        return;
      }

      vectorA.y = 0;
      if (vectorA.lengthSq() <= 0.0001) {
        return;
      }
      vectorA.normalize();
      if (vectorA.dot(forward) < 0.05) {
        return;
      }

      nestHit = this.damageNest(nest, this.playerStats.biteDamage * 0.82);
    });

    if (nestHit) {
      this.player.attackDidConnect = true;
      this.player.attackResult = "hit";
      this.player.attackResultTimer = 0.24;
      this.player.attackImpact = Math.max(this.player.attackImpact, 0.46);
      this.setImpactPause(0.05, 1.8, 0.1);
      return;
    }

    this.player.attackResult = "miss";
    this.player.attackResultTimer = 0.2;
    this.player.attackImpact = Math.max(this.player.attackImpact, 0.28);
    this.player.impulseVelocity.addScaledVector(forward, this.playerStats.attackCarry * 0.12);
    this.spawnBurst(mouthPosition.clone().setY(getTerrainHeight(mouthPosition.x, mouthPosition.z) + 0.28), {
      color: 0xe6c49c,
      ttl: 0.16,
      size: 0.5,
      shards: 3,
      ring: false,
      rise: 0.04,
    });
  }

  resolvePlayerBodyCollisions() {
    const playerPosition = this.player.group.position;
    const playerMass = this.playerStats.mass;
    const playerRadius = this.playerStats.collisionRadius;

    this.enemies.forEach((enemy) => {
      if (enemy.deadTimer > 0) {
        return;
      }

      vectorA.subVectors(enemy.group.position, playerPosition).setY(0);
      const distance = vectorA.length();
      const minimumDistance = playerRadius + enemy.collisionRadius;
      if (distance <= 0.0001 || distance >= minimumDistance) {
        return;
      }

      vectorA.divideScalar(distance);
      const overlap = minimumDistance - distance;
      const totalMass = playerMass + enemy.mass;
      const playerPush = overlap * (enemy.mass / totalMass) * 0.55;
      const enemyPush = overlap * (playerMass / totalMass) * 0.82;

      playerPosition.addScaledVector(vectorA, -playerPush);
      enemy.group.position.addScaledVector(vectorA, enemyPush);
      enemy.group.position.y = getTerrainHeight(enemy.group.position.x, enemy.group.position.z) + enemy.spec.yOffset;

      const closingSpeed = Math.max(0, this.player.velocity.dot(vectorA) - enemy.velocity.dot(vectorA));
      if (closingSpeed > 4.2) {
        const shove = Math.min(7.2, closingSpeed * 0.55 + overlap * 3);
        enemy.velocity.addScaledVector(vectorA, shove * this.playerStats.bodyPush / (enemy.mass * 6.8));
        this.player.impulseVelocity.addScaledVector(vectorA, -shove / (playerMass * 11.5));
        enemy.hitDirection.copy(vectorA);
        enemy.impactPulse = Math.max(enemy.impactPulse, 0.24);
        enemy.recoilLift = Math.max(enemy.recoilLift, enemy.type === "predator" ? 0.16 : 0.28);
        if (this.player.isSprinting && enemy.type !== "predator") {
          enemy.staggerTimer = Math.max(enemy.staggerTimer, 0.08);
        }
      }

      enemy.group.position.x = clamp(enemy.group.position.x, -WORLD_RADIUS + 2, WORLD_RADIUS - 2);
      enemy.group.position.z = clamp(enemy.group.position.z, -WORLD_RADIUS + 2, WORLD_RADIUS - 2);
    });

    playerPosition.x = clamp(playerPosition.x, -WORLD_RADIUS + 2, WORLD_RADIUS - 2);
    playerPosition.z = clamp(playerPosition.z, -WORLD_RADIUS + 2, WORLD_RADIUS - 2);
    playerPosition.y = getTerrainHeight(playerPosition.x, playerPosition.z) + PLAYER_HEIGHT + this.player.attackRecoil * 0.14 + this.surge.pulse * 0.05;
  }

  updateFood(dt) {
    this.foods.forEach((food) => {
      if (!food.active) {
        food.respawnTimer -= dt;
        if (food.respawnTimer <= 0) {
          food.active = true;
          food.group.visible = true;
        }
        return;
      }

      food.bobPhase += dt * 2.2;
      food.group.rotation.y += dt * 1.25;
      food.group.position.y = food.group.userData.baseY + Math.sin(food.bobPhase) * 0.22;

      const distance = getDistance2D(this.player.group.position, food.group.position);
      if (distance < 2.4) {
        food.active = false;
        food.respawnTimer = food.spawn.rare ? 16 : 11;
        food.group.visible = false;
        this.player.health = Math.min(this.player.maxHealth, this.player.health + (food.spawn.rare ? 10 : 5));
        this.player.sprintCharge = clamp(this.player.sprintCharge + (food.spawn.rare ? 0.42 : 0.16), 0, 1);
        this.player.pickupPulse = 1;
        this.awardDNA(
          food.spawn.dna,
          food.spawn.rare
            ? `You crack a rare nutrient bloom and surge with fresh momentum.`
            : `You absorb ${food.spawn.dna} DNA from a nutrient bloom.`,
          {
            position: food.group.position,
            source: food.spawn.rare ? "rareFood" : "food",
          },
        );
      }
    });
  }

  updateEnemies(dt) {
    const livingEnemies = this.enemies.filter((enemy) => enemy.deadTimer <= 0 && enemy.group.visible);
    const enemyById = new Map(livingEnemies.map((enemy) => [enemy.group.userData.enemyId, enemy]));
    const packMap = new Map();
    const playerInNest = this.state.zone === "nest";
    const playerVulnerable = this.player.health <= this.player.maxHealth * 0.68 || this.state.dna >= 10;
    const intimidationPressure = this.playerStats.intimidation + (this.player.evolutionTimer > 0 ? 0.05 : 0);
    const playerTerritory = this.currentTerritory ?? this.getCurrentTerritoryForPosition(this.player.group.position);

    livingEnemies.forEach((enemy) => {
      const packId = enemy.packId ?? enemy.group.userData.enemyId;
      if (!packMap.has(packId)) {
        packMap.set(packId, []);
      }
      packMap.get(packId).push(enemy);
    });

    packMap.forEach((members) => {
      const leader = members.find((member) => member.isLeader) ?? members[0];
      members.forEach((member) => {
        member.isLeader = member === leader;
        member.leaderId = leader.group.userData.enemyId;
      });
    });

    this.enemies.forEach((enemy) => {
      if (enemy.deadTimer > 0) {
        enemy.deadTimer = Math.max(0, enemy.deadTimer - dt);
        return;
      }

      if (!enemy.group.visible) {
        if (enemy.temporary) {
          return;
        }
        const nest = this.getNestForSpecies(enemy.speciesId);
        if (nest && !nest.destroyed && nest.respawnTimer <= 0 && this.respawnEnemy(enemy)) {
          nest.respawnTimer = enemy.species.respawnDelay * (0.72 + Math.random() * 0.56);
        }
        return;
      }

      const territory = this.getTerritoryForSpecies(enemy.speciesId);
      const nest = this.getNestForSpecies(enemy.speciesId);
      const relation = this.getSpeciesRelation(enemy.speciesId);
      const speciesFriendlyToPlayer = relation?.status === "friendly";
      const speciesHostileToPlayer = relation?.status === "hostile";
      const packMembers = packMap.get(enemy.packId) ?? [enemy];
      const leader = enemy.isLeader
        ? enemy
        : enemyById.get(enemy.leaderId) ?? packMembers[0] ?? enemy;
      const leaderTarget = leader !== enemy && leader?.attackTargetKind === "creature"
        ? enemyById.get(leader.attackTargetId) ?? null
        : null;
      const leaderCarcass = leader !== enemy && leader?.targetCarcassId
        ? this.carcasses.find((carcass) => carcass.id === leader.targetCarcassId) ?? null
        : null;
      const position = enemy.group.position;
      const toPlayer = vectorA.subVectors(this.player.group.position, position).setY(0);
      const distanceToPlayer = toPlayer.length();
      const distanceToHome = getDistance2D(position, enemy.home);
      const telegraphDuration = enemy.variant === "hornedPredator"
        ? 0.62
        : enemy.variant === "armoredScavenger"
          ? 0.38
          : enemy.type === "predator"
            ? 0.55
            : enemy.type === "herbivore"
              ? 0.28
              : 0.34;
      const playerInsideTerritory = Boolean(playerTerritory && playerTerritory.speciesId === enemy.speciesId);
      const migrationActive = this.ecosystem.activeEvent?.speciesId === enemy.speciesId && enemy.migrationGoal;
      const homeLimit = (territory?.radius ?? enemy.spec.leashRadius) + enemy.spec.leashRadius * 0.28;

      enemy.cooldown = Math.max(0, enemy.cooldown - dt);
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      enemy.impactPulse = Math.max(0, enemy.impactPulse - dt * 3.4);
      enemy.staggerTimer = Math.max(0, enemy.staggerTimer - dt);
      enemy.fleeTimer = Math.max(0, enemy.fleeTimer - dt);
      enemy.threatGlow = Math.max(0, enemy.threatGlow - dt * 2.5);
      enemy.recoilLift = Math.max(0, enemy.recoilLift - dt * 3.8);
      enemy.recoilTilt = Math.max(0, enemy.recoilTilt - dt * 4.6);
      enemy.socialPulse = Math.max(0, enemy.socialPulse - dt * 2.2);
      enemy.interactionCooldown = Math.max(0, enemy.interactionCooldown - dt);
      enemy.grazeTimer = Math.max(0, enemy.grazeTimer - dt);
      enemy.territoryAlert = Math.max(0, enemy.territoryAlert - dt * 0.42);
      enemy.bob += dt * (enemy.type === "predator" ? 7 : enemy.type === "herbivore" ? 5 : 5.7);
      enemy.roamTimer -= dt;
      enemy.hunger = clamp(
        enemy.hunger + dt * (enemy.type === "predator" ? 0.05 : enemy.type === "scavenger" ? 0.042 : 0.036) - enemy.grazeTimer * dt * 0.28,
        0,
        1,
      );
      enemy.rest = clamp(
        enemy.rest + dt * (enemy.velocity.length() > enemy.spec.speed * 0.45 ? 0.09 : 0.032) - (distanceToHome < (territory?.radius ?? 10) * 0.45 ? dt * 0.05 : 0),
        0,
        1,
      );

      if (playerInsideTerritory && !playerInNest && !speciesFriendlyToPlayer && distanceToPlayer < (territory?.radius ?? 12) + 5) {
        enemy.territoryAlert = Math.max(enemy.territoryAlert, enemy.type === "herbivore" ? 0.44 : 0.78);
      }
      if (nest?.alert > 0) {
        enemy.territoryAlert = Math.max(enemy.territoryAlert, nest.alert);
      }
      if (speciesHostileToPlayer && !playerInNest) {
        enemy.territoryAlert = Math.max(enemy.territoryAlert, enemy.type === "predator" ? 0.48 : 0.28);
      }

      if (enemy.targetCreatureId && !enemyById.has(enemy.targetCreatureId)) {
        enemy.targetCreatureId = null;
      }
      if (enemy.attackTargetKind === "creature" && enemy.attackTargetId && !enemyById.has(enemy.attackTargetId)) {
        enemy.attackTargetId = null;
      }
      if (enemy.targetFoodId && !this.foods.some((food) => food.id === enemy.targetFoodId && food.active)) {
        enemy.targetFoodId = null;
      }
      if (enemy.targetCarcassId && !this.carcasses.some((carcass) => carcass.id === enemy.targetCarcassId)) {
        enemy.targetCarcassId = null;
      }
      if (enemy.roamTimer <= 0) {
        enemy.roamTimer = 1.2 + Math.random() * 2.4;
        enemy.direction.set(Math.sin(enemy.bob * 0.4), 0, Math.cos(enemy.bob * 0.6)).normalize();
      }

      let desiredDirection = vectorB.set(0, 0, 0);
      let desiredSpeed = 0;
      let nextNeed = enemy.need;
      let targetKind = null;
      let targetEnemy = null;
      let targetPoint = null;

      const predatorThreat = enemy.type !== "predator"
        ? this.getClosestCreatureTarget(
          enemy,
          (other) => other.type === "predator" && other.speciesId !== enemy.speciesId,
          enemy.type === "herbivore" ? 13.5 : 10.5,
        )
        : null;
      const territoryIntruder = territory
        ? this.getClosestCreatureTarget(
          enemy,
          (other) => other.speciesId !== enemy.speciesId && Math.hypot(other.group.position.x - territory.x, other.group.position.z - territory.z) < territory.radius + 3,
          territory.radius + 6,
        )
        : null;
      const preyTarget = enemy.type === "predator"
        ? this.getClosestCreatureTarget(
          enemy,
          (other) => other.speciesId !== enemy.speciesId && (other.type === "herbivore" || enemy.hunger > 0.6 || other.hp < other.maxHp * 0.75),
          migrationActive ? 18 : 15,
        )
        : null;
      const carcassTarget = enemy.type !== "herbivore"
        ? this.getClosestCarcassTarget(
          enemy,
          enemy.type === "predator" ? 9.5 : 14,
          (carcass) => carcass.speciesId !== enemy.speciesId || enemy.type === "scavenger",
        )
        : null;
      const foodTarget = enemy.type !== "predator"
        ? this.getClosestFoodTarget(enemy, enemy.type === "herbivore" ? 15 : 11)
        : null;

      if (enemy.staggerTimer > 0) {
        enemy.state = enemy.type === "predator" ? "braced" : "staggered";
        nextNeed = enemy.type === "predator" ? "defending" : "fleeing";
        desiredDirection = enemy.hitDirection.lengthSq() > 0.001
          ? vectorB.copy(enemy.hitDirection)
          : vectorB.subVectors(position, this.player.group.position).setY(0);
        desiredSpeed = enemy.spec.speed * (enemy.type === "predator" ? 0.2 : enemy.type === "herbivore" ? 0.4 : enemy.variant === "armoredScavenger" ? 0.24 : 0.34);
      } else if (enemy.attackTelegraph > 0) {
        enemy.state = enemy.type === "predator" ? "winding up" : enemy.type === "herbivore" ? "bracing" : "feinting";
        const previousTelegraph = enemy.attackTelegraph;
        const telegraphCancelled = enemy.attackTargetKind === "player" && speciesFriendlyToPlayer;
        enemy.attackTelegraph = Math.max(0, enemy.attackTelegraph - dt);

        let strikeTargetPosition = null;
        let strikeTarget = null;
        if (enemy.attackTargetKind === "creature") {
          strikeTarget = enemyById.get(enemy.attackTargetId) ?? null;
          strikeTargetPosition = strikeTarget?.group.position ?? null;
        } else if (!playerInNest) {
          strikeTargetPosition = this.player.group.position;
        }

        if (telegraphCancelled) {
          enemy.attackTelegraph = 0;
          enemy.attackTargetId = null;
        } else if (strikeTargetPosition) {
          enemy.attackVector.copy(vectorC.subVectors(strikeTargetPosition, position).setY(0));
          if (enemy.attackVector.lengthSq() > 0.0001) {
            enemy.attackVector.normalize();
          }
          desiredDirection = enemy.attackVector;
          desiredSpeed = enemy.spec.speed * (enemy.variant === "hornedPredator" ? 0.24 : enemy.type === "predator" ? 0.2 : 0.14);
        } else {
          enemy.attackTelegraph = 0;
        }

        if (!telegraphCancelled && enemy.attackTelegraph <= 0 && previousTelegraph > 0) {
          const lungeSpeed = enemy.variant === "hornedPredator" ? 8.3 : enemy.type === "predator" ? 7.4 : enemy.type === "herbivore" ? 4.8 : 5.2;
          enemy.velocity.addScaledVector(enemy.attackVector, lungeSpeed);

          if (enemy.attackTargetKind === "player") {
            if (!playerInNest && distanceToPlayer <= enemy.spec.attackRange + (enemy.type === "predator" ? 0.9 : 0.55) && this.state.respawnTimer <= 0) {
              this.damagePlayer(enemy.spec.damage, enemy.attackVector);
            }
          } else if (strikeTarget) {
            const strikeDistance = getDistance2D(position, strikeTarget.group.position);
            if (strikeDistance <= enemy.spec.attackRange + (enemy.type === "predator" ? 1 : 0.65)) {
              strikeTarget.velocity.addScaledVector(enemy.attackVector, enemy.type === "predator" ? 4.8 : enemy.type === "herbivore" ? 3.1 : 3.8);
              this.damageEnemy(strikeTarget, enemy.spec.damage, enemy.attackVector, {
                sourceKind: "creature",
                attacker: enemy,
              });
            }
          }
          enemy.cooldown = enemy.variant === "hornedPredator" ? 1.5 : enemy.type === "predator" ? 1.65 : enemy.type === "herbivore" ? 1.05 : 1.2;
          enemy.threatGlow = 1;
        }
      } else {
        if (migrationActive) {
          nextNeed = "migrating";
          targetPoint = enemy.migrationGoal;
          enemy.state = "migrating";
        }

        if (enemy.type === "herbivore") {
          if (speciesFriendlyToPlayer && !migrationActive && !playerInNest && distanceToPlayer < 8.4) {
            nextNeed = "patrolling";
            enemy.state = "gathering";
            const escortAngle = this.elapsed * 0.88 + enemy.groupIndex * Math.PI * 0.82;
            targetPoint = {
              x: this.player.group.position.x + Math.cos(escortAngle) * 3.1,
              z: this.player.group.position.z + Math.sin(escortAngle) * 2.4,
            };
            desiredSpeed = enemy.spec.speed * 0.42;
          } else {
          const playerThreat = !playerInNest && !speciesFriendlyToPlayer && distanceToPlayer < 7.2 && (playerInsideTerritory || intimidationPressure > 0.1 || this.state.zone === "danger");
          const shouldFlee = Boolean(predatorThreat && predatorThreat.distance < 11.5) || playerThreat || enemy.hp < enemy.maxHp * 0.55 || enemy.fleeTimer > 0;
          if (shouldFlee) {
            nextNeed = "fleeing";
            enemy.state = "skittering";
            if (predatorThreat && predatorThreat.distance < 11.5) {
              desiredDirection = vectorB.subVectors(position, predatorThreat.enemy.group.position).setY(0);
              enemy.targetCreatureId = predatorThreat.enemy.group.userData.enemyId;
            } else {
              desiredDirection = vectorB.subVectors(position, this.player.group.position).setY(0);
              enemy.targetCreatureId = null;
            }
            desiredSpeed = enemy.spec.speed * 1.16;
          } else if (migrationActive) {
            nextNeed = "migrating";
            targetPoint = enemy.migrationGoal;
            enemy.state = "migrating";
            desiredSpeed = enemy.spec.speed * 0.94;
          } else if (foodTarget && (enemy.hunger > 0.3 || enemy.grazeTimer > 0.01)) {
            nextNeed = "foraging";
            targetPoint = foodTarget.food.group.position;
            enemy.targetFoodId = foodTarget.food.id;
            if (foodTarget.distance <= 1.65) {
              enemy.state = "grazing";
              enemy.grazeTimer = Math.max(enemy.grazeTimer, 0.55);
              enemy.hunger = Math.max(0, enemy.hunger - dt * 1.25);
              desiredSpeed = enemy.spec.speed * 0.08;
            } else {
              enemy.state = "foraging";
              desiredSpeed = enemy.spec.speed * 0.62;
            }
          } else if (!enemy.isLeader && leader && leader !== enemy) {
            nextNeed = leader.need === "migrating" ? "migrating" : "patrolling";
            const followAngle = this.elapsed * 0.9 + enemy.groupIndex * Math.PI * 0.78;
            targetPoint = {
              x: leader.group.position.x + Math.cos(followAngle) * 2.1,
              z: leader.group.position.z + Math.sin(followAngle) * 1.7,
            };
            enemy.state = nextNeed === "migrating" ? "migrating" : "following";
            desiredSpeed = enemy.spec.speed * (nextNeed === "migrating" ? 0.92 : 0.56);
          } else if (enemy.rest > 0.72 && distanceToHome < (territory?.radius ?? 12) * 0.52) {
            nextNeed = "resting";
            targetPoint = enemy.home;
            enemy.state = "resting";
            desiredSpeed = enemy.spec.speed * 0.16;
          } else if (!migrationActive) {
            nextNeed = "patrolling";
            enemy.state = "patrolling";
            desiredDirection = enemy.direction;
            desiredSpeed = enemy.spec.speed * 0.48;
          }
          }
        } else if (enemy.type === "scavenger") {
          const guardPredator = carcassTarget?.carcass.guardedBy ? enemyById.get(carcassTarget.carcass.guardedBy) ?? null : null;
          const predatorPressure = predatorThreat && predatorThreat.distance < (enemy.variant === "armoredScavenger" ? 5.1 : 6.2);
          const shouldFlee = enemy.variant !== "armoredScavenger"
            && (enemy.hp < enemy.maxHp * 0.45 || enemy.fleeTimer > 0 || predatorPressure || (!speciesFriendlyToPlayer && intimidationPressure > 0.16 && distanceToPlayer < 6.2));

          if (speciesFriendlyToPlayer && !migrationActive && !playerInNest && distanceToPlayer < 7.4) {
            nextNeed = "patrolling";
            enemy.state = "shadowing";
            const escortAngle = this.elapsed * 0.82 + enemy.groupIndex * Math.PI * 0.9;
            targetPoint = {
              x: this.player.group.position.x + Math.cos(escortAngle) * 3.4,
              z: this.player.group.position.z + Math.sin(escortAngle) * 2.8,
            };
            desiredSpeed = enemy.spec.speed * (enemy.variant === "armoredScavenger" ? 0.36 : 0.44);
          } else if (shouldFlee) {
            nextNeed = "fleeing";
            enemy.state = "fleeing";
            if (predatorThreat && predatorThreat.distance < 6.8) {
              desiredDirection = vectorB.subVectors(position, predatorThreat.enemy.group.position).setY(0);
              enemy.targetCreatureId = predatorThreat.enemy.group.userData.enemyId;
            } else {
              desiredDirection = vectorB.subVectors(position, this.player.group.position).setY(0);
              enemy.targetCreatureId = null;
            }
            desiredSpeed = enemy.spec.speed * 1.12;
          } else if (migrationActive) {
            nextNeed = "migrating";
            targetPoint = enemy.migrationGoal;
            enemy.state = "migrating";
            desiredSpeed = enemy.spec.speed * 0.9;
          } else if (carcassTarget && (enemy.hunger > 0.28 || carcassTarget.distance < 6 || enemy.territoryAlert > 0.2)) {
            nextNeed = "scavenging";
            targetPoint = carcassTarget.carcass.group.position;
            enemy.targetCarcassId = carcassTarget.carcass.id;
            if (carcassTarget.distance <= 1.8) {
              carcassTarget.carcass.beingScavenged = true;
              carcassTarget.carcass.ttl = Math.max(0.4, carcassTarget.carcass.ttl - dt * 2.1);
              enemy.hunger = Math.max(0, enemy.hunger - dt * 1.15);
              enemy.rest = Math.max(0, enemy.rest - dt * 0.1);
              enemy.state = guardPredator ? "stealing" : "feeding";
              desiredSpeed = enemy.spec.speed * 0.12;
            } else if (guardPredator && getDistance2D(guardPredator.group.position, carcassTarget.carcass.group.position) < 5.2) {
              nextNeed = "stealing";
              enemy.state = enemy.variant === "armoredScavenger" ? "pressing" : "circling";
              targetKind = "creature";
              targetEnemy = guardPredator;
            } else {
              enemy.state = "scavenging";
              desiredSpeed = enemy.spec.speed * (enemy.variant === "armoredScavenger" ? 0.68 : 0.8);
            }
          } else if (!playerInNest && !speciesFriendlyToPlayer && (playerInsideTerritory || (distanceToPlayer < enemy.spec.aggroRadius && (playerVulnerable || enemy.territoryAlert > 0.45 || this.state.zone === "danger" || speciesHostileToPlayer)))) {
            nextNeed = "defending";
            targetKind = "player";
            enemy.state = "harassing";
          } else if (territoryIntruder && enemy.interactionCooldown <= 0) {
            nextNeed = "defending";
            targetKind = "creature";
            targetEnemy = territoryIntruder.enemy;
            enemy.state = "bracing";
          } else if (!enemy.isLeader && leader && leader !== enemy) {
            if (leaderTarget) {
              nextNeed = "defending";
              targetKind = "creature";
              targetEnemy = leaderTarget;
              enemy.state = "circling";
            } else if (leaderCarcass) {
              nextNeed = "scavenging";
              targetPoint = leaderCarcass.group.position;
              enemy.targetCarcassId = leaderCarcass.id;
              enemy.state = "scavenging";
              desiredSpeed = enemy.spec.speed * 0.72;
            } else {
              nextNeed = leader.need === "migrating" ? "migrating" : "patrolling";
              const followAngle = this.elapsed * 0.82 + enemy.groupIndex * Math.PI * 0.85;
              targetPoint = {
                x: leader.group.position.x + Math.cos(followAngle) * 2.4,
                z: leader.group.position.z + Math.sin(followAngle) * 2,
              };
              enemy.state = nextNeed === "migrating" ? "migrating" : "following";
              desiredSpeed = enemy.spec.speed * (nextNeed === "migrating" ? 0.9 : 0.62);
            }
          } else if (enemy.rest > 0.76 && distanceToHome < (territory?.radius ?? 12) * 0.5) {
            nextNeed = "resting";
            targetPoint = enemy.home;
            enemy.state = "resting";
            desiredSpeed = enemy.spec.speed * 0.18;
          } else if (!migrationActive) {
            nextNeed = "patrolling";
            enemy.state = "patrolling";
            desiredDirection = enemy.direction;
            desiredSpeed = enemy.spec.speed * 0.46;
          }
        } else {
          if (speciesFriendlyToPlayer && !migrationActive && !playerInNest && distanceToPlayer < 9.2) {
            nextNeed = "patrolling";
            enemy.state = "watching";
            const escortAngle = this.elapsed * 0.68 + enemy.groupIndex * Math.PI * 0.74;
            targetPoint = {
              x: this.player.group.position.x + Math.cos(escortAngle) * 4.1,
              z: this.player.group.position.z + Math.sin(escortAngle) * 3.3,
            };
            desiredSpeed = enemy.spec.speed * 0.34;
          } else if (!playerInNest && !speciesFriendlyToPlayer && playerInsideTerritory) {
            nextNeed = "defending";
            targetKind = "player";
            enemy.state = "territorial";
          } else if (migrationActive) {
            nextNeed = "migrating";
            targetPoint = enemy.migrationGoal;
            enemy.state = "migrating";
            desiredSpeed = enemy.spec.speed * 0.96;
          } else if (territoryIntruder && (enemy.territoryAlert > 0.24 || enemy.hunger > 0.22 || nest?.alert > 0.2)) {
            nextNeed = "defending";
            targetKind = "creature";
            targetEnemy = territoryIntruder.enemy;
            enemy.state = "territorial";
          } else if (leaderTarget) {
            nextNeed = "hunting";
            targetKind = "creature";
            targetEnemy = leaderTarget;
            enemy.state = "stalking";
          } else if (preyTarget && (enemy.hunger > 0.2 || migrationActive || preyTarget.enemy.hp < preyTarget.enemy.maxHp * 0.82)) {
            nextNeed = "hunting";
            targetKind = "creature";
            targetEnemy = preyTarget.enemy;
            enemy.state = "hunting";
          } else if (!playerInNest && !speciesFriendlyToPlayer && distanceToPlayer < enemy.spec.aggroRadius && (this.state.zone === "danger" || playerVulnerable || enemy.territoryAlert > 0.42 || speciesHostileToPlayer)) {
            nextNeed = "hunting";
            targetKind = "player";
            enemy.state = "chasing";
          } else if (!enemy.isLeader && leader && leader !== enemy) {
            nextNeed = leader.need === "migrating" ? "migrating" : "patrolling";
            const followAngle = this.elapsed * 0.78 + enemy.groupIndex * Math.PI * 0.8;
            targetPoint = {
              x: leader.group.position.x + Math.cos(followAngle) * 2.9,
              z: leader.group.position.z + Math.sin(followAngle) * 2.5,
            };
            enemy.state = nextNeed === "migrating" ? "migrating" : "following";
            desiredSpeed = enemy.spec.speed * (nextNeed === "migrating" ? 0.94 : 0.68);
          } else if (enemy.rest > 0.84 && distanceToHome < (territory?.radius ?? 12) * 0.42) {
            nextNeed = "resting";
            targetPoint = enemy.home;
            enemy.state = "resting";
            desiredSpeed = enemy.spec.speed * 0.16;
          } else if (!migrationActive) {
            nextNeed = "patrolling";
            enemy.state = "patrolling";
            desiredDirection = enemy.direction;
            desiredSpeed = enemy.spec.speed * 0.44;
          }
        }

        if (targetKind === "player") {
          desiredDirection = vectorB.subVectors(this.player.group.position, position).setY(0);
          const closeDistance = distanceToPlayer;
          if (enemy.type === "predator") {
            if (closeDistance > 5.6) {
              desiredSpeed = enemy.spec.speed * (enemy.variant === "hornedPredator" ? 1.08 : 1.02);
            } else {
              desiredDirection.crossVectors(desiredDirection.normalize(), upVector).multiplyScalar(enemy.circleSign);
              desiredDirection.addScaledVector(vectorC.subVectors(this.player.group.position, position).setY(0).normalize(), 0.45);
              desiredSpeed = enemy.spec.speed * (enemy.variant === "hornedPredator" ? 0.88 : 0.8);
              enemy.state = enemy.variant === "hornedPredator" ? "goring" : "stalking";
            }
          } else {
            if (closeDistance > 4.5) {
              desiredSpeed = enemy.spec.speed * (enemy.variant === "armoredScavenger" ? 0.84 : 0.96);
            } else {
              desiredDirection.crossVectors(desiredDirection.normalize(), upVector).multiplyScalar(enemy.circleSign);
              desiredSpeed = enemy.spec.speed * (enemy.variant === "armoredScavenger" ? 0.64 : 0.86);
              enemy.state = enemy.variant === "armoredScavenger" ? "pressing" : "circling";
            }
          }

          if (!playerInNest && enemy.cooldown <= 0 && closeDistance <= enemy.spec.attackRange + (enemy.type === "predator" ? 1.1 : 0.75)) {
            enemy.attackTelegraph = telegraphDuration;
            enemy.attackVector.copy(toPlayer.lengthSq() > 0.0001 ? toPlayer.normalize() : enemy.direction);
            enemy.attackTargetKind = "player";
            enemy.attackTargetId = null;
            enemy.state = enemy.type === "predator" ? "coiling" : "snapping";
            enemy.threatGlow = 1;
          }
        } else if (targetKind === "creature" && targetEnemy) {
          const toTarget = vectorB.subVectors(targetEnemy.group.position, position).setY(0);
          const targetDistance = toTarget.length();
          if (targetDistance > 0.0001) {
            toTarget.normalize();
          }

          desiredDirection = toTarget;
          if (enemy.type === "predator") {
            if (targetDistance > 5.4) {
              desiredSpeed = enemy.spec.speed * (enemy.variant === "hornedPredator" ? 1.05 : 0.98);
            } else {
              desiredDirection.crossVectors(toTarget, upVector).multiplyScalar(enemy.circleSign);
              desiredDirection.addScaledVector(vectorC.subVectors(targetEnemy.group.position, position).setY(0).normalize(), 0.42);
              desiredSpeed = enemy.spec.speed * (enemy.variant === "hornedPredator" ? 0.9 : 0.78);
              enemy.state = "stalking";
            }
          } else if (enemy.type === "scavenger") {
            desiredSpeed = enemy.spec.speed * (enemy.variant === "armoredScavenger" ? 0.74 : 0.84);
            if (targetDistance < 4.2) {
              desiredDirection.crossVectors(toTarget, upVector).multiplyScalar(enemy.circleSign);
              desiredDirection.addScaledVector(vectorC.subVectors(targetEnemy.group.position, position).setY(0).normalize(), 0.36);
              enemy.state = enemy.variant === "armoredScavenger" ? "pressing" : "circling";
            }
          } else {
            desiredSpeed = enemy.spec.speed * 0.92;
            if (targetDistance < 3.2) {
              desiredDirection.multiplyScalar(-1);
              enemy.state = "skittering";
              nextNeed = "fleeing";
            } else {
              enemy.state = "bracing";
            }
          }

          if (enemy.cooldown <= 0 && targetDistance <= enemy.spec.attackRange + (enemy.type === "predator" ? 1.05 : enemy.type === "herbivore" ? 0.45 : 0.7)) {
            const canCommit = enemy.type === "predator"
              || enemy.type === "scavenger"
              || enemy.hp > enemy.maxHp * 0.52
              || packMembers.length > 2;
            if (canCommit) {
              enemy.attackTelegraph = telegraphDuration;
              enemy.attackVector.copy(vectorC.subVectors(targetEnemy.group.position, position).setY(0).normalize());
              enemy.attackTargetKind = "creature";
              enemy.attackTargetId = targetEnemy.group.userData.enemyId;
              enemy.targetCreatureId = targetEnemy.group.userData.enemyId;
              enemy.state = enemy.type === "predator" ? "coiling" : enemy.type === "herbivore" ? "bracing" : "snapping";
              enemy.threatGlow = 1;
              enemy.interactionCooldown = 0.7;
            }
          }
        } else if (targetPoint) {
          desiredDirection = vectorB.subVectors(
            vectorC.set(targetPoint.x, position.y, targetPoint.z),
            position,
          ).setY(0);
          if (desiredDirection.lengthSq() > 0.0001) {
            desiredDirection.normalize();
          }
        }

        if (nextNeed !== "migrating" && nextNeed !== "hunting" && nextNeed !== "defending" && nextNeed !== "fleeing" && distanceToHome > homeLimit) {
          nextNeed = "returning";
          enemy.state = "returning";
          desiredDirection = vectorB.subVectors(enemy.home, position).setY(0);
          desiredSpeed = enemy.spec.speed * 0.92;
          targetKind = null;
          targetEnemy = null;
        }
      }

      if (desiredDirection.lengthSq() > 0.0001) {
        desiredDirection.normalize();
      }

      enemy.need = nextNeed;
      vectorC.copy(desiredDirection).multiplyScalar(desiredSpeed);
      dampVector(enemy.velocity, vectorC, 6.2, dt);
      position.addScaledVector(enemy.velocity, dt);

      position.x = clamp(position.x, -WORLD_RADIUS, WORLD_RADIUS);
      position.z = clamp(position.z, -WORLD_RADIUS, WORLD_RADIUS);
      position.y = getTerrainHeight(position.x, position.z) + enemy.spec.yOffset;

      if (enemy.velocity.lengthSq() > 0.1) {
        const yaw = Math.atan2(enemy.velocity.x, enemy.velocity.z);
        enemy.group.rotation.y = damp(enemy.group.rotation.y, yaw, 12, dt);
      }

      const gait = this.elapsed * (enemy.type === "predator" ? 10 : enemy.type === "herbivore" ? 13 : 12) + enemy.bob;
      enemy.refs.legPivots.forEach((leg, index) => {
        leg.rotation.x = Math.sin(gait + index * Math.PI * 0.9) * Math.min(0.58, enemy.velocity.length() * 0.06 + enemy.attackTelegraph * 0.45);
      });
      const telegraphStrength = enemy.attackTelegraph > 0 ? enemy.attackTelegraph / telegraphDuration : 0;
      const staggerStrength = enemy.staggerTimer > 0 ? Math.min(1, enemy.staggerTimer / (enemy.type === "predator" ? 0.18 : 0.3)) : 0;
      const friendlyAura = speciesFriendlyToPlayer ? 0.16 : 0;
      const pressureGlow = enemy.territoryAlert * 0.16 + (nextNeed === "migrating" ? 0.08 : 0) + (nextNeed === "hunting" || nextNeed === "defending" ? 0.12 : 0);
      const fleeLean = nextNeed === "fleeing" ? 0.12 : 0;
      const hitYawOffset = enemy.hitDirection.lengthSq() > 0.001
        ? normalizeAngle(Math.atan2(enemy.hitDirection.x, enemy.hitDirection.z) - enemy.group.rotation.y)
        : 0;
      const hitLateral = Math.sin(hitYawOffset) * enemy.recoilTilt;
      enemy.refs.body.position.x = hitLateral * 0.2;
      enemy.refs.body.position.y = enemy.recoilLift * (enemy.type === "predator" ? 0.08 : 0.12);
      enemy.refs.body.position.z = -telegraphStrength * 0.14 - staggerStrength * 0.18 - enemy.recoilLift * 0.2 + pressureGlow * 0.08 - fleeLean * 0.08;
      enemy.refs.back.position.x = hitLateral * 0.14;
      enemy.refs.back.position.z = -0.7 - telegraphStrength * 0.08 + staggerStrength * 0.06 - enemy.recoilLift * 0.08 + pressureGlow * 0.04;
      enemy.refs.body.rotation.x = telegraphStrength * 0.12 - enemy.recoilLift * 0.18 - fleeLean * 0.1;
      enemy.refs.body.rotation.z = hitLateral * 0.18;
      enemy.refs.back.rotation.x = telegraphStrength * 0.06 - enemy.recoilLift * 0.08;
      enemy.refs.back.rotation.z = hitLateral * 0.1;
      enemy.refs.headPivot.position.x = hitLateral * 0.2;
      enemy.refs.headPivot.rotation.x = Math.sin(gait * 0.35) * 0.08 - telegraphStrength * 0.2 - staggerStrength * 0.24 - enemy.recoilLift * 0.14 + fleeLean * 0.08;
      enemy.refs.headPivot.rotation.z = hitLateral * 0.28 + staggerStrength * 0.08;
      enemy.refs.tailGroup.rotation.x = Math.sin(gait * 0.5) * 0.18 + telegraphStrength * 0.12 + staggerStrength * 0.18 + fleeLean * 0.12 + enemy.recoilLift * 0.08;
      enemy.refs.tailGroup.rotation.z = -hitLateral * 0.14;
      enemy.refs.materials.skin.emissive.setRGB(
        enemy.hitFlash * 0.8 + telegraphStrength * 0.8 + enemy.threatGlow * 0.18 + pressureGlow * 0.55 + friendlyAura * 0.08,
        enemy.hitFlash * 0.25 + telegraphStrength * 0.2 + pressureGlow * 0.18 + enemy.socialPulse * 0.28 + friendlyAura * 0.26,
        enemy.hitFlash * 0.18 + pressureGlow * 0.12 + enemy.socialPulse * 0.44 + friendlyAura * 0.32,
      );
      enemy.refs.materials.skin.emissiveIntensity = enemy.hitFlash * 0.9 + telegraphStrength * 1.1 + enemy.threatGlow * 0.22 + pressureGlow * 0.46 + enemy.socialPulse * 0.24;
      enemy.refs.materials.accent.emissiveIntensity = enemy.baseBackGlow + telegraphStrength * 0.85 + enemy.threatGlow * 0.2 + pressureGlow * 0.32 + enemy.socialPulse * 0.36 + friendlyAura * 0.22;
      enemy.refs.materials.markings.emissiveIntensity = enemy.baseMarkingGlow + enemy.threatGlow * 0.18 + telegraphStrength * 0.12 + pressureGlow * 0.22 + enemy.socialPulse * 0.58 + friendlyAura * 0.3;
      enemy.group.scale.set(
        enemy.baseScale * (1 + enemy.impactPulse * 0.08 + pressureGlow * 0.02 + enemy.socialPulse * 0.03),
        enemy.baseScale * (1 - enemy.impactPulse * 0.06 - staggerStrength * 0.03 - fleeLean * 0.02),
        enemy.baseScale * (1 + enemy.impactPulse * 0.14 + staggerStrength * 0.05 + pressureGlow * 0.03 + enemy.socialPulse * 0.05),
      );
    });
  }

  updatePlayer(dt) {
    if (this.state.mode !== "playing") {
      return;
    }

    if (this.state.respawnTimer > 0) {
      this.state.respawnTimer -= dt;
      if (this.state.respawnTimer <= 0) {
        this.resetPlayerToNest();
      }
      return;
    }

    this.surge.timer = Math.max(0, this.surge.timer - dt * (this.state.zone === "danger" ? 0.9 : 1.08));
    this.surge.pulse = Math.max(0, this.surge.pulse - dt * 1.9);
    if (this.surge.timer <= 0.001) {
      this.surge.level = 0;
      this.surge.pulse = 0;
    }

    this.runStats.timeAlive += dt;
    this.updateSpeciesProgress(dt);
    this.player.previousVelocity.copy(this.player.velocity);
    const surgePower = this.surge.timer > 0 ? this.surge.level : 0;
    const surgeCharge = clamp(this.surge.timer / FERAL_SURGE_MAX_TIMER, 0, 1);
    const editorLocked = this.state.editorOpen;
    this.player.attackResultTimer = Math.max(0, this.player.attackResultTimer - dt);
    if (this.player.attackResultTimer <= 0 && this.player.attackPhase === "idle") {
      this.player.attackResult = this.player.attackCooldown > 0 ? "cooldown" : "ready";
    }

    const digitalForward = Number(this.input.forward || this.virtualInput.forward) - Number(this.input.backward || this.virtualInput.backward);
    const digitalStrafe = Number(this.input.right || this.virtualInput.right) - Number(this.input.left || this.virtualInput.left);
    const moveForward = editorLocked ? 0 : clamp(digitalForward + this.gamepad.moveY, -1, 1);
    const moveStrafe = editorLocked ? 0 : clamp(digitalStrafe + this.gamepad.moveX, -1, 1);
    const hasDirectInput = moveForward !== 0 || moveStrafe !== 0;
    const hasGamepadAim = !editorLocked && (Math.abs(this.gamepad.lookX) > 0.001 || Math.abs(this.gamepad.lookY) > 0.001);
    const desiredDirection = vectorA.set(0, 0, 0);
    const aimDirection = vectorE.set(0, 0, 0);
    let targetSlowdown = 1;
    let moving = false;
    let hasAimDirection = false;

    if (hasDirectInput || hasGamepadAim) {
      this.camera.getWorldDirection(vectorB);
      vectorB.y = 0;
      if (vectorB.lengthSq() <= 0.0001) {
        vectorB.set(0, 0, 1);
      } else {
        vectorB.normalize();
      }

      vectorC.crossVectors(vectorB, upVector).normalize();

      if (hasDirectInput) {
        desiredDirection.copy(vectorC).multiplyScalar(moveStrafe).addScaledVector(vectorB, moveForward);
        if (desiredDirection.lengthSq() > 1) {
          desiredDirection.normalize();
        }
        moving = desiredDirection.lengthSq() > 0.0001;
      }

      if (hasGamepadAim) {
        aimDirection.copy(vectorC).multiplyScalar(this.gamepad.lookX).addScaledVector(vectorB, this.gamepad.lookY);
        if (aimDirection.lengthSq() > 1) {
          aimDirection.normalize();
        }
        hasAimDirection = aimDirection.lengthSq() > 0.01;
      }
    } else if (this.moveTarget.active) {
      desiredDirection.subVectors(this.moveTarget.position, this.player.group.position).setY(0);
      const distanceToTarget = desiredDirection.length();
      if (distanceToTarget <= MOVE_TARGET_STOP_DISTANCE) {
        this.clearMoveTarget();
      } else {
        desiredDirection.divideScalar(distanceToTarget);
        moving = true;
        if (distanceToTarget < MOVE_TARGET_SLOW_DISTANCE) {
          targetSlowdown = clamp(
            (distanceToTarget - MOVE_TARGET_STOP_DISTANCE) / Math.max(0.1, MOVE_TARGET_SLOW_DISTANCE - MOVE_TARGET_STOP_DISTANCE),
            0.26,
            1,
          );
        }
      }
    }

    if (editorLocked) {
      this.clearMoveTarget();
      this.input.attackQueued = false;
    }

    if (hasAimDirection && this.player.attackPhase === "idle") {
      this.player.attackDirection.copy(aimDirection);
    }

    if (this.player.attackPhase !== "idle") {
      this.player.attackPhaseTimer = Math.max(0, this.player.attackPhaseTimer - dt);
      if (this.player.attackPhase === "windup" && this.player.attackPhaseTimer <= 0) {
        this.player.attackPhase = "strike";
        this.player.attackPhaseTimer = ATTACK_STRIKE_DURATION;
        this.player.attackLungeTimer = ATTACK_LUNGE_DURATION;
        this.player.moveVelocity.multiplyScalar(0.72);
        this.player.impulseVelocity.addScaledVector(
          this.player.attackDirection,
          this.playerStats.attackDrive * (this.player.terrain.attackFactor ?? 1),
        );
        this.player.attackImpact = Math.max(this.player.attackImpact, 0.34);
        this.cameraFovKick = Math.max(this.cameraFovKick, 2.2);
        this.cameraShake = Math.max(this.cameraShake, 0.08);
        this.spawnGroundDust(
          vectorF.copy(this.player.group.position).addScaledVector(this.player.attackDirection, 0.75),
          {
            color: 0xcf9d72,
            ttl: 0.18,
            size: 0.72 + this.state.upgrades.tail * 0.05,
            shards: 4,
          },
        );
        if (!this.player.attackResolved) {
          this.resolvePlayerAttack();
          this.player.attackResolved = true;
        }
      } else if (this.player.attackPhase === "strike" && this.player.attackPhaseTimer <= 0) {
        this.player.attackPhase = "recovery";
        this.player.attackPhaseTimer = ATTACK_RECOVERY_DURATION;
      } else if (this.player.attackPhase === "recovery" && this.player.attackPhaseTimer <= 0) {
        this.player.attackPhase = "idle";
        this.player.attackPhaseTimer = 0;
        this.player.attackResolved = false;
        this.player.attackDidConnect = false;
      }
    }

    const sprinting = !editorLocked && (this.input.sprint || this.virtualInput.sprint || this.gamepad.sprint) && moving && this.player.sprintCharge > 0.05;
    const sprintBonus = sprinting ? SPRINT_SPEED_BONUS : 1;
    const attackMoveFactor = this.player.attackPhase === "windup"
      ? 0.42
      : this.player.attackPhase === "strike"
        ? 0.08
        : this.player.attackPhase === "recovery"
          ? 0.62
          : 1;
    const terrainDirection = moving
      ? vectorF.copy(desiredDirection)
      : this.player.velocity.lengthSq() > 0.001
        ? vectorF.copy(this.player.velocity).setY(0).normalize()
        : vectorF.set(0, 0, 0);
    const terrainBiome = this.getCurrentBiome(this.player.group.position);
    const activeCreature = this.getActiveCreature();
    const pathProfile = this.playerStats.path ?? SPECIES_PATH_DEFS.nestling;
    const frontierUnlocked = this.isBiomeUnlocked(terrainBiome.key);
    sampleTerrainResponse(this.player.group.position, terrainDirection, this.player.terrain);
    this.player.terrain.biomeKey = terrainBiome.key;
    this.player.terrain.water = terrainBiome.water;
    const juvenileWaterBonus = terrainBiome.water && (activeCreature?.growth ?? 1) < 1 ? 1.14 : 1;
    const adultWaterPenalty = terrainBiome.water && (activeCreature?.growth ?? 1) >= 1 ? 0.9 : 1;
    const pathSpeedFactor = pathProfile.biomeSpeed?.[terrainBiome.key] ?? 1;
    const pathTractionFactor = pathProfile.biomeTraction?.[terrainBiome.key] ?? 1;
    const pathTurnFactor = pathProfile.biomeTurn?.[terrainBiome.key] ?? 1;
    const pathSprintDrain = pathProfile.biomeSprintDrain?.[terrainBiome.key] ?? 1;
    const pathAttackFactor = pathProfile.biomeAttack?.[terrainBiome.key] ?? 1;
    const growthReadiness = clamp(
      (this.playerStats.shoreReadiness ?? 0)
        + Math.max(0, (activeCreature?.growth ?? 1) - BABY_STAGE_THRESHOLD) * 0.52
        + (terrainBiome.key === "sunlitShallows" ? 0.08 : 0),
      0,
      1,
    );
    const shorelineStrain = terrainBiome.water ? 0 : clamp(1 - growthReadiness, 0, 1);
    const shorelineSpeedPenalty = terrainBiome.water ? 1 : 1 - shorelineStrain * ((activeCreature?.growth ?? 1) < 1 ? 0.34 : 0.18);
    const shorelineTractionPenalty = terrainBiome.water ? 1 : 1 - shorelineStrain * ((activeCreature?.growth ?? 1) < 1 ? 0.24 : 0.12);
    this.player.terrain.shoreReadiness = growthReadiness;
    this.player.terrain.shoreStrain = shorelineStrain;
    this.player.terrain.attackFactor = pathAttackFactor * (terrainBiome.water ? 1 : 1 - shorelineStrain * 0.08);
    this.player.terrain.speedFactor = clamp(
      this.player.terrain.speedFactor
        * (terrainBiome.speed ?? 1)
        * juvenileWaterBonus
        * adultWaterPenalty
        * pathSpeedFactor
        * shorelineSpeedPenalty
        * (frontierUnlocked ? 1 : 0.94),
      0.58,
      1.24,
    );
    this.player.terrain.traction = clamp(
      this.player.terrain.traction * (terrainBiome.traction ?? 1) * pathTractionFactor * shorelineTractionPenalty,
      0.56,
      1.18,
    );
    this.player.terrain.dust = clamp(this.player.terrain.dust * (terrainBiome.dust ?? 1) * (terrainBiome.water ? 0.94 : 1 + shorelineStrain * 0.18), 0.14, 1);
    if (sprinting) {
      this.player.sprintCharge = Math.max(0, this.player.sprintCharge - dt * SPRINT_DRAIN_RATE * pathSprintDrain * (1 + shorelineStrain * 0.44));
    } else {
      const rechargeRate = this.state.zone === "nest" ? SPRINT_SAFE_RECHARGE_RATE : SPRINT_RECHARGE_RATE;
      this.player.sprintCharge = clamp(this.player.sprintCharge + dt * rechargeRate * (1 + surgePower * FERAL_SURGE_RECOVERY_BONUS), 0, 1);
    }
    const desiredSpeed = moving
      ? this.playerStats.speed * sprintBonus * (1 + surgePower * FERAL_SURGE_SPEED_BONUS) * attackMoveFactor * this.player.terrain.speedFactor * targetSlowdown
      : 0;
    const targetMoveVelocity = vectorD.copy(desiredDirection).multiplyScalar(desiredSpeed);

    if (moving) {
      const sameHeading = this.player.moveVelocity.lengthSq() <= 0.001 || this.player.moveVelocity.dot(targetMoveVelocity) >= 0;
      const accelerationRate = (sameHeading ? this.playerStats.acceleration : this.playerStats.braking) * this.player.terrain.traction;
      moveVectorToward(this.player.moveVelocity, targetMoveVelocity, accelerationRate * dt, vectorG);
    } else {
      moveVectorToward(this.player.moveVelocity, vectorG.set(0, 0, 0), (this.playerStats.braking * 0.72 + this.playerStats.coastDrag * 0.6) * dt, vectorF);
      if (this.player.moveVelocity.lengthSq() > 0.0001) {
        this.player.moveVelocity.multiplyScalar(Math.exp(-this.playerStats.coastDrag * dt));
      }
      if (this.player.moveVelocity.lengthSq() < 0.0004) {
        this.player.moveVelocity.set(0, 0, 0);
      }
    }

    this.player.attackLungeTimer = Math.max(0, this.player.attackLungeTimer - dt);
    const impulseDecay = this.player.attackPhase === "strike" ? 9 : this.player.attackPhase === "recovery" ? 10.5 : 12.5;
    dampVector(this.player.impulseVelocity, vectorG.set(0, 0, 0), impulseDecay, dt);
    this.player.velocity.copy(this.player.moveVelocity).add(this.player.impulseVelocity);

    const planarSpeed = this.player.velocity.length();
    const speedRatio = clamp(planarSpeed / (this.playerStats.speed * SPRINT_SPEED_BONUS), 0, 1);
    this.player.isSprinting = sprinting;
    this.player.sprintHudTimer = sprinting ? SPRINT_HUD_HOLD : Math.max(0, this.player.sprintHudTimer - dt);
    const attackHudActive = this.player.attackPhase !== "idle" || this.player.attackResultTimer > 0 || this.player.attackCooldown > 0.02;
    this.player.combatHudTimer = attackHudActive ? COMBAT_HUD_HOLD : Math.max(0, this.player.combatHudTimer - dt);

    if (moving || hasAimDirection || this.player.attackLungeTimer > 0 || this.player.velocity.lengthSq() > 0.04 || this.player.attackPhase !== "idle") {
      const yawSource = this.player.attackPhase !== "idle"
        ? this.player.attackDirection
        : hasAimDirection
          ? aimDirection
        : this.player.velocity.lengthSq() > 0.04
          ? this.player.velocity
          : desiredDirection;
      const desiredYaw = Math.atan2(yawSource.x, yawSource.z);
      const yawDelta = normalizeAngle(desiredYaw - this.player.yaw);
      const maxTurn = this.playerStats.turnRate
        * pathTurnFactor
        * (0.78 + speedRatio * 0.52)
        * (this.player.attackPhase === "strike" ? 0.62 : this.player.attackPhase === "windup" ? 0.82 : 1)
        * dt;
      const appliedTurn = clamp(yawDelta, -maxTurn, maxTurn);
      this.player.yaw = normalizeAngle(this.player.yaw + appliedTurn);
      this.player.turnMomentum = damp(this.player.turnMomentum, appliedTurn / Math.max(0.0001, maxTurn), 10, dt);
    } else {
      this.player.turnMomentum = damp(this.player.turnMomentum, 0, 8, dt);
    }

    this.player.group.position.addScaledVector(this.player.velocity, dt);
    this.player.group.position.x = clamp(this.player.group.position.x, -WORLD_RADIUS + 2, WORLD_RADIUS - 2);
    this.player.group.position.z = clamp(this.player.group.position.z, -WORLD_RADIUS + 2, WORLD_RADIUS - 2);
    this.player.group.position.y = getTerrainHeight(this.player.group.position.x, this.player.group.position.z) + PLAYER_HEIGHT + this.player.attackRecoil * 0.14 + this.surge.pulse * 0.05;
    this.player.group.rotation.y = this.player.yaw;
    this.player.lean = damp(
      this.player.lean,
      clamp(this.player.velocity.dot(vectorF.set(Math.sin(this.player.yaw), 0, Math.cos(this.player.yaw))) / Math.max(0.1, this.playerStats.speed * 1.15), -1, 1),
      7.5,
      dt,
    );
    this.player.bank = damp(
      this.player.bank,
      clamp(-this.player.velocity.dot(vectorG.set(Math.cos(this.player.yaw), 0, -Math.sin(this.player.yaw))) / Math.max(0.1, this.playerStats.speed * 0.95) + this.player.turnMomentum * 0.36, -1, 1),
      9.5,
      dt,
    );

    this.player.stepCycle += planarSpeed * dt * 0.7;
    const step = this.player.stepCycle * 10.5;
    this.player.refs.legPivots.forEach((leg, index) => {
      leg.rotation.x = Math.sin(step + index * Math.PI * 0.9) * Math.min(0.62, planarSpeed * 0.045 + this.player.attackImpact * 0.05);
    });

    this.player.dustTimer = Math.max(0, this.player.dustTimer - dt);
    if (
      !editorLocked
      && planarSpeed > this.playerStats.speed * (sprinting ? 0.78 : 0.58)
      && this.player.dustTimer <= 0
    ) {
      const dustDirection = this.player.velocity.lengthSq() > 0.001
        ? vectorG.copy(this.player.velocity).normalize()
        : vectorG.set(0, 0, -1);
      this.spawnGroundDust(
        vectorF.copy(this.player.group.position).addScaledVector(dustDirection, -0.46),
        {
          color: this.player.terrain.water ? 0x8ef7e4 : this.state.zone === "danger" ? 0xca865f : 0xd8b287,
          ttl: this.player.terrain.water ? 0.2 : sprinting ? 0.22 : 0.16,
          size: 0.58 + this.player.terrain.dust * 0.28 + (sprinting ? 0.18 : 0),
          shards: this.player.terrain.water ? 4 : sprinting ? 5 : 3,
        },
      );
      this.player.dustTimer = PLAYER_DUST_INTERVAL / Math.max(0.45, this.player.terrain.dust);
    }

    this.player.attackTimer = Math.max(0, this.player.attackTimer - dt);
    this.player.attackCooldown = Math.max(0, this.player.attackCooldown - dt * (1 + surgePower * FERAL_SURGE_COOLDOWN_BONUS));
    this.player.invulnerability = Math.max(0, this.player.invulnerability - dt);
    this.player.hurtTint = Math.max(0, this.player.hurtTint - dt * 1.6);
    this.player.pickupPulse = Math.max(0, this.player.pickupPulse - dt * 2.4);
    this.player.attackRecoil = Math.max(0, this.player.attackRecoil - dt * 4.8);
    this.player.attackImpact = Math.max(0, this.player.attackImpact - dt * 5.4);
    this.player.evolutionTimer = Math.max(0, this.player.evolutionTimer - dt);
    this.player.socialTimer = Math.max(0, this.player.socialTimer - dt);
    this.player.socialSuccess = Math.max(0, this.player.socialSuccess - dt * 1.8);
    if (this.player.evolutionTimer <= 0) {
      this.player.evolutionTrait = null;
    }
    if (this.player.socialTimer <= 0) {
      this.player.socialVerb = null;
    }

    if (this.input.attackQueued) {
      this.triggerAttack();
      this.input.attackQueued = false;
    }

    const attackPhaseStrength = this.player.attackPhase === "windup"
      ? 1 - this.player.attackPhaseTimer / ATTACK_WINDUP_DURATION
      : this.player.attackPhase === "strike"
        ? 1 - this.player.attackPhaseTimer / ATTACK_STRIKE_DURATION
        : this.player.attackPhase === "recovery"
          ? 1 - this.player.attackPhaseTimer / ATTACK_RECOVERY_DURATION
          : 0;
    const windupStrength = this.player.attackPhase === "windup" ? attackPhaseStrength : 0;
    const strikeStrength = this.player.attackPhase === "strike" ? attackPhaseStrength : 0;
    const recoveryStrength = this.player.attackPhase === "recovery" ? 1 - attackPhaseStrength : 0;
    const jawOpen = this.player.attackPhase === "windup"
      ? windupStrength * 0.16
      : this.player.attackPhase === "strike"
        ? 0.82 - strikeStrength * 0.12
        : this.player.attackPhase === "recovery"
          ? recoveryStrength * 0.32
          : 0;
    const socialPulse = this.player.socialTimer > 0
      ? Math.sin((1 - this.player.socialTimer / SOCIAL_EMOTE_DURATION) * Math.PI)
      : 0;
    const singPose = this.player.socialVerb === "sing" ? socialPulse : 0;
    const posePose = this.player.socialVerb === "pose" ? socialPulse : 0;
    const charmPose = this.player.socialVerb === "charm" ? socialPulse : 0;
    const strikeArc = this.player.attackPhase === "strike" ? Math.sin(attackPhaseStrength * Math.PI) : 0;
    const recoverArc = this.player.attackPhase === "recovery" ? attackPhaseStrength : 0;
    const biteSnap = jawOpen + this.player.attackRecoil * 0.9 + strikeArc * 0.4 + this.player.attackImpact * 0.55;
    const readyPulse = this.player.attackPhase === "idle" && this.player.attackCooldown <= 0.02 ? Math.sin(this.elapsed * 8.5) * 0.5 + 0.5 : 0;
    this.player.refs.jaw.rotation.x = Math.PI * 0.48 + jawOpen * 0.95 + this.player.attackRecoil * 0.14 + this.player.attackImpact * 0.12 + singPose * 0.08;
    this.player.refs.headPivot.position.z = 2.1 - windupStrength * 0.58 + strikeArc * 0.82 + recoverArc * 0.18 + singPose * 0.08 + charmPose * 0.05;
    this.player.refs.headPivot.position.y = 0.35 + windupStrength * 0.08 - strikeArc * 0.14 + this.player.attackImpact * 0.04 + singPose * 0.12;
    this.player.refs.headPivot.position.x = this.player.bank * 0.16 + posePose * 0.08;
    this.player.refs.body.position.z = -windupStrength * 0.34 + strikeArc * 0.28 - recoverArc * 0.05 - posePose * 0.06;
    this.player.refs.body.position.y = -windupStrength * 0.12 + strikeArc * 0.08 - this.player.lean * 0.04 + posePose * 0.05;
    this.player.refs.body.position.x = -this.player.bank * 0.12;
    this.player.refs.back.position.z = -0.7 - windupStrength * 0.14 + strikeArc * 0.08 - posePose * 0.04;
    this.player.refs.body.rotation.x = -this.player.lean * 0.14 + windupStrength * 0.2 - strikeArc * 0.28 + recoverArc * 0.08 - posePose * 0.12;
    this.player.refs.body.rotation.z = this.player.bank * 0.16 + posePose * 0.14;
    this.player.refs.back.rotation.x = -this.player.lean * 0.08 + windupStrength * 0.1 - strikeArc * 0.14 + singPose * 0.08;
    this.player.refs.back.rotation.z = this.player.bank * 0.12 + posePose * 0.08;
    this.player.refs.headPivot.rotation.x = jawOpen * -0.36 + Math.sin(this.elapsed * 2.6) * 0.02 - speedRatio * 0.06 - this.player.attackRecoil * 0.15 - windupStrength * 0.28 + strikeArc * 0.46 + recoverArc * 0.1 + singPose * 0.22;
    this.player.refs.headPivot.rotation.z = this.player.bank * 0.12 + this.player.attackImpact * 0.05 + posePose * 0.08;
    this.player.refs.tailGroup.rotation.x = Math.sin(this.elapsed * 3.2) * 0.14 + jawOpen * 0.2 + speedRatio * 0.1 + surgeCharge * 0.08 + windupStrength * 0.12 - strikeArc * 0.18 + recoverArc * 0.08 + charmPose * 0.22;
    this.player.refs.tailGroup.rotation.z = -this.player.bank * 0.12 - charmPose * 0.06;
    this.player.group.rotation.z = this.player.bank * 0.1;
    this.player.groundMarker.material.opacity = 0.26 + Math.sin(this.elapsed * 5.5) * 0.04 + biteSnap * 0.12 + this.player.pickupPulse * 0.18 + speedRatio * 0.08 + surgeCharge * 0.16 + readyPulse * 0.08 + socialPulse * 0.08;
    this.player.groundMarker.rotation.z += dt * (0.35 + speedRatio * 0.6);
    this.player.groundMarker.scale.setScalar(1 + this.player.pickupPulse * 0.12 + surgeCharge * 0.14 + readyPulse * 0.05);

    const tintStrength = this.player.hurtTint;
    const feralGlow = surgeCharge * (0.45 + surgePower * 0.08);
    const evolutionPulse = this.player.evolutionTimer > 0 ? Math.sin((1 - this.player.evolutionTimer / 1.45) * Math.PI * 6) * 0.5 + 0.5 : 0;
    this.player.refs.materials.skin.emissive.setRGB(
      tintStrength * 0.5 + feralGlow * 0.12,
      tintStrength * 0.1 + feralGlow * 0.42 + socialPulse * 0.14,
      tintStrength * 0.08 + feralGlow * 0.28 + socialPulse * 0.28,
    );
    this.player.refs.materials.skin.emissiveIntensity = tintStrength + this.player.pickupPulse * 0.2 + feralGlow * 0.55 + socialPulse * 0.18;
    this.player.refs.materials.accent.emissiveIntensity = this.player.baseBackGlow + feralGlow * 0.9 + this.player.pickupPulse * 0.08 + evolutionPulse * 0.55 + socialPulse * 0.22;
    this.player.refs.materials.markings.emissiveIntensity = this.player.baseMarkingGlow + feralGlow * 0.55 + evolutionPulse * 0.85 + socialPulse * 0.7;
    this.player.group.scale.set(
      this.player.baseScale * (1 + this.player.attackRecoil * 0.04 + feralGlow * 0.02 - windupStrength * 0.05 + strikeArc * 0.09 + evolutionPulse * 0.02 + socialPulse * 0.02),
      this.player.baseScale * (1 - this.player.attackRecoil * 0.05 + tintStrength * 0.02 - windupStrength * 0.06 + strikeArc * 0.03 - evolutionPulse * 0.01),
      this.player.baseScale * (1 + this.player.attackRecoil * 0.09 + feralGlow * 0.03 + windupStrength * 0.08 + strikeArc * 0.12 + evolutionPulse * 0.03 + socialPulse * 0.03),
    );

    this.state.zone = getZoneName(this.player.group.position);
    const currentBiome = this.getCurrentBiome(this.player.group.position);
    const activeFrontier = this.isBiomeUnlocked(currentBiome.key);
    const activePath = this.playerStats.path ?? SPECIES_PATH_DEFS.nestling;
    const shoreReadiness = this.player.terrain.shoreReadiness ?? this.playerStats.shoreReadiness ?? 0;
    this.currentBiome = currentBiome;
    this.state.biome = currentBiome.key;

    if (this.state.zone === "nest" && this.state.editorOpen) {
      this.player.health = Math.min(this.player.maxHealth, this.player.health + dt * 18);
      this.state.objective = "Creature Evolution shapes the next body. Species grows outward by hatching fresh life back into the origin waters.";
    } else if (this.state.zone === "nest") {
      this.player.health = Math.min(this.player.maxHealth, this.player.health + dt * 16);
      this.state.objective = "Species nest: heal, spend DNA, lay an egg, then send the newborn back through the origin waters.";
    } else if (this.state.zone === "danger") {
      this.state.objective = "Jaw Basin: richer DNA and harder fights. Master it to turn the species into a war line.";
    } else if (!activeFrontier) {
      this.state.objective = `${currentBiome.label} is still a hard frontier. Grow the species or return to the nest before claiming it.`;
    } else if (!currentBiome.water && shoreReadiness < SHORE_READY_THRESHOLD) {
      this.state.objective = `${activePath.label}: this body is still shore-soft. Make brief land runs, then evolve cleaner shoreline anatomy at the nest.`;
    } else if (currentBiome.key === "originWaters") {
      this.state.objective = `${activePath.label}: feed safely in the origin waters until the line is ready to break for shore.`;
    } else if (currentBiome.key === "sunlitShallows") {
      this.state.objective = `${activePath.label}: Sunlit Shallows are the first shoreline test before committing to a land route.`;
    } else if (currentBiome.key === "glowMarsh") {
      this.state.objective = `${activePath.label}: Glow Marsh rewards patient bodies that can hold momentum in soft ground.`;
    } else {
      this.state.objective = `${activePath.label}: Bone Dunes reward bodies that can hold speed and survive long exposed hunts.`;
    }
  }

  updateCamera(dt) {
    const focus = this.player.group.position;
    const editorLocked = this.state.editorOpen;
    const heading = editorLocked ? this.elapsed * EDITOR_ORBIT_SPEED + Math.PI * 0.12 : this.player.yaw;
    const speedFactor = clamp(this.player.velocity.length() / (this.playerStats.speed * SPRINT_SPEED_BONUS), 0, 1);
    const surgeCharge = clamp(this.surge.timer / FERAL_SURGE_MAX_TIMER, 0, 1);
    const surgePower = this.surge.timer > 0 ? this.surge.level : 0;
    const attackCameraPush = this.player.attackPhase === "strike"
      ? 1 - this.player.attackPhaseTimer / ATTACK_STRIKE_DURATION
      : this.player.attackPhase === "recovery"
        ? 0.3
        : 0;
    const accelerationOffset = vectorF.copy(this.player.velocity).sub(this.player.previousVelocity).multiplyScalar(0.24);
    const momentumTarget = vectorA.copy(this.player.velocity).multiplyScalar(CAMERA_LOOKAHEAD + speedFactor * 0.05).add(accelerationOffset);
    dampVector(this.cameraMomentum, momentumTarget, editorLocked ? 7.5 : 4.6, dt);
    const forwardOffset = vectorA.copy(this.cameraMomentum);
    const sideOffset = vectorB.set(Math.cos(heading), 0, -Math.sin(heading)).multiplyScalar(CAMERA_SIDE_OFFSET + speedFactor * 0.25);
    const attackDirection = vectorG.set(Math.sin(this.player.yaw), 0, Math.cos(this.player.yaw));

    if (editorLocked) {
      this.cameraTarget.set(
        focus.x,
        focus.y + EDITOR_LOOK_HEIGHT,
        focus.z,
      );
      this.cameraGoal.set(
        focus.x - Math.sin(heading) * EDITOR_CAMERA_DISTANCE,
        focus.y + EDITOR_CAMERA_HEIGHT,
        focus.z - Math.cos(heading) * EDITOR_CAMERA_DISTANCE,
      );
    } else {
      this.cameraTarget.set(
        focus.x + forwardOffset.x * 0.42 + attackDirection.x * attackCameraPush * 0.34,
        focus.y + 1.75 + speedFactor * 0.12 + this.player.attackImpact * 0.06,
        focus.z + forwardOffset.z * 0.42 + attackDirection.z * attackCameraPush * 0.34,
      );
      this.cameraGoal.set(
        focus.x - Math.sin(heading) * (CAMERA_DISTANCE + speedFactor * 1.3 - attackCameraPush * 0.45) + sideOffset.x + forwardOffset.x - attackDirection.x * attackCameraPush * 0.2,
        focus.y + CAMERA_HEIGHT + speedFactor * 0.45 + this.player.terrain.slope * 0.2,
        focus.z - Math.cos(heading) * (CAMERA_DISTANCE + speedFactor * 1.3 - attackCameraPush * 0.45) + sideOffset.z + forwardOffset.z - attackDirection.z * attackCameraPush * 0.2,
      );
    }

    if (!editorLocked && this.state.zone === "danger") {
      this.cameraGoal.y += 0.8;
      this.cameraGoal.x += 1.2;
      this.cameraTarget.y += 0.12;
    }

    if (!editorLocked && surgePower > 0) {
      this.cameraGoal.y += surgeCharge * 0.25;
      this.cameraTarget.y += surgeCharge * 0.08;
    }

    this.cameraShake = Math.max(0, this.cameraShake - dt * 2.8);
    this.cameraFovKick = Math.max(0, this.cameraFovKick - dt * CAMERA_FOV_KICK_DECAY);
    if (!editorLocked && this.player.isSprinting && speedFactor > 0.35) {
      const sprintPulse = Math.sin(this.elapsed * 26) * 0.03 * speedFactor;
      this.cameraGoal.y += Math.abs(sprintPulse) * 0.8;
      this.cameraGoal.x += sprintPulse * 0.5;
      this.cameraTarget.y += Math.abs(sprintPulse) * 0.2;
    }
    if (this.cameraShake > 0.001) {
      this.cameraGoal.x += (Math.random() - 0.5) * this.cameraShake;
      this.cameraGoal.y += (Math.random() - 0.5) * this.cameraShake * 0.75;
      this.cameraGoal.z += (Math.random() - 0.5) * this.cameraShake;
    }

    dampVector(this.camera.position, this.cameraGoal, editorLocked ? 6.2 : 4.35, dt);
    const targetFov = editorLocked
      ? 52 + this.cameraFovKick * 0.35
      : this.cameraBaseFov + this.cameraFovKick + speedFactor * 1.35 + surgeCharge * surgePower * 0.8 + attackCameraPush * 0.95;
    this.camera.fov = damp(this.camera.fov, targetFov, 8, dt);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.cameraTarget);
  }

  updateAmbient(dt) {
    this.world.swayNodes.forEach(({ pivot, phase, amplitude }) => {
      pivot.rotation.z = Math.sin(this.elapsed * 1.4 + phase) * amplitude;
      pivot.rotation.x = Math.cos(this.elapsed * 1.15 + phase) * amplitude * 0.35;
    });

    const dustPositions = this.world.dust.geometry.attributes.position;
    const basePositions = this.world.dust.geometry.userData.basePositions;
    const seeds = this.world.dust.geometry.userData.seeds;

    for (let index = 0; index < dustPositions.count; index += 1) {
      const baseIndex = index * 3;
      dustPositions.array[baseIndex] = basePositions[baseIndex] + Math.sin(this.elapsed * 0.35 + seeds[index]) * 0.22;
      dustPositions.array[baseIndex + 1] = basePositions[baseIndex + 1] + Math.sin(this.elapsed * 0.65 + seeds[index]) * 0.18;
      dustPositions.array[baseIndex + 2] = basePositions[baseIndex + 2] + Math.cos(this.elapsed * 0.3 + seeds[index]) * 0.24;
    }
    dustPositions.needsUpdate = true;
    this.world.dust.rotation.y += dt * 0.015;

    if (this.world.zoneParticles) {
      this.world.zoneParticles.forEach((cloud, cloudIndex) => {
        const positions = cloud.geometry.attributes.position;
        const basePositions = cloud.geometry.userData.basePositions;
        const seeds = cloud.geometry.userData.seeds;
        for (let index = 0; index < positions.count; index += 1) {
          const baseIndex = index * 3;
          positions.array[baseIndex] = basePositions[baseIndex] + Math.sin(this.elapsed * (0.26 + cloudIndex * 0.08) + seeds[index]) * 0.18;
          positions.array[baseIndex + 1] = basePositions[baseIndex + 1] + Math.cos(this.elapsed * (0.78 + cloudIndex * 0.12) + seeds[index]) * 0.14;
          positions.array[baseIndex + 2] = basePositions[baseIndex + 2] + Math.sin(this.elapsed * (0.34 + cloudIndex * 0.05) + seeds[index]) * 0.18;
        }
        positions.needsUpdate = true;
        cloud.rotation.y += dt * (cloudIndex === 0 ? 0.01 : -0.016);
      });
    }

    if (this.world.sunHalo) {
      this.world.sunHalo.rotation.z += dt * 0.012;
      this.world.sunHalo.children.forEach((layer, index) => {
        layer.material.opacity = (index === 0 ? 0.18 : 0.1) + Math.sin(this.elapsed * (0.35 + index * 0.18)) * 0.02;
      });
    }
    if (this.world.waterSurfaces) {
      this.world.waterSurfaces.forEach((surface, index) => {
        surface.mesh.position.y = surface.baseY + Math.sin(this.elapsed * (0.75 + index * 0.18) + surface.phase) * surface.drift;
        const swell = 1 + Math.sin(this.elapsed * (0.55 + index * 0.12) + surface.phase) * surface.scale;
        surface.mesh.scale.setScalar(swell);
        surface.mesh.material.opacity = (index === 0 ? 0.3 : 0.16) + Math.sin(this.elapsed * (0.65 + index * 0.16) + surface.phase) * 0.015;
      });
    }
    if (this.world.skyFlocks) {
      this.world.skyFlocks.forEach((flock, flockIndex) => {
        flock.birds.forEach((bird, birdIndex) => {
          const phase = this.elapsed * bird.userData.speed + bird.userData.angle;
          bird.position.set(
            Math.cos(phase) * bird.userData.radius,
            bird.userData.height + Math.sin(this.elapsed * 0.7 + bird.userData.phase) * 0.6,
            Math.sin(phase) * bird.userData.radius * bird.userData.depth,
          );
          bird.rotation.y = -phase + Math.PI * 0.5;
          const flap = Math.sin(this.elapsed * (5.5 + flockIndex) + bird.userData.phase) * 0.22;
          bird.children[0].rotation.z = 0.4 + flap;
          bird.children[1].rotation.z = -0.4 - flap;
          bird.children[0].rotation.y = birdIndex % 2 === 0 ? 0.08 : -0.08;
          bird.children[1].rotation.y = birdIndex % 2 === 0 ? -0.08 : 0.08;
        });
        flock.group.rotation.y += dt * flock.speed;
      });
    }

    const biome = this.currentBiome ?? BIOME_DEFS[this.state.biome] ?? BIOME_DEFS.boneDunes;
    if (this.nestLight && this.dangerLight) {
      this.nestLight.intensity = 4.4 + Math.sin(this.elapsed * 1.9) * 0.45 + (this.state.zone === "nest" ? 0.5 : 0);
      this.dangerLight.intensity = 5.1 + Math.sin(this.elapsed * 1.5 + 0.9) * 0.55 + (this.state.zone === "danger" ? 0.8 : 0);
    }
    if (this.hemiLight) {
      this.hemiLight.intensity = this.state.zone === "danger" ? 1.45 : biome.water ? 1.78 : biome.key === "glowMarsh" ? 1.6 : 1.68;
    }
    if (this.scene.fog) {
      this.scene.fog.density = this.state.zone === "danger" ? 0.026 : biome.water ? 0.0195 : biome.key === "glowMarsh" ? 0.024 : 0.022;
      this.scene.fog.color.set(this.state.zone === "danger" ? 0xc7855d : biome.water ? 0xa5cdbd : biome.key === "glowMarsh" ? 0xb49d72 : 0xd89d69);
    }
    if (this.scene.background) {
      this.scene.background.set(this.state.zone === "danger" ? 0xe0a071 : biome.water ? 0xcfe0c3 : biome.key === "glowMarsh" ? 0xd7b67d : 0xe3ae73);
    }
    if (this.world.nestRing) {
      this.world.nestRing.material.opacity = 0.16 + Math.sin(this.elapsed * 2.2) * 0.04 + (this.state.zone === "nest" ? 0.07 : 0);
      this.world.nestRing.rotation.z += dt * 0.08;
    }
    if (this.world.dangerRing) {
      this.world.dangerRing.material.opacity = 0.18 + Math.sin(this.elapsed * 2.8) * 0.05 + (this.state.zone === "danger" ? 0.1 : 0);
      this.world.dangerRing.rotation.z -= dt * 0.12;
    }
  }

  updateEffects(dt) {
    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      const effect = this.effects[index];
      effect.age += dt;
      const t = effect.age / effect.ttl;
      effect.group.position.y += effect.rise * dt;

      effect.entries.forEach((entry) => {
        if (entry.type === "ring") {
          entry.mesh.scale.setScalar(effect.size * (1 + t * 3.2));
          entry.mesh.material.opacity = Math.max(0, 0.72 * (1 - t));
        } else if (entry.type === "arc") {
          entry.mesh.scale.set(effect.size * (1 + t * 0.45), effect.size * (1 + t * 0.18), effect.size);
          entry.mesh.rotation.z = t * 0.28;
          entry.mesh.material.opacity = Math.max(0, 0.82 * (1 - t));
        } else {
          entry.mesh.position.addScaledVector(entry.velocity, dt);
          entry.velocity.y -= dt * 4.8;
          entry.mesh.material.opacity = Math.max(0, 0.92 * (1 - t));
          entry.mesh.scale.multiplyScalar(1 - dt * 1.2);
        }
      });

      if (t >= 1) {
        effect.entries.forEach((entry) => entry.mesh.material.dispose());
        this.scene.remove(effect.group);
        this.effects.splice(index, 1);
      }
    }
  }

  updateMoveTargetMarker(dt) {
    if (!this.moveTarget.active) {
      return;
    }

    this.moveTargetMarker.group.position.set(
      this.moveTarget.position.x,
      getTerrainHeight(this.moveTarget.position.x, this.moveTarget.position.z) + 0.08,
      this.moveTarget.position.z,
    );
    this.moveTargetMarker.ring.rotation.z += dt * 0.75;
    this.moveTargetMarker.pulse.rotation.z -= dt * 0.45;
    const pulseScale = 1 + Math.sin(this.elapsed * 5.8) * 0.08;
    this.moveTargetMarker.pulse.scale.setScalar(pulseScale);
    this.moveTargetMarker.spike.position.y = 0.48 + Math.sin(this.elapsed * 7.2) * 0.08;
  }

  update(dt) {
    this.pollGamepadInput();
    if (this.state.pauseMenuOpen) {
      this.updateCamera(0);
      this.updateMoveTargetMarker(0);
      if (this.elapsed % 0.2 < dt) {
        this.emitState();
      }
      return;
    }

    this.elapsed += dt;
    this.socialEncounter.cooldown = Math.max(0, this.socialEncounter.cooldown - dt);
    if (this.socialEncounter.timer > 0) {
      this.socialEncounter.timer = Math.max(0, this.socialEncounter.timer - dt);
      if (this.socialEncounter.timer <= 0) {
        this.clearSocialEncounter();
      } else {
        const encounterEnemy = this.socialEncounter.enemyId
          ? this.enemies.find((enemy) => enemy.group.userData.enemyId === this.socialEncounter.enemyId && enemy.deadTimer <= 0 && enemy.group.visible)
          : null;
        if (!encounterEnemy || getDistance2D(encounterEnemy.group.position, this.player.group.position) > SOCIAL_INTERACT_RANGE + 2) {
          this.clearSocialEncounter();
        }
      }
    }
    const simDt = dt * (this.impactSlow > 0 ? 0.24 : 1);
    this.impactSlow = Math.max(0, this.impactSlow - dt);
    this.updateAmbient(dt);
    this.updatePlayer(simDt);
    this.updateFood(simDt);
    this.updateEcosystem(simDt);
    this.updateEnemies(simDt);
    this.resolvePlayerBodyCollisions();
    this.updateCamera(dt);
    this.updateEffects(dt);
    this.updateMoveTargetMarker(dt);

    this.updateRunScore();

    if (this.state.zone !== this.lastZone) {
      this.zoneTransition = 1;
      if (this.state.zone === "danger") {
        this.state.message = "The dunes turn hotter here. Richer DNA, faster deaths.";
      } else if (this.state.zone === "nest") {
        this.state.message = this.runStats.sessionDna > 0
          ? `Back at the species nest. Spend DNA on the next egg or switch into a stronger adult.`
          : "Back at the species nest. Heal up, shape the next egg, or hatch a waiting newborn.";
      }
      this.lastZone = this.state.zone;
    } else {
      this.zoneTransition = Math.max(0, this.zoneTransition - dt * 1.5);
    }

    if (this.state.mode === "playing" && this.ecosystem.activeEvent) {
      const species = SPECIES_DEFS[this.ecosystem.activeEvent.speciesId];
      this.state.objective = `${this.ecosystem.activeEvent.label}: ${species.name} movement is reshaping the hunt.`;
    } else if (this.state.mode === "playing" && this.currentTerritory && this.state.zone !== "nest") {
      const species = SPECIES_DEFS[this.currentTerritory.speciesId];
      this.state.objective = `${species.name} territory at ${this.currentTerritory.label}. ${species.temperament} reactions intensify here.`;
    }

    if (this.state.editorOpen) {
      this.state.message = this.state.lastEvolution
        ? `${this.state.lastEvolution.label} set. ${this.state.lastEvolution.summary}.`
        : this.state.editorTab === "evolution"
          ? "Creature Evolution open. Spend DNA on unlocked blueprints, then lay the egg."
          : "Species Nest open. Swap between bodies, lay the egg, or fast evolve a hatchling with species XP.";
    } else if (this.state.pauseMenuOpen) {
      this.state.message = this.state.zone === "nest"
        ? "Pause menu open. Resume or open Creature Evolution from the nest."
        : "Pause menu open. Resume the hunt or return to the nest to evolve.";
    } else if (this.state.mode === "playing" && !this.state.editorOpen) {
      const socialOpportunity = this.getSocialOpportunity();
      if (socialOpportunity && socialOpportunity.status !== "friendly" && socialOpportunity.canAttempt && this.elapsed % 7 < dt) {
        this.state.message = `${socialOpportunity.speciesName} are listening. ${socialOpportunity.expectedVerbHotkey} ${socialOpportunity.expectedVerbLabel} comes next.`;
      } else if (socialOpportunity && socialOpportunity.status === "friendly" && this.elapsed % 11 < dt) {
        this.state.message = `${socialOpportunity.speciesName} recognize your line and keep their distance.`;
      } else if (this.surge.timer > 0.2 && this.elapsed % 6 < dt) {
        this.state.message = `Feral surge x${this.surge.level}. Keep feeding it with blooms or kills before it burns out.`;
      } else if (this.state.zone === "danger" && this.player.attackCooldown <= 0.05 && this.elapsed % 8 < dt) {
        this.state.message = "The air thickens with heat. Better rewards, worse odds.";
      } else if (this.state.zone === "nest" && this.elapsed % 10 < dt) {
        this.state.message = "The species nest is calm. Befriend or defeat species to unlock new body parts.";
      }
    }

    if (this.elapsed % 0.2 < dt) {
      this.emitState();
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  tick() {
    if (!this.manualStepping) {
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.update(dt);
      this.render();
    } else {
      this.clock.getDelta();
    }

    this.animationFrame = window.requestAnimationFrame(this.tick);
  }

  emitState() {
    const activeCreature = this.getActiveCreature();
    const activeRuntime = activeCreature ? getCreatureRuntimeState(activeCreature) : this.activeCreatureRuntime;
    const activeMaturation = activeCreature
      ? getCreatureMaturationDisplay(activeCreature)
      : {
          key: "grown",
          label: `Fully Grown ${SPECIES_DISPLAY_NAME}`,
          progress: 1,
          detail: "Adult body online",
        };
    const draft = this.saveData.evolutionDraft ?? createEvolutionDraft(activeCreature);
    const draftBaseCreature = this.getDraftBaseCreature();
    const draftModified = this.isDraftModified();
    const draftStats = computePlayerStats(draft.traits, draft.profile);
    const activePath = this.playerStats.path ?? SPECIES_PATH_DEFS.nestling;
    const draftPath = draftStats.path ?? SPECIES_PATH_DEFS.nestling;
    const draftMaturityTarget = computeCreatureMaturityTarget(draft);
    const socialOpportunity = this.getSocialOpportunity();
    const upgradeEntries = UPGRADE_DEFS.map((upgrade) => {
      const level = draft.traits[upgrade.key] ?? 0;
      const cost = upgrade.costs[level] ?? null;
      const nextTraits = cost == null ? draft.traits : { ...draft.traits, [upgrade.key]: level + 1 };
      const nextMaturityTarget = cost == null ? draftMaturityTarget : computeCreatureMaturityTarget({ traits: nextTraits, profile: draft.profile });
      const blueprintUnlocked = this.isTraitBlueprintUnlocked(upgrade.key);
      return {
        ...upgrade,
        level,
        cost,
        summary: describeTraitLevel(upgrade.key, level),
        nextSummary: cost == null ? "Complete" : describeTraitLevel(upgrade.key, level + 1),
        growthDelta: Math.max(0, nextMaturityTarget - draftMaturityTarget),
        maxed: cost == null,
        blueprintUnlocked,
        unlockHint: getBlueprintUnlockText(upgrade),
        sourceSpecies: upgrade.unlock?.speciesId ? SPECIES_DEFS[upgrade.unlock.speciesId]?.name ?? null : null,
        unlockType: upgrade.unlock?.type ?? "starter",
        canBuy: blueprintUnlocked && this.state.zone === "nest" && cost != null && this.state.dna >= cost && this.state.mode !== "menu",
      };
    });
    const identity = activeCreature
      ? buildCreatureIdentity(activeCreature.profile, activeCreature.traits)
      : buildCreatureIdentity(this.state.creatureProfile, this.state.upgrades);
    const statEntries = [
      { label: "Bite", value: Math.round(this.playerStats.biteDamage), detail: "damage" },
      { label: "Stride", value: this.playerStats.speed.toFixed(1), detail: "move speed" },
      { label: "Hide", value: `${Math.round(this.playerStats.defense * 100)}%`, detail: "damage cut" },
      { label: "Tail", value: `${Math.round((this.playerStats.knockback - 1) * 100)}%`, detail: "knockback" },
      { label: "Bite Cooldown", value: `${this.playerStats.biteCooldown.toFixed(2)}s`, detail: "recovery" },
      { label: "Presence", value: `${Math.round(this.playerStats.intimidation * 100)}%`, detail: "enemy pressure" },
    ];
    const closestThreat = this.enemies
      .filter((enemy) => enemy.deadTimer <= 0)
      .reduce((closest, enemy) => Math.min(closest, getDistance2D(enemy.group.position, this.player.group.position)), Number.POSITIVE_INFINITY);
    const playerPosition = this.player.group.position;
    const nestDx = NEST_POSITION.x - playerPosition.x;
    const nestDz = NEST_POSITION.z - playerPosition.z;
    const nestDistance = Math.hypot(nestDx, nestDz);
    const attackHudVisible = this.player.combatHudTimer > 0 || (this.state.zone !== "nest" && Number.isFinite(closestThreat) && closestThreat < 8.5);
    const currentBiome = this.currentBiome ?? this.getCurrentBiome(this.player.group.position);
    const dominantBiome = BIOME_DEFS[this.saveData.biomeProgress.dominantBiome] ?? BIOME_DEFS.originWaters;
    const nextBiomeUnlock = this.getNextBiomeUnlock();
    const unlockedBiomeEntries = this.saveData.biomeProgress.unlockedBiomes
      .map((biomeKey) => BIOME_DEFS[biomeKey])
      .filter(Boolean);
    const currentTerritory = this.currentTerritory ?? this.getCurrentTerritoryForPosition(this.player.group.position);
    const territorySpecies = currentTerritory ? SPECIES_DEFS[currentTerritory.speciesId] : null;
    const unlockedBlueprints = UPGRADE_DEFS.reduce((count, upgrade) => count + (this.isTraitBlueprintUnlocked(upgrade.key) ? 1 : 0), 0);
    const nearbySpecies = sortByDistance(
      this.player.group.position,
      this.enemies.filter((enemy) => enemy.deadTimer <= 0),
      (enemy, distance) => ({
        id: enemy.group.userData.enemyId,
        species: enemy.speciesName,
        type: enemy.type,
        state: enemy.state,
        need: enemy.need,
        distance: Number(distance.toFixed(1)),
      }),
    ).slice(0, 4);
    const nearbyNests = sortByDistance(
      this.player.group.position,
      this.ecosystem.nests,
      (nest, distance) => ({
        species: nest.species.name,
        hp: Number(nest.hp.toFixed(0)),
        maxHp: nest.maxHp,
        destroyed: nest.destroyed,
        distance: Number(distance.toFixed(1)),
      }),
    ).slice(0, 3);
    const speciesRoster = this.saveData.speciesCreatures.map((creature) => {
      const runtime = getCreatureRuntimeState(creature);
      const remainingPoints = computeRemainingMaturityPoints(creature);
      const fastEvolveCost = creature.growth >= 1 ? 0 : getFastEvolveCost(creature);
      const maturation = getCreatureMaturationDisplay(creature);
      return {
        id: creature.id,
        identity: buildCreatureIdentity(creature.profile, creature.traits),
        generation: creature.generation,
        stage: describeCreatureStage(runtime.maturity),
        stageLabel: maturation.label,
        maturationTone: maturation.key,
        maturationDetail: maturation.detail,
        maturity: Number(runtime.maturity.toFixed(3)),
        maturityPct: Math.round(runtime.maturity * 100),
        maturityTarget: runtime.maturityTarget,
        remainingGrowth: Math.ceil(remainingPoints),
        fastEvolveCost,
        canSwitch: this.state.zone === "nest" && this.state.mode === "playing" && creature.id !== this.saveData.activeCreatureId,
        canFastEvolve:
          this.state.zone === "nest"
          && this.state.mode === "playing"
          && creature.growth < 1
          && this.state.speciesXp >= fastEvolveCost,
        active: creature.id === this.saveData.activeCreatureId,
        killCount: creature.killCount,
        activeTime: Number(creature.activeTime.toFixed(1)),
        traitTotal: Math.round(getTraitTotal(creature.traits)),
      };
    });
    const activeStage = describeCreatureStage(activeRuntime.maturity);
    const rosterFull = this.saveData.speciesCreatures.length >= MAX_SPECIES_CREATURES;
    const activeMaturityRemaining = computeRemainingMaturityPoints(activeCreature);
    const evolutionPreviewStats = [
      {
        key: "bite",
        label: "Bite",
        current: Math.round(this.playerStats.biteDamage),
        next: Math.round(draftStats.biteDamage),
        format: "flat",
        better: "higher",
      },
      {
        key: "speed",
        label: "Speed",
        current: Number(this.playerStats.speed.toFixed(1)),
        next: Number(draftStats.speed.toFixed(1)),
        format: "decimal",
        better: "higher",
      },
      {
        key: "toughness",
        label: "Toughness",
        current: Math.round(this.playerStats.health * (1 + this.playerStats.defense * 0.75)),
        next: Math.round(draftStats.health * (1 + draftStats.defense * 0.75)),
        format: "flat",
        better: "higher",
      },
      {
        key: "growth",
        label: "Growth Time",
        current: activeRuntime.maturityTarget,
        next: draftMaturityTarget,
        format: "flat",
        better: "lower",
      },
    ];

    this.onStateChange?.({
      mode: this.state.mode,
      zone: this.state.zone,
      message: this.state.message,
      objective: this.state.objective,
      dna: this.state.dna,
      speciesXp: Math.round(this.state.speciesXp),
      bestRun: this.state.bestRun,
      runScore: this.runStats.score,
      sessionDna: this.runStats.sessionDna,
      scavengersDefeated: this.runStats.scavengersDefeated,
      predatorsDefeated: this.runStats.predatorsDefeated,
      herbivoresDefeated: this.runStats.herbivoresDefeated,
      huntSummary: this.runStats.summary,
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      sprintCharge: this.player.sprintCharge,
      showSprintHud: this.player.sprintHudTimer > 0.001,
      biteCharge: clamp(1 - this.player.attackCooldown / Math.max(0.01, this.playerStats.biteCooldown), 0, 1),
      attackPhase: this.player.attackPhase,
      attackResult: this.player.attackResult,
      showAttackHud: attackHudVisible,
      surgeCharge: clamp(this.surge.timer / FERAL_SURGE_MAX_TIMER, 0, 1),
      surgeLevel: this.surge.level,
      lowHealth: this.player.health <= this.player.maxHealth * LOW_HEALTH_THRESHOLD,
      dangerBoost: this.state.zone === "danger" ? DANGER_REWARD_MULTIPLIER : 1,
      threatDistance: Number.isFinite(closestThreat) ? closestThreat : null,
      zoneTransition: this.zoneTransition,
      biomeKey: currentBiome.key,
      biomeName: currentBiome.label,
      biomeSummary: currentBiome.summary,
      biomePressure: currentBiome.pressure,
      biomeUnlocked: this.isBiomeUnlocked(currentBiome.key),
      dominantBiomeName: dominantBiome.label,
      dominantBiomeSummary: dominantBiome.summary,
      pathLabel: activePath.label,
      pathShortLabel: activePath.shortLabel,
      pathSummary: activePath.summary,
      pathFavoredBiomes: activePath.favoredBiomes,
      shoreLabel: activePath.shoreLabel,
      shoreReadiness: Math.round((this.player.terrain.shoreReadiness ?? this.playerStats.shoreReadiness ?? 0) * 100),
      shoreSummary: activePath.shoreSummary,
      unlockedBiomes: unlockedBiomeEntries.map((biome) => ({
        key: biome.key,
        label: biome.label,
        shortLabel: biome.shortLabel,
      })),
      nextBiomeUnlock,
      ecosystemNotice: this.state.ecosystemNotice,
      territoryName: currentTerritory?.label ?? null,
      territoryOwner: territorySpecies?.name ?? null,
      territoryTemperament: territorySpecies?.temperament ?? null,
      territoryAlert: currentTerritory ? currentTerritory.alert : 0,
      territoryPopulation: currentTerritory
        ? this.enemies.reduce(
          (count, enemy) => count + (enemy.speciesId === currentTerritory.speciesId && enemy.deadTimer <= 0 ? 1 : 0),
          0,
        )
        : null,
      activeMigration: this.ecosystem.activeEvent
        ? {
            label: this.ecosystem.activeEvent.label,
            species: SPECIES_DEFS[this.ecosystem.activeEvent.speciesId].name,
            timeLeft: Number(this.ecosystem.activeEvent.timer.toFixed(1)),
            progress: 1 - clamp(this.ecosystem.activeEvent.timer / this.ecosystem.activeEvent.duration, 0, 1),
          }
        : null,
      socialHint: socialOpportunity
        ? {
            speciesName: socialOpportunity.speciesName,
            status: socialOpportunity.status,
            distance: Number(socialOpportunity.distance.toFixed(1)),
            expectedVerb: socialOpportunity.expectedVerbLabel,
            expectedHotkey: socialOpportunity.expectedVerbHotkey,
            sequence: socialOpportunity.sequence,
            progress: socialOpportunity.progress,
            hint: socialOpportunity.hint,
          }
        : null,
      blueprintSummary: {
        unlocked: unlockedBlueprints,
        total: UPGRADE_DEFS.length,
      },
      speciesRelations: Object.entries(this.saveData.speciesRelations).map(([speciesId, relation]) => ({
        speciesId,
        speciesName: SPECIES_DEFS[speciesId]?.name ?? speciesId,
        status: relation.status,
        friendship: relation.friendship,
        dominance: relation.dominance,
      })),
      gamepadConnected: this.gamepad.connected,
      gamepadLabel: this.gamepad.label,
      speciesName: SPECIES_DISPLAY_NAME,
      maturationLabel: activeMaturation.label,
      maturationTone: activeMaturation.key,
      maturationProgress: Math.round(activeMaturation.progress * 100),
      maturationDetail: activeMaturation.detail,
      hudMap: {
        range: HUD_MAP_RANGE,
        worldRadius: WORLD_RADIUS,
        player: {
          x: Number(playerPosition.x.toFixed(1)),
          z: Number(playerPosition.z.toFixed(1)),
          yaw: Number(this.player.yaw.toFixed(3)),
        },
        nest: {
          dx: Number(nestDx.toFixed(1)),
          dz: Number(nestDz.toFixed(1)),
          distance: Number(nestDistance.toFixed(1)),
          bearing: Number(Math.atan2(nestDx, nestDz).toFixed(3)),
          atNest: this.state.zone === "nest",
        },
      },
      nearbySpecies,
      nearbyNests,
      upgrades: draft.traits,
      upgradeEntries,
      evolutionPreviewStats,
      pauseMenuOpen: this.state.pauseMenuOpen,
      editorOpen: this.state.editorOpen,
      editorTab: this.state.editorTab,
      editorPulse: this.player.evolutionTimer > 0 ? this.player.evolutionTimer / 1.45 : 0,
      creatureIdentity: identity,
      creatureProfile: {
        ...(activeCreature?.profile ?? this.state.creatureProfile),
        patternLabel: PATTERN_LABELS[(activeCreature?.profile ?? this.state.creatureProfile).patternType] ?? PATTERN_LABELS[0],
      },
      alignment: this.state.alignment,
      traitStats: statEntries,
      lastEvolution: this.state.lastEvolution,
      hasSave: this.state.hasSave,
      canUpgrade: this.state.zone === "nest" && this.state.mode !== "menu",
      canOpenEditor: this.state.zone === "nest" && this.state.mode === "playing" && this.state.respawnTimer <= 0,
      canLayEgg:
        this.state.zone === "nest"
        && this.state.mode === "playing"
        && this.state.respawnTimer <= 0
        && draftModified
        && !rosterFull,
      rosterFull,
      speciesRoster,
      activeCreature: activeCreature
        ? {
            id: activeCreature.id,
            identity,
            generation: activeCreature.generation,
            stage: activeStage,
            stageLabel: activeMaturation.label,
            maturationTone: activeMaturation.key,
            maturationDetail: activeMaturation.detail,
            maturity: Number(activeRuntime.maturity.toFixed(3)),
            maturityPct: Math.round(activeRuntime.maturity * 100),
            maturityTarget: activeRuntime.maturityTarget,
            remainingGrowth: Math.ceil(activeMaturityRemaining),
            fastEvolveCost: activeCreature.growth >= 1 ? 0 : getFastEvolveCost(activeCreature),
            canFastEvolve: activeCreature.growth < 1 && this.state.speciesXp >= getFastEvolveCost(activeCreature),
            sizeScale: Number(activeRuntime.sizeScale.toFixed(3)),
            killCount: activeCreature.killCount,
            activeTime: Number(activeCreature.activeTime.toFixed(1)),
            pathLabel: activePath.label,
            pathSummary: activePath.summary,
            shoreLabel: activePath.shoreLabel,
          }
        : null,
      evolutionDraft: {
        identity: buildCreatureIdentity(draft.profile, draft.traits),
        baseCreatureId: draft.baseCreatureId,
        baseIdentity: draftBaseCreature ? buildCreatureIdentity(draftBaseCreature.profile, draftBaseCreature.traits) : identity,
        modified: draftModified,
        profile: {
          ...draft.profile,
          patternLabel: PATTERN_LABELS[draft.profile.patternType] ?? PATTERN_LABELS[0],
        },
        traitTotal: Math.round(getTraitTotal(draft.traits)),
        maturityTarget: draftMaturityTarget,
        pathLabel: draftPath.label,
        pathSummary: draftPath.summary,
        shoreLabel: draftPath.shoreLabel,
        favoredBiomes: draftPath.favoredBiomes,
      },
      controlsHint: this.gamepad.connected
        ? "Xbox pad: left stick move, right stick aim, A/RT bite or confirm, B/LB sprint, Start opens pause, D-pad navigates menus, View opens Creature Evolution at the nest. Keyboard Q/E/R sends social signals."
        : this.state.mode === "menu"
          ? "Left click move, WASD/Arrows steer, Q/E/R signal species, Space/right click bite, then return to the nest to evolve the next water-born body"
        : this.state.editorOpen
          ? "Species nest open. Creature Evolution grows unlocked blueprints; Species Nest swaps bodies and fast evolves hatchlings."
          : "Left click move, WASD/Arrows steer, Shift sprint, Q/E/R signal species, Space/right click bite. Bring DNA home to hatch new water-born bodies.",
    });
  }

  dispose() {
    window.cancelAnimationFrame(this.animationFrame);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("keydown", this.handleKey);
    window.removeEventListener("keyup", this.handleKey);
    window.removeEventListener("gamepadconnected", this.handleGamepadConnection);
    window.removeEventListener("gamepaddisconnected", this.handleGamepadDisconnection);
    window.removeEventListener("blur", this.handleBlur);
    this.renderer.domElement.removeEventListener("mousedown", this.handleMouseDown);
    this.renderer.domElement.removeEventListener("mouseup", this.handleMouseUp);
    this.renderer.domElement.removeEventListener("contextmenu", this.handleContextMenu);

    if (window.advanceTime) {
      delete window.advanceTime;
    }
    if (window.render_game_to_text) {
      delete window.render_game_to_text;
    }
    if (window.__setTestGamepadState) {
      delete window.__setTestGamepadState;
    }
    if (window.__sporeSliceGameInstance === this) {
      delete window.__sporeSliceGameInstance;
    }

    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
