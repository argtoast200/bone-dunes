import * as THREE from "three";

import {
  DANGER_ZONE,
  ENEMY_DEFS,
  FOOD_SPAWNS,
  NEST_POSITION,
  PLAYER_BASE_STATS,
  PREDATOR_SPAWNS,
  SCAVENGER_SPAWNS,
  UPGRADE_DEFS,
  WORLD_RADIUS,
} from "./config";
import {
  DEFAULT_ALIGNMENT,
  DEFAULT_SAVE,
  clearSave,
  createRandomCreatureProfile,
  loadSave,
  saveProgress,
} from "./save";
import { buildWorld, getTerrainHeight } from "./world";

const FIXED_STEP = 1 / 60;
const PLAYER_HEIGHT = 2.2;
const CAMERA_HEIGHT = 5.8;
const CAMERA_DISTANCE = 10.5;
const ATTACK_WINDUP_DURATION = 0.08;
const ATTACK_STRIKE_DURATION = 0.09;
const ATTACK_RECOVERY_DURATION = 0.16;
const ATTACK_DURATION = ATTACK_WINDUP_DURATION + ATTACK_STRIKE_DURATION + ATTACK_RECOVERY_DURATION;
const ATTACK_LUNGE_DURATION = 0.12;
const ATTACK_LUNGE_SPEED = 11.8;
const MOVE_TARGET_STOP_DISTANCE = 1.25;
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
const IMPACT_SLOW_DURATION = 0.07;
const KILL_IMPACT_SLOW_DURATION = 0.11;
const CAMERA_FOV_KICK_DECAY = 7.5;
const EDITOR_CAMERA_DISTANCE = 5.9;
const EDITOR_CAMERA_HEIGHT = 3.2;
const EDITOR_LOOK_HEIGHT = 1.92;
const EDITOR_ORBIT_SPEED = 0.32;
const EFFECT_RING_GEOMETRY = new THREE.RingGeometry(0.34, 0.62, 18);
const EFFECT_SHARD_GEOMETRY = new THREE.OctahedronGeometry(0.18, 0);
const EFFECT_BITE_ARC_GEOMETRY = new THREE.TorusGeometry(1.05, 0.11, 4, 16, Math.PI * 0.95);
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

const vectorA = new THREE.Vector3();
const vectorB = new THREE.Vector3();
const vectorC = new THREE.Vector3();
const vectorD = new THREE.Vector3();
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

function computeRunScore({ sessionDna, scavengersDefeated, predatorsDefeated, timeAlive }) {
  const survivalBonus = Math.max(0, timeAlive - 25) * 0.8;
  return Math.round(sessionDna * 6 + scavengersDefeated * 10 + predatorsDefeated * 26 + survivalBonus);
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

function computePlayerStats(upgrades) {
  return {
    speed: PLAYER_BASE_STATS.speed * (1 + upgrades.legs * 0.1),
    health: PLAYER_BASE_STATS.health + upgrades.spikes * 16,
    biteDamage: PLAYER_BASE_STATS.biteDamage + upgrades.jaw * 7 + upgrades.horns * 4,
    biteCooldown: PLAYER_BASE_STATS.biteCooldown * (1 - upgrades.glow * 0.08),
    knockback: PLAYER_BASE_STATS.knockback * (1 + upgrades.tail * 0.18),
    defense: clamp(PLAYER_BASE_STATS.defense + upgrades.spikes * 0.09, 0, 0.3),
    intimidation: PLAYER_BASE_STATS.intimidation + upgrades.horns * 0.12 + upgrades.crest * 0.18,
    attackReach: 4.35 + upgrades.jaw * 0.28 + upgrades.horns * 0.18,
    lungeSpeed: ATTACK_LUNGE_SPEED * (1 + upgrades.legs * 0.03 + upgrades.jaw * 0.02),
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

export class SporeSliceGame {
  constructor(container, onStateChange) {
    this.container = container;
    this.onStateChange = onStateChange;
    this.manualStepping = false;
    this.animationFrame = 0;
    this.lastFrameTime = 0;
    this.elapsed = 0;
    this.saveData = loadSave();

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
      message: "Wake at the nest, then head into the dunes for food.",
      objective: "Collect food, hunt threats, and evolve at the nest.",
      dna: this.saveData.dna,
      bestRun: this.saveData.bestRun ?? 0,
      upgrades: getTraitLevels(this.saveData),
      creatureProfile: { ...this.saveData.creatureProfile },
      alignment: normalizeAlignment(this.saveData.alignment ?? DEFAULT_ALIGNMENT),
      hasSave: this.saveData.dna > 0 || Object.values(this.saveData.upgrades).some(Boolean),
      editorOpen: false,
      lastEvolution: null,
      startedAt: 0,
      respawnTimer: 0,
    };

    this.playerStats = computePlayerStats(this.state.upgrades);
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

    this.playerVelocity = new THREE.Vector3();
    this.cameraTarget = new THREE.Vector3();
    this.cameraGoal = new THREE.Vector3();
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
    this.runStats = {
      sessionDna: 0,
      scavengersDefeated: 0,
      predatorsDefeated: 0,
      timeAlive: 0,
      score: 0,
      bestRun: this.saveData.bestRun ?? 0,
      summary: "Fresh hatchling. No hunts logged yet.",
    };
    this.player = this.buildPlayer();
    this.foods = [];
    this.enemies = [];
    this.pickupPulse = new THREE.Group();
    this.scene.add(this.pickupPulse);

    this.world = buildWorld(this.scene);
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
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleContextMenu = this.handleContextMenu.bind(this);
    this.handleBlur = this.handleBlur.bind(this);

    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this.handleKey);
    window.addEventListener("keyup", this.handleKey);
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
      stepCycle: 0,
      attackSwingId: 0,
      baseScale: 1,
      baseBackGlow: 0.12,
      baseMarkingGlow: 0.14,
      evolutionTimer: 0,
      evolutionTrait: null,
      groundMarker,
    };
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
    SCAVENGER_SPAWNS.forEach((spawn, index) => {
      const enemy = createEnemy(spawn.enemyType ?? "scavenger");
      enemy.spawn = spawn;
      const offset = getSpawnOffset(3.2);
      const x = clamp(spawn.x + offset.x, -WORLD_RADIUS + 5, WORLD_RADIUS - 5);
      const z = clamp(spawn.z + offset.z, -WORLD_RADIUS + 5, WORLD_RADIUS - 5);
      enemy.group.position.set(x, getTerrainHeight(x, z) + enemy.spec.yOffset, z);
      enemy.home = new THREE.Vector3(enemy.group.position.x, enemy.group.position.y, enemy.group.position.z);
      enemy.group.rotation.y = Math.random() * Math.PI * 2;
      enemy.group.userData.enemyId = `${enemy.variant}-${index}`;
      this.scene.add(enemy.group);
      this.enemies.push(enemy);
    });

    PREDATOR_SPAWNS.forEach((spawn, index) => {
      const enemy = createEnemy(spawn.enemyType ?? "predator");
      enemy.spawn = spawn;
      const offset = getSpawnOffset(3.8);
      const x = clamp(spawn.x + offset.x, -WORLD_RADIUS + 5, WORLD_RADIUS - 5);
      const z = clamp(spawn.z + offset.z, -WORLD_RADIUS + 5, WORLD_RADIUS - 5);
      enemy.group.position.set(x, getTerrainHeight(x, z) + enemy.spec.yOffset, z);
      enemy.home = new THREE.Vector3(enemy.group.position.x, enemy.group.position.y, enemy.group.position.z);
      enemy.group.rotation.y = Math.random() * Math.PI * 2;
      enemy.group.userData.enemyId = `${enemy.variant}-${index}`;
      this.scene.add(enemy.group);
      this.enemies.push(enemy);
    });
  }

  startGame() {
    if (this.state.mode === "menu") {
      this.state.mode = "playing";
      this.clearFeralSurge();
      this.state.message = this.state.hasSave
        ? "The dunes remember you. Hunt, gather DNA, then return home to evolve."
        : "Food glows across the dunes. Bring DNA home before the predators close in.";
      this.runStats.summary = "Fresh hunt. Build a score, then bank upgrades at the nest.";
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

  handleKey(event) {
    const pressed = event.type === "keydown";
    if (BLOCKED_BROWSER_KEYS.has(event.code)) {
      event.preventDefault();
    }

    if (event.code === "Escape" && pressed && this.state.editorOpen) {
      this.toggleEditor(false);
      return;
    }

    if (event.code === "KeyF" && pressed && !event.repeat) {
      this.toggleFullscreen();
      return;
    }

    if (this.state.editorOpen) {
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
      default:
        break;
    }
  }

  handleMouseDown(event) {
    this.renderer.domElement.focus();
    if (this.state.editorOpen) {
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
  }

  setVirtualInput(key, pressed) {
    if (this.state.editorOpen) {
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
    if (this.state.mode !== "playing" || this.state.respawnTimer > 0 || this.state.editorOpen) {
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

  toggleEditor(forceOpen) {
    const nextOpen = typeof forceOpen === "boolean" ? forceOpen : !this.state.editorOpen;
    if (nextOpen) {
      if (this.state.mode !== "playing" || this.state.zone !== "nest" || this.state.respawnTimer > 0) {
        return false;
      }
      this.handleBlur();
      this.clearMoveTarget();
      this.input.attackQueued = false;
      this.state.editorOpen = true;
      this.state.message = "Nest editor open. Spend DNA to reshape the dune-runner.";
    } else {
      if (!this.state.editorOpen) {
        return false;
      }
      this.state.editorOpen = false;
      this.state.message = "Evolution locked in. Leave the nest and test the new body.";
      this.renderer.domElement.focus();
    }
    this.emitState();
    return true;
  }

  installTestingHooks() {
    window.__sporeSliceGameInstance = this;
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
        state: enemy.state,
        x: Number(enemy.group.position.x.toFixed(1)),
        z: Number(enemy.group.position.z.toFixed(1)),
        hp: Number(enemy.hp.toFixed(0)),
        telegraph: Number(enemy.attackTelegraph.toFixed(2)),
        distance: Number(distance.toFixed(1)),
      })).slice(0, 6);

      return JSON.stringify({
        coordinate_system: "x east/right, z south-to-north on the ground plane, y up",
        mode: this.state.mode,
        zone: this.state.zone,
        editorOpen: this.state.editorOpen,
        message: this.state.message,
        objective: this.state.objective,
        player: {
          x: Number(playerPosition.x.toFixed(1)),
          y: Number(playerPosition.y.toFixed(1)),
          z: Number(playerPosition.z.toFixed(1)),
          vx: Number(this.player.velocity.x.toFixed(2)),
          vz: Number(this.player.velocity.z.toFixed(2)),
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
          sprinting: this.input.sprint,
          identity: buildCreatureIdentity(this.state.creatureProfile, this.state.upgrades),
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
        alignment: this.state.alignment,
        food: nearbyFoods,
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
    this.playerStats = computePlayerStats(this.state.upgrades);
    const healthRatio = this.player.maxHealth > 0 ? this.player.health / this.player.maxHealth : 1;
    this.player.maxHealth = this.playerStats.health;
    this.player.health = clamp(this.playerStats.health * healthRatio, 0, this.player.maxHealth);
  }

  persistProgress() {
    saveProgress({
      dna: this.state.dna,
      bestRun: this.state.bestRun,
      upgrades: this.state.upgrades,
      creatureProfile: this.state.creatureProfile,
      alignment: this.state.alignment,
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
    const rewardMultiplier = this.state.zone === "danger" ? DANGER_REWARD_MULTIPLIER : 1;
    const reward = Math.max(1, Math.round(amount * rewardMultiplier));
    this.state.dna += reward;
    this.state.hasSave = true;
    this.runStats.sessionDna += reward;
    if (source === "predator") {
      this.runStats.predatorsDefeated += 1;
    } else if (source === "scavenger") {
      this.runStats.scavengersDefeated += 1;
    }
    const surgeLevel = this.grantFeralSurge(
      source === "predator" ? 2 : source === "scavenger" || source === "rareFood" ? 1 : 0,
      source === "predator" ? 4.6 : source === "scavenger" ? 3.5 : source === "rareFood" ? 3.8 : 2.1,
    );
    this.state.alignment = shiftAlignment(
      this.state.alignment,
      source === "predator" || source === "scavenger" ? "aggressive" : "adaptive",
      source === "predator" ? 0.03 : source === "scavenger" ? 0.02 : source === "rareFood" ? 0.018 : 0.012,
    );
    this.updateRunScore();
    this.state.message = reward > amount
      ? `${message} Danger surge: +${reward - amount} bonus DNA. Feral surge x${surgeLevel}.`
      : `${message} Feral surge x${surgeLevel}.`;
    this.runStats.summary = this.surge.timer > 0.2
      ? `Run score ${this.runStats.score}. ${this.runStats.sessionDna} DNA gathered this hunt. Feral surge x${this.surge.level} is live.`
      : `Run score ${this.runStats.score}. ${this.runStats.sessionDna} DNA gathered this hunt.`;
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

    const currentLevel = this.state.upgrades[key] ?? 0;
    const cost = spec.costs[currentLevel];
    if (cost == null || this.state.dna < cost) {
      return;
    }

    this.state.dna -= cost;
    this.state.upgrades[key] = currentLevel + 1;
    this.state.alignment = shiftAlignment(this.state.alignment, "social", 0.026);
    this.updatePlayerStats();
    this.applyUpgradeVisuals();
    this.player.sprintCharge = 1;
    this.player.health = Math.min(this.player.maxHealth, this.player.health + this.player.maxHealth * 0.25);
    this.player.evolutionTimer = 1.45;
    this.player.evolutionTrait = key;
    this.evolutionFx.timer = 1.45;
    this.evolutionFx.trait = key;
    this.state.lastEvolution = {
      key,
      label: spec.label,
      summary: describeTraitLevel(key, this.state.upgrades[key]),
    };
    this.state.message = `${spec.label} evolved. ${describeTraitLevel(key, this.state.upgrades[key])}.`;
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
    clearSave();
    this.saveData = {
      ...DEFAULT_SAVE,
      upgrades: { ...DEFAULT_SAVE.upgrades },
      creatureProfile: createRandomCreatureProfile(),
      alignment: { ...DEFAULT_ALIGNMENT },
    };
    this.state.dna = 0;
    this.state.bestRun = 0;
    this.state.upgrades = getTraitLevels(this.saveData);
    this.state.creatureProfile = { ...this.saveData.creatureProfile };
    this.state.alignment = { ...this.saveData.alignment };
    this.state.hasSave = false;
    this.state.editorOpen = false;
    this.state.lastEvolution = null;
    this.state.message = "The nest is quiet again. A fresh organism emerges.";
    this.runStats = {
      sessionDna: 0,
      scavengersDefeated: 0,
      predatorsDefeated: 0,
      timeAlive: 0,
      score: 0,
      bestRun: 0,
      summary: "Fresh hatchling. No hunts logged yet.",
    };
    this.clearFeralSurge();
    this.updatePlayerStats();
    this.applyUpgradeVisuals();
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
    const spawnY = getTerrainHeight(NEST_POSITION.x, NEST_POSITION.z) + PLAYER_HEIGHT;
    this.player.group.position.set(NEST_POSITION.x, spawnY, NEST_POSITION.z);
    this.player.velocity.set(0, 0, 0);
    this.player.yaw = Math.PI;
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
    this.player.group.scale.setScalar(this.player.baseScale);
    this.player.evolutionTimer = 0;
    this.player.evolutionTrait = null;
    this.state.editorOpen = false;
    this.clearFeralSurge();
    this.impactSlow = 0;
    this.cameraFovKick = 0;
    this.clearMoveTarget();

    if (resettingAfterDeath) {
      this.runStats = {
        ...this.runStats,
        sessionDna: 0,
        scavengersDefeated: 0,
        predatorsDefeated: 0,
        timeAlive: 0,
        score: 0,
      };
    }
  }

  respawnEnemy(enemy) {
    enemy.deadTimer = 0;
    enemy.hp = enemy.maxHp;
    enemy.cooldown = 0.8;
    enemy.state = "idle";
    enemy.attackTelegraph = 0;
    enemy.impactPulse = 0;
    enemy.staggerTimer = 0;
    enemy.fleeTimer = 0;
    enemy.threatGlow = 0;
    enemy.group.scale.setScalar(enemy.baseScale);
    enemy.group.visible = true;
    const offset = getSpawnOffset(enemy.type === "predator" ? 3.8 : 3.2);
    const x = clamp(enemy.spawn.x + offset.x, -WORLD_RADIUS + 5, WORLD_RADIUS - 5);
    const z = clamp(enemy.spawn.z + offset.z, -WORLD_RADIUS + 5, WORLD_RADIUS - 5);
    enemy.group.position.set(x, getTerrainHeight(x, z) + enemy.spec.yOffset, z);
    enemy.home.set(enemy.group.position.x, enemy.group.position.y, enemy.group.position.z);
    enemy.velocity.set(0, 0, 0);
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
    this.player.velocity.addScaledVector(sourceDirection, 4.8);
    this.setImpactPause(this.player.health > 0 ? 0.08 : 0.12, this.player.health > 0 ? 2.6 : 4.8);
    this.cameraShake = Math.max(this.cameraShake, this.player.health > 0 ? 0.18 : 0.34);
    this.spawnBurst(this.player.group.position, {
      color: this.player.health > 0 ? 0xff8b72 : 0xff4f3a,
      ttl: this.player.health > 0 ? 0.45 : 0.65,
      size: this.player.health > 0 ? 1.2 : 1.8,
      shards: this.player.health > 0 ? 7 : 10,
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
      this.runStats.summary = `Run score ${this.runStats.score}. ${this.runStats.predatorsDefeated} predators and ${this.runStats.scavengersDefeated} scavengers brought down.`;
      this.persistProgress();
      this.state.message = dnaLoss > 0
        ? `You lose ${dnaLoss} DNA and reform at the nest.`
        : "You reform at the nest.";
    }
  }

  damageEnemy(enemy, amount, sourceDirection) {
    if (enemy.deadTimer > 0) {
      return { defeated: false, killed: false };
    }

    const adjustedDamage = amount * (enemy.variant === "armoredScavenger" ? 0.88 : 1);
    enemy.hp = Math.max(0, enemy.hp - adjustedDamage);
    enemy.hitFlash = 0.36;
    enemy.impactPulse = enemy.hp <= 0 ? 1 : 0.82;
    enemy.threatGlow = 1;
    enemy.attackTelegraph = 0;
    enemy.staggerTimer = enemy.hp <= 0 ? 0.28 : (enemy.type === "predator" ? 0.18 : 0.3) / (enemy.spec.poise ?? 1);
    enemy.fleeTimer = enemy.type === "scavenger" && enemy.hp > 0 ? 0.48 : 0;
    enemy.cooldown = Math.max(enemy.cooldown, enemy.type === "predator" ? 0.55 : 0.42);
    if (sourceDirection) {
      enemy.hitDirection.copy(sourceDirection);
    }
    enemy.state = enemy.type === "predator" ? "staggered" : "reeling";
    this.player.attackRecoil = Math.max(this.player.attackRecoil, enemy.hp <= 0 ? 1 : 0.7);
    this.setImpactPause(
      enemy.hp <= 0 ? KILL_IMPACT_SLOW_DURATION : IMPACT_SLOW_DURATION,
      enemy.hp <= 0 ? 5.4 : 3.2,
      enemy.type === "predator" ? 0.18 : 0.1,
    );
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

    if (enemy.hp <= 0) {
      enemy.deadTimer = enemy.type === "predator" ? 11 : 8;
      enemy.group.visible = false;
      this.awardDNA(
        enemy.spec.reward,
        `You defeat a ${enemy.spec.label} and harvest ${enemy.spec.reward} DNA.`,
        {
          position: enemy.group.position,
          source: enemy.type,
        },
      );
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

    this.player.attackTimer = ATTACK_DURATION;
    this.player.attackCooldown = this.playerStats.biteCooldown;
    this.player.attackPhase = "windup";
    this.player.attackPhaseTimer = ATTACK_WINDUP_DURATION;
    this.player.attackLungeTimer = 0;
    this.player.attackResolved = false;
    this.player.attackDidConnect = false;
    this.player.attackResult = "snap";
    this.player.attackResultTimer = 0.18;
    this.player.attackRecoil = Math.max(this.player.attackRecoil, 0.48);
    this.cameraFovKick = Math.max(this.cameraFovKick, 1.2);
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
    const mouthPosition = playerPosition.clone().addScaledVector(forward, 2.05 + biteReachBonus);

    this.spawnAttackArc(mouthPosition, this.player.yaw, {
      color: 0xffe1b0,
      ttl: 0.18,
      size: 1 + this.state.upgrades.jaw * 0.08 + this.state.upgrades.horns * 0.05,
    });
    this.spawnBurst(mouthPosition, {
      color: 0xffcb8f,
      ttl: 0.18,
      size: 0.72 + this.state.upgrades.jaw * 0.04,
      shards: 5,
      rise: 0.12,
    });

    let hitCount = 0;
    let killedTarget = false;

    this.enemies.forEach((enemy) => {
      if (enemy.deadTimer > 0) {
        return;
      }

      vectorA.subVectors(enemy.group.position, playerPosition);
      const horizontalDistance = Math.hypot(vectorA.x, vectorA.z);
      const range = enemy.type === "predator" ? this.playerStats.attackReach + 0.55 : this.playerStats.attackReach;
      if (horizontalDistance > range) {
        return;
      }

      vectorA.y = 0;
      vectorA.normalize();
      const dot = vectorA.dot(forward);
      const dotThreshold = horizontalDistance < 2.35 ? -0.18 : 0.12;
      if (dot < dotThreshold) {
        return;
      }

      const impactDirection = vectorC.copy(forward).multiplyScalar((enemy.type === "predator" ? 5.2 : 7.2) * this.playerStats.knockback);
      enemy.velocity.addScaledVector(impactDirection, 1);
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

    this.player.attackResult = "miss";
    this.player.attackResultTimer = 0.2;
    this.spawnBurst(mouthPosition.clone().setY(getTerrainHeight(mouthPosition.x, mouthPosition.z) + 0.28), {
      color: 0xe6c49c,
      ttl: 0.16,
      size: 0.5,
      shards: 3,
      ring: false,
      rise: 0.04,
    });
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
    this.enemies.forEach((enemy) => {
      if (enemy.deadTimer > 0) {
        enemy.deadTimer -= dt;
        if (enemy.deadTimer <= 0) {
          this.respawnEnemy(enemy);
        }
        return;
      }

      enemy.cooldown = Math.max(0, enemy.cooldown - dt);
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      enemy.impactPulse = Math.max(0, enemy.impactPulse - dt * 3.4);
      enemy.staggerTimer = Math.max(0, enemy.staggerTimer - dt);
      enemy.fleeTimer = Math.max(0, enemy.fleeTimer - dt);
      enemy.threatGlow = Math.max(0, enemy.threatGlow - dt * 2.5);
      enemy.bob += dt * (enemy.type === "predator" ? 7 : 5.5);

      const position = enemy.group.position;
      const toPlayer = vectorA.subVectors(this.player.group.position, position).setY(0);
      const distanceToPlayer = toPlayer.length();
      const distanceToHome = getDistance2D(position, enemy.home);
      const playerInNest = this.state.zone === "nest";
      const playerVulnerable = this.player.health <= this.player.maxHealth * 0.68 || this.state.dna >= 10;
      const intimidationPressure = this.playerStats.intimidation + (this.player.evolutionTimer > 0 ? 0.05 : 0);
      const telegraphDuration = enemy.variant === "hornedPredator" ? 0.62 : enemy.variant === "armoredScavenger" ? 0.38 : enemy.type === "predator" ? 0.55 : 0.34;

      enemy.roamTimer -= dt;
      if (enemy.roamTimer <= 0) {
        enemy.roamTimer = 1.4 + Math.random() * 2.2;
        enemy.direction.set(Math.sin(enemy.bob * 0.4), 0, Math.cos(enemy.bob * 0.6)).normalize();
      }

      let desiredDirection = vectorB.set(0, 0, 0);
      let desiredSpeed = 0;
      const shouldFlee = enemy.type === "scavenger"
        && enemy.variant !== "armoredScavenger"
        && (enemy.hp < enemy.maxHp * 0.45 || enemy.fleeTimer > 0 || (intimidationPressure > 0.16 && distanceToPlayer < 6.2));

      if (enemy.staggerTimer > 0) {
        enemy.state = enemy.type === "predator" ? "braced" : "staggered";
        desiredDirection = enemy.hitDirection.lengthSq() > 0.001
          ? vectorB.copy(enemy.hitDirection)
          : vectorB.subVectors(position, this.player.group.position).setY(0);
        desiredSpeed = enemy.spec.speed * (enemy.type === "predator" ? 0.18 : enemy.variant === "armoredScavenger" ? 0.22 : 0.34);
      } else if (enemy.attackTelegraph > 0) {
        enemy.state = enemy.type === "predator" ? "winding up" : "feinting";
        const previousTelegraph = enemy.attackTelegraph;
        enemy.attackTelegraph = Math.max(0, enemy.attackTelegraph - dt);

        desiredDirection = enemy.attackVector;
        desiredSpeed = enemy.spec.speed * (enemy.variant === "hornedPredator" ? 0.24 : enemy.type === "predator" ? 0.2 : 0.14);

        if (enemy.attackTelegraph <= 0 && previousTelegraph > 0) {
          enemy.velocity.addScaledVector(enemy.attackVector, enemy.variant === "hornedPredator" ? 8.3 : enemy.type === "predator" ? 7.4 : 5.2);
          if (distanceToPlayer <= enemy.spec.attackRange + (enemy.type === "predator" ? 0.9 : 0.55) && this.state.respawnTimer <= 0) {
            this.damagePlayer(enemy.spec.damage, enemy.attackVector);
          }
          enemy.cooldown = enemy.variant === "hornedPredator" ? 1.5 : enemy.type === "predator" ? 1.65 : 1.2;
          enemy.threatGlow = 1;
        }
      } else {
        if (!playerInNest) {
          if (enemy.type === "predator" && (distanceToPlayer < enemy.spec.aggroRadius || (this.state.zone === "danger" && distanceToHome < enemy.spec.leashRadius + 8))) {
            enemy.state = "chasing";
          } else if (enemy.type === "scavenger" && distanceToPlayer < enemy.spec.aggroRadius && (playerVulnerable || enemy.hp < enemy.maxHp || this.state.zone === "danger")) {
            enemy.state = "harassing";
          } else if (distanceToHome > enemy.spec.leashRadius) {
            enemy.state = "returning";
          } else if (enemy.state !== "threatened") {
            enemy.state = "idle";
          }
        } else if (distanceToHome > enemy.spec.leashRadius) {
          enemy.state = "returning";
        } else if (enemy.state !== "threatened") {
          enemy.state = "idle";
        }

        if (enemy.state === "chasing" || enemy.state === "harassing" || enemy.state === "threatened") {
          desiredDirection = vectorB.subVectors(this.player.group.position, position).setY(0);
          if (shouldFlee) {
            desiredDirection.multiplyScalar(-1);
            desiredSpeed = enemy.spec.speed * 1.12;
            enemy.state = "fleeing";
          } else if (enemy.type === "scavenger") {
            if (distanceToPlayer > 4.5) {
              desiredSpeed = enemy.spec.speed * (enemy.variant === "armoredScavenger" ? 0.84 : 0.96);
            } else {
              desiredDirection.crossVectors(desiredDirection.normalize(), upVector).multiplyScalar(enemy.circleSign);
              desiredSpeed = enemy.spec.speed * (enemy.variant === "armoredScavenger" ? 0.64 : 0.86);
              enemy.state = enemy.variant === "armoredScavenger" ? "bracing" : "circling";
            }
          } else if (distanceToPlayer > 5.6) {
            desiredSpeed = enemy.spec.speed * (enemy.variant === "hornedPredator" ? 1.08 : 1.02);
          } else {
            desiredDirection.crossVectors(desiredDirection.normalize(), upVector).multiplyScalar(enemy.circleSign);
            desiredDirection.addScaledVector(vectorC.subVectors(this.player.group.position, position).setY(0).normalize(), 0.45);
            desiredSpeed = enemy.spec.speed * (enemy.variant === "hornedPredator" ? 0.88 : 0.8);
            enemy.state = enemy.variant === "hornedPredator" ? "goring" : "stalking";
          }
        } else if (enemy.state === "fleeing") {
          desiredDirection = vectorB.subVectors(position, this.player.group.position).setY(0);
          desiredSpeed = enemy.spec.speed * 1.1;
        } else if (enemy.state === "returning") {
          desiredDirection = vectorB.subVectors(enemy.home, position).setY(0);
          desiredSpeed = enemy.spec.speed * 0.9;
        } else {
          desiredDirection = enemy.direction;
          desiredSpeed = enemy.spec.speed * 0.42;
        }

        if (!playerInNest && enemy.cooldown <= 0 && !shouldFlee && distanceToPlayer <= enemy.spec.attackRange + (enemy.type === "predator" ? 1.1 : 0.75)) {
          enemy.attackTelegraph = telegraphDuration;
          enemy.attackVector.copy(toPlayer.lengthSq() > 0.0001 ? toPlayer.normalize() : enemy.direction);
          enemy.state = enemy.type === "predator" ? "coiling" : "snapping";
          enemy.threatGlow = 1;
        }
      }

      if (desiredDirection.lengthSq() > 0.0001) {
        desiredDirection.normalize();
      }

      vectorC.copy(desiredDirection).multiplyScalar(desiredSpeed);
      dampVector(enemy.velocity, vectorC, 6, dt);
      position.addScaledVector(enemy.velocity, dt);

      position.x = clamp(position.x, -WORLD_RADIUS, WORLD_RADIUS);
      position.z = clamp(position.z, -WORLD_RADIUS, WORLD_RADIUS);
      position.y = getTerrainHeight(position.x, position.z) + enemy.spec.yOffset;

      if (enemy.velocity.lengthSq() > 0.1) {
        const yaw = Math.atan2(enemy.velocity.x, enemy.velocity.z);
        enemy.group.rotation.y = damp(enemy.group.rotation.y, yaw, 12, dt);
      }

      const gait = this.elapsed * (enemy.type === "predator" ? 10 : 12) + enemy.bob;
      enemy.refs.legPivots.forEach((leg, index) => {
        leg.rotation.x = Math.sin(gait + index * Math.PI * 0.9) * Math.min(0.58, enemy.velocity.length() * 0.06 + enemy.attackTelegraph * 0.45);
      });
      const telegraphStrength = enemy.attackTelegraph > 0 ? enemy.attackTelegraph / telegraphDuration : 0;
      const staggerStrength = enemy.staggerTimer > 0 ? Math.min(1, enemy.staggerTimer / (enemy.type === "predator" ? 0.18 : 0.3)) : 0;
      enemy.refs.body.position.z = -telegraphStrength * 0.14 - staggerStrength * 0.18;
      enemy.refs.back.position.z = -0.7 - telegraphStrength * 0.08 + staggerStrength * 0.06;
      enemy.refs.headPivot.rotation.x = Math.sin(gait * 0.35) * 0.08 - telegraphStrength * 0.2 - staggerStrength * 0.24;
      enemy.refs.tailGroup.rotation.x = Math.sin(gait * 0.5) * 0.18 + telegraphStrength * 0.12 + staggerStrength * 0.18;
      enemy.refs.materials.skin.emissive.setRGB(
        enemy.hitFlash * 0.8 + telegraphStrength * 0.8 + enemy.threatGlow * 0.18,
        enemy.hitFlash * 0.25 + telegraphStrength * 0.2,
        enemy.hitFlash * 0.18,
      );
      enemy.refs.materials.skin.emissiveIntensity = enemy.hitFlash * 0.9 + telegraphStrength * 1.1 + enemy.threatGlow * 0.22;
      enemy.refs.materials.accent.emissiveIntensity = enemy.baseBackGlow + telegraphStrength * 0.85 + enemy.threatGlow * 0.2;
      enemy.refs.materials.markings.emissiveIntensity = enemy.baseMarkingGlow + enemy.threatGlow * 0.18 + telegraphStrength * 0.12;
      enemy.group.scale.set(
        enemy.baseScale * (1 + enemy.impactPulse * 0.08),
        enemy.baseScale * (1 - enemy.impactPulse * 0.06 - staggerStrength * 0.03),
        enemy.baseScale * (1 + enemy.impactPulse * 0.14 + staggerStrength * 0.05),
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
    const surgePower = this.surge.timer > 0 ? this.surge.level : 0;
    const surgeCharge = clamp(this.surge.timer / FERAL_SURGE_MAX_TIMER, 0, 1);
    const editorLocked = this.state.editorOpen;
    this.player.attackResultTimer = Math.max(0, this.player.attackResultTimer - dt);
    if (this.player.attackResultTimer <= 0 && this.player.attackPhase === "idle") {
      this.player.attackResult = this.player.attackCooldown > 0 ? "cooldown" : "ready";
    }

    const moveForward = editorLocked ? 0 : Number(this.input.forward || this.virtualInput.forward) - Number(this.input.backward || this.virtualInput.backward);
    const moveStrafe = editorLocked ? 0 : Number(this.input.right || this.virtualInput.right) - Number(this.input.left || this.virtualInput.left);
    const hasDirectInput = moveForward !== 0 || moveStrafe !== 0;
    const desiredDirection = vectorA.set(0, 0, 0);
    let moving = false;

    if (hasDirectInput) {
      this.camera.getWorldDirection(vectorB);
      vectorB.y = 0;
      if (vectorB.lengthSq() <= 0.0001) {
        vectorB.set(0, 0, 1);
      } else {
        vectorB.normalize();
      }

      vectorC.crossVectors(vectorB, upVector).normalize();
      desiredDirection.copy(vectorC).multiplyScalar(moveStrafe).addScaledVector(vectorB, moveForward);
      if (desiredDirection.lengthSq() > 1) {
        desiredDirection.normalize();
      }
      moving = desiredDirection.lengthSq() > 0.0001;
    } else if (this.moveTarget.active) {
      desiredDirection.subVectors(this.moveTarget.position, this.player.group.position).setY(0);
      const distanceToTarget = desiredDirection.length();
      if (distanceToTarget <= MOVE_TARGET_STOP_DISTANCE) {
        this.clearMoveTarget();
      } else {
        desiredDirection.divideScalar(distanceToTarget);
        moving = true;
      }
    }

    if (editorLocked) {
      this.clearMoveTarget();
      this.input.attackQueued = false;
    }

    if (this.player.attackPhase !== "idle") {
      this.player.attackPhaseTimer = Math.max(0, this.player.attackPhaseTimer - dt);
      if (this.player.attackPhase === "windup" && this.player.attackPhaseTimer <= 0) {
        this.player.attackPhase = "strike";
        this.player.attackPhaseTimer = ATTACK_STRIKE_DURATION;
        this.player.attackLungeTimer = ATTACK_LUNGE_DURATION;
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

    const sprinting = !editorLocked && this.input.sprint && moving && this.player.sprintCharge > 0.05;
    if (sprinting) {
      this.player.sprintCharge = Math.max(0, this.player.sprintCharge - dt * SPRINT_DRAIN_RATE);
    } else {
      const rechargeRate = this.state.zone === "nest" ? SPRINT_SAFE_RECHARGE_RATE : SPRINT_RECHARGE_RATE;
      this.player.sprintCharge = clamp(this.player.sprintCharge + dt * rechargeRate * (1 + surgePower * FERAL_SURGE_RECOVERY_BONUS), 0, 1);
    }

    const sprintBonus = sprinting ? SPRINT_SPEED_BONUS : 1;
    const attackMoveFactor = this.player.attackPhase === "windup"
      ? 0.58
      : this.player.attackPhase === "strike"
        ? 0.18
        : this.player.attackPhase === "recovery"
          ? 0.72
          : 1;
    const desiredSpeed = moving ? this.playerStats.speed * sprintBonus * (1 + surgePower * FERAL_SURGE_SPEED_BONUS) * attackMoveFactor : 0;
    const desiredVelocity = vectorD.copy(desiredDirection).multiplyScalar(desiredSpeed);

    this.player.attackLungeTimer = Math.max(0, this.player.attackLungeTimer - dt);
    if (this.player.attackLungeTimer > 0) {
      vectorB.set(Math.sin(this.player.yaw), 0, Math.cos(this.player.yaw));
      desiredVelocity.addScaledVector(vectorB, this.playerStats.lungeSpeed * (this.player.attackLungeTimer / ATTACK_LUNGE_DURATION));
    }

    dampVector(this.player.velocity, desiredVelocity, moving ? (sprinting ? 18 : 14) : 8, dt);

    if (moving || this.player.attackLungeTimer > 0 || this.player.velocity.lengthSq() > 0.04 || this.player.attackPhase !== "idle") {
      const yawSource = this.player.attackPhase !== "idle"
        ? this.player.attackDirection
        : this.player.velocity.lengthSq() > 0.04
          ? this.player.velocity
          : desiredDirection;
      const desiredYaw = Math.atan2(yawSource.x, yawSource.z);
      const yawDelta = normalizeAngle(desiredYaw - this.player.yaw);
      this.player.yaw = normalizeAngle(this.player.yaw + yawDelta * (1 - Math.exp(-16 * dt)));
    }

    this.player.group.position.addScaledVector(this.player.velocity, dt);
    this.player.group.position.x = clamp(this.player.group.position.x, -WORLD_RADIUS + 2, WORLD_RADIUS - 2);
    this.player.group.position.z = clamp(this.player.group.position.z, -WORLD_RADIUS + 2, WORLD_RADIUS - 2);
    this.player.group.position.y = getTerrainHeight(this.player.group.position.x, this.player.group.position.z) + PLAYER_HEIGHT + this.player.attackRecoil * 0.14 + this.surge.pulse * 0.05;
    this.player.group.rotation.y = this.player.yaw;

    this.player.stepCycle += this.player.velocity.length() * dt * 0.7;
    const step = this.player.stepCycle * 10.5;
    this.player.refs.legPivots.forEach((leg, index) => {
      leg.rotation.x = Math.sin(step + index * Math.PI * 0.9) * Math.min(0.62, this.player.velocity.length() * 0.045);
    });

    this.player.attackTimer = Math.max(0, this.player.attackTimer - dt);
    this.player.attackCooldown = Math.max(0, this.player.attackCooldown - dt * (1 + surgePower * FERAL_SURGE_COOLDOWN_BONUS));
    this.player.invulnerability = Math.max(0, this.player.invulnerability - dt);
    this.player.hurtTint = Math.max(0, this.player.hurtTint - dt * 1.6);
    this.player.pickupPulse = Math.max(0, this.player.pickupPulse - dt * 2.4);
    this.player.attackRecoil = Math.max(0, this.player.attackRecoil - dt * 4.8);
    this.player.evolutionTimer = Math.max(0, this.player.evolutionTimer - dt);
    if (this.player.evolutionTimer <= 0) {
      this.player.evolutionTrait = null;
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
    const speedRatio = clamp(this.player.velocity.length() / (this.playerStats.speed * SPRINT_SPEED_BONUS), 0, 1);
    const biteSnap = jawOpen + this.player.attackRecoil * 0.9 + strikeStrength * 0.3;
    this.player.refs.jaw.rotation.x = Math.PI * 0.48 + jawOpen * 0.8 + this.player.attackRecoil * 0.14;
    this.player.refs.headPivot.position.z = 2.1 - windupStrength * 0.38 + strikeStrength * 0.48 - recoveryStrength * 0.14;
    this.player.refs.headPivot.position.y = 0.35 + windupStrength * 0.06 - strikeStrength * 0.08;
    this.player.refs.body.position.z = -windupStrength * 0.24 + strikeStrength * 0.18;
    this.player.refs.body.position.y = -windupStrength * 0.08 + strikeStrength * 0.05;
    this.player.refs.back.position.z = -0.7 - windupStrength * 0.08 + strikeStrength * 0.06;
    this.player.refs.headPivot.rotation.x = jawOpen * -0.34 + Math.sin(this.elapsed * 2.6) * 0.02 - speedRatio * 0.05 - this.player.attackRecoil * 0.15 - windupStrength * 0.24 + strikeStrength * 0.34;
    this.player.refs.tailGroup.rotation.x = Math.sin(this.elapsed * 3.2) * 0.14 + jawOpen * 0.16 + speedRatio * 0.08 + surgeCharge * 0.08 + windupStrength * 0.08 - strikeStrength * 0.14;
    this.player.groundMarker.material.opacity = 0.26 + Math.sin(this.elapsed * 5.5) * 0.04 + biteSnap * 0.12 + this.player.pickupPulse * 0.18 + speedRatio * 0.08 + surgeCharge * 0.16;
    this.player.groundMarker.rotation.z += dt * (0.35 + speedRatio * 0.6);
    this.player.groundMarker.scale.setScalar(1 + this.player.pickupPulse * 0.12 + surgeCharge * 0.14);

    const tintStrength = this.player.hurtTint;
    const feralGlow = surgeCharge * (0.45 + surgePower * 0.08);
    const evolutionPulse = this.player.evolutionTimer > 0 ? Math.sin((1 - this.player.evolutionTimer / 1.45) * Math.PI * 6) * 0.5 + 0.5 : 0;
    this.player.refs.materials.skin.emissive.setRGB(
      tintStrength * 0.5 + feralGlow * 0.12,
      tintStrength * 0.1 + feralGlow * 0.42,
      tintStrength * 0.08 + feralGlow * 0.28,
    );
    this.player.refs.materials.skin.emissiveIntensity = tintStrength + this.player.pickupPulse * 0.2 + feralGlow * 0.55;
    this.player.refs.materials.accent.emissiveIntensity = this.player.baseBackGlow + feralGlow * 0.9 + this.player.pickupPulse * 0.08 + evolutionPulse * 0.55;
    this.player.refs.materials.markings.emissiveIntensity = this.player.baseMarkingGlow + feralGlow * 0.55 + evolutionPulse * 0.85;
    this.player.group.scale.set(
      this.player.baseScale * (1 + this.player.attackRecoil * 0.04 + feralGlow * 0.02 - windupStrength * 0.04 + strikeStrength * 0.07 + evolutionPulse * 0.02),
      this.player.baseScale * (1 - this.player.attackRecoil * 0.05 + tintStrength * 0.02 - windupStrength * 0.05 + strikeStrength * 0.02 - evolutionPulse * 0.01),
      this.player.baseScale * (1 + this.player.attackRecoil * 0.09 + feralGlow * 0.03 + windupStrength * 0.06 + strikeStrength * 0.1 + evolutionPulse * 0.03),
    );

    this.state.zone = getZoneName(this.player.group.position);

    if (this.state.zone === "nest" && this.state.editorOpen) {
      this.player.health = Math.min(this.player.maxHealth, this.player.health + dt * 18);
      this.state.objective = "Editor open: spend DNA, compare stat shifts, then close the nest screen to hunt.";
    } else if (this.state.zone === "nest") {
      this.player.health = Math.min(this.player.maxHealth, this.player.health + dt * 16);
      this.state.objective = "Safe nest: heal, refill your burst, and spend DNA on evolutions.";
    } else if (this.state.zone === "danger") {
      this.state.objective = "Territory zone: richer DNA, tighter stamina, and predators that commit.";
    } else {
      this.state.objective = "Bone dunes: chain blooms, avoid bad fights, and push toward a bigger run score.";
    }
  }

  updateCamera(dt) {
    const focus = this.player.group.position;
    const editorLocked = this.state.editorOpen;
    const heading = editorLocked ? this.elapsed * EDITOR_ORBIT_SPEED + Math.PI * 0.12 : this.player.yaw;
    const speedFactor = clamp(this.player.velocity.length() / (this.playerStats.speed * SPRINT_SPEED_BONUS), 0, 1);
    const surgeCharge = clamp(this.surge.timer / FERAL_SURGE_MAX_TIMER, 0, 1);
    const surgePower = this.surge.timer > 0 ? this.surge.level : 0;
    const forwardOffset = vectorA.copy(this.player.velocity).multiplyScalar(CAMERA_LOOKAHEAD);
    const sideOffset = vectorB.set(Math.cos(heading), 0, -Math.sin(heading)).multiplyScalar(CAMERA_SIDE_OFFSET + speedFactor * 0.25);

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
        focus.x + forwardOffset.x * 0.45,
        focus.y + 1.75 + speedFactor * 0.12,
        focus.z + forwardOffset.z * 0.45,
      );
      this.cameraGoal.set(
        focus.x - Math.sin(heading) * (CAMERA_DISTANCE + speedFactor * 1.3) + sideOffset.x + forwardOffset.x,
        focus.y + CAMERA_HEIGHT + speedFactor * 0.45,
        focus.z - Math.cos(heading) * (CAMERA_DISTANCE + speedFactor * 1.3) + sideOffset.z + forwardOffset.z,
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
    if (this.cameraShake > 0.001) {
      this.cameraGoal.x += (Math.random() - 0.5) * this.cameraShake;
      this.cameraGoal.y += (Math.random() - 0.5) * this.cameraShake * 0.75;
      this.cameraGoal.z += (Math.random() - 0.5) * this.cameraShake;
    }

    dampVector(this.camera.position, this.cameraGoal, 5, dt);
    const targetFov = editorLocked
      ? 52 + this.cameraFovKick * 0.35
      : this.cameraBaseFov + this.cameraFovKick + speedFactor * 1.1 + surgeCharge * surgePower * 0.8;
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

    if (this.nestLight && this.dangerLight) {
      this.nestLight.intensity = 4.4 + Math.sin(this.elapsed * 1.9) * 0.45 + (this.state.zone === "nest" ? 0.5 : 0);
      this.dangerLight.intensity = 5.1 + Math.sin(this.elapsed * 1.5 + 0.9) * 0.55 + (this.state.zone === "danger" ? 0.8 : 0);
    }
    if (this.hemiLight) {
      this.hemiLight.intensity = this.state.zone === "danger" ? 1.45 : 1.68;
    }
    if (this.scene.fog) {
      this.scene.fog.density = this.state.zone === "danger" ? 0.026 : 0.022;
      this.scene.fog.color.set(this.state.zone === "danger" ? 0xc7855d : 0xd89d69);
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
    this.elapsed += dt;
    const simDt = dt * (this.impactSlow > 0 ? 0.24 : 1);
    this.impactSlow = Math.max(0, this.impactSlow - dt);
    this.updateAmbient(dt);
    this.updatePlayer(simDt);
    this.updateFood(simDt);
    this.updateEnemies(simDt);
    this.updateCamera(dt);
    this.updateEffects(dt);
    this.updateMoveTargetMarker(dt);

    this.updateRunScore();

    if (this.state.zone !== this.lastZone) {
      this.zoneTransition = 1;
      if (this.state.zone === "danger") {
        this.state.message = "The dunes turn hotter here. Richer DNA, faster deaths.";
      } else if (this.state.zone === "nest") {
        this.state.message = this.runStats.score > 0
          ? `Safe again. Current run score ${this.runStats.score}. Spend DNA or push farther.`
          : "The nest hums softly. Heal up and evolve.";
      }
      this.lastZone = this.state.zone;
    } else {
      this.zoneTransition = Math.max(0, this.zoneTransition - dt * 1.5);
    }

    if (this.state.editorOpen) {
      this.state.message = this.state.lastEvolution
        ? `${this.state.lastEvolution.label} set. ${this.state.lastEvolution.summary}.`
        : "Nest editor open. Shape the creature, then close the editor to hunt.";
    } else if (this.state.mode === "playing" && this.surge.timer > 0.2 && this.elapsed % 6 < dt) {
      this.state.message = `Feral surge x${this.surge.level}. Keep feeding it with blooms or kills before it burns out.`;
    } else if (this.state.mode === "playing" && this.state.zone === "danger" && this.player.attackCooldown <= 0.05 && this.elapsed % 8 < dt) {
      this.state.message = "The air thickens with heat. Better rewards, worse odds.";
    } else if (this.state.mode === "playing" && this.state.zone === "nest" && this.elapsed % 10 < dt) {
      this.state.message = "The nest hums softly. Evolve while the predators keep their distance.";
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
    const upgradeEntries = UPGRADE_DEFS.map((upgrade) => {
      const level = this.state.upgrades[upgrade.key] ?? 0;
      const cost = upgrade.costs[level] ?? null;
      return {
        ...upgrade,
        level,
        cost,
        summary: describeTraitLevel(upgrade.key, level),
        nextSummary: cost == null ? "Complete" : describeTraitLevel(upgrade.key, level + 1),
        maxed: cost == null,
        canBuy: this.state.zone === "nest" && cost != null && this.state.dna >= cost && this.state.mode !== "menu",
      };
    });
    const identity = buildCreatureIdentity(this.state.creatureProfile, this.state.upgrades);
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

    this.onStateChange?.({
      mode: this.state.mode,
      zone: this.state.zone,
      message: this.state.message,
      objective: this.state.objective,
      dna: this.state.dna,
      bestRun: this.state.bestRun,
      runScore: this.runStats.score,
      sessionDna: this.runStats.sessionDna,
      scavengersDefeated: this.runStats.scavengersDefeated,
      predatorsDefeated: this.runStats.predatorsDefeated,
      huntSummary: this.runStats.summary,
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      sprintCharge: this.player.sprintCharge,
      biteCharge: clamp(1 - this.player.attackCooldown / Math.max(0.01, this.playerStats.biteCooldown), 0, 1),
      attackPhase: this.player.attackPhase,
      attackResult: this.player.attackResult,
      surgeCharge: clamp(this.surge.timer / FERAL_SURGE_MAX_TIMER, 0, 1),
      surgeLevel: this.surge.level,
      lowHealth: this.player.health <= this.player.maxHealth * LOW_HEALTH_THRESHOLD,
      dangerBoost: this.state.zone === "danger" ? DANGER_REWARD_MULTIPLIER : 1,
      threatDistance: Number.isFinite(closestThreat) ? closestThreat : null,
      zoneTransition: this.zoneTransition,
      upgrades: this.state.upgrades,
      upgradeEntries,
      editorOpen: this.state.editorOpen,
      editorPulse: this.player.evolutionTimer > 0 ? this.player.evolutionTimer / 1.45 : 0,
      creatureIdentity: identity,
      creatureProfile: {
        ...this.state.creatureProfile,
        patternLabel: PATTERN_LABELS[this.state.creatureProfile.patternType] ?? PATTERN_LABELS[0],
      },
      alignment: this.state.alignment,
      traitStats: statEntries,
      lastEvolution: this.state.lastEvolution,
      hasSave: this.state.hasSave,
      canUpgrade: this.state.zone === "nest" && this.state.mode !== "menu",
      canOpenEditor: this.state.zone === "nest" && this.state.mode === "playing" && this.state.respawnTimer <= 0,
      controlsHint: this.state.mode === "menu"
        ? "Left click move, WASD/Arrows steer, Space/right click bite, F fullscreen"
        : this.state.editorOpen
          ? "Nest editor open. Spend DNA, then press Esc or Close Editor."
          : "Left click move, WASD/Arrows steer, Shift sprint, Space/right click bite",
    });
  }

  dispose() {
    window.cancelAnimationFrame(this.animationFrame);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("keydown", this.handleKey);
    window.removeEventListener("keyup", this.handleKey);
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
    if (window.__sporeSliceGameInstance === this) {
      delete window.__sporeSliceGameInstance;
    }

    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
