const STORAGE_KEY = "bone-dunes-save-v1";

export const DEFAULT_SAVE = {
  dna: 0,
  upgrades: {
    speed: 0,
    health: 0,
    bite: 0,
    crest: 0,
  },
};

export function loadSave() {
  if (typeof window === "undefined") {
    return { ...DEFAULT_SAVE, upgrades: { ...DEFAULT_SAVE.upgrades } };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_SAVE, upgrades: { ...DEFAULT_SAVE.upgrades } };
    }

    const parsed = JSON.parse(raw);
    return {
      dna: Number.isFinite(parsed?.dna) ? parsed.dna : DEFAULT_SAVE.dna,
      upgrades: {
        ...DEFAULT_SAVE.upgrades,
        ...(parsed?.upgrades ?? {}),
      },
    };
  } catch {
    return { ...DEFAULT_SAVE, upgrades: { ...DEFAULT_SAVE.upgrades } };
  }
}

export function saveProgress(payload) {
  if (typeof window === "undefined") {
    return;
  }

  const snapshot = {
    dna: Math.max(0, Math.round(payload.dna ?? 0)),
    upgrades: {
      ...DEFAULT_SAVE.upgrades,
      ...(payload.upgrades ?? {}),
    },
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

export function clearSave() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}
