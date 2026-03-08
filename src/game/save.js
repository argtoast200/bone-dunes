import { BIOME_DEFS, SPECIES_DEFS, UPGRADE_DEFS } from "./config";

const STORAGE_KEY = "bone-dunes-save-v1";
export const MAX_SPECIES_CREATURES = 6;

export const DEFAULT_TRAITS = {
  jaw: 0,
  horns: 0,
  crest: 0,
  tail: 0,
  legs: 0,
  arms: 0,
  wings: 0,
  spikes: 0,
  glow: 0,
};

export const DEFAULT_ALIGNMENT = {
  aggressive: 0.34,
  social: 0.33,
  adaptive: 0.33,
};

export const DEFAULT_TRAIT_BLUEPRINTS = UPGRADE_DEFS.reduce((blueprints, upgrade) => {
  blueprints[upgrade.key] = upgrade.unlock?.type === "starter";
  return blueprints;
}, {});

export function createDefaultBiomeProgress({ legacy = false } = {}) {
  const biomeKeys = Object.keys(BIOME_DEFS);
  const mastery = biomeKeys.reduce((entries, biomeKey) => {
    entries[biomeKey] = 0;
    return entries;
  }, {});

  if (legacy) {
    mastery.originWaters = 7;
    mastery.sunlitShallows = 9;
    mastery.glowMarsh = 11;
    mastery.boneDunes = 22;
    mastery.jawBasin = 14;
    return {
      originStarted: true,
      unlockedBiomes: [...biomeKeys],
      discoveredBiomes: [...biomeKeys],
      dominantBiome: "boneDunes",
      mastery,
    };
  }

  mastery.originWaters = 10;
  mastery.sunlitShallows = 3;
  return {
    originStarted: true,
    unlockedBiomes: ["originWaters", "sunlitShallows"],
    discoveredBiomes: ["originWaters", "sunlitShallows"],
    dominantBiome: "originWaters",
    mastery,
  };
}

export const DEFAULT_BIOME_PROGRESS = createDefaultBiomeProgress();

export const DEFAULT_SPECIES_RELATIONS = Object.values(SPECIES_DEFS).reduce((relations, species) => {
  relations[species.id] = {
    status: "wary",
    rapport: 0,
    friendship: 0,
    dominance: 0,
    allyUnlocked: false,
    alphaUnlocked: false,
  };
  return relations;
}, {});

export function createRandomCreatureProfile() {
  return {
    bodyHue: Number((0.05 + Math.random() * 0.08).toFixed(3)),
    accentHue: Number((0.42 + Math.random() * 0.12).toFixed(3)),
    markingsHue: Number((0.47 + Math.random() * 0.18).toFixed(3)),
    size: Number((0.94 + Math.random() * 0.12).toFixed(3)),
    patternType: Math.floor(Math.random() * 3),
    patternScale: Number((0.92 + Math.random() * 0.24).toFixed(3)),
  };
}

const LEGACY_UPGRADE_KEYS = {
  speed: "legs",
  health: "spikes",
  bite: "jaw",
  cooldown: "glow",
  crest: "crest",
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sanitizeTraits(rawUpgrades) {
  const upgrades = { ...DEFAULT_TRAITS };

  Object.keys(DEFAULT_TRAITS).forEach((key) => {
    if (Number.isFinite(rawUpgrades?.[key])) {
      upgrades[key] = Math.max(0, Math.round(rawUpgrades[key]));
    }
  });

  Object.entries(LEGACY_UPGRADE_KEYS).forEach(([legacyKey, traitKey]) => {
    if (!Number.isFinite(rawUpgrades?.[legacyKey])) {
      return;
    }

    const legacyLevel = Math.max(0, Math.round(rawUpgrades[legacyKey]));
    upgrades[traitKey] = Math.max(upgrades[traitKey], legacyLevel);

    if (legacyKey === "bite") {
      upgrades.horns = Math.max(upgrades.horns, clamp(legacyLevel - 1, 0, 2));
    }
    if (legacyKey === "speed") {
      upgrades.tail = Math.max(upgrades.tail, clamp(legacyLevel - 1, 0, 2));
    }
  });

  return upgrades;
}

function sanitizeProfile(rawProfile) {
  const fallback = createRandomCreatureProfile();
  return {
    bodyHue: Number.isFinite(rawProfile?.bodyHue) ? clamp(rawProfile.bodyHue, 0, 1) : fallback.bodyHue,
    accentHue: Number.isFinite(rawProfile?.accentHue) ? clamp(rawProfile.accentHue, 0, 1) : fallback.accentHue,
    markingsHue: Number.isFinite(rawProfile?.markingsHue) ? clamp(rawProfile.markingsHue, 0, 1) : fallback.markingsHue,
    size: Number.isFinite(rawProfile?.size) ? clamp(rawProfile.size, 0.82, 1.24) : fallback.size,
    patternType: Number.isFinite(rawProfile?.patternType) ? clamp(Math.round(rawProfile.patternType), 0, 2) : fallback.patternType,
    patternScale: Number.isFinite(rawProfile?.patternScale) ? clamp(rawProfile.patternScale, 0.8, 1.35) : fallback.patternScale,
  };
}

function sanitizeAlignment(rawAlignment) {
  const normalized = {
    aggressive: Number.isFinite(rawAlignment?.aggressive) ? rawAlignment.aggressive : DEFAULT_ALIGNMENT.aggressive,
    social: Number.isFinite(rawAlignment?.social) ? rawAlignment.social : DEFAULT_ALIGNMENT.social,
    adaptive: Number.isFinite(rawAlignment?.adaptive) ? rawAlignment.adaptive : DEFAULT_ALIGNMENT.adaptive,
  };
  const total = normalized.aggressive + normalized.social + normalized.adaptive;

  if (total <= 0.001) {
    return { ...DEFAULT_ALIGNMENT };
  }

  return {
    aggressive: Number((normalized.aggressive / total).toFixed(4)),
    social: Number((normalized.social / total).toFixed(4)),
    adaptive: Number((normalized.adaptive / total).toFixed(4)),
  };
}

function sanitizeSpeciesRelations(rawRelations) {
  return Object.keys(DEFAULT_SPECIES_RELATIONS).reduce((relations, speciesId) => {
    const fallback = DEFAULT_SPECIES_RELATIONS[speciesId];
    const relation = rawRelations?.[speciesId];
    const status = typeof relation?.status === "string" && ["friendly", "wary", "hostile"].includes(relation.status)
      ? relation.status
      : fallback.status;

    relations[speciesId] = {
      status,
      rapport: Number.isFinite(relation?.rapport) ? clamp(relation.rapport, -120, 120) : fallback.rapport,
      friendship: Number.isFinite(relation?.friendship) ? Math.max(0, Math.round(relation.friendship)) : fallback.friendship,
      dominance: Number.isFinite(relation?.dominance) ? Math.max(0, Math.round(relation.dominance)) : fallback.dominance,
      allyUnlocked: Boolean(relation?.allyUnlocked),
      alphaUnlocked: Boolean(relation?.alphaUnlocked),
    };
    return relations;
  }, {});
}

function sanitizeTraitBlueprints(rawBlueprints, speciesCreatures, evolutionDraft) {
  const blueprints = { ...DEFAULT_TRAIT_BLUEPRINTS };

  Object.keys(DEFAULT_TRAIT_BLUEPRINTS).forEach((traitKey) => {
    if (rawBlueprints?.[traitKey] != null) {
      blueprints[traitKey] = Boolean(rawBlueprints[traitKey]);
    }
  });

  [...speciesCreatures, evolutionDraft].forEach((creatureLike) => {
    if (!creatureLike?.traits) {
      return;
    }

    Object.keys(DEFAULT_TRAITS).forEach((traitKey) => {
      if ((creatureLike.traits?.[traitKey] ?? 0) > 0) {
        blueprints[traitKey] = true;
      }
    });
  });

  return blueprints;
}

function sanitizeBiomeProgress(rawBiomeProgress, fallback = DEFAULT_BIOME_PROGRESS) {
  const biomeKeys = Object.keys(BIOME_DEFS);
  const unlockedSource = Array.isArray(rawBiomeProgress?.unlockedBiomes) ? rawBiomeProgress.unlockedBiomes : fallback.unlockedBiomes;
  const discoveredSource = Array.isArray(rawBiomeProgress?.discoveredBiomes) ? rawBiomeProgress.discoveredBiomes : fallback.discoveredBiomes;
  const unlockedBiomes = biomeKeys.filter((biomeKey) => unlockedSource.includes(biomeKey));
  const discoveredBiomes = biomeKeys.filter((biomeKey) => discoveredSource.includes(biomeKey) || unlockedBiomes.includes(biomeKey));
  const mastery = biomeKeys.reduce((entries, biomeKey) => {
    const fallbackValue = fallback.mastery?.[biomeKey] ?? 0;
    const rawValue = rawBiomeProgress?.mastery?.[biomeKey];
    entries[biomeKey] = Number.isFinite(rawValue) ? clamp(rawValue, 0, 100) : fallbackValue;
    return entries;
  }, {});
  const dominantBiome = typeof rawBiomeProgress?.dominantBiome === "string" && biomeKeys.includes(rawBiomeProgress.dominantBiome)
    ? rawBiomeProgress.dominantBiome
    : fallback.dominantBiome;

  return {
    originStarted: rawBiomeProgress?.originStarted !== false,
    unlockedBiomes: unlockedBiomes.length ? unlockedBiomes : [...fallback.unlockedBiomes],
    discoveredBiomes: discoveredBiomes.length ? discoveredBiomes : [...fallback.discoveredBiomes],
    dominantBiome,
    mastery,
  };
}

function createCreatureId() {
  return `creature-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createSpeciesCreature(payload = {}) {
  return {
    id: typeof payload.id === "string" && payload.id ? payload.id : createCreatureId(),
    generation: Number.isFinite(payload.generation) ? Math.max(1, Math.round(payload.generation)) : 1,
    traits: sanitizeTraits(payload.traits),
    profile: sanitizeProfile(payload.profile),
    growth: Number.isFinite(payload.growth) ? clamp(payload.growth, 0, 1) : 1,
    killCount: Number.isFinite(payload.killCount) ? Math.max(0, Math.round(payload.killCount)) : 0,
    activeTime: Number.isFinite(payload.activeTime) ? Math.max(0, payload.activeTime) : 0,
    createdAt: Number.isFinite(payload.createdAt) ? Math.max(0, payload.createdAt) : Date.now(),
  };
}

export function createEvolutionDraft(creature) {
  const sourceCreature = creature ? createSpeciesCreature(creature) : createSpeciesCreature({
    traits: DEFAULT_TRAITS,
    profile: createRandomCreatureProfile(),
    growth: 1,
  });
  return {
    baseCreatureId: sourceCreature.id,
    traits: sanitizeTraits(sourceCreature.traits),
    profile: sanitizeProfile(sourceCreature.profile),
  };
}

function sanitizeSpeciesCreatures(rawCreatures, legacyUpgrades = DEFAULT_TRAITS, legacyProfile = createRandomCreatureProfile()) {
  const rawList = Array.isArray(rawCreatures) ? rawCreatures : [];
  const nextCreatures = rawList
    .filter(Boolean)
    .slice(0, MAX_SPECIES_CREATURES)
    .map((creature, index) => createSpeciesCreature({
      ...creature,
      generation: Number.isFinite(creature?.generation) ? creature.generation : index + 1,
    }));

  if (nextCreatures.length > 0) {
    return nextCreatures;
  }

  return [createSpeciesCreature({
    traits: legacyUpgrades,
    profile: legacyProfile,
    growth: 1,
    generation: 1,
  })];
}

function sanitizeEvolutionDraft(rawDraft, speciesCreatures, activeCreatureId) {
  const fallbackCreature = speciesCreatures.find((creature) => creature.id === activeCreatureId) ?? speciesCreatures[0];
  return {
    baseCreatureId:
      typeof rawDraft?.baseCreatureId === "string"
      && speciesCreatures.some((creature) => creature.id === rawDraft.baseCreatureId)
        ? rawDraft.baseCreatureId
        : fallbackCreature.id,
    traits: sanitizeTraits(rawDraft?.traits ?? fallbackCreature.traits),
    profile: sanitizeProfile(rawDraft?.profile ?? fallbackCreature.profile),
  };
}

function buildDefaultSave() {
  const starterCreature = createSpeciesCreature({
    traits: DEFAULT_TRAITS,
    profile: createRandomCreatureProfile(),
    growth: 0.22,
    generation: 1,
  });

  return {
    dna: 0,
    speciesXp: 0,
    bestRun: 0,
    speciesCreatures: [starterCreature],
    activeCreatureId: starterCreature.id,
    evolutionDraft: createEvolutionDraft(starterCreature),
    upgrades: { ...starterCreature.traits },
    creatureProfile: sanitizeProfile(starterCreature.profile),
    alignment: { ...DEFAULT_ALIGNMENT },
    traitBlueprints: sanitizeTraitBlueprints(DEFAULT_TRAIT_BLUEPRINTS, [starterCreature], createEvolutionDraft(starterCreature)),
    speciesRelations: sanitizeSpeciesRelations(DEFAULT_SPECIES_RELATIONS),
    biomeProgress: sanitizeBiomeProgress(DEFAULT_BIOME_PROGRESS),
  };
}

export const DEFAULT_SAVE = buildDefaultSave();

function cloneDefaultSave() {
  const speciesCreatures = DEFAULT_SAVE.speciesCreatures.map((creature) => createSpeciesCreature(creature));
  const activeCreatureId = speciesCreatures[0].id;
  return {
    dna: DEFAULT_SAVE.dna,
    speciesXp: DEFAULT_SAVE.speciesXp,
    bestRun: DEFAULT_SAVE.bestRun,
    speciesCreatures,
    activeCreatureId,
    evolutionDraft: sanitizeEvolutionDraft(DEFAULT_SAVE.evolutionDraft, speciesCreatures, activeCreatureId),
    upgrades: { ...speciesCreatures[0].traits },
    creatureProfile: sanitizeProfile(speciesCreatures[0].profile),
    alignment: { ...DEFAULT_SAVE.alignment },
    traitBlueprints: { ...DEFAULT_SAVE.traitBlueprints },
    speciesRelations: sanitizeSpeciesRelations(DEFAULT_SAVE.speciesRelations),
    biomeProgress: sanitizeBiomeProgress(DEFAULT_SAVE.biomeProgress),
  };
}

export function loadSave() {
  if (typeof window === "undefined") {
    return cloneDefaultSave();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return cloneDefaultSave();
    }

    const parsed = JSON.parse(raw);
    const legacyUpgrades = sanitizeTraits(parsed?.upgrades);
    const legacyProfile = sanitizeProfile(parsed?.creatureProfile);
    const speciesCreatures = sanitizeSpeciesCreatures(parsed?.speciesCreatures, legacyUpgrades, legacyProfile);
    const activeCreatureId =
      typeof parsed?.activeCreatureId === "string"
      && speciesCreatures.some((creature) => creature.id === parsed.activeCreatureId)
        ? parsed.activeCreatureId
        : speciesCreatures[0].id;
    const activeCreature = speciesCreatures.find((creature) => creature.id === activeCreatureId) ?? speciesCreatures[0];
    const evolutionDraft = sanitizeEvolutionDraft(parsed?.evolutionDraft, speciesCreatures, activeCreatureId);
    const traitBlueprints = sanitizeTraitBlueprints(parsed?.traitBlueprints, speciesCreatures, evolutionDraft);
    const speciesRelations = sanitizeSpeciesRelations(parsed?.speciesRelations);
    const hasLegacyProgress =
      !parsed?.biomeProgress
      && (
        (parsed?.dna ?? 0) > 0
        || (parsed?.speciesXp ?? 0) > 0
        || speciesCreatures.length > 1
        || Object.values(activeCreature?.traits ?? {}).some((value) => value > 0)
      );
    const biomeProgress = sanitizeBiomeProgress(
      parsed?.biomeProgress,
      createDefaultBiomeProgress({ legacy: hasLegacyProgress }),
    );

    return {
      dna: Number.isFinite(parsed?.dna) ? Math.max(0, Math.round(parsed.dna)) : DEFAULT_SAVE.dna,
      speciesXp: Number.isFinite(parsed?.speciesXp) ? Math.max(0, Math.round(parsed.speciesXp)) : 0,
      bestRun: Number.isFinite(parsed?.bestRun) ? Math.max(0, Math.round(parsed.bestRun)) : DEFAULT_SAVE.bestRun,
      speciesCreatures,
      activeCreatureId,
      evolutionDraft,
      upgrades: sanitizeTraits(parsed?.upgrades ?? activeCreature.traits),
      creatureProfile: sanitizeProfile(parsed?.creatureProfile ?? activeCreature.profile),
      alignment: sanitizeAlignment(parsed?.alignment),
      traitBlueprints,
      speciesRelations,
      biomeProgress,
    };
  } catch {
    return cloneDefaultSave();
  }
}

export function saveProgress(payload) {
  if (typeof window === "undefined") {
    return;
  }

  const speciesCreatures = sanitizeSpeciesCreatures(payload.speciesCreatures, payload.upgrades, payload.creatureProfile);
  const activeCreatureId =
    typeof payload.activeCreatureId === "string"
    && speciesCreatures.some((creature) => creature.id === payload.activeCreatureId)
      ? payload.activeCreatureId
      : speciesCreatures[0].id;
  const activeCreature = speciesCreatures.find((creature) => creature.id === activeCreatureId) ?? speciesCreatures[0];
  const evolutionDraft = sanitizeEvolutionDraft(payload.evolutionDraft, speciesCreatures, activeCreatureId);
  const traitBlueprints = sanitizeTraitBlueprints(payload.traitBlueprints, speciesCreatures, evolutionDraft);
  const speciesRelations = sanitizeSpeciesRelations(payload.speciesRelations);
  const biomeProgress = sanitizeBiomeProgress(payload.biomeProgress);
  const snapshot = {
    dna: Math.max(0, Math.round(payload.dna ?? 0)),
    speciesXp: Math.max(0, Math.round(payload.speciesXp ?? 0)),
    bestRun: Math.max(0, Math.round(payload.bestRun ?? DEFAULT_SAVE.bestRun)),
    speciesCreatures,
    activeCreatureId,
    evolutionDraft,
    upgrades: sanitizeTraits(payload.upgrades ?? activeCreature.traits),
    creatureProfile: sanitizeProfile(payload.creatureProfile ?? activeCreature.profile),
    alignment: sanitizeAlignment(payload.alignment),
    traitBlueprints,
    speciesRelations,
    biomeProgress,
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

export function clearSave() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}
