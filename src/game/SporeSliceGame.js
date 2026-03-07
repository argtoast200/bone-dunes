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
import { DEFAULT_SAVE, clearSave, loadSave, saveProgress } from "./save";
import { buildWorld, getTerrainHeight } from "./world";

const FIXED_STEP = 1 / 60;
const PLAYER_HEIGHT = 2.2;
const CAMERA_HEIGHT = 5.8;
const CAMERA_DISTANCE = 10.5;
const ATTACK_DURATION = 0.28;
const ATTACK_LUNGE_DURATION = 0.14;
const ATTACK_LUNGE_SPEED = 10.5;
const MOVE_TARGET_STOP_DISTANCE = 1.25;
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
]);

const vectorA = new THREE.Vector3();
const vectorB = new THREE.Vector3();
const vectorC = new THREE.Vector3();
const vectorD = new THREE.Vector3();
const upVector = new THREE.Vector3(0, 1, 0);

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

function getDistance2D(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
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
  scale = 1,
  aggressive = false,
  crest = false,
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
    emissive: crest ? accentColor : 0x000000,
    emissiveIntensity: crest ? 0.35 : 0,
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

  const hornLeft = new THREE.Mesh(new THREE.ConeGeometry(0.18 * scale, 0.75 * scale, 4), accentMaterial);
  hornLeft.position.set(-0.38 * scale, 0.5 * scale, 0.05 * scale);
  hornLeft.rotation.z = 0.28;
  headPivot.add(hornLeft);

  const hornRight = hornLeft.clone();
  hornRight.position.x *= -1;
  hornRight.rotation.z *= -1;
  headPivot.add(hornRight);

  const eyeLeft = new THREE.Mesh(new THREE.SphereGeometry(0.13 * scale, 6, 6), eyeMaterial);
  eyeLeft.position.set(-0.28 * scale, 0.1 * scale, 0.64 * scale);
  headPivot.add(eyeLeft);

  const eyeRight = eyeLeft.clone();
  eyeRight.position.x *= -1;
  headPivot.add(eyeRight);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.45 * scale, 1.8 * scale, 5), accentMaterial);
  tail.position.set(0, 0.2 * scale, -2.1 * scale);
  tail.rotation.x = -Math.PI * 0.55;
  tail.castShadow = true;
  group.add(tail);

  const crestGroup = new THREE.Group();
  crestGroup.visible = crest;
  for (let index = 0; index < 4; index += 1) {
    const frill = new THREE.Mesh(new THREE.ConeGeometry(0.2 * scale, 0.85 * scale, 4), accentMaterial);
    frill.position.set(0, 0.8 * scale + index * 0.1 * scale, -1 * scale + index * 0.7 * scale);
    frill.rotation.z = Math.PI / 2;
    crestGroup.add(frill);
  }
  group.add(crestGroup);

  const legPivots = [];
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
    group.add(pivot);
  });

  return {
    group,
    refs: {
      headPivot,
      jaw,
      tail,
      body,
      crestGroup,
      legPivots,
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
  const model = makeCreatureModel({
    bodyColor: spec.color,
    accentColor: spec.accent,
    scale: spec.scale,
    aggressive: type === "predator",
    crest: type === "predator",
  });

  return {
    ...model,
    type,
    spec,
    velocity: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    state: "idle",
    hp: spec.health,
    maxHp: spec.health,
    cooldown: 0,
    deadTimer: 0,
    roamTimer: 0,
    bob: Math.random() * Math.PI * 2,
    hitFlash: 0,
  };
}

function getUpgradeLevels(saveData) {
  return {
    speed: clamp(saveData.upgrades.speed ?? 0, 0, 3),
    health: clamp(saveData.upgrades.health ?? 0, 0, 3),
    bite: clamp(saveData.upgrades.bite ?? 0, 0, 3),
    crest: clamp(saveData.upgrades.crest ?? 0, 0, 1),
  };
}

function computePlayerStats(upgrades) {
  return {
    speed: PLAYER_BASE_STATS.speed * (1 + upgrades.speed * 0.12),
    health: PLAYER_BASE_STATS.health + upgrades.health * 28,
    biteDamage: PLAYER_BASE_STATS.biteDamage + upgrades.bite * 9,
  };
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
      upgrades: getUpgradeLevels(this.saveData),
      hasSave: this.saveData.dna > 0 || Object.values(this.saveData.upgrades).some(Boolean),
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
      scale: 1.15,
      crest: false,
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
      attackTimer: 0,
      attackCooldown: 0,
      attackLungeTimer: 0,
      invulnerability: 0,
      hurtTint: 0,
      stepCycle: 0,
      attackSwingId: 0,
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

  setupLights() {
    const hemi = new THREE.HemisphereLight(0xffe0ba, 0x5b4638, 1.65);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xffe7c6, 2.2);
    keyLight.position.set(-18, 24, 10);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 70;
    keyLight.shadow.camera.left = -30;
    keyLight.shadow.camera.right = 30;
    keyLight.shadow.camera.top = 30;
    keyLight.shadow.camera.bottom = -30;
    this.scene.add(keyLight);

    const fillLight = new THREE.PointLight(0x76ffe5, 4.6, 26, 2);
    fillLight.position.set(NEST_POSITION.x, getTerrainHeight(NEST_POSITION.x, NEST_POSITION.z) + 5, NEST_POSITION.z);
    this.scene.add(fillLight);

    const dangerLight = new THREE.PointLight(0xff6e48, 5.4, 32, 2);
    dangerLight.position.set(DANGER_ZONE.x, getTerrainHeight(DANGER_ZONE.x, DANGER_ZONE.z) + 5, DANGER_ZONE.z);
    this.scene.add(dangerLight);
  }

  spawnFoods() {
    FOOD_SPAWNS.forEach((spawn, index) => {
      const group = createFoodMesh(spawn.rare);
      const y = getTerrainHeight(spawn.x, spawn.z) + 1.35;
      group.position.set(spawn.x, y, spawn.z);
      group.userData.baseY = y;
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
      const enemy = createEnemy("scavenger");
      enemy.spawn = spawn;
      enemy.group.position.set(spawn.x, getTerrainHeight(spawn.x, spawn.z) + 1.3, spawn.z);
      enemy.home = new THREE.Vector3(spawn.x, enemy.group.position.y, spawn.z);
      enemy.group.rotation.y = Math.random() * Math.PI * 2;
      enemy.group.userData.enemyId = `scavenger-${index}`;
      this.scene.add(enemy.group);
      this.enemies.push(enemy);
    });

    PREDATOR_SPAWNS.forEach((spawn, index) => {
      const enemy = createEnemy("predator");
      enemy.spawn = spawn;
      enemy.group.position.set(spawn.x, getTerrainHeight(spawn.x, spawn.z) + 1.5, spawn.z);
      enemy.home = new THREE.Vector3(spawn.x, enemy.group.position.y, spawn.z);
      enemy.group.rotation.y = Math.random() * Math.PI * 2;
      enemy.group.userData.enemyId = `predator-${index}`;
      this.scene.add(enemy.group);
      this.enemies.push(enemy);
    });
  }

  startGame() {
    if (this.state.mode === "menu") {
      this.state.mode = "playing";
      this.state.message = this.state.hasSave
        ? "The dunes remember you. Hunt, gather DNA, then return home to evolve."
        : "Food glows across the dunes. Bring DNA home before the predators close in.";
      this.state.startedAt = this.elapsed;
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
      case "KeyF":
        if (pressed && !event.repeat) {
          this.toggleFullscreen();
        }
        break;
      default:
        break;
    }
  }

  handleMouseDown(event) {
    this.renderer.domElement.focus();
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
    if (!(key in this.virtualInput)) {
      return;
    }

    this.virtualInput[key] = pressed;
    if (key === "attackHeld" && pressed) {
      this.queueAttack();
    }
  }

  queueAttack() {
    if (this.state.mode !== "playing" || this.state.respawnTimer > 0) {
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
        state: enemy.state,
        x: Number(enemy.group.position.x.toFixed(1)),
        z: Number(enemy.group.position.z.toFixed(1)),
        hp: Number(enemy.hp.toFixed(0)),
        distance: Number(distance.toFixed(1)),
      })).slice(0, 6);

      return JSON.stringify({
        coordinate_system: "x east/right, z south-to-north on the ground plane, y up",
        mode: this.state.mode,
        zone: this.state.zone,
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
          atNest: this.state.zone === "nest",
          attackReady: this.player.attackCooldown <= 0,
          sprinting: this.input.sprint,
        },
        moveTarget: this.moveTarget.active
          ? {
              x: Number(this.moveTarget.position.x.toFixed(1)),
              z: Number(this.moveTarget.position.z.toFixed(1)),
              distance: Number(getDistance2D(playerPosition, this.moveTarget.position).toFixed(1)),
            }
          : null,
        upgrades: this.state.upgrades,
        food: nearbyFoods,
        enemies: nearbyEnemies,
      });
    };
  }

  applyUpgradeVisuals() {
    this.player.refs.crestGroup.visible = Boolean(this.state.upgrades.crest);
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
      upgrades: this.state.upgrades,
    });
  }

  awardDNA(amount, message) {
    this.state.dna += amount;
    this.state.message = message;
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
    this.updatePlayerStats();
    this.applyUpgradeVisuals();
    this.player.health = Math.min(this.player.maxHealth, this.player.health + this.player.maxHealth * 0.25);
    this.state.message = `${spec.label} evolved. ${spec.description}.`;
    this.persistProgress();
    this.emitState();
  }

  resetProgress() {
    clearSave();
    this.saveData = { ...DEFAULT_SAVE, upgrades: { ...DEFAULT_SAVE.upgrades } };
    this.state.dna = 0;
    this.state.upgrades = getUpgradeLevels(this.saveData);
    this.state.hasSave = false;
    this.state.message = "The nest is quiet again. A fresh organism emerges.";
    this.updatePlayerStats();
    this.applyUpgradeVisuals();
    this.resetPlayerToNest(true);
    this.foods.forEach((food) => {
      food.active = true;
      food.respawnTimer = 0;
      food.group.visible = true;
    });
    this.enemies.forEach((enemy) => this.respawnEnemy(enemy));
    this.emitState();
  }

  resetPlayerToNest(initial = false) {
    const spawnY = getTerrainHeight(NEST_POSITION.x, NEST_POSITION.z) + PLAYER_HEIGHT;
    this.player.group.position.set(NEST_POSITION.x, spawnY, NEST_POSITION.z);
    this.player.velocity.set(0, 0, 0);
    this.player.yaw = Math.PI;
    this.player.health = this.playerStats.health;
    this.player.maxHealth = this.playerStats.health;
    this.player.attackCooldown = initial ? 0 : 0.6;
    this.player.attackTimer = 0;
    this.player.attackLungeTimer = 0;
    this.player.invulnerability = 1.2;
    this.player.hurtTint = 0;
    this.clearMoveTarget();
  }

  respawnEnemy(enemy) {
    enemy.deadTimer = 0;
    enemy.hp = enemy.maxHp;
    enemy.cooldown = 0.8;
    enemy.state = "idle";
    enemy.group.visible = true;
    enemy.group.position.set(enemy.spawn.x, getTerrainHeight(enemy.spawn.x, enemy.spawn.z) + (enemy.type === "predator" ? 1.5 : 1.3), enemy.spawn.z);
    enemy.home.set(enemy.group.position.x, enemy.group.position.y, enemy.group.position.z);
    enemy.velocity.set(0, 0, 0);
  }

  damagePlayer(amount, sourceDirection) {
    if (this.player.invulnerability > 0 || this.state.respawnTimer > 0) {
      return;
    }

    this.player.health = Math.max(0, this.player.health - amount);
    this.player.invulnerability = 0.65;
    this.player.hurtTint = 0.5;
    this.player.velocity.addScaledVector(sourceDirection, 3.8);
    this.state.message = this.player.health > 0
      ? "A creature tears into you. Fall back or finish the fight."
      : "You collapse in the dunes.";

    if (this.player.health <= 0) {
      this.state.respawnTimer = 2.3;
      const dnaLoss = Math.min(this.state.dna, 8);
      this.state.dna -= dnaLoss;
      this.persistProgress();
      this.state.message = dnaLoss > 0
        ? `You lose ${dnaLoss} DNA and reform at the nest.`
        : "You reform at the nest.";
    }
  }

  damageEnemy(enemy, amount) {
    if (enemy.deadTimer > 0) {
      return;
    }

    enemy.hp = Math.max(0, enemy.hp - amount);
    enemy.hitFlash = 0.25;
    enemy.state = "threatened";

    if (enemy.hp <= 0) {
      enemy.deadTimer = enemy.type === "predator" ? 11 : 8;
      enemy.group.visible = false;
      this.awardDNA(enemy.spec.reward, `You defeat a ${enemy.spec.label} and harvest ${enemy.spec.reward} DNA.`);
    }
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
      const range = enemy.type === "predator" ? 5.4 : 4.7;
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
    if (this.player.attackCooldown > 0 || this.state.mode !== "playing") {
      return;
    }

    this.player.attackTimer = ATTACK_DURATION;
    this.player.attackCooldown = 0.62;
    this.player.attackLungeTimer = ATTACK_LUNGE_DURATION;
    this.player.attackSwingId += 1;

    const lockedTarget = this.findAttackTarget();
    if (lockedTarget) {
      vectorA.subVectors(lockedTarget.group.position, this.player.group.position).setY(0);
      if (vectorA.lengthSq() > 0.0001) {
        vectorA.normalize();
        this.player.yaw = Math.atan2(vectorA.x, vectorA.z);
      }
    }

    const forward = vectorD.set(Math.sin(this.player.yaw), 0, Math.cos(this.player.yaw));
    const playerPosition = this.player.group.position;

    this.enemies.forEach((enemy) => {
      if (enemy.deadTimer > 0) {
        return;
      }

      vectorA.subVectors(enemy.group.position, playerPosition);
      const horizontalDistance = Math.hypot(vectorA.x, vectorA.z);
      if (horizontalDistance > (enemy.type === "predator" ? 4.8 : 4.1)) {
        return;
      }

      vectorA.y = 0;
      vectorA.normalize();
      const dot = vectorA.dot(forward);
      const dotThreshold = enemy === lockedTarget ? -0.7 : -0.1;
      if (dot < dotThreshold) {
        return;
      }

      this.damageEnemy(enemy, this.playerStats.biteDamage);
      enemy.velocity.addScaledVector(vectorA, 3.8);
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
        this.awardDNA(food.spawn.dna, `You absorb ${food.spawn.dna} DNA from a nutrient bloom.`);
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
      enemy.bob += dt * (enemy.type === "predator" ? 7 : 5.5);

      const position = enemy.group.position;
      const distanceToPlayer = getDistance2D(position, this.player.group.position);
      const distanceToHome = getDistance2D(position, enemy.home);
      const playerInNest = this.state.zone === "nest";

      enemy.roamTimer -= dt;
      if (enemy.roamTimer <= 0) {
        enemy.roamTimer = 1.4 + Math.random() * 2.2;
        enemy.direction.set(Math.sin(enemy.bob * 0.4), 0, Math.cos(enemy.bob * 0.6)).normalize();
      }

      if (!playerInNest && distanceToPlayer < enemy.spec.aggroRadius) {
        enemy.state = enemy.type === "predator" ? "chasing" : "harassing";
      } else if (distanceToHome > enemy.spec.leashRadius) {
        enemy.state = "returning";
      } else if (enemy.state !== "threatened") {
        enemy.state = "idle";
      }

      let desiredDirection = vectorB.set(0, 0, 0);
      let desiredSpeed = 0;

      if (enemy.state === "chasing" || enemy.state === "harassing" || enemy.state === "threatened") {
        desiredDirection = vectorB.subVectors(this.player.group.position, position).setY(0);
        if (enemy.type === "scavenger" && enemy.hp < enemy.maxHp * 0.45) {
          desiredDirection.multiplyScalar(-1);
          desiredSpeed = enemy.spec.speed * 1.08;
          enemy.state = "fleeing";
        } else {
          desiredSpeed = enemy.spec.speed;
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

      if (desiredDirection.lengthSq() > 0.0001) {
        desiredDirection.normalize();
      }

      vectorC.copy(desiredDirection).multiplyScalar(desiredSpeed);
      dampVector(enemy.velocity, vectorC, 6, dt);
      position.addScaledVector(enemy.velocity, dt);

      position.x = clamp(position.x, -WORLD_RADIUS, WORLD_RADIUS);
      position.z = clamp(position.z, -WORLD_RADIUS, WORLD_RADIUS);
      position.y = getTerrainHeight(position.x, position.z) + (enemy.type === "predator" ? 1.5 : 1.3);

      if (enemy.velocity.lengthSq() > 0.1) {
        const yaw = Math.atan2(enemy.velocity.x, enemy.velocity.z);
        enemy.group.rotation.y = damp(enemy.group.rotation.y, yaw, 12, dt);
      }

      const gait = this.elapsed * (enemy.type === "predator" ? 10 : 12) + enemy.bob;
      enemy.refs.legPivots.forEach((leg, index) => {
        leg.rotation.x = Math.sin(gait + index * Math.PI * 0.9) * 0.5;
      });
      enemy.refs.headPivot.rotation.x = Math.sin(gait * 0.35) * 0.08;
      enemy.refs.tail.rotation.x = -Math.PI * 0.55 + Math.sin(gait * 0.5) * 0.18;
      enemy.refs.body.material.emissive.setRGB(enemy.hitFlash * 0.8, enemy.hitFlash * 0.25, enemy.hitFlash * 0.18);
      enemy.refs.body.material.emissiveIntensity = enemy.hitFlash * 0.9;

      if (distanceToPlayer <= enemy.spec.attackRange && enemy.cooldown <= 0 && this.state.respawnTimer <= 0) {
        const direction = vectorA.subVectors(this.player.group.position, enemy.group.position).setY(0);
        if (direction.lengthSq() > 0.0001) {
          direction.normalize();
        }
        this.damagePlayer(enemy.spec.damage, direction);
        enemy.cooldown = enemy.type === "predator" ? 1.4 : 1.1;
      }
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

    const moveForward = Number(this.input.forward || this.virtualInput.forward) - Number(this.input.backward || this.virtualInput.backward);
    const moveStrafe = Number(this.input.right || this.virtualInput.right) - Number(this.input.left || this.virtualInput.left);
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

    const sprintBonus = this.input.sprint ? 1.08 : 1;
    const desiredSpeed = moving ? this.playerStats.speed * sprintBonus : 0;
    const desiredVelocity = vectorD.copy(desiredDirection).multiplyScalar(desiredSpeed);

    this.player.attackLungeTimer = Math.max(0, this.player.attackLungeTimer - dt);
    if (this.player.attackLungeTimer > 0) {
      vectorB.set(Math.sin(this.player.yaw), 0, Math.cos(this.player.yaw));
      desiredVelocity.addScaledVector(vectorB, ATTACK_LUNGE_SPEED * (this.player.attackLungeTimer / ATTACK_LUNGE_DURATION));
    }

    dampVector(this.player.velocity, desiredVelocity, moving ? 14 : 8, dt);

    if (moving || this.player.attackLungeTimer > 0 || this.player.velocity.lengthSq() > 0.04) {
      const yawSource = this.player.velocity.lengthSq() > 0.04 ? this.player.velocity : desiredDirection;
      const desiredYaw = Math.atan2(yawSource.x, yawSource.z);
      const yawDelta = normalizeAngle(desiredYaw - this.player.yaw);
      this.player.yaw = normalizeAngle(this.player.yaw + yawDelta * (1 - Math.exp(-16 * dt)));
    }

    this.player.group.position.addScaledVector(this.player.velocity, dt);
    this.player.group.position.x = clamp(this.player.group.position.x, -WORLD_RADIUS + 2, WORLD_RADIUS - 2);
    this.player.group.position.z = clamp(this.player.group.position.z, -WORLD_RADIUS + 2, WORLD_RADIUS - 2);
    this.player.group.position.y = getTerrainHeight(this.player.group.position.x, this.player.group.position.z) + PLAYER_HEIGHT;
    this.player.group.rotation.y = this.player.yaw;

    this.player.stepCycle += this.player.velocity.length() * dt * 0.7;
    const step = this.player.stepCycle * 10.5;
    this.player.refs.legPivots.forEach((leg, index) => {
      leg.rotation.x = Math.sin(step + index * Math.PI * 0.9) * Math.min(0.62, this.player.velocity.length() * 0.045);
    });

    this.player.attackTimer = Math.max(0, this.player.attackTimer - dt);
    this.player.attackCooldown = Math.max(0, this.player.attackCooldown - dt);
    this.player.invulnerability = Math.max(0, this.player.invulnerability - dt);
    this.player.hurtTint = Math.max(0, this.player.hurtTint - dt * 2);

    if (this.input.attackQueued) {
      this.triggerAttack();
      this.input.attackQueued = false;
    }

    const jawOpen = this.player.attackTimer > 0 ? Math.sin((this.player.attackTimer / ATTACK_DURATION) * Math.PI) : 0;
    this.player.refs.jaw.rotation.x = Math.PI * 0.48 + jawOpen * 0.48;
    this.player.refs.headPivot.rotation.x = jawOpen * -0.18 + Math.sin(this.elapsed * 2.6) * 0.02;
    this.player.refs.tail.rotation.x = -Math.PI * 0.55 + Math.sin(this.elapsed * 3.2) * 0.14 + jawOpen * 0.1;
    this.player.groundMarker.material.opacity = 0.26 + Math.sin(this.elapsed * 5.5) * 0.04 + jawOpen * 0.12;
    this.player.groundMarker.rotation.z += dt * 0.35;

    const tintStrength = this.player.hurtTint;
    this.player.refs.body.material.emissive.setRGB(tintStrength * 0.5, tintStrength * 0.1, tintStrength * 0.08);
    this.player.refs.body.material.emissiveIntensity = tintStrength;

    this.state.zone = getZoneName(this.player.group.position);

    if (this.state.zone === "nest") {
      this.player.health = Math.min(this.player.maxHealth, this.player.health + dt * 16);
      this.state.objective = "Safe nest: heal up and spend DNA on evolutions.";
    } else if (this.state.zone === "danger") {
      this.state.objective = "Territory zone: stronger predators, richer DNA blooms.";
    } else {
      this.state.objective = "Bone dunes: forage, skirmish, and return before things get ugly.";
    }
  }

  updateCamera(dt) {
    const focus = this.player.group.position;
    const heading = this.player.yaw;
    this.cameraTarget.set(focus.x, focus.y + 1.75, focus.z);
    this.cameraGoal.set(
      focus.x - Math.sin(heading) * CAMERA_DISTANCE,
      focus.y + CAMERA_HEIGHT,
      focus.z - Math.cos(heading) * CAMERA_DISTANCE,
    );

    if (this.state.zone === "danger") {
      this.cameraGoal.y += 0.8;
      this.cameraGoal.x += 1.2;
    }

    dampVector(this.camera.position, this.cameraGoal, 5, dt);
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
    this.updateAmbient(dt);
    this.updatePlayer(dt);
    this.updateFood(dt);
    this.updateEnemies(dt);
    this.updateCamera(dt);
    this.updateMoveTargetMarker(dt);

    if (this.state.mode === "playing" && this.state.zone === "danger" && this.player.attackCooldown <= 0.05 && this.elapsed % 8 < dt) {
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
        maxed: cost == null,
        canBuy: this.state.zone === "nest" && cost != null && this.state.dna >= cost && this.state.mode !== "menu",
      };
    });

    this.onStateChange?.({
      mode: this.state.mode,
      zone: this.state.zone,
      message: this.state.message,
      objective: this.state.objective,
      dna: this.state.dna,
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      upgrades: this.state.upgrades,
      upgradeEntries,
      hasSave: this.state.hasSave,
      canUpgrade: this.state.zone === "nest" && this.state.mode !== "menu",
      controlsHint: this.state.mode === "menu"
        ? "Left click move, WASD/Arrows steer, Space/right click bite, F fullscreen"
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
