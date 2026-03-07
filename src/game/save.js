const STORAGE_KEY = "bone-dunes-save-v1";

export const DEFAULT_TRAITS = {
  jaw: 0,
  horns: 0,
  crest: 0,
  tail: 0,
  legs: 0,
  spikes: 0,
  glow: 0,
};

export const DEFAULT_ALIGNMENT = {
  aggressive: 0.34,
  social: 0.33,
  adaptive: 0.33,
};

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

export const DEFAULT_SAVE = {
  dna: 0,
  bestRun: 0,
  upgrades: { ...DEFAULT_TRAITS },
  creatureProfile: createRandomCreatureProfile(),
  alignment: { ...DEFAULT_ALIGNMENT },
};

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

function cloneDefaultSave() {
  return {
    dna: DEFAULT_SAVE.dna,
    bestRun: DEFAULT_SAVE.bestRun,
    upgrades: { ...DEFAULT_SAVE.upgrades },
    creatureProfile: sanitizeProfile(DEFAULT_SAVE.creatureProfile),
    alignment: { ...DEFAULT_SAVE.alignment },
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
    return {
      dna: Number.isFinite(parsed?.dna) ? Math.max(0, Math.round(parsed.dna)) : DEFAULT_SAVE.dna,
      bestRun: Number.isFinite(parsed?.bestRun) ? Math.max(0, Math.round(parsed.bestRun)) : DEFAULT_SAVE.bestRun,
      upgrades: sanitizeTraits(parsed?.upgrades),
      creatureProfile: sanitizeProfile(parsed?.creatureProfile),
      alignment: sanitizeAlignment(parsed?.alignment),
    };
  } catch {
    return cloneDefaultSave();
  }
}

export function saveProgress(payload) {
  if (typeof window === "undefined") {
    return;
  }

  const snapshot = {
    dna: Math.max(0, Math.round(payload.dna ?? 0)),
    bestRun: Math.max(0, Math.round(payload.bestRun ?? DEFAULT_SAVE.bestRun)),
    upgrades: sanitizeTraits(payload.upgrades),
    creatureProfile: sanitizeProfile(payload.creatureProfile),
    alignment: sanitizeAlignment(payload.alignment),
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

export function clearSave() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}
