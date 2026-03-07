import * as THREE from "three";

import {
  DANGER_ZONE,
  ENEMY_DEFS,
  FOOD_SPAWNS,
  MIGRATION_EVENT_DEFS,
  NEST_POSITION,
  PLAYER_BASE_STATS,
  SPECIES_DEFS,
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
const SPECIES_RING_GEOMETRY = new THREE.RingGeometry(0.94, 1, 40);
const EFFECT_RING_GEOMETRY = new THREE.RingGeometry(0.34, 0.62, 18);
const EFFECT_SHARD_GEOMETRY = new THREE.OctahedronGeometry(0.18, 0);
const EFFECT_BITE_ARC_GEOMETRY = new THREE.TorusGeometry(1.05, 0.11, 4, 16, Math.PI * 0.95);
const ECOSYSTEM_EVENT_MIN_DELAY = 18;
const ECOSYSTEM_EVENT_MAX_DELAY = 28;
const NEST_ATTACK_RANGE = 4.9;
const CARCASS_TTL = 18;
const MAX_CARCASSES = 6;
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
      ecosystemNotice: "The dunes are still settling.",
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
      herbivoresDefeated: 0,
      timeAlive: 0,
      score: 0,
      bestRun: this.saveData.bestRun ?? 0,
      summary: "Fresh hatchling. No hunts logged yet.",
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
      if (!nest.destroyed) {
        nest.alert = Math.max(0, nest.alert - dt * 0.55);
        nest.respawnTimer = Math.max(0, nest.respawnTimer - dt);
        nest.marker.position.y = Math.sin(this.elapsed * (1.4 + index * 0.16)) * 0.12 + nest.alert * 0.24;
        nest.marker.rotation.y += dt * (0.22 + index * 0.03);
        nest.marker.scale.setScalar(1 + nest.alert * 0.06 + (playerTerritory?.speciesId === nest.speciesId ? 0.03 : 0));
      } else {
        nest.alert = 0;
        nest.marker.position.y = damp(nest.marker.position.y, -0.58, 4, dt);
      }
    });

    this.ecosystem.territories.forEach((territory, index) => {
      const nest = this.getNestForSpecies(territory.speciesId);
      const playerInside = playerTerritory?.id === territory.id;
      territory.alert = Math.max(0, territory.alert - dt * 0.4);
      if (playerInside && this.state.mode === "playing" && this.state.zone !== "nest") {
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
        : 0.05 + presence * 0.04 + alertStrength * 0.17 + (playerInside ? 0.08 : 0);
      territory.pulse.material.opacity = nest?.destroyed
        ? 0
        : 0.03 + presence * 0.04 + alertStrength * 0.18 + (playerInside ? 0.12 : 0);
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
      const currentTerritory = this.currentTerritory ?? this.getCurrentTerritoryForPosition(playerPosition);
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
        editorOpen: this.state.editorOpen,
        message: this.state.message,
        objective: this.state.objective,
        ecosystemNotice: this.state.ecosystemNotice,
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
      herbivoresDefeated: 0,
      timeAlive: 0,
      score: 0,
      bestRun: 0,
      summary: "Fresh hatchling. No hunts logged yet.",
    };
    this.clearFeralSurge();
    this.updatePlayerStats();
    this.applyUpgradeVisuals();
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
      nest.destroyed = true;
      nest.ring.material.opacity = 0.03;
      nest.pulse.material.opacity = 0;
      nest.marker.rotation.z = -0.12;
      nest.marker.position.y -= 0.6;
      this.setEcosystemNotice(`${nest.species.name} nest broken. Their territory is no longer reinforced.`, 4.4);
      this.state.message = `${nest.species.name} nest collapses under your bite.`;
      return true;
    }

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
      this.runStats.summary = `Run score ${this.runStats.score}. ${this.runStats.predatorsDefeated} predators, ${this.runStats.scavengersDefeated} scavengers, and ${this.runStats.herbivoresDefeated} herbivores brought down.`;
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
    enemy.staggerTimer = enemy.hp <= 0 ? 0.28 : (enemy.type === "predator" ? 0.18 : 0.3) / (enemy.spec.poise ?? 1);
    enemy.fleeTimer = enemy.type !== "predator" && enemy.hp > 0 ? 0.48 : 0;
    enemy.cooldown = Math.max(enemy.cooldown, enemy.type === "predator" ? 0.55 : 0.42);
    if (sourceDirection) {
      enemy.hitDirection.copy(sourceDirection);
    }
    enemy.state = enemy.type === "predator" ? "staggered" : enemy.type === "herbivore" ? "panicked" : "reeling";
    enemy.need = enemy.type === "predator" ? "defending" : "fleeing";
    enemy.targetCreatureId = sourceKind === "creature" && attacker ? attacker.group.userData.enemyId : null;
    if (sourceKind === "player") {
      this.player.attackRecoil = Math.max(this.player.attackRecoil, enemy.hp <= 0 ? 1 : 0.7);
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
        this.awardDNA(
          enemy.spec.reward,
          `You defeat a ${enemy.species.name.toLowerCase()} and harvest ${enemy.spec.reward} DNA.`,
          {
            position: enemy.group.position,
            source: enemy.type === "herbivore" ? "herbivore" : enemy.type,
          },
        );
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
      this.setImpactPause(0.05, 1.8, 0.1);
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

      if (playerInsideTerritory && !playerInNest && distanceToPlayer < (territory?.radius ?? 12) + 5) {
        enemy.territoryAlert = Math.max(enemy.territoryAlert, enemy.type === "herbivore" ? 0.44 : 0.78);
      }
      if (nest?.alert > 0) {
        enemy.territoryAlert = Math.max(enemy.territoryAlert, nest.alert);
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
        enemy.attackTelegraph = Math.max(0, enemy.attackTelegraph - dt);

        let strikeTargetPosition = null;
        let strikeTarget = null;
        if (enemy.attackTargetKind === "creature") {
          strikeTarget = enemyById.get(enemy.attackTargetId) ?? null;
          strikeTargetPosition = strikeTarget?.group.position ?? null;
        } else if (!playerInNest) {
          strikeTargetPosition = this.player.group.position;
        }

        if (strikeTargetPosition) {
          enemy.attackVector.copy(vectorC.subVectors(strikeTargetPosition, position).setY(0));
          if (enemy.attackVector.lengthSq() > 0.0001) {
            enemy.attackVector.normalize();
          }
          desiredDirection = enemy.attackVector;
          desiredSpeed = enemy.spec.speed * (enemy.variant === "hornedPredator" ? 0.24 : enemy.type === "predator" ? 0.2 : 0.14);
        } else {
          enemy.attackTelegraph = 0;
        }

        if (enemy.attackTelegraph <= 0 && previousTelegraph > 0) {
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
          const playerThreat = !playerInNest && distanceToPlayer < 7.2 && (playerInsideTerritory || intimidationPressure > 0.1 || this.state.zone === "danger");
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
        } else if (enemy.type === "scavenger") {
          const guardPredator = carcassTarget?.carcass.guardedBy ? enemyById.get(carcassTarget.carcass.guardedBy) ?? null : null;
          const predatorPressure = predatorThreat && predatorThreat.distance < (enemy.variant === "armoredScavenger" ? 5.1 : 6.2);
          const shouldFlee = enemy.variant !== "armoredScavenger"
            && (enemy.hp < enemy.maxHp * 0.45 || enemy.fleeTimer > 0 || predatorPressure || (intimidationPressure > 0.16 && distanceToPlayer < 6.2));

          if (shouldFlee) {
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
          } else if (!playerInNest && (playerInsideTerritory || (distanceToPlayer < enemy.spec.aggroRadius && (playerVulnerable || enemy.territoryAlert > 0.45 || this.state.zone === "danger")))) {
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
          if (!playerInNest && playerInsideTerritory) {
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
          } else if (!playerInNest && distanceToPlayer < enemy.spec.aggroRadius && (this.state.zone === "danger" || playerVulnerable || enemy.territoryAlert > 0.42)) {
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
      const pressureGlow = enemy.territoryAlert * 0.16 + (nextNeed === "migrating" ? 0.08 : 0) + (nextNeed === "hunting" || nextNeed === "defending" ? 0.12 : 0);
      const fleeLean = nextNeed === "fleeing" ? 0.12 : 0;
      enemy.refs.body.position.z = -telegraphStrength * 0.14 - staggerStrength * 0.18 + pressureGlow * 0.08 - fleeLean * 0.08;
      enemy.refs.back.position.z = -0.7 - telegraphStrength * 0.08 + staggerStrength * 0.06 + pressureGlow * 0.04;
      enemy.refs.headPivot.rotation.x = Math.sin(gait * 0.35) * 0.08 - telegraphStrength * 0.2 - staggerStrength * 0.24 + fleeLean * 0.08;
      enemy.refs.tailGroup.rotation.x = Math.sin(gait * 0.5) * 0.18 + telegraphStrength * 0.12 + staggerStrength * 0.18 + fleeLean * 0.12;
      enemy.refs.materials.skin.emissive.setRGB(
        enemy.hitFlash * 0.8 + telegraphStrength * 0.8 + enemy.threatGlow * 0.18 + pressureGlow * 0.55,
        enemy.hitFlash * 0.25 + telegraphStrength * 0.2 + pressureGlow * 0.18,
        enemy.hitFlash * 0.18 + pressureGlow * 0.12,
      );
      enemy.refs.materials.skin.emissiveIntensity = enemy.hitFlash * 0.9 + telegraphStrength * 1.1 + enemy.threatGlow * 0.22 + pressureGlow * 0.46;
      enemy.refs.materials.accent.emissiveIntensity = enemy.baseBackGlow + telegraphStrength * 0.85 + enemy.threatGlow * 0.2 + pressureGlow * 0.32;
      enemy.refs.materials.markings.emissiveIntensity = enemy.baseMarkingGlow + enemy.threatGlow * 0.18 + telegraphStrength * 0.12 + pressureGlow * 0.22;
      enemy.group.scale.set(
        enemy.baseScale * (1 + enemy.impactPulse * 0.08 + pressureGlow * 0.02),
        enemy.baseScale * (1 - enemy.impactPulse * 0.06 - staggerStrength * 0.03 - fleeLean * 0.02),
        enemy.baseScale * (1 + enemy.impactPulse * 0.14 + staggerStrength * 0.05 + pressureGlow * 0.03),
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
    this.updateEcosystem(simDt);
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
    const currentTerritory = this.currentTerritory ?? this.getCurrentTerritoryForPosition(this.player.group.position);
    const territorySpecies = currentTerritory ? SPECIES_DEFS[currentTerritory.speciesId] : null;
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
      herbivoresDefeated: this.runStats.herbivoresDefeated,
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
      nearbySpecies,
      nearbyNests,
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
          : "Left click move, WASD/Arrows steer, Shift sprint, Space/right click bite. Territories react to you.",
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
