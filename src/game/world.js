import * as THREE from "three";

import {
  BIOME_DEFS,
  DANGER_ZONE,
  EMBER_RIDGE_ZONE,
  MARSH_ZONE,
  NEST_POSITION,
  ORIGIN_POOL,
  SALT_FLATS_ZONE,
  SHALLOWS_ZONE,
  WORLD_RADIUS,
} from "./config";

const sandColor = 0xcfa06c;
const shadowSandColor = 0x8f6947;
const rockColor = 0x84634d;
const boneColor = 0xf2deb8;
const plantStemColor = 0x314b36;
const plantGlowColor = 0x79f2d2;

const tempColor = new THREE.Color();
const yAxis = new THREE.Vector3(0, 1, 0);

const WATERFALL_DEFS = [
  {
    key: "emberCascade",
    label: "Ember Cascade",
    topX: 28.8,
    topZ: 25.8,
    baseX: 24.6,
    baseZ: 19.8,
    topOffset: 1.15,
    baseOffset: 0.18,
    width: 1.75,
    poolRadius: 2.8,
    color: 0xa7fff5,
    shadowColor: 0x61d9d2,
  },
  {
    key: "basinFalls",
    label: "Basin Falls",
    topX: 34.6,
    topZ: -24.4,
    baseX: 31.9,
    baseZ: -21.6,
    topOffset: 1.2,
    baseOffset: 0.22,
    width: 1.6,
    poolRadius: 2.5,
    color: 0xbff9ff,
    shadowColor: 0x79d5d8,
  },
];

function smoothstep(edge0, edge1, value) {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function radialPeak(x, z, centerX, centerZ, radius, height, sharpness = 1.75) {
  const distance = Math.hypot(x - centerX, z - centerZ);
  const t = Math.max(0, 1 - distance / radius);
  return height * Math.pow(smoothstep(0, 1, t), sharpness);
}

function ridgeBand(distance, radius, halfWidth, height) {
  const t = Math.max(0, 1 - Math.abs(distance - radius) / halfWidth);
  return height * smoothstep(0, 1, t);
}

function resolvePoint(positionOrX, zValue) {
  if (typeof positionOrX === "object" && positionOrX != null) {
    return { x: positionOrX.x, z: positionOrX.z };
  }
  return { x: positionOrX, z: zValue };
}

export function getBiomeKeyAtPosition(positionOrX, zValue = 0) {
  const { x, z } = resolvePoint(positionOrX, zValue);
  const dangerDistance = Math.hypot(x - DANGER_ZONE.x, z - DANGER_ZONE.z);
  if (dangerDistance <= DANGER_ZONE.radius + 2.5) {
    return "jawBasin";
  }

  const emberDistance = Math.hypot(x - EMBER_RIDGE_ZONE.x, z - EMBER_RIDGE_ZONE.z);
  if (emberDistance <= EMBER_RIDGE_ZONE.radius + 2) {
    return "emberRidge";
  }

  const originDistance = Math.hypot(x - ORIGIN_POOL.x, z - ORIGIN_POOL.z);
  if (originDistance <= ORIGIN_POOL.radius + 1.5) {
    return "originWaters";
  }

  const saltDistance = Math.hypot(x - SALT_FLATS_ZONE.x, z - SALT_FLATS_ZONE.z);
  if (saltDistance <= SALT_FLATS_ZONE.radius + 2.2) {
    return "saltFlats";
  }

  const marshDistance = Math.hypot(x - MARSH_ZONE.x, z - MARSH_ZONE.z);
  if (marshDistance <= MARSH_ZONE.radius + 1.5) {
    return "glowMarsh";
  }

  const shallowsDistance = Math.hypot(x - SHALLOWS_ZONE.x, z - SHALLOWS_ZONE.z);
  if (shallowsDistance <= SHALLOWS_ZONE.radius + 1.8 || (x < -6 && x > -41 && z > 3 && z < 31)) {
    return "sunlitShallows";
  }

  return "boneDunes";
}

export function getBiomeDefAtPosition(positionOrX, zValue = 0) {
  return BIOME_DEFS[getBiomeKeyAtPosition(positionOrX, zValue)] ?? BIOME_DEFS.boneDunes;
}

export function getTerrainHeight(x, z) {
  const duneA = Math.sin(x * 0.11 + z * 0.05) * 2.2;
  const duneB = Math.cos(z * 0.14 - x * 0.03) * 1.6;
  const duneC = Math.sin((x + z) * 0.07) * 1.1;
  const baseTerrain = duneA + duneB + duneC;

  const originDistance = Math.hypot(x - ORIGIN_POOL.x, z - ORIGIN_POOL.z);
  const originFactor = Math.max(0, 1 - originDistance / (ORIGIN_POOL.radius + 6));
  const originLagoon = -4.6 * smoothstep(0, 1, originFactor);

  const shallowsDistance = Math.hypot(x - SHALLOWS_ZONE.x, z - SHALLOWS_ZONE.z);
  const shallowsFactor = Math.max(0, 1 - shallowsDistance / (SHALLOWS_ZONE.radius + 7));
  const shallowsShelf = -1.9 * smoothstep(0, 1, shallowsFactor);

  const marshDistance = Math.hypot(x - MARSH_ZONE.x, z - MARSH_ZONE.z);
  const marshFactor = Math.max(0, 1 - marshDistance / (MARSH_ZONE.radius + 6));
  const marshFloor = -1.6 * smoothstep(0, 1, marshFactor);
  const marshHummocks = Math.sin(x * 0.18 + z * 0.05) * Math.cos(z * 0.15 - x * 0.04) * 0.32 * marshFactor;

  const saltDistance = Math.hypot(x - SALT_FLATS_ZONE.x, z - SALT_FLATS_ZONE.z);
  const saltFactor = Math.max(0, 1 - saltDistance / (SALT_FLATS_ZONE.radius + 7));
  const saltPanTarget = -0.45 + Math.sin(x * 0.22 + z * 0.07) * 0.12 + Math.cos(z * 0.18 - x * 0.04) * 0.08;

  const dangerDistance = Math.hypot(x - DANGER_ZONE.x, z - DANGER_ZONE.z);
  const dangerFactor = Math.max(0, 1 - dangerDistance / (DANGER_ZONE.radius + 6));
  const dangerBowl = -4.7 * smoothstep(0, 1, dangerFactor);
  const dangerRimBand = Math.max(0, 1 - Math.abs(dangerDistance - (DANGER_ZONE.radius - 4.2)) / 5.4);
  const dangerRim = ridgeBand(dangerDistance, DANGER_ZONE.radius - 4.2, 5.4, 9.2);
  const dangerTeeth = (0.58 + 0.42 * Math.sin(x * 0.31 + z * 0.14) * Math.cos(z * 0.18 - x * 0.08)) * 2.4 * smoothstep(0, 1, dangerRimBand);
  const dangerNotch = radialPeak(x, z, DANGER_ZONE.x - 10.5, DANGER_ZONE.z + 6.5, 7.2, 5.8, 1.25);
  const dangerMountains = Math.max(0, dangerRim + dangerTeeth - dangerNotch);

  const emberDistance = Math.hypot(x - EMBER_RIDGE_ZONE.x, z - EMBER_RIDGE_ZONE.z);
  const emberFactor = Math.max(0, 1 - emberDistance / (EMBER_RIDGE_ZONE.radius + 7));
  const emberRise = 3.6 * smoothstep(0, 1, emberFactor);
  const emberRidges = (0.62 + 0.38 * Math.sin(x * 0.24 - z * 0.1) * Math.cos(z * 0.12 + x * 0.05)) * 2.1 * emberFactor;
  const emberPeakA = radialPeak(x, z, EMBER_RIDGE_ZONE.x + 1.5, EMBER_RIDGE_ZONE.z + 1.2, 12.6, 9.8, 1.6);
  const emberPeakB = radialPeak(x, z, EMBER_RIDGE_ZONE.x + 8.2, EMBER_RIDGE_ZONE.z + 6.1, 8.6, 7.2, 1.8);
  const emberPeakC = radialPeak(x, z, EMBER_RIDGE_ZONE.x - 7.2, EMBER_RIDGE_ZONE.z - 3.8, 7.8, 6.4, 1.8);
  const emberSaddle = radialPeak(x, z, EMBER_RIDGE_ZONE.x - 1.8, EMBER_RIDGE_ZONE.z + 7.5, 10.5, 3.8, 1.3);
  const emberMountains = emberPeakA + emberPeakB + emberPeakC + emberSaddle + emberRidges;

  const nestDistance = Math.hypot(x - NEST_POSITION.x, z - NEST_POSITION.z);
  const nestFactor = Math.max(0, 1 - nestDistance / (NEST_POSITION.radius + 5));
  const shorelineLift = smoothstep(-28, -8, x) * smoothstep(0, 1, 1 - Math.abs(z - 18) / 26) * 0.45;
  const terrainWithBiomes = baseTerrain
    + originLagoon
    + shallowsShelf
    + marshFloor
    + marshHummocks
    + shorelineLift
    + emberRise
    + emberMountains
    + dangerMountains;
  const saltFlattened = THREE.MathUtils.lerp(terrainWithBiomes, saltPanTarget, smoothstep(0, 1, saltFactor));
  const nestShelf = THREE.MathUtils.lerp(saltFlattened, 0.7, smoothstep(0, 1, nestFactor));

  const ring = Math.max(0, 1 - Math.abs(Math.hypot(x, z) - (WORLD_RADIUS - 8)) / 10) * -1.4;

  return nestShelf + dangerBowl + ring;
}

function makeRock(color) {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: 1,
    metalness: 0.05,
  });
}

function addRockCluster(group, x, z, scale, rotation = 0, tint = rockColor) {
  const cluster = new THREE.Group();
  cluster.position.set(x, getTerrainHeight(x, z), z);
  cluster.rotation.y = rotation;

  for (let index = 0; index < 4; index += 1) {
    const piece = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.8 + index * 0.18, 0),
      makeRock(tint + index * 0x020202),
    );
    piece.position.set(
      (index - 1.5) * 0.9,
      0.6 + Math.sin(index) * 0.2,
      Math.cos(index * 1.7) * 0.9,
    );
    piece.rotation.set(index * 0.25, index * 0.5, index * 0.15);
    piece.scale.setScalar(scale * (1 + index * 0.08));
    piece.castShadow = true;
    piece.receiveShadow = true;
    cluster.add(piece);
  }

  group.add(cluster);
}

function addBasaltPeak(group, x, z, scale, rotation = 0, glow = false) {
  const peak = new THREE.Group();
  peak.position.set(x, getTerrainHeight(x, z), z);
  peak.rotation.y = rotation;

  const basaltMaterial = new THREE.MeshStandardMaterial({
    color: glow ? 0x5f352f : 0x5a473f,
    emissive: glow ? 0xff7d54 : 0x000000,
    emissiveIntensity: glow ? 0.14 : 0,
    flatShading: true,
    roughness: 1,
    metalness: 0.04,
  });

  const shardCount = 4;
  for (let index = 0; index < shardCount; index += 1) {
    const shard = new THREE.Mesh(
      new THREE.ConeGeometry((0.9 + index * 0.2) * scale, (9 + index * 1.4) * scale, 6),
      basaltMaterial,
    );
    shard.position.set(
      (index - 1.5) * 1.2 * scale,
      (4.6 + index * 0.55) * scale,
      Math.sin(index * 1.7) * 1.1 * scale,
    );
    shard.rotation.set(index * 0.06, index * 0.65, (index - 1.5) * 0.08);
    shard.castShadow = true;
    shard.receiveShadow = true;
    peak.add(shard);
  }

  const cap = new THREE.Mesh(
    new THREE.DodecahedronGeometry(1.4 * scale, 0),
    new THREE.MeshStandardMaterial({
      color: glow ? 0x805245 : 0x6d574e,
      emissive: glow ? 0xff9f6d : 0x000000,
      emissiveIntensity: glow ? 0.12 : 0,
      flatShading: true,
      roughness: 0.96,
    }),
  );
  cap.position.set(0.3 * scale, 10.4 * scale, -0.25 * scale);
  cap.scale.set(1.15, 0.92, 1.05);
  cap.castShadow = true;
  peak.add(cap);

  group.add(peak);
}

function addBoneRibs(group, x, z, scale, rotation) {
  const ribs = new THREE.Group();
  ribs.position.set(x, getTerrainHeight(x, z) + 0.3, z);
  ribs.rotation.y = rotation;

  const spine = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.3 * scale, 3.8 * scale, 4, 8),
    new THREE.MeshStandardMaterial({
      color: boneColor,
      flatShading: true,
      roughness: 0.9,
    }),
  );
  spine.rotation.z = Math.PI / 2;
  spine.castShadow = true;
  ribs.add(spine);

  for (let index = 0; index < 6; index += 1) {
    const rib = new THREE.Mesh(
      new THREE.TorusGeometry(0.9 * scale, 0.08 * scale, 5, 10, Math.PI * 0.82),
      new THREE.MeshStandardMaterial({
        color: boneColor,
        flatShading: true,
        roughness: 0.92,
      }),
    );
    rib.position.set((index - 2.5) * 0.55 * scale, 0.5 * scale, 0);
    rib.rotation.set(Math.PI * 0.55, 0, Math.PI * 0.5);
    rib.castShadow = true;
    ribs.add(rib);
  }

  group.add(ribs);
}

function addArch(group, x, z, scale, rotation) {
  const arch = new THREE.Group();
  arch.position.set(x, getTerrainHeight(x, z), z);
  arch.rotation.y = rotation;

  const legGeometry = new THREE.CylinderGeometry(0.8 * scale, 1.1 * scale, 7 * scale, 5);
  const bridgeGeometry = new THREE.CapsuleGeometry(0.75 * scale, 7.5 * scale, 5, 10);
  const material = makeRock(0x76523e);

  const leftLeg = new THREE.Mesh(legGeometry, material);
  leftLeg.position.set(-3.3 * scale, 3 * scale, 0);
  leftLeg.rotation.z = 0.08;
  leftLeg.castShadow = true;
  leftLeg.receiveShadow = true;
  arch.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeometry, material);
  rightLeg.position.set(3.2 * scale, 3.1 * scale, 0);
  rightLeg.rotation.z = -0.11;
  rightLeg.castShadow = true;
  rightLeg.receiveShadow = true;
  arch.add(rightLeg);

  const bridge = new THREE.Mesh(bridgeGeometry, material);
  bridge.position.set(0, 6.8 * scale, 0);
  bridge.rotation.z = Math.PI / 2;
  bridge.castShadow = true;
  bridge.receiveShadow = true;
  arch.add(bridge);

  group.add(arch);
}

function addGlowPlant(group, x, z, scale, swayNodes) {
  const plant = new THREE.Group();
  plant.position.set(x, getTerrainHeight(x, z), z);

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18 * scale, 0.24 * scale, 2.2 * scale, 5),
    new THREE.MeshStandardMaterial({
      color: plantStemColor,
      flatShading: true,
      roughness: 1,
    }),
  );
  stem.position.y = 1.1 * scale;
  stem.castShadow = true;
  plant.add(stem);

  const headPivot = new THREE.Group();
  headPivot.position.y = 2 * scale;

  const cap = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.9 * scale, 0),
    new THREE.MeshStandardMaterial({
      color: plantGlowColor,
      emissive: plantGlowColor,
      emissiveIntensity: 0.8,
      flatShading: true,
      roughness: 0.65,
    }),
  );
  cap.scale.set(1.15, 0.55, 1.15);
  headPivot.add(cap);
  plant.add(headPivot);
  group.add(plant);

  swayNodes.push({
    pivot: headPivot,
    phase: x * 0.3 + z * 0.19,
    amplitude: 0.12 + scale * 0.02,
  });
}

function addReedPatch(group, x, z, scale, swayNodes) {
  const patch = new THREE.Group();
  patch.position.set(x, getTerrainHeight(x, z), z);

  for (let index = 0; index < 5; index += 1) {
    const stemPivot = new THREE.Group();
    stemPivot.position.set((Math.random() - 0.5) * 1.2 * scale, 0, (Math.random() - 0.5) * 1.1 * scale);
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08 * scale, 0.12 * scale, 1.9 * scale, 5),
      new THREE.MeshStandardMaterial({
        color: index % 2 === 0 ? 0x476348 : 0x597b56,
        flatShading: true,
        roughness: 1,
      }),
    );
    stem.position.y = 0.92 * scale;
    stem.castShadow = true;
    stemPivot.add(stem);

    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.14 * scale, 0.45 * scale, 5),
      new THREE.MeshStandardMaterial({
        color: 0xc6f0bf,
        emissive: 0x87f0ca,
        emissiveIntensity: 0.12,
        flatShading: true,
        roughness: 0.9,
      }),
    );
    tip.position.y = 2 * scale;
    tip.castShadow = true;
    stemPivot.add(tip);
    patch.add(stemPivot);

    swayNodes.push({
      pivot: stemPivot,
      phase: x * 0.22 + z * 0.18 + index,
      amplitude: 0.07 + scale * 0.01,
    });
  }

  group.add(patch);
}

function addCoralCluster(group, x, z, scale) {
  const cluster = new THREE.Group();
  cluster.position.set(x, getTerrainHeight(x, z), z);

  for (let index = 0; index < 4; index += 1) {
    const shard = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.45 * scale + index * 0.08 * scale, 0),
      new THREE.MeshStandardMaterial({
        color: index % 2 === 0 ? 0x9cf6e2 : 0xffd5a2,
        emissive: index % 2 === 0 ? 0x68efd8 : 0xffba7f,
        emissiveIntensity: 0.22,
        flatShading: true,
        roughness: 0.74,
      }),
    );
    shard.position.set((index - 1.5) * 0.45 * scale, 0.35 + Math.sin(index) * 0.18, Math.cos(index * 1.4) * 0.48 * scale);
    shard.scale.set(0.8, 1.35, 0.8);
    shard.rotation.set(index * 0.2, index * 0.55, index * 0.18);
    shard.castShadow = true;
    cluster.add(shard);
  }

  group.add(cluster);
}

function addBoneSpire(group, x, z, scale, rotation = 0, glow = false) {
  const spire = new THREE.Group();
  spire.position.set(x, getTerrainHeight(x, z), z);
  spire.rotation.y = rotation;

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28 * scale, 0.55 * scale, 6.2 * scale, 6),
    new THREE.MeshStandardMaterial({
      color: boneColor,
      emissive: glow ? 0xffb078 : 0x000000,
      emissiveIntensity: glow ? 0.28 : 0,
      flatShading: true,
      roughness: 0.9,
    }),
  );
  shaft.position.y = 3 * scale;
  shaft.rotation.z = 0.06;
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  spire.add(shaft);

  const shard = new THREE.Mesh(
    new THREE.ConeGeometry(0.65 * scale, 2 * scale, 5),
    new THREE.MeshStandardMaterial({
      color: glow ? 0xf7c79b : 0xe8d6b8,
      emissive: glow ? 0xff8b5b : 0x000000,
      emissiveIntensity: glow ? 0.3 : 0,
      flatShading: true,
      roughness: 0.84,
    }),
  );
  shard.position.set(0, 6.6 * scale, 0.1 * scale);
  shard.rotation.z = 0.12;
  shard.castShadow = true;
  spire.add(shard);

  const brace = new THREE.Mesh(
    new THREE.BoxGeometry(0.34 * scale, 1.9 * scale, 0.8 * scale),
    new THREE.MeshStandardMaterial({
      color: glow ? 0x8f543d : 0x6f503d,
      flatShading: true,
      roughness: 0.98,
    }),
  );
  brace.position.set(0.4 * scale, 1.4 * scale, -0.25 * scale);
  brace.rotation.set(0.2, 0.25, -0.14);
  brace.castShadow = true;
  spire.add(brace);

  group.add(spire);
}

function createDustCloud() {
  const count = 180;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const seeds = new Float32Array(count);

  for (let index = 0; index < count; index += 1) {
    const radius = Math.random() * (WORLD_RADIUS - 10);
    const theta = Math.random() * Math.PI * 2;
    const x = Math.cos(theta) * radius;
    const z = Math.sin(theta) * radius;
    const y = getTerrainHeight(x, z) + 3.5 + Math.random() * 5.5;

    positions[index * 3] = x;
    positions[index * 3 + 1] = y;
    positions[index * 3 + 2] = z;

    tempColor.set(index % 6 === 0 ? 0xffd9a2 : 0xe8c59a);
    tempColor.offsetHSL((Math.random() - 0.5) * 0.04, 0, (Math.random() - 0.5) * 0.08);
    colors[index * 3] = tempColor.r;
    colors[index * 3 + 1] = tempColor.g;
    colors[index * 3 + 2] = tempColor.b;
    seeds[index] = Math.random() * Math.PI * 2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.userData.basePositions = positions.slice();
  geometry.userData.seeds = seeds;

  const material = new THREE.PointsMaterial({
    size: 0.35,
    vertexColors: true,
    transparent: true,
    opacity: 0.75,
    sizeAttenuation: true,
    depthWrite: false,
  });

  return new THREE.Points(geometry, material);
}

function createZoneParticles({ count, centerX, centerZ, radius, color, altColor, minHeight, maxHeight, size }) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const seeds = new Float32Array(count);

  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.sqrt(Math.random()) * radius;
    const x = centerX + Math.cos(angle) * distance;
    const z = centerZ + Math.sin(angle) * distance;
    const y = getTerrainHeight(x, z) + minHeight + Math.random() * (maxHeight - minHeight);

    positions[index * 3] = x;
    positions[index * 3 + 1] = y;
    positions[index * 3 + 2] = z;

    tempColor.set(index % 3 === 0 ? altColor : color);
    tempColor.offsetHSL((Math.random() - 0.5) * 0.05, 0, (Math.random() - 0.5) * 0.08);
    colors[index * 3] = tempColor.r;
    colors[index * 3 + 1] = tempColor.g;
    colors[index * 3 + 2] = tempColor.b;
    seeds[index] = Math.random() * Math.PI * 2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.userData.basePositions = positions.slice();
  geometry.userData.seeds = seeds;
  geometry.userData.center = { x: centerX, z: centerZ };

  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size,
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      sizeAttenuation: true,
      depthWrite: false,
    }),
  );
}

function createWaterfallFeature(definition) {
  const top = new THREE.Vector3(
    definition.topX,
    getTerrainHeight(definition.topX, definition.topZ) + definition.topOffset,
    definition.topZ,
  );
  const base = new THREE.Vector3(
    definition.baseX,
    getTerrainHeight(definition.baseX, definition.baseZ) + definition.baseOffset,
    definition.baseZ,
  );
  const flow = new THREE.Vector3().subVectors(base, top);
  const length = flow.length();
  const direction = flow.clone().normalize();
  const midpoint = top.clone().lerp(base, 0.5);

  const group = new THREE.Group();
  group.position.copy(midpoint);
  group.quaternion.setFromUnitVectors(yAxis, direction);

  const sheetMaterial = new THREE.MeshBasicMaterial({
    color: definition.color,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: false,
  });
  const sheetMaterialCross = sheetMaterial.clone();
  sheetMaterialCross.opacity = 0.22;
  const coreMaterial = new THREE.MeshBasicMaterial({
    color: 0xe5fffe,
    transparent: true,
    opacity: 0.44,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: false,
  });
  const dropletMaterial = new THREE.MeshBasicMaterial({
    color: 0xf2ffff,
    transparent: true,
    opacity: 0.56,
    depthWrite: false,
    fog: false,
  });

  const sheetGeometry = new THREE.PlaneGeometry(definition.width * 1.45, length, 1, 1);
  const sheetA = new THREE.Mesh(sheetGeometry, sheetMaterial);
  sheetA.rotation.y = Math.PI * 0.1;
  group.add(sheetA);

  const sheetB = new THREE.Mesh(sheetGeometry, sheetMaterialCross);
  sheetB.rotation.y = Math.PI * 0.58;
  group.add(sheetB);

  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(definition.width * 0.16, definition.width * 0.3, length * 0.98, 6, 1, true),
    coreMaterial,
  );
  group.add(core);

  const droplets = [];
  for (let index = 0; index < 8; index += 1) {
    const droplet = new THREE.Mesh(
      new THREE.OctahedronGeometry(definition.width * (0.13 + (index % 3) * 0.025), 0),
      dropletMaterial,
    );
    droplet.userData = {
      phase: index / 8,
      speed: 0.45 + index * 0.04,
      sway: (index % 2 === 0 ? 1 : -1) * (0.08 + (index % 3) * 0.015),
    };
    group.add(droplet);
    droplets.push(droplet);
  }

  const crest = createWaterSurface(definition.width * 0.82, definition.color, 0.22);
  crest.position.copy(top);
  crest.position.y += 0.06;
  crest.material.color.set(definition.color);

  const pool = createWaterSurface(definition.poolRadius, 0x8ef3eb, 0.24);
  pool.position.copy(base);
  pool.position.y += 0.08;
  pool.material.color.offsetHSL(0, 0, 0.04);

  const foamRing = new THREE.Mesh(
    new THREE.RingGeometry(definition.poolRadius * 0.54, definition.poolRadius * 0.92, 28),
    new THREE.MeshBasicMaterial({
      color: 0xf3fffb,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false,
    }),
  );
  foamRing.rotation.x = -Math.PI / 2;
  foamRing.position.copy(base);
  foamRing.position.y += 0.1;

  const mist = createZoneParticles({
    count: 24,
    centerX: base.x,
    centerZ: base.z,
    radius: definition.poolRadius * 0.78,
    color: definition.shadowColor,
    altColor: 0xf0fffd,
    minHeight: 0.3,
    maxHeight: 2,
    size: 0.14,
  });
  mist.material.opacity = 0.4;

  return {
    key: definition.key,
    label: definition.label,
    group,
    top,
    base,
    length,
    width: definition.width,
    direction,
    sheets: [sheetA, sheetB],
    sheetMaterials: [sheetMaterial, sheetMaterialCross],
    core,
    coreMaterial,
    droplets,
    crest,
    pool,
    foamRing,
    mist,
    basin: {
      key: definition.key,
      label: definition.label,
      x: base.x,
      z: base.z,
      y: base.y,
      topY: top.y,
      radius: definition.poolRadius,
      safeRadius: definition.poolRadius * 1.28,
    },
  };
}

function createSunHalo() {
  const halo = new THREE.Group();

  const outer = new THREE.Mesh(
    new THREE.CircleGeometry(16, 48),
    new THREE.MeshBasicMaterial({
      color: 0xffc88e,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    }),
  );
  halo.add(outer);

  const inner = new THREE.Mesh(
    new THREE.CircleGeometry(10.5, 40),
    new THREE.MeshBasicMaterial({
      color: 0xffefc4,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
    }),
  );
  inner.position.z = 0.2;
  halo.add(inner);

  halo.lookAt(0, 0, 0);
  return halo;
}

function createWaterSurface(radius, color, opacity) {
  const surface = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 56),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  surface.rotation.x = -Math.PI / 2;
  return surface;
}

function createSkyCloud({
  scale = 1,
  color = 0xfff0dc,
  shadowColor = 0xdfb993,
  opacity = 0.54,
  stretch = 1.9,
  puffCount = 6,
}) {
  const cloud = new THREE.Group();

  const puffMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    fog: false,
  });
  const shadowMaterial = new THREE.MeshBasicMaterial({
    color: shadowColor,
    transparent: true,
    opacity: opacity * 0.58,
    depthWrite: false,
    fog: false,
  });

  const materials = [puffMaterial, shadowMaterial];

  for (let index = 0; index < puffCount; index += 1) {
    const angle = (index / puffCount) * Math.PI * 2 + (index % 2 === 0 ? 0.25 : -0.18);
    const radius = 0.8 + (index % 3) * 0.34;
    const size = 0.85 + (index % 4) * 0.18;
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 0), puffMaterial);
    puff.position.set(
      Math.cos(angle) * radius * scale * 0.95,
      (index % 2 === 0 ? 0.35 : -0.1) * scale + Math.sin(index * 1.3) * 0.18 * scale,
      Math.sin(angle) * radius * scale * 0.42,
    );
    puff.scale.set(stretch * (1 + index * 0.04), 0.7 + (index % 3) * 0.08, 1.15 + (index % 2) * 0.16);
    cloud.add(puff);
  }

  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 0), puffMaterial);
  core.position.y = 0.28 * scale;
  core.scale.set(stretch * 1.35, 0.9, 1.4);
  cloud.add(core);

  for (let index = 0; index < 2; index += 1) {
    const underbelly = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05 - index * 0.08, 0), shadowMaterial);
    underbelly.position.set(index === 0 ? -0.55 * scale : 0.72 * scale, -0.42 * scale, index === 0 ? -0.22 * scale : 0.16 * scale);
    underbelly.scale.set(stretch * (1.15 - index * 0.12), 0.44, 1.02);
    cloud.add(underbelly);
  }

  cloud.userData.materials = materials;
  cloud.renderOrder = 2;
  return cloud;
}

function createCloudField(definitions) {
  const group = new THREE.Group();
  const clouds = definitions.map((definition, index) => {
    const cloud = createSkyCloud(definition);
    cloud.position.set(definition.x, definition.y, definition.z);
    cloud.rotation.y = definition.rotation ?? 0;
    group.add(cloud);
    return {
      group: cloud,
      materials: cloud.userData.materials,
      basePosition: new THREE.Vector3(definition.x, definition.y, definition.z),
      bob: definition.bob ?? 0.45,
      driftX: definition.driftX ?? 0.8,
      driftZ: definition.driftZ ?? 0.5,
      speed: definition.speed ?? 0.06,
      phase: definition.phase ?? index * 0.7,
      pulse: definition.pulse ?? 0.03,
      opacity: definition.opacity ?? 0.4,
      rotationSpeed: definition.rotationSpeed ?? 0.01,
    };
  });

  return { group, clouds };
}

function createCarrionBird(scale, color) {
  const bird = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.84,
  });

  const wingGeometry = new THREE.BoxGeometry(0.95 * scale, 0.03 * scale, 0.24 * scale);
  const leftWing = new THREE.Mesh(wingGeometry, material);
  leftWing.position.x = -0.4 * scale;
  leftWing.rotation.z = 0.42;
  bird.add(leftWing);

  const rightWing = new THREE.Mesh(wingGeometry, material);
  rightWing.position.x = 0.4 * scale;
  rightWing.rotation.z = -0.42;
  bird.add(rightWing);

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.2 * scale, 0.06 * scale, 0.5 * scale),
    material,
  );
  body.rotation.x = 0.12;
  bird.add(body);

  return bird;
}

function createCarrionFlock({ centerX, centerY, centerZ, radius, count, scale, color }) {
  const group = new THREE.Group();
  group.position.set(centerX, centerY, centerZ);
  const birds = [];

  for (let index = 0; index < count; index += 1) {
    const bird = createCarrionBird(scale * (0.8 + Math.random() * 0.5), color);
    bird.userData = {
      angle: Math.random() * Math.PI * 2,
      radius: radius * (0.55 + Math.random() * 0.5),
      speed: 0.14 + Math.random() * 0.08,
      phase: Math.random() * Math.PI * 2,
      height: (Math.random() - 0.5) * 1.6,
      depth: 0.45 + Math.random() * 0.4,
    };
    group.add(bird);
    birds.push(bird);
  }

  return {
    group,
    birds,
    speed: 0.002 + Math.random() * 0.0025,
  };
}

function addNest(group) {
  const nest = new THREE.Group();
  nest.position.set(NEST_POSITION.x, getTerrainHeight(NEST_POSITION.x, NEST_POSITION.z), NEST_POSITION.z);

  const ringMaterial = new THREE.MeshStandardMaterial({
    color: 0x8d6c54,
    flatShading: true,
    roughness: 0.95,
  });

  const centerBowl = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.8, 1.2, 10), ringMaterial);
  centerBowl.position.y = 0.4;
  centerBowl.receiveShadow = true;
  nest.add(centerBowl);

  for (let index = 0; index < 7; index += 1) {
    const angle = (index / 7) * Math.PI * 2;
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 0), ringMaterial);
    stone.position.set(Math.cos(angle) * 5.5, 0.8, Math.sin(angle) * 5.5);
    stone.scale.set(1.3, 0.9, 1.1);
    stone.castShadow = true;
    stone.receiveShadow = true;
    nest.add(stone);
  }

  for (let index = 0; index < 3; index += 1) {
    const egg = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.9, 0),
      new THREE.MeshStandardMaterial({
        color: 0xf8ddae,
        emissive: 0xffc675,
        emissiveIntensity: 0.35,
        flatShading: true,
      }),
    );
    egg.position.set(-1.2 + index * 1.25, 1.1, 0.3 - index * 0.25);
    egg.scale.set(0.8, 1.25, 0.8);
    nest.add(egg);
  }

  const safeRing = new THREE.Mesh(
    new THREE.RingGeometry(NEST_POSITION.radius - 0.6, NEST_POSITION.radius, 36),
    new THREE.MeshBasicMaterial({
      color: 0x8ff7da,
      opacity: 0.2,
      transparent: true,
      side: THREE.DoubleSide,
    }),
  );
  safeRing.rotation.x = -Math.PI / 2;
  safeRing.position.y = 0.05;
  nest.add(safeRing);

  for (let index = 0; index < 4; index += 1) {
    const angle = (index / 4) * Math.PI * 2 + 0.35;
    addBoneSpire(
      group,
      NEST_POSITION.x + Math.cos(angle) * (NEST_POSITION.radius - 1.8),
      NEST_POSITION.z + Math.sin(angle) * (NEST_POSITION.radius - 1.8),
      0.55,
      angle + Math.PI * 0.5,
      true,
    );
  }

  group.add(nest);
  return { nest, safeRing };
}

function addDangerMarker(group) {
  const marker = new THREE.Group();
  marker.position.set(DANGER_ZONE.x, getTerrainHeight(DANGER_ZONE.x, DANGER_ZONE.z), DANGER_ZONE.z);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(DANGER_ZONE.radius - 0.7, DANGER_ZONE.radius, 42),
    new THREE.MeshBasicMaterial({
      color: 0xff744c,
      opacity: 0.22,
      transparent: true,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  marker.add(ring);

  for (let index = 0; index < 6; index += 1) {
    const angle = (index / 6) * Math.PI * 2;
    addRockCluster(
      marker,
      Math.cos(angle) * (DANGER_ZONE.radius - 3),
      Math.sin(angle) * (DANGER_ZONE.radius - 3),
      0.85,
      angle,
      0x704131,
    );
  }

  for (let index = 0; index < 5; index += 1) {
    const angle = (index / 5) * Math.PI * 2 + 0.2;
    addBoneSpire(
      group,
      DANGER_ZONE.x + Math.cos(angle) * (DANGER_ZONE.radius - 1.6),
      DANGER_ZONE.z + Math.sin(angle) * (DANGER_ZONE.radius - 1.6),
      0.82,
      angle,
      true,
    );
  }

  group.add(marker);
  return { marker, ring };
}

export function buildWorld(scene) {
  scene.background = new THREE.Color(0xe3ae73);
  scene.fog = new THREE.FogExp2(0xd89d69, 0.022);

  const world = new THREE.Group();
  const swayNodes = [];

  const terrainGeometry = new THREE.PlaneGeometry(WORLD_RADIUS * 2.2, WORLD_RADIUS * 2.2, 110, 110);
  terrainGeometry.rotateX(-Math.PI / 2);

  const position = terrainGeometry.attributes.position;
  const colorValues = [];

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const z = position.getZ(index);
    const y = getTerrainHeight(x, z);
    position.setY(index, y);

    const edgeFade = THREE.MathUtils.clamp(Math.hypot(x, z) / WORLD_RADIUS, 0, 1);
    tempColor.set(sandColor).lerp(new THREE.Color(shadowSandColor), edgeFade * 0.45);

    const originFactor = Math.max(0, 1 - Math.hypot(x - ORIGIN_POOL.x, z - ORIGIN_POOL.z) / (ORIGIN_POOL.radius + 5));
    const shallowsFactor = Math.max(0, 1 - Math.hypot(x - SHALLOWS_ZONE.x, z - SHALLOWS_ZONE.z) / (SHALLOWS_ZONE.radius + 5));
    const marshFactor = Math.max(0, 1 - Math.hypot(x - MARSH_ZONE.x, z - MARSH_ZONE.z) / (MARSH_ZONE.radius + 4));
    const saltFactor = Math.max(0, 1 - Math.hypot(x - SALT_FLATS_ZONE.x, z - SALT_FLATS_ZONE.z) / (SALT_FLATS_ZONE.radius + 5));
    const emberFactor = Math.max(0, 1 - Math.hypot(x - EMBER_RIDGE_ZONE.x, z - EMBER_RIDGE_ZONE.z) / (EMBER_RIDGE_ZONE.radius + 6));
    tempColor.lerp(new THREE.Color(0x86b9a4), originFactor * 0.74);
    tempColor.lerp(new THREE.Color(0xb7d5b8), shallowsFactor * 0.28);
    tempColor.lerp(new THREE.Color(0x7a8660), marshFactor * 0.5);
    tempColor.lerp(new THREE.Color(0xd9e3cf), saltFactor * 0.72);
    tempColor.lerp(new THREE.Color(0xa95e47), emberFactor * 0.64);

    const dangerBlend = Math.max(0, 1 - Math.hypot(x - DANGER_ZONE.x, z - DANGER_ZONE.z) / (DANGER_ZONE.radius + 8));
    tempColor.lerp(new THREE.Color(0xaa6342), dangerBlend * 0.38);
    const highlandBlend = smoothstep(4, 15, y);
    tempColor.lerp(new THREE.Color(0x7d6656), highlandBlend * 0.28);

    colorValues.push(tempColor.r, tempColor.g, tempColor.b);
  }

  terrainGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colorValues, 3));
  terrainGeometry.computeVertexNormals();

  const terrainMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 1,
    metalness: 0,
  });

  const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
  terrain.receiveShadow = true;
  world.add(terrain);

  const nest = addNest(world);
  const dangerMarker = addDangerMarker(world);

  const deepLagoon = createWaterSurface(ORIGIN_POOL.radius * 1.06, 0x5bbdb8, 0.3);
  deepLagoon.position.set(ORIGIN_POOL.x, ORIGIN_POOL.surfaceY, ORIGIN_POOL.z);
  world.add(deepLagoon);

  const shorelineWater = createWaterSurface(SHALLOWS_ZONE.radius * 0.94, 0x8fd8c8, 0.16);
  shorelineWater.position.set(SHALLOWS_ZONE.x, ORIGIN_POOL.surfaceY + 0.18, SHALLOWS_ZONE.z);
  world.add(shorelineWater);

  const waterfalls = WATERFALL_DEFS.map((definition) => createWaterfallFeature(definition));
  waterfalls.forEach((waterfall) => {
    world.add(waterfall.group);
    world.add(waterfall.crest);
    world.add(waterfall.pool);
    world.add(waterfall.foamRing);
    world.add(waterfall.mist);
  });

  [
    [-35, 10, 1.1, 0.3],
    [-5, 23, 1.2, 1.1],
    [13, 18, 1.35, 0.8],
    [31, 4, 1.1, 2.2],
    [8, -21, 1.4, 1.4],
    [-20, -26, 1.2, 2.5],
    [39, -28, 1.1, 0.4],
    [-31, 30, 1.15, 0.7],
    [2, -30, 1.25, 1.9],
    [34, 18, 1.05, 2.4],
  ].forEach(([x, z, scale, rotation]) => addRockCluster(world, x, z, scale, rotation));

  [
    [-11, 11, 0.95, 0.6],
    [9, 10, 0.9, 1.5],
    [23, -10, 1.05, 0.2],
    [32, -25, 1.15, 2.1],
    [18, -31, 1.05, 0.8],
    [-28, 4, 0.92, 2.4],
  ].forEach(([x, z, scale, rotation]) => addBoneRibs(world, x, z, scale, rotation));

  [
    [-18, 2, 0.9, 0.4],
    [18, 20, 0.8, 1.8],
    [24, -24, 0.95, 0.25],
    [2, 28, 0.72, 2.2],
    [34, -8, 0.9, 1.4],
    [-30, -27, 0.82, 1.1],
    [34, 28, 0.78, 2.4],
  ].forEach(([x, z, scale, rotation]) => addArch(world, x, z, scale, rotation));

  [
    [-35, -18, 0.92, 0.35, 0xb8ab98],
    [-27, -30, 1.05, 1.8, 0xc4b9a7],
    [-22, -17, 0.88, 2.2, 0xb0a28f],
    [26, 25, 1.08, 1.1, 0x6b453b],
    [35, 31, 1.15, 0.4, 0x5b3b34],
    [40, 20, 0.92, 2.3, 0x74493d],
  ].forEach(([x, z, scale, rotation, tint]) => addRockCluster(world, x, z, scale, rotation, tint));

  [
    [24, -11, 1.2, 0.2, true],
    [33, -23, 1.45, 1.4, true],
    [29, 24, 1.35, 0.8, true],
    [37, 31, 1.6, 1.9, true],
  ].forEach(([x, z, scale, rotation, glow]) => addBasaltPeak(world, x, z, scale, rotation, glow));

  [
    [-39, 27, 0.8],
    [-36, 18, 0.95],
    [-31, 28, 0.82],
    [-28, 15, 0.92],
    [-24, 8, 1.1],
    [-14, 19, 1],
    [-4, 24, 1],
    [7, 8, 1.15],
    [15, 12, 0.95],
    [29, -12, 1.2],
    [34, -20, 1.15],
    [16, -29, 1.1],
    [26, -28, 1.25],
    [34, -8, 0.95],
    [-31, 18, 1.05],
    [27, 27, 0.96],
    [33, 33, 1.05],
  ].forEach(([x, z, scale]) => addGlowPlant(world, x, z, scale, swayNodes));

  [
    [-39, 23, 0.8],
    [-36, 28, 0.92],
    [-30, 19, 0.88],
    [-20, 23, 0.78],
    [40, -20, 1.4, 0.2, true],
    [28, -37, 1.2, 1.8, true],
    [-42, -30, 1.15, 2.4, false],
    [-38, 28, 1.25, 1.2, false],
    [44, 30, 1.05, 0.6, false],
    [-34, -26, 1.12, 1.4, false],
    [-24, -18, 0.96, 0.6, false],
    [26, 31, 1.18, 0.2, true],
    [36, 24, 1.1, 1.5, true],
  ].forEach(([x, z, scale, rotation, glow]) => addBoneSpire(world, x, z, scale, rotation, glow));

  const dust = createDustCloud();
  world.add(dust);
  [
    [-39, 24, 0.9],
    [-35, 18, 0.82],
    [-32, 28, 0.94],
    [-27, 18, 0.78],
  ].forEach(([x, z, scale]) => addCoralCluster(world, x, z, scale));

  [
    [-18, 26, 0.82],
    [-12, 31, 0.95],
    [-5, 35, 0.88],
    [0, 27, 0.86],
  ].forEach(([x, z, scale]) => addReedPatch(world, x, z, scale, swayNodes));

  [
    [-35, -22, 0.92],
    [-30, -29, 0.84],
    [-24, -18, 0.86],
    [27, 31, 0.88],
    [34, 24, 0.94],
  ].forEach(([x, z, scale]) => addCoralCluster(world, x, z, scale));
  const nestMotes = createZoneParticles({
    count: 70,
    centerX: NEST_POSITION.x,
    centerZ: NEST_POSITION.z,
    radius: NEST_POSITION.radius + 7,
    color: 0x8ff7da,
    altColor: 0xffefc9,
    minHeight: 1.2,
    maxHeight: 5.2,
    size: 0.24,
  });
  world.add(nestMotes);

  const originMotes = createZoneParticles({
    count: 72,
    centerX: ORIGIN_POOL.x,
    centerZ: ORIGIN_POOL.z,
    radius: ORIGIN_POOL.radius + 4,
    color: 0x82f7ea,
    altColor: 0xe9fffb,
    minHeight: 0.4,
    maxHeight: 2.6,
    size: 0.2,
  });
  world.add(originMotes);

  const marshMotes = createZoneParticles({
    count: 68,
    centerX: MARSH_ZONE.x,
    centerZ: MARSH_ZONE.z,
    radius: MARSH_ZONE.radius + 3,
    color: 0x7bf0c6,
    altColor: 0xc5ffd8,
    minHeight: 0.6,
    maxHeight: 3.8,
    size: 0.18,
  });
  world.add(marshMotes);

  const saltMotes = createZoneParticles({
    count: 72,
    centerX: SALT_FLATS_ZONE.x,
    centerZ: SALT_FLATS_ZONE.z,
    radius: SALT_FLATS_ZONE.radius + 4,
    color: 0xecf5e2,
    altColor: 0xa7f2df,
    minHeight: 0.4,
    maxHeight: 3.2,
    size: 0.18,
  });
  world.add(saltMotes);

  const dangerEmbers = createZoneParticles({
    count: 90,
    centerX: DANGER_ZONE.x,
    centerZ: DANGER_ZONE.z,
    radius: DANGER_ZONE.radius + 9,
    color: 0xff834f,
    altColor: 0xffd29a,
    minHeight: 0.8,
    maxHeight: 7.5,
    size: 0.28,
  });
  world.add(dangerEmbers);

  const emberMotes = createZoneParticles({
    count: 84,
    centerX: EMBER_RIDGE_ZONE.x,
    centerZ: EMBER_RIDGE_ZONE.z,
    radius: EMBER_RIDGE_ZONE.radius + 5,
    color: 0xff8f62,
    altColor: 0xffd1a1,
    minHeight: 0.8,
    maxHeight: 6.2,
    size: 0.22,
  });
  world.add(emberMotes);

  const sun = new THREE.Mesh(
    new THREE.IcosahedronGeometry(8, 1),
    new THREE.MeshBasicMaterial({
      color: 0xffe0a6,
      transparent: true,
      opacity: 0.95,
    }),
  );
  sun.position.set(-65, 48, -48);
  world.add(sun);

  const sunHalo = createSunHalo();
  sunHalo.position.copy(sun.position);
  world.add(sunHalo);

  const cloudField = createCloudField([
    {
      x: -22,
      y: 18.8,
      z: 18,
      scale: 10.8,
      stretch: 2.8,
      opacity: 0.6,
      driftX: 1.25,
      driftZ: 0.68,
      bob: 0.34,
      speed: 0.04,
      phase: 0.2,
      rotation: 0.18,
    },
    {
      x: -10,
      y: 36,
      z: -34,
      scale: 4.6,
      stretch: 2.35,
      opacity: 0.36,
      driftX: 1.1,
      driftZ: 1,
      bob: 0.55,
      speed: 0.035,
      phase: 1.1,
      rotation: -0.25,
    },
    {
      x: 8,
      y: 18.2,
      z: 10,
      scale: 9.4,
      stretch: 2.7,
      opacity: 0.58,
      driftX: 0.92,
      driftZ: 0.64,
      bob: 0.32,
      speed: 0.038,
      phase: 2.6,
      rotation: 0.34,
    },
    {
      x: 28,
      y: 18.8,
      z: -4,
      scale: 8.8,
      stretch: 2.8,
      opacity: 0.56,
      driftX: 1.12,
      driftZ: 0.86,
      bob: 0.4,
      speed: 0.032,
      phase: 3.3,
      rotation: -0.24,
    },
    {
      x: 30,
      y: 18.4,
      z: 27,
      scale: 3.1,
      stretch: 2.05,
      opacity: 0.3,
      driftX: 0.6,
      driftZ: 0.4,
      bob: 0.28,
      speed: 0.052,
      phase: 4.4,
      rotation: 0.28,
    },
    {
      x: 19,
      y: 19.2,
      z: -9,
      scale: 3.4,
      stretch: 2.15,
      opacity: 0.31,
      driftX: 0.72,
      driftZ: 0.46,
      bob: 0.3,
      speed: 0.05,
      phase: 5.2,
      rotation: -0.42,
    },
    {
      x: -20,
      y: 28.5,
      z: 24,
      scale: 3.7,
      stretch: 2.1,
      opacity: 0.32,
      driftX: 1,
      driftZ: 0.62,
      bob: 0.35,
      speed: 0.042,
      phase: 6.1,
      rotation: 0.18,
    },
  ]);
  world.add(cloudField.group);

  const moon = new THREE.Mesh(
    new THREE.IcosahedronGeometry(3.2, 0),
    new THREE.MeshBasicMaterial({
      color: 0xb9d8ff,
      transparent: true,
      opacity: 0.7,
    }),
  );
  moon.position.set(46, 32, -76);
  world.add(moon);

  const carrionFlock = createCarrionFlock({
    centerX: 24,
    centerY: 26,
    centerZ: -18,
    radius: 18,
    count: 6,
    scale: 1.35,
    color: 0x5a3226,
  });
  world.add(carrionFlock.group);

  const highFlock = createCarrionFlock({
    centerX: -8,
    centerY: 34,
    centerZ: -42,
    radius: 24,
    count: 5,
    scale: 1.1,
    color: 0x6b4031,
  });
  world.add(highFlock.group);

  scene.add(world);

  const zoneParticles = [nestMotes, originMotes, marshMotes, saltMotes, dangerEmbers, emberMotes];
  waterfalls.forEach((waterfall) => zoneParticles.push(waterfall.mist));

  return {
    world,
    terrain,
    swayNodes,
    dust,
    nestRing: nest.safeRing,
    dangerRing: dangerMarker.ring,
    zoneParticles,
    waterSurfaces: [
      { mesh: deepLagoon, baseY: ORIGIN_POOL.surfaceY, drift: 0.06, scale: 0.02, phase: 0 },
      { mesh: shorelineWater, baseY: ORIGIN_POOL.surfaceY + 0.18, drift: 0.04, scale: 0.015, phase: 1.1 },
    ],
    waterfalls,
    waterfallBasins: waterfalls.map((waterfall) => waterfall.basin),
    sunHalo,
    skyClouds: cloudField.clouds,
    skyFlocks: [carrionFlock, highFlock],
  };
}
