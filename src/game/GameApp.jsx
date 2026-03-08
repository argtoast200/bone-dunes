import { useEffect, useRef, useState } from "react";

import { SporeSliceGame } from "./SporeSliceGame";

const initialState = {
  mode: "menu",
  zone: "nest",
  message: "Wake at the nest, gather DNA, then return to lay the next egg.",
  objective: "Evolve at the nest, hatch a stronger body, and grow it across the frontier biomes.",
  dna: 0,
  speciesXp: 0,
  bestRun: 0,
  runScore: 0,
  sessionDna: 0,
  scavengersDefeated: 0,
  predatorsDefeated: 0,
  herbivoresDefeated: 0,
  huntSummary: "Fresh line. Gather DNA, lay a new egg, then grow it across the frontier biomes.",
  health: 120,
  maxHealth: 120,
  sprintCharge: 1,
  showSprintHud: false,
  biteCharge: 1,
  showAttackHud: false,
  attackPhase: "idle",
  attackResult: "ready",
  surgeCharge: 0,
  surgeLevel: 0,
  lowHealth: false,
  dangerBoost: 1,
  threatDistance: null,
  zoneTransition: 0,
  biomeKey: "sunlitShallows",
  biomeName: "Sunlit Shallows",
  biomeSummary: "Food-rich shallows where early lines first push out of the nursery waters.",
  biomePressure: "Starter frontier",
  biomeUnlocked: true,
  dominantBiomeName: "Origin Waters",
  dominantBiomeSummary: "Universal cradle water. Newborn bodies grow fastest here.",
  pathLabel: "Nursery Drifter",
  pathShortLabel: "Drifter",
  pathSummary: "Soft-bodied swimmer still learning whether the line belongs in water or on land.",
  pathFavoredBiomes: ["Origin Waters", "Sunlit Shallows"],
  shoreLabel: "Water-bound",
  shoreReadiness: 24,
  shoreSummary: "This body still belongs to the nursery waters.",
  unlockedBiomes: [
    { key: "originWaters", label: "Origin Waters", shortLabel: "Origin" },
    { key: "sunlitShallows", label: "Sunlit Shallows", shortLabel: "Shallows" },
  ],
  nextBiomeUnlock: null,
  ecosystemNotice: "The dunes are still settling.",
  territoryName: null,
  territoryOwner: null,
  territoryTemperament: null,
  territoryAlert: 0,
  territoryPopulation: null,
  activeMigration: null,
  socialHint: null,
  blueprintSummary: {
    unlocked: 4,
    total: 9,
  },
  speciesRelations: [],
  gamepadConnected: false,
  gamepadLabel: "",
  speciesName: "Boney Snapper",
  maturationLabel: "Fully Grown Boney Snapper",
  maturationTone: "grown",
  maturationProgress: 100,
  maturationDetail: "Adult body online",
  hudMap: {
    range: 26,
    worldRadius: 58,
    player: { x: 0, z: 0, yaw: Math.PI },
    nest: { dx: 0, dz: 0, distance: 0, bearing: 0, atNest: true },
  },
  nearbySpecies: [],
  nearbyNests: [],
  upgrades: {
    jaw: 0,
    horns: 0,
    crest: 0,
    tail: 0,
    legs: 0,
    arms: 0,
    wings: 0,
    spikes: 0,
    glow: 0,
  },
  upgradeEntries: [],
  evolutionPreviewStats: [],
  editorOpen: false,
  pauseMenuOpen: false,
  editorTab: "evolution",
  editorPulse: 0,
  canOpenEditor: false,
  canLayEgg: false,
  rosterFull: false,
  creatureIdentity: "Dune Nestling Bloomstripe",
  creatureProfile: {
    patternLabel: "Bloomstripe",
    size: 1,
  },
  activeCreature: null,
  speciesRoster: [],
  evolutionDraft: {
    identity: "Unshaped Egg",
    baseCreatureId: null,
    baseIdentity: "Starter Line",
    modified: false,
    profile: {
      patternLabel: "Bloomstripe",
      size: 1,
    },
    traitTotal: 0,
    maturityTarget: 26,
    pathLabel: "Nursery Drifter",
    pathSummary: "Soft-bodied swimmer still learning whether the line belongs in water or on land.",
    shoreLabel: "Water-bound",
    favoredBiomes: ["Origin Waters", "Sunlit Shallows"],
  },
  traitStats: [],
  lastEvolution: null,
  hasSave: false,
  canUpgrade: false,
  controlsHint: "Left click move, WASD/Arrows steer, Space/right click bite, then return to the nest to evolve the next water-born body",
};

const UPGRADE_GROUPS = [
  { key: "head", label: "Head", summary: "Commit harder bites.", keys: ["jaw", "horns"] },
  { key: "bodyPlan", label: "Body Plan", summary: "Stretch the line into different hunting bodies.", keys: ["legs", "arms", "tail", "wings"] },
  { key: "defense", label: "Defense", summary: "Survive heavier contact.", keys: ["spikes", "crest"] },
  { key: "traits", label: "Traits", summary: "Refine recovery and identity.", keys: ["glow"] },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function MobileButton({ label, onPressStart, onPressEnd, className = "" }) {
  return (
    <button
      className={`mobile-btn ${className}`}
      onPointerDown={onPressStart}
      onPointerUp={onPressEnd}
      onPointerCancel={onPressEnd}
      onPointerLeave={onPressEnd}
      type="button"
    >
      {label}
    </button>
  );
}

function formatStatValue(stat, value) {
  if (stat.format === "decimal") {
    return Number(value).toFixed(1);
  }
  return `${Math.round(value)}`;
}

function getStatDelta(stat) {
  const delta = Number((stat.next - stat.current).toFixed(stat.format === "decimal" ? 1 : 0));
  if (Math.abs(delta) < 0.05) {
    return { label: "No change", tone: "flat" };
  }

  const prefersLower = stat.better === "lower";
  const improved = prefersLower ? delta < 0 : delta > 0;
  const label = `${delta > 0 ? "+" : ""}${delta}${stat.format === "decimal" ? "" : ""}`;
  return {
    label,
    tone: improved ? "up" : "down",
  };
}

function getBearingLabel(angle) {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const normalized = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const index = Math.round(normalized / (Math.PI / 4)) % directions.length;
  return directions[index];
}

function GrowthRing({ value, tone }) {
  return (
    <div
      className={`growth-ring ${tone}`}
      style={{ "--progress": `${clamp(value, 0, 100)}%` }}
    >
      <div className="growth-ring-core">
        <strong>{Math.round(clamp(value, 0, 100))}%</strong>
      </div>
    </div>
  );
}

function HudMeter({ label, value, fill, tone = "health", detail = null }) {
  return (
    <div className={`vital-card ${tone}`}>
      <div className="vital-head">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="meter">
        <div className={`meter-fill ${tone}-fill`} style={{ width: `${clamp(fill, 0, 100)}%` }} />
      </div>
      {detail && <small>{detail}</small>}
    </div>
  );
}

function MiniMap({ hudMap, zone, biomeName }) {
  const center = 70;
  const radius = 48;
  const safeHudMap = hudMap ?? initialState.hudMap;
  const playerYaw = safeHudMap.player?.yaw ?? Math.PI;
  const nest = safeHudMap.nest ?? initialState.hudMap.nest;
  const range = Math.max(14, safeHudMap.range ?? 26);
  const localX = (nest.dx / range) * radius;
  const localY = (-nest.dz / range) * radius;
  const distance = Math.hypot(localX, localY);
  const rim = radius - 7;
  const scale = distance > rim && distance > 0.001 ? rim / distance : 1;
  const nestX = center + localX * scale;
  const nestY = center + localY * scale;
  const bearing = getBearingLabel(nest.bearing ?? 0);
  const biomeBadge = biomeName?.split(" ").slice(0, 2).join(" ") ?? "Dunes";

  return (
    <section className="mini-map-card">
      <div className="mini-map-copy">
        <p className="eyebrow">Nest Route</p>
        <strong>{nest.atNest ? "At species nest" : `Nest ${Math.round(nest.distance)}m ${bearing}`}</strong>
        <small>{zone === "danger" ? "Danger pressure rises away from home." : biomeName}</small>
      </div>

      <div className="mini-map-frame">
        <svg className="mini-map-svg" viewBox="0 0 140 140" aria-hidden="true">
          <circle cx="70" cy="70" r="58" className="mini-map-shell" />
          <circle cx="70" cy="70" r="48" className="mini-map-core" />
          <circle cx="70" cy="22" r="2" className="mini-map-north-tick" />
          <circle cx="70" cy="70" r="2.5" className="mini-map-center" />
          <circle cx={nestX} cy={nestY} r={nest.atNest ? 7 : 5.5} className="mini-map-nest-dot" />
          {distance > rim && (
            <g transform={`translate(${nestX} ${nestY}) rotate(${(Math.atan2(localX, -localY) * 180) / Math.PI})`}>
              <path d="M0,-10 L5,2 L0,-1 L-5,2 Z" className="mini-map-rim-arrow" />
            </g>
          )}
          <g transform={`translate(70 70) rotate(${(playerYaw * 180) / Math.PI})`}>
            <path d="M0,-17 L9,11 L0,5 L-9,11 Z" className="mini-map-player" />
          </g>
        </svg>
        <span className={`mini-map-zone ${zone}`}>{zone === "danger" ? "Threat" : zone === "nest" ? "Nest" : biomeBadge}</span>
      </div>
    </section>
  );
}

function EvolutionStatCard({ stat }) {
  const delta = getStatDelta(stat);
  const prefersLower = stat.better === "lower";
  return (
    <div className={`stat-comparison-card ${delta.tone} ${prefersLower ? "prefers-lower" : ""}`}>
      <span>{stat.label}</span>
      <strong>{formatStatValue(stat, stat.next)}</strong>
      <small>
        Now {formatStatValue(stat, stat.current)}
        {" • "}
        {delta.label}
      </small>
    </div>
  );
}

export function GameApp() {
  const mountRef = useRef(null);
  const gameRef = useRef(null);
  const [uiState, setUiState] = useState(initialState);

  useEffect(() => {
    if (!mountRef.current) {
      return undefined;
    }

    const game = new SporeSliceGame(mountRef.current, setUiState);
    gameRef.current = game;

    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, []);

  const setVirtualInput = (key, pressed) => {
    gameRef.current?.setVirtualInput(key, pressed);
  };

  const activeCreature = uiState.activeCreature;
  const activeIdentity = activeCreature?.identity ?? uiState.creatureIdentity;
  const stageLabel = activeCreature?.stageLabel ?? uiState.maturationLabel;
  const stageTone = activeCreature?.maturationTone ?? uiState.maturationTone;
  const stageDetail = activeCreature?.maturationDetail ?? uiState.maturationDetail;
  const growthDisplay = uiState.maturationProgress ?? activeCreature?.maturityPct ?? 100;
  const speciesCount = uiState.speciesRoster.length || 1;
  const draftIdentity = uiState.evolutionDraft?.identity ?? "Unshaped Egg";
  const draftBaseIdentity = uiState.evolutionDraft?.baseIdentity ?? activeIdentity;
  const healthPct = uiState.maxHealth > 0 ? (uiState.health / uiState.maxHealth) * 100 : 0;
  const socialHint = uiState.socialHint;
  const biteStatus = uiState.attackPhase === "windup"
    ? "Coiling"
    : uiState.attackPhase === "strike"
      ? "Snapping"
      : uiState.attackPhase === "recovery"
        ? "Recovering"
        : uiState.attackResult === "hit"
          ? "Landed"
          : uiState.attackResult === "kill"
            ? "Crushed"
            : uiState.attackResult === "broken"
              ? "Broken"
              : uiState.attackResult === "miss"
                ? "Missed"
                : uiState.biteCharge >= 0.98
                  ? "Ready"
                  : "Recovering";
  const evolutionGroups = UPGRADE_GROUPS.map((group) => ({
    ...group,
    entries: group.keys
      .map((key) => uiState.upgradeEntries.find((upgrade) => upgrade.key === key))
      .filter(Boolean),
  }));
  const liveControls = uiState.gamepadConnected
    ? "A jump • X/RB/RT bite • B or LB sprint • D-pad navigates menus • Start opens pause • View opens Creature Evolution at the nest"
    : "Shift sprint • Q/E/R social • Space or right click bite • F fullscreen";

  let contextPrompt = "Gather DNA in the dunes, then return to the nest to evolve.";
  if (socialHint && socialHint.status !== "friendly" && socialHint.distance <= 9 && !uiState.canOpenEditor) {
    contextPrompt = `Near ${socialHint.speciesName}. Hit ${socialHint.expectedHotkey} to ${socialHint.expectedVerb.toLowerCase()} and finish the pattern to befriend them.`;
  } else if (socialHint && socialHint.status === "friendly" && !uiState.canOpenEditor) {
    contextPrompt = `${socialHint.speciesName} recognize your line. Use the opening to gather DNA or pass through their territory.`;
  } else if (!uiState.biomeUnlocked && uiState.zone !== "nest") {
    contextPrompt = `${uiState.biomeName} is still a hard frontier. Return stronger before trying to claim it for the species.`;
  } else if (uiState.biomeKey !== "originWaters" && uiState.biomeKey !== "sunlitShallows" && uiState.shoreReadiness < 58 && !uiState.canOpenEditor) {
    contextPrompt = `${uiState.pathLabel} is still shore-soft. Make shorter land runs, then evolve cleaner shoreline anatomy at the nest.`;
  } else if (uiState.biomeKey === "originWaters" && activeCreature && activeCreature.maturityPct < 100) {
    contextPrompt = "Origin waters accelerate newborn growth. Feed with the tide skimmers here before pushing into harder frontiers.";
  } else if (uiState.canOpenEditor && uiState.evolutionDraft?.modified) {
    contextPrompt = "Egg draft ready. Open Creature Evolution, then lay the egg from Species.";
  } else if (uiState.canOpenEditor) {
    contextPrompt = uiState.dna > 0
      ? "Back at the nest. Spend DNA to shape the next body."
      : "Back at the nest. Hunt for DNA or switch into another body.";
  } else if (activeCreature && activeCreature.maturityPct < 100) {
    contextPrompt = `${stageLabel} grows faster from time alive and clean kills.`;
  } else if (uiState.lowHealth) {
    contextPrompt = "Low health. Break away and follow the nest beacon home.";
  } else if (uiState.zone === "danger") {
    contextPrompt = `${uiState.territoryOwner ?? "Predator"} territory. Take quick fights and bank DNA before this body falls.`;
  }

  return (
    <div className={`game-shell ${uiState.zone === "danger" ? "is-danger" : ""} ${uiState.lowHealth ? "is-low-health" : ""} ${uiState.surgeCharge > 0.05 ? "is-surging" : ""}`}>
      <div className="game-stage">
        <div className="game-canvas" ref={mountRef} />

        <div className="hud-layer">
          {uiState.mode === "playing" && !uiState.editorOpen && (
            <div className="play-hud">
              <div className="hud-top-row">
                <section className="lineage-chip">
                  <div className="lineage-chip-main">
                    <div className="lineage-copy">
                      <p className="eyebrow">Creature Line</p>
                      <h1>{stageLabel}</h1>
                      <p className="lineage-subline">
                        {activeIdentity}
                        {" • "}
                        {stageDetail}
                      </p>
                    </div>
                    <GrowthRing value={growthDisplay} tone={stageTone} />
                  </div>

                  <div className="lineage-pill-row">
                    <span className="lineage-pill active">DNA {uiState.dna}</span>
                    <span className="lineage-pill">XP {uiState.speciesXp}</span>
                    <span className="lineage-pill">
                      {speciesCount}
                      {" "}
                      alive
                    </span>
                  </div>
                </section>

                <MiniMap hudMap={uiState.hudMap} zone={uiState.zone} biomeName={uiState.biomeName} />
              </div>

              <div className="vitals-stack">
                <HudMeter
                  label="Health"
                  value={`${Math.round(uiState.health)} / ${Math.round(uiState.maxHealth)}`}
                  fill={healthPct}
                  tone="health"
                />
                {uiState.showSprintHud && (
                  <HudMeter
                    label="Sprint"
                    value={`${Math.round(uiState.sprintCharge * 100)}%`}
                    fill={uiState.sprintCharge * 100}
                    tone="sprint"
                    detail="Shown only while pushing into a sprint."
                  />
                )}
                {uiState.showAttackHud && (
                  <HudMeter
                    label="Bite"
                    value={biteStatus}
                    fill={uiState.biteCharge * 100}
                    tone="bite"
                    detail="Appears when a fight is live."
                  />
                )}
              </div>

              <div className="context-strip">
                <div>
                  <p className="eyebrow">Focus</p>
                  <strong>{contextPrompt}</strong>
                  <small>
                    {uiState.gamepadConnected ? "Controller live." : "Keyboard and mouse live."}
                    {" "}
                    {liveControls}
                  </small>
                  <div className="context-chip-row">
                    <span className={`context-chip ${uiState.biomeUnlocked ? "friendly" : "hostile"}`}>
                      {uiState.biomeName}
                    </span>
                    <span className="context-chip">
                      Path
                      {" "}
                      {uiState.pathShortLabel}
                    </span>
                    <span className="context-chip">
                      Dominant
                      {" "}
                      {uiState.dominantBiomeName}
                    </span>
                    <span className={`context-chip ${uiState.shoreReadiness >= 58 ? "friendly" : "hostile"}`}>
                      {uiState.shoreLabel}
                    </span>
                    {uiState.nextBiomeUnlock && (
                      <span className="context-chip">
                        Next
                        {" "}
                        {uiState.nextBiomeUnlock.label}
                      </span>
                    )}
                    <span className="context-chip">
                      Blueprints
                      {" "}
                      {uiState.blueprintSummary.unlocked}
                      /
                      {uiState.blueprintSummary.total}
                    </span>
                    {socialHint && (
                      <span className={`context-chip ${socialHint.status}`}>
                        {socialHint.status === "friendly" ? "Friendly" : socialHint.status === "hostile" ? "Hostile" : "Wary"}
                        {" "}
                        {socialHint.speciesName}
                        {socialHint.status !== "friendly" && (
                          <>
                            {" • "}
                            {socialHint.expectedHotkey}
                            {" "}
                            {socialHint.expectedVerb}
                          </>
                        )}
                      </span>
                    )}
                  </div>
                </div>
                {uiState.canOpenEditor && (
                  <button className="utility-btn nest-action-btn" type="button" onClick={() => gameRef.current?.toggleEditor(true)}>
                    Creature Evolution
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="mobile-controls">
            <div className="dpad">
              <MobileButton
                label="W"
                className="up"
                onPressStart={() => setVirtualInput("forward", true)}
                onPressEnd={() => setVirtualInput("forward", false)}
              />
              <MobileButton
                label="A"
                className="left"
                onPressStart={() => setVirtualInput("left", true)}
                onPressEnd={() => setVirtualInput("left", false)}
              />
              <MobileButton
                label="S"
                className="down"
                onPressStart={() => setVirtualInput("backward", true)}
                onPressEnd={() => setVirtualInput("backward", false)}
              />
              <MobileButton
                label="D"
                className="right"
                onPressStart={() => setVirtualInput("right", true)}
                onPressEnd={() => setVirtualInput("right", false)}
              />
            </div>

            <MobileButton
              label="Bite"
              className="attack"
              onPressStart={() => setVirtualInput("attackHeld", true)}
              onPressEnd={() => setVirtualInput("attackHeld", false)}
            />
          </div>

          {uiState.mode === "menu" && (
            <div className="menu-overlay">
              <div className="menu-card menu-shell">
                <div className="menu-hero">
                  <div>
                    <p className="eyebrow">Creature Slice</p>
                    <h2>Bone Dunes</h2>
                    <p>
                      Every species begins in the water. Feed in the origin pool, branch into new frontiers, then bring DNA home to shape the next body.
                    </p>
                  </div>
                  <div className="menu-pill-row">
                    <span className="lineage-pill active">Species {speciesCount}</span>
                    <span className="lineage-pill">XP {uiState.speciesXp}</span>
                    <span className="lineage-pill">DNA {uiState.dna}</span>
                  </div>
                </div>

                <div className="menu-grid">
                  <div className="menu-panel">
                    <h3>Core Loop</h3>
                    <p>Feed in the origin waters beside tide skimmers. Push into shallows, marsh, dunes, salt flats, basin, and ember ridges. Unlock blueprints. Return to the nest. Lay the egg. Raise the newborn.</p>
                  </div>
                  <div className="menu-panel">
                    <h3>Controls</h3>
                    <p>`Left click` move</p>
                    <p>`WASD` or `Arrows` steer</p>
                    <p>`Q`, `E`, `R` social signals</p>
                    <p>`Shift` sprint</p>
                    <p>`Space` or `Right click` bite</p>
                    <p>`A` jumps in gameplay; `X`, `RB`, or `RT` bite on controller</p>
                    <p>`D-pad` moves through menu choices, `A` confirms, `View` opens evolution at the nest</p>
                  </div>
                </div>

                <div className="menu-actions">
                  <button id="start-btn" className="start-btn" type="button" onClick={() => gameRef.current?.startGame()}>
                    {uiState.hasSave ? "Resume Species" : "Start Species"}
                  </button>
                  <button className="ghost-btn" type="button" onClick={() => gameRef.current?.resetProgress()}>
                    New Organism
                  </button>
                </div>
              </div>
            </div>
          )}

          {uiState.pauseMenuOpen && uiState.mode === "playing" && !uiState.editorOpen && (
            <div className="pause-overlay">
              <div className="menu-card pause-card menu-shell">
                <div className="menu-hero">
                  <div>
                    <p className="eyebrow">In-Game Menu</p>
                    <h2>Species Pause</h2>
                    <p>
                      Pause the hunt, orient the line, then either resume or return to the nest to shape the next body.
                    </p>
                  </div>
                  <div className="menu-pill-row">
                    <span className="lineage-pill active">DNA {uiState.dna}</span>
                    <span className="lineage-pill">XP {uiState.speciesXp}</span>
                    <span className="lineage-pill">{uiState.zone === "nest" ? "At Nest" : uiState.biomeName}</span>
                  </div>
                </div>

                <div className="menu-grid pause-grid">
                  <div className="menu-panel">
                    <h3>Current Body</h3>
                    <p>{stageLabel}</p>
                    <p>{activeIdentity}</p>
                    <p>{uiState.zone === "nest" ? "The species nest is within reach." : "You are out in the field. Return to the nest to evolve."}</p>
                  </div>
                  <div className="menu-panel">
                    <h3>Controller</h3>
                    <p>`D-pad` moves through pause options</p>
                    <p>`A` confirms the focused option</p>
                    <p>`Start` closes this menu</p>
                    <p>`View` opens evolution directly, but only at the nest</p>
                  </div>
                </div>

                <div className="menu-actions">
                  <button className="start-btn" type="button" onClick={() => gameRef.current?.togglePauseMenu(false)}>
                    Resume Hunt
                  </button>
                  <button
                    className="utility-btn"
                    type="button"
                    disabled={!uiState.canOpenEditor}
                    onClick={() => gameRef.current?.openPauseEvolution()}
                  >
                    Creature Evolution
                  </button>
                  <button className="ghost-btn" type="button" onClick={() => gameRef.current?.toggleFullscreen()}>
                    Fullscreen
                  </button>
                </div>
              </div>
            </div>
          )}

          {uiState.editorOpen && (
            <div className="editor-overlay">
              <div className={`editor-card nest-editor ${uiState.editorPulse > 0.08 ? "is-transforming" : ""}`}>
                <div className="editor-header">
                  <div>
                    <p className="eyebrow">Species Nest</p>
                    <h2>{uiState.editorTab === "evolution" ? "Creature Evolution" : "Species"}</h2>
                    <p>
                      {uiState.editorTab === "evolution"
                        ? "Draft the next egg here. Spend DNA on blueprints unlocked across the frontier biomes. Every upgrade changes the body and lengthens the growth journey."
                        : "Lay drafted eggs, fast evolve hatchlings with XP, or switch between living bodies in the line as the species spreads into new biomes."}
                    </p>
                  </div>

                  <div className="editor-header-actions">
                    <div className="lineage-pill-row">
                      <span className="lineage-pill active">DNA {uiState.dna}</span>
                      <span className="lineage-pill">XP {uiState.speciesXp}</span>
                      <span className="lineage-pill">
                        {speciesCount}
                        {" "}
                        alive
                      </span>
                    </div>
                    <button className="ghost-btn" type="button" onClick={() => gameRef.current?.toggleEditor(false)}>
                      Close Nest
                    </button>
                  </div>
                </div>

                <div className="editor-tabs">
                  <button
                    className={`editor-tab ${uiState.editorTab === "evolution" ? "active" : ""}`}
                    type="button"
                    onClick={() => gameRef.current?.setEditorTab("evolution")}
                  >
                    Creature Evolution
                  </button>
                  <button
                    className={`editor-tab ${uiState.editorTab === "species" ? "active" : ""}`}
                    type="button"
                    onClick={() => gameRef.current?.setEditorTab("species")}
                  >
                    Species
                  </button>
                </div>

                {uiState.editorTab === "evolution" ? (
                  <>
                    <div className="editor-hero">
                      <div className="editor-preview-panel current">
                        <span className="upgrade-slot">Current Body</span>
                        <strong>{activeIdentity}</strong>
                        <small>
                          {stageLabel}
                          {" • "}
                          {activeCreature?.maturityPct ?? 100}
                          % grown
                        </small>
                        <p>
                          {uiState.pathLabel}
                          {" • "}
                          {uiState.shoreLabel}
                          {" • "}
                          {uiState.pathSummary}
                        </p>
                      </div>

                      <div className="editor-preview-panel next">
                        <span className="upgrade-slot">Next Egg</span>
                        <strong>{draftIdentity}</strong>
                        <small>
                          Based on
                          {" "}
                          {draftBaseIdentity}
                        </small>
                        <p>
                          {uiState.evolutionDraft?.pathLabel}
                          {" • "}
                          {uiState.evolutionDraft?.shoreLabel}
                          {" • "}
                          {uiState.evolutionDraft?.modified ? "Ready to lay from the Species tab." : "Spend DNA to start branching a new body."}
                        </p>
                      </div>
                    </div>

                    <div className="stat-comparison-grid">
                      {uiState.evolutionPreviewStats.map((stat) => (
                        <EvolutionStatCard key={stat.key} stat={stat} />
                      ))}
                    </div>

                    <div className="blueprint-summary-card">
                      <div>
                        <span className="upgrade-slot">Blueprints</span>
                        <strong>
                          {uiState.blueprintSummary.unlocked}
                          /
                          {uiState.blueprintSummary.total}
                          {" "}
                          discovered
                        </strong>
                        <small>New parts come from species encounters or mastering frontier biomes.</small>
                      </div>
                      <div className="species-relation-row">
                        {uiState.speciesRelations.map((relation) => (
                          <span key={relation.speciesId} className={`species-relation-pill ${relation.status}`}>
                            {relation.speciesName}
                            {" • "}
                            {relation.status}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="frontier-summary-card">
                      <div>
                        <span className="upgrade-slot">Frontiers</span>
                        <strong>{uiState.dominantBiomeName}</strong>
                        <small>
                          {uiState.dominantBiomeSummary}
                          {" • "}
                          {uiState.pathLabel}
                          {" • "}
                          {uiState.shoreLabel}
                        </small>
                      </div>
                      <div className="species-relation-row frontier-pill-row">
                        {uiState.unlockedBiomes.map((biome) => (
                          <span key={biome.key} className="species-relation-pill frontier-pill">
                            {biome.label}
                          </span>
                        ))}
                      </div>
                      {uiState.nextBiomeUnlock && (
                        <small className="frontier-next-unlock">
                          Next frontier:
                          {" "}
                          {uiState.nextBiomeUnlock.label}
                          {" • "}
                          {uiState.nextBiomeUnlock.hint}
                        </small>
                      )}
                    </div>

                    {uiState.lastEvolution && (
                      <div className="evolution-flash">
                        <strong>{uiState.lastEvolution.label}</strong>
                        <span>{uiState.lastEvolution.summary}</span>
                      </div>
                    )}

                    <div className="editor-group-grid">
                      {evolutionGroups.map((group) => (
                        <section key={group.key} className="evolution-group">
                          <div className="evolution-group-header">
                            <div>
                              <p className="eyebrow">{group.label}</p>
                              <h3>{group.summary}</h3>
                            </div>
                          </div>

                          <div className="evolution-choice-grid">
                            {group.entries.map((upgrade) => (
                              <button
                                key={upgrade.key}
                                type="button"
                                className={`upgrade-btn editor-upgrade-btn evolution-choice-card ${upgrade.level > 0 ? "active" : ""} ${!upgrade.blueprintUnlocked ? "is-locked" : ""}`}
                                disabled={!upgrade.canBuy}
                                onClick={() => gameRef.current?.purchaseUpgrade(upgrade.key)}
                              >
                                <div className="choice-summary">
                                  <span className="upgrade-slot">{upgrade.slot}</span>
                                  <strong>{upgrade.label}</strong>
                                  <span>{upgrade.description}</span>
                                  {upgrade.drawback && <span className="upgrade-drawback">Drawback: {upgrade.drawback}</span>}
                                </div>
                                <div className="choice-meta">
                                  <span className="choice-cost">
                                    {upgrade.maxed ? "Maxed" : !upgrade.blueprintUnlocked ? "Locked" : `${upgrade.cost} DNA`}
                                  </span>
                                  <span className="choice-level">Lv {upgrade.level}</span>
                                </div>
                                <span className="upgrade-bonus">{upgrade.summary}</span>
                                {!upgrade.maxed && <span className="upgrade-next">Next: {upgrade.nextSummary}</span>}
                                {!upgrade.blueprintUnlocked && <span className="upgrade-lock">{upgrade.unlockHint}</span>}
                                {!upgrade.maxed && (
                                  <span className="choice-tradeoff">
                                    Growth
                                    {" "}
                                    +{upgrade.growthDelta}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>

                    <div className="editor-footer">
                      <button className="utility-btn" type="button" onClick={() => gameRef.current?.setEditorTab("species")}>
                        Go To Species
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="species-summary-bar">
                      <div className="species-summary-card">
                        <span className="upgrade-slot">Active Body</span>
                        <strong>{activeIdentity}</strong>
                        <small>
                          {stageLabel}
                          {" • "}
                          {activeCreature?.killCount ?? 0}
                          {" "}
                          kills
                        </small>
                      </div>
                      <div className="species-summary-card">
                        <span className="upgrade-slot">Next Egg</span>
                        <strong>{uiState.evolutionDraft?.modified ? draftIdentity : "No new draft yet"}</strong>
                        <small>
                          Growth time
                          {" "}
                          {uiState.evolutionDraft?.maturityTarget ?? 0}
                        </small>
                      </div>
                      <div className="species-summary-card">
                        <span className="upgrade-slot">Population</span>
                        <strong>
                          {speciesCount}
                          /6 alive
                        </strong>
                        <small>{uiState.rosterFull ? "Roster full" : "Switch bodies freely at the nest."}</small>
                      </div>
                      <div className="species-summary-card">
                        <span className="upgrade-slot">Dominant Biome</span>
                        <strong>{uiState.dominantBiomeName}</strong>
                        <small>{uiState.nextBiomeUnlock ? `Next: ${uiState.nextBiomeUnlock.label}` : "All current frontiers claimed"}</small>
                      </div>
                    </div>

                    <div className="species-actions">
                      <button
                        className="utility-btn"
                        type="button"
                        disabled={!uiState.canLayEgg}
                        onClick={() => gameRef.current?.layEgg()}
                      >
                        Lay Egg
                      </button>
                      {activeCreature?.fastEvolveCost > 0 && (
                        <button
                          className="utility-btn"
                          type="button"
                          disabled={!activeCreature?.canFastEvolve}
                          onClick={() => gameRef.current?.fastEvolveCreature(activeCreature.id)}
                        >
                          Fast Evolve Active
                          {" "}
                          {activeCreature.fastEvolveCost}
                          {" "}
                          XP
                        </button>
                      )}
                      <button className="utility-btn secondary" type="button" onClick={() => gameRef.current?.setEditorTab("evolution")}>
                        Back To Creature Evolution
                      </button>
                    </div>

                    <div className="species-roster-list">
                      {uiState.speciesRoster.map((creature) => (
                        <div key={creature.id} className={`species-roster-card ${creature.active ? "active" : ""}`}>
                          <div className="species-roster-copy">
                            <span className="upgrade-slot">
                              Gen
                              {" "}
                              {creature.generation}
                            </span>
                            <strong>{creature.identity}</strong>
                            <span>
                              {creature.stageLabel}
                              {" • "}
                              {creature.maturityPct}
                              % grown
                            </span>
                            <span>{creature.maturationDetail}</span>
                          </div>

                          <div className="species-roster-meta">
                            <span>
                              {creature.active ? "Active body" : `${creature.remainingGrowth} growth left`}
                            </span>
                            <span>
                              {creature.killCount}
                              {" "}
                              kills
                            </span>
                          </div>

                          <div className="species-roster-actions">
                            {creature.canSwitch && (
                              <button className="utility-btn" type="button" onClick={() => gameRef.current?.switchSpeciesCreature(creature.id)}>
                                Switch
                              </button>
                            )}
                            {!creature.active && creature.fastEvolveCost > 0 && (
                              <button
                                className="utility-btn secondary"
                                type="button"
                                disabled={!creature.canFastEvolve}
                                onClick={() => gameRef.current?.fastEvolveCreature(creature.id)}
                              >
                                Fast Evolve
                                {" "}
                                {creature.fastEvolveCost}
                                {" "}
                                XP
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
