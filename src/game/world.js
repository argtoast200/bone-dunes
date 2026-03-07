import * as THREE from "three";

import { DANGER_ZONE, NEST_POSITION, WORLD_RADIUS } from "./config";

const sandColor = 0xcfa06c;
const shadowSandColor = 0x8f6947;
const rockColor = 0x84634d;
const boneColor = 0xf2deb8;
const plantStemColor = 0x314b36;
const plantGlowColor = 0x79f2d2;

const tempColor = new THREE.Color();

function smoothstep(edge0, edge1, value) {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function getTerrainHeight(x, z) {
  const duneA = Math.sin(x * 0.11 + z * 0.05) * 2.2;
  const duneB = Math.cos(z * 0.14 - x * 0.03) * 1.6;
  const duneC = Math.sin((x + z) * 0.07) * 1.1;

  const dangerDistance = Math.hypot(x - DANGER_ZONE.x, z - DANGER_ZONE.z);
  const dangerFactor = Math.max(0, 1 - dangerDistance / (DANGER_ZONE.radius + 6));
  const dangerBowl = -3.8 * smoothstep(0, 1, dangerFactor);

  const nestDistance = Math.hypot(x - NEST_POSITION.x, z - NEST_POSITION.z);
  const nestFactor = Math.max(0, 1 - nestDistance / (NEST_POSITION.radius + 5));
  const nestShelf = THREE.MathUtils.lerp(duneA + duneB + duneC, 0.7, smoothstep(0, 1, nestFactor));

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

    const dangerBlend = Math.max(0, 1 - Math.hypot(x - DANGER_ZONE.x, z - DANGER_ZONE.z) / (DANGER_ZONE.radius + 8));
    tempColor.lerp(new THREE.Color(0xaa6342), dangerBlend * 0.38);

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
  ].forEach(([x, z, scale, rotation]) => addArch(world, x, z, scale, rotation));

  [
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
  ].forEach(([x, z, scale]) => addGlowPlant(world, x, z, scale, swayNodes));

  [
    [40, -20, 1.4, 0.2, true],
    [28, -37, 1.2, 1.8, true],
    [-42, -30, 1.15, 2.4, false],
    [-38, 28, 1.25, 1.2, false],
    [44, 30, 1.05, 0.6, false],
  ].forEach(([x, z, scale, rotation, glow]) => addBoneSpire(world, x, z, scale, rotation, glow));

  const dust = createDustCloud();
  world.add(dust);
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

  scene.add(world);

  return {
    world,
    terrain,
    swayNodes,
    dust,
    nestRing: nest.safeRing,
    dangerRing: dangerMarker.ring,
    zoneParticles: [nestMotes, dangerEmbers],
  };
}
