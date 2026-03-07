import { useEffect, useRef, useState } from "react";

import { SporeSliceGame } from "./SporeSliceGame";

const initialState = {
  mode: "menu",
  zone: "nest",
  message: "Wake at the nest, gather DNA, then return to lay the next egg.",
  objective: "Evolve at the nest, hatch a stronger body, and grow it in the dunes.",
  dna: 0,
  speciesXp: 0,
  bestRun: 0,
  runScore: 0,
  sessionDna: 0,
  scavengersDefeated: 0,
  predatorsDefeated: 0,
  herbivoresDefeated: 0,
  huntSummary: "Fresh line. Gather DNA, lay a new egg, then grow it in the dunes.",
  health: 120,
  maxHealth: 120,
  sprintCharge: 1,
  biteCharge: 1,
  attackPhase: "idle",
  attackResult: "ready",
  surgeCharge: 0,
  surgeLevel: 0,
  lowHealth: false,
  dangerBoost: 1,
  threatDistance: null,
  zoneTransition: 0,
  ecosystemNotice: "The dunes are still settling.",
  territoryName: null,
  territoryOwner: null,
  territoryTemperament: null,
  territoryAlert: 0,
  territoryPopulation: null,
  activeMigration: null,
  gamepadConnected: false,
  gamepadLabel: "",
  nearbySpecies: [],
  nearbyNests: [],
  upgrades: {
    jaw: 0,
    horns: 0,
    crest: 0,
    tail: 0,
    legs: 0,
    spikes: 0,
    glow: 0,
  },
  upgradeEntries: [],
  editorOpen: false,
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
  },
  traitStats: [],
  lastEvolution: null,
  hasSave: false,
  canUpgrade: false,
  controlsHint: "Left click move, WASD/Arrows steer, Space/right click bite, then return to the nest to evolve",
};

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

  const totalKills = uiState.scavengersDefeated + uiState.predatorsDefeated + uiState.herbivoresDefeated;
  const zoneTitle = uiState.zone === "nest" ? "Safe Nest" : uiState.zone === "danger" ? "Predator Territory" : "Open Dunes";
  const surgeActive = uiState.surgeCharge > 0.05;
  const activeMutations = uiState.upgradeEntries.filter((upgrade) => upgrade.level > 0);
  const editorTransforming = uiState.editorOpen && uiState.editorPulse > 0.08;
  const activeCreature = uiState.activeCreature;
  const activeIdentity = activeCreature?.identity ?? uiState.creatureIdentity;
  const activeStage = activeCreature?.stage ?? "Adult";
  const activeGrowthPct = activeCreature?.maturityPct ?? 100;
  const speciesCount = uiState.speciesRoster.length;
  const draftIdentity = uiState.evolutionDraft?.identity ?? "Unshaped Egg";
  const draftBaseIdentity = uiState.evolutionDraft?.baseIdentity ?? activeIdentity;
  const territoryPressure = Math.round((uiState.territoryAlert ?? 0) * 100);
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
  const alertTone = uiState.lowHealth ? "warning" : surgeActive ? "surge" : uiState.zone === "danger" ? "danger" : "calm";

  return (
    <div className={`game-shell ${uiState.zone === "danger" ? "is-danger" : ""} ${uiState.lowHealth ? "is-low-health" : ""} ${surgeActive ? "is-surging" : ""}`}>
      <div className="game-stage">
        <div className="game-canvas" ref={mountRef} />

        <div className="hud-layer">
          <header className="top-bar">
            <div className="brand-card compact-brand-card">
              <div className="brand-head">
                <div>
                  <p className="eyebrow">Species Line</p>
                  <h1>Bone Dunes</h1>
                </div>
                <span className={`zone-pill ${activeGrowthPct >= 100 ? "active" : ""}`}>
                  {activeStage}
                  {" "}
                  {activeGrowthPct}%
                </span>
              </div>

              <div className="brand-active">
                <span>Active body</span>
                <strong>{activeIdentity}</strong>
                <small>
                  Gen
                  {" "}
                  {activeCreature?.generation ?? 1}
                  {" • "}
                  {speciesCount}
                  /6 bodies
                  {" • "}
                  {uiState.speciesXp}
                  {" "}
                  XP
                </small>
              </div>

              <div className="compact-meter-block">
                <div className="meter-copy">
                  <span>Growth</span>
                  <strong>{activeGrowthPct}%</strong>
                </div>
                <div className="meter">
                  <div
                    className="meter-fill surge-fill"
                    style={{ width: `${Math.max(0, Math.min(100, activeGrowthPct))}%` }}
                  />
                </div>
              </div>

              <p className="status-copy">{uiState.controlsHint}</p>

              <div className="trait-chip-row compact-status-row">
                <span className="trait-chip active">
                  DNA
                  {" "}
                  {uiState.dna}
                </span>
                <span className="trait-chip">
                  {surgeActive ? `Feral x${uiState.surgeLevel}` : uiState.gamepadConnected ? "Pad Ready" : "Nest Line"}
                </span>
                {uiState.evolutionDraft?.modified && <span className="trait-chip active">Egg Ready</span>}
              </div>
            </div>

            <div className="resource-strip">
              <div className="resource-card">
                <span>Health</span>
                <strong>
                  {Math.round(uiState.health)} / {Math.round(uiState.maxHealth)}
                </strong>
                <div className="meter">
                  <div
                    className="meter-fill health-fill"
                    style={{ width: `${Math.max(0, (uiState.health / uiState.maxHealth) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="resource-card">
                <span>Sprint</span>
                <strong>{Math.round(uiState.sprintCharge * 100)}%</strong>
                <div className="meter">
                  <div
                    className="meter-fill sprint-fill"
                    style={{ width: `${Math.max(0, uiState.sprintCharge * 100)}%` }}
                  />
                </div>
              </div>

              <div className={`resource-card bite-card ${uiState.attackResult}`}>
                <span>Bite</span>
                <strong>{biteStatus}</strong>
                <div className="meter">
                  <div
                    className="meter-fill bite-fill"
                    style={{ width: `${Math.max(0, Math.min(100, uiState.biteCharge * 100))}%` }}
                  />
                </div>
              </div>

              <div className="resource-card">
                <span>DNA</span>
                <strong>{uiState.dna}</strong>
                <div className="meter">
                  <div
                    className="meter-fill dna-fill"
                    style={{ width: `${Math.min(100, 18 + uiState.dna * 3)}%` }}
                  />
                </div>
              </div>
            </div>
          </header>

          <aside className="side-panel">
            <div className="panel-card zone-card">
              <p className="eyebrow">Area</p>
              <h2>{zoneTitle}</h2>
              <div className="zone-meta">
                <span className={`zone-pill ${uiState.canUpgrade ? "active" : ""}`}>
                  {uiState.canUpgrade ? "Nest Access" : uiState.zone === "danger" ? "High Risk" : "Traveling"}
                </span>
                {uiState.territoryOwner && <span className="zone-pill active">{uiState.territoryOwner}</span>}
                <span className="zone-chip">{uiState.threatDistance ? `Threat ${uiState.threatDistance.toFixed(0)}m` : "Threat unknown"}</span>
              </div>
              <p>{uiState.objective}</p>
              <p className="signal-copy ecosystem-signal zone-signal">
                {uiState.activeMigration
                  ? `${uiState.activeMigration.label}: ${uiState.activeMigration.species} are on the move for ${uiState.activeMigration.timeLeft}s.`
                  : uiState.territoryOwner
                    ? `${uiState.territoryOwner} pressure at ${territoryPressure}% around ${uiState.territoryName}.`
                    : uiState.ecosystemNotice}
              </p>
            </div>

            <div className="panel-card species-card">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Species Nest</p>
                  <h2>{activeIdentity}</h2>
                </div>
                <span className={`zone-pill ${uiState.activeMigration ? "active" : ""}`}>
                  {uiState.canLayEgg ? "Egg Ready" : uiState.editorOpen ? "Nest Open" : uiState.canUpgrade ? "Nest Ready" : "Return Home"}
                </span>
              </div>

              <p>
                {activeCreature?.stage === "Adult"
                  ? "Adult body online. Use Creature Evolution to design the next egg, then hatch it from the Species Nest."
                  : `${activeIdentity} is still ${activeCreature?.stage?.toLowerCase()}. Time alive and kills accelerate maturation.`}
              </p>

              <div className="hunt-grid ecosystem-grid">
                <div className="hunt-stat">
                  <span>Species XP</span>
                  <strong>{uiState.speciesXp}</strong>
                </div>
                <div className="hunt-stat">
                  <span>Bodies</span>
                  <strong>
                    {speciesCount}
                    /6
                  </strong>
                </div>
                <div className="hunt-stat">
                  <span>Growth</span>
                  <strong>{activeGrowthPct}%</strong>
                </div>
                <div className="hunt-stat">
                  <span>Next Egg</span>
                  <strong>{uiState.evolutionDraft?.modified ? "Ready" : "Draft"}</strong>
                </div>
              </div>

              <div className="evolution-preview">
                <div>
                  <p className="eyebrow">Egg Draft</p>
                  <h3>{draftIdentity}</h3>
                  <p>
                    Based on
                    {" "}
                    {draftBaseIdentity}
                    . Spend DNA in Creature Evolution, then return here to lay the egg.
                  </p>
                </div>
                <div className="trait-chip-row">
                  {(activeMutations.length > 0 ? activeMutations : uiState.upgradeEntries.slice(0, 3)).slice(0, 4).map((upgrade) => (
                    <span key={upgrade.key} className={`trait-chip ${upgrade.level > 0 ? "active" : ""}`}>
                      {upgrade.label}
                      {upgrade.level > 0 ? ` Lv ${upgrade.level}` : ""}
                    </span>
                  ))}
                </div>
              </div>

              <div className="trait-stat-grid compact">
                {[
                  { label: "Generation", value: activeCreature?.generation ?? 1, detail: "current body" },
                  { label: "Stage", value: activeStage, detail: "growth state" },
                  { label: "Kills", value: activeCreature?.killCount ?? 0, detail: "this body" },
                  { label: "Egg Traits", value: uiState.evolutionDraft?.traitTotal ?? 0, detail: "draft complexity" },
                ].map((stat) => (
                  <div key={stat.label} className="trait-stat">
                    <span>{stat.label}</span>
                    <strong>{stat.value}</strong>
                    <small>{stat.detail}</small>
                  </div>
                ))}
              </div>

              <p className="signal-copy">{uiState.message}</p>

              <div className="editor-actions">
                <button
                  className="utility-btn"
                  type="button"
                  disabled={!uiState.canOpenEditor}
                  onClick={() => gameRef.current?.toggleEditor(true)}
                >
                  Open Species Nest
                </button>
                {uiState.editorOpen && (
                  <button className="utility-btn secondary" type="button" onClick={() => gameRef.current?.toggleEditor(false)}>
                    Close Nest
                  </button>
                )}
              </div>
            </div>

            <div className="panel-card ecosystem-card">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Ecosystem</p>
                  <h2>{uiState.territoryOwner ?? "Open Dunes"}</h2>
                </div>
                <span className={`zone-pill ${uiState.activeMigration ? "active" : ""}`}>
                  {uiState.activeMigration ? uiState.activeMigration.label : uiState.territoryName ?? "No Active Claim"}
                </span>
              </div>

              <p>
                {uiState.territoryOwner
                  ? `${uiState.territoryOwner} hold ${uiState.territoryName}. ${uiState.territoryTemperament} behavior spikes as you push deeper.`
                  : "Species drift between landmarks until a migration, carcass, or intruder pulls them into a new fight."}
              </p>

              <div className="hunt-grid ecosystem-grid">
                <div className="hunt-stat">
                  <span>Territory alert</span>
                  <strong>{uiState.territoryOwner ? `${territoryPressure}%` : "Low"}</strong>
                </div>
                <div className="hunt-stat">
                  <span>Presence</span>
                  <strong>{uiState.territoryPopulation ?? "--"}</strong>
                </div>
                <div className="hunt-stat">
                  <span>Migration</span>
                  <strong>{uiState.activeMigration ? `${uiState.activeMigration.timeLeft}s` : "Quiet"}</strong>
                </div>
              </div>

              <div className="trait-chip-row ecosystem-chip-row">
                {uiState.nearbySpecies.slice(0, 4).map((entry) => (
                  <span key={entry.id} className="trait-chip active ecosystem-chip">
                    {entry.species}
                    {" "}
                    {entry.distance.toFixed(0)}m
                  </span>
                ))}
              </div>

              {uiState.nearbyNests.length > 0 && (
                <div className="nest-list">
                  {uiState.nearbyNests.slice(0, 2).map((nest) => (
                    <div key={`${nest.species}-${nest.distance}`} className={`nest-pill ${nest.destroyed ? "broken" : ""}`}>
                      <span>{nest.species}</span>
                      <strong>{nest.destroyed ? "Broken" : `${Math.round((nest.hp / nest.maxHp) * 100)}% nest`}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="panel-card hunt-card">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Hunt</p>
                  <h2>Current Excursion</h2>
                </div>
                <span className="zone-chip">{surgeActive ? `Feral x${uiState.surgeLevel}` : `${uiState.bestRun} best`}</span>
              </div>

              <div className="hunt-grid">
                <div className="hunt-stat">
                  <span>DNA this hunt</span>
                  <strong>{uiState.sessionDna}</strong>
                </div>
                <div className="hunt-stat">
                  <span>Run score</span>
                  <strong>{uiState.runScore}</strong>
                </div>
                <div className="hunt-stat">
                  <span>Predators</span>
                  <strong>{uiState.predatorsDefeated}</strong>
                </div>
                <div className="hunt-stat">
                  <span>Total kills</span>
                  <strong>{totalKills}</strong>
                </div>
              </div>

              <p>{uiState.huntSummary}</p>
            </div>
          </aside>

          <div className="bottom-row">
            <div className={`panel-card loop-card ${alertTone}`}>
              <p className="eyebrow">{uiState.zone === "danger" ? "Push Deeper" : "Growth Loop"}</p>
              <p>
                {activeCreature?.maturityPct < 100
                  ? `${activeIdentity} is still growing. Time alive in this body and clean kills accelerate maturation.`
                  : uiState.evolutionDraft?.modified
                    ? `${draftIdentity} is drafted. Return to the Species Nest tab and lay the egg when you want to branch the line.`
                    : uiState.activeMigration
                      ? `${uiState.activeMigration.label} is live. Ride the ecosystem pressure for DNA, then bring that DNA home to design the next body.`
                      : uiState.zone === "danger"
                        ? "Danger territory pays richer DNA, but every mistake can kill the body you are trying to mature."
                        : "Gather DNA, shape a new egg, hatch it at the nest, then swap between bodies as the species line grows."}
              </p>
            </div>

            <div className="panel-card utility-card">
              <div className="utility-copy">
                <span>Species XP</span>
                <strong>{uiState.speciesXp}</strong>
              </div>
              <div className="utility-copy">
                <span>Bodies</span>
                <strong>
                  {speciesCount}
                  /6
                </strong>
              </div>
              <button
                className="utility-btn"
                type="button"
                disabled={!uiState.canOpenEditor}
                onClick={() => gameRef.current?.toggleEditor(true)}
              >
                Species Nest
              </button>
              <button className="utility-btn" type="button" onClick={() => gameRef.current?.toggleFullscreen()}>
                Fullscreen
              </button>
              <button className="utility-btn secondary" type="button" onClick={() => gameRef.current?.resetProgress()}>
                Reset Save
              </button>
            </div>
          </div>

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
              <div className="menu-card">
                <p className="eyebrow">Playable Vertical Slice</p>
                <h2>Evolve a species line, not just a single run.</h2>
                <p>
                  Gather DNA in the Bone Dunes, return to the nest to shape a new egg, then survive in that newborn body until it grows into its full form.
                </p>

                <div className="menu-grid">
                  <div>
                    <h3>Controls</h3>
                    <p>`Left click` move target</p>
                    <p>`WASD` or `Arrows` steer</p>
                    <p>`Shift` sprint</p>
                    <p>`Space` or `Right click` bite</p>
                    <p>`Xbox controller` supported</p>
                    <p>`F` fullscreen</p>
                  </div>
                  <div>
                    <h3>Read the loop</h3>
                    <p>Bring DNA home and spend it in Creature Evolution.</p>
                    <p>Lay the egg from the Species Nest tab, then switch into the newborn.</p>
                    <p>Time alive and kills mature that body; species XP can fast evolve it at the nest.</p>
                  </div>
                </div>

                <div className="menu-stats">
                  <div>
                    <span>Bodies</span>
                    <strong>{speciesCount || 1}</strong>
                  </div>
                  <div>
                    <span>Species XP</span>
                    <strong>{uiState.speciesXp}</strong>
                  </div>
                </div>

                <div className="menu-actions">
                  <button id="start-btn" className="start-btn" type="button" onClick={() => gameRef.current?.startGame()}>
                    {uiState.hasSave ? "Resume Hunt" : "Start Hunt"}
                  </button>
                  <button className="ghost-btn" type="button" onClick={() => gameRef.current?.resetProgress()}>
                    New Organism
                  </button>
                </div>
              </div>
            </div>
          )}

          {uiState.editorOpen && (
            <div className="editor-overlay">
              <div className={`editor-card ${editorTransforming ? "is-transforming" : ""}`}>
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Species Nest</p>
                    <h2>{activeIdentity}</h2>
                  </div>
                  <button className="ghost-btn" type="button" onClick={() => gameRef.current?.toggleEditor(false)}>
                    Close Nest
                  </button>
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
                    Species Nest
                  </button>
                </div>

                {uiState.editorTab === "evolution" ? (
                  <>
                    <div className="editor-summary-grid">
                      <div className="editor-summary-card">
                        <span className="zone-chip">DNA {uiState.dna}</span>
                        <p>
                          Drafting
                          {" "}
                          <strong>{draftIdentity}</strong>
                          {" "}
                          from
                          {" "}
                          {draftBaseIdentity}.
                        </p>
                        <p>
                          Spend DNA here to shape the next body. Then switch to the Species Nest tab to lay the egg.
                        </p>
                        {uiState.lastEvolution && (
                          <div className="evolution-flash">
                            <strong>{uiState.lastEvolution.label}</strong>
                            <span>{uiState.lastEvolution.summary}</span>
                          </div>
                        )}
                      </div>

                      <div className="trait-stat-grid">
                        {[
                          { label: "Egg traits", value: uiState.evolutionDraft?.traitTotal ?? 0, detail: "draft complexity" },
                          { label: "Bodies", value: `${speciesCount}/6`, detail: "species line" },
                          { label: "Species XP", value: uiState.speciesXp, detail: "fast evolve bank" },
                          { label: "Ready", value: uiState.evolutionDraft?.modified ? "Yes" : "No", detail: "egg can be laid" },
                        ].map((stat) => (
                          <div key={stat.label} className="trait-stat">
                            <span>{stat.label}</span>
                            <strong>{stat.value}</strong>
                            <small>{stat.detail}</small>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="editor-actions">
                      <button className="utility-btn" type="button" onClick={() => gameRef.current?.setEditorTab("species")}>
                        Go To Species Nest
                      </button>
                    </div>

                    <div className="upgrade-list editor-upgrade-list">
                      {uiState.upgradeEntries.map((upgrade) => (
                        <button
                          key={upgrade.key}
                          type="button"
                          className={`upgrade-btn editor-upgrade-btn ${upgrade.level > 0 ? "active" : ""}`}
                          disabled={!upgrade.canBuy}
                          onClick={() => gameRef.current?.purchaseUpgrade(upgrade.key)}
                        >
                          <div>
                            <span className="upgrade-slot">{upgrade.slot}</span>
                            <strong>{upgrade.label}</strong>
                            <span>{upgrade.description}</span>
                            <span className="upgrade-bonus">{upgrade.summary}</span>
                            {!upgrade.maxed && <span className="upgrade-next">Next: {upgrade.nextSummary}</span>}
                          </div>
                          <div className="upgrade-meta">
                            <span>Lv {upgrade.level}</span>
                            <span>{upgrade.maxed ? "Maxed" : `${upgrade.cost} DNA`}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="editor-summary-grid">
                      <div className="editor-summary-card">
                        <span className="zone-chip">Species XP {uiState.speciesXp}</span>
                        <p>
                          Active body:
                          {" "}
                          <strong>{activeIdentity}</strong>
                          {" "}
                          {activeStage.toLowerCase()}
                          {" "}
                          at
                          {" "}
                          {activeGrowthPct}
                          % growth.
                        </p>
                        <p>
                          Lay the drafted egg here, then swap between any body in the line. Hatchlings mature from time alive and kills.
                        </p>
                        {uiState.rosterFull && (
                          <div className="evolution-flash">
                            <strong>Roster Full</strong>
                            <span>The species line is at 6 bodies. Switch into an existing body before drafting farther.</span>
                          </div>
                        )}
                      </div>

                      <div className="trait-stat-grid">
                        {[
                          { label: "Growth left", value: activeCreature ? activeCreature.remainingGrowth : 0, detail: "points to adult" },
                          { label: "Fast evolve", value: activeCreature?.fastEvolveCost ?? 0, detail: "xp for active body" },
                          { label: "Kills", value: activeCreature?.killCount ?? 0, detail: "current body" },
                          { label: "Egg draft", value: uiState.evolutionDraft?.modified ? "Ready" : "Empty", detail: draftIdentity },
                        ].map((stat) => (
                          <div key={stat.label} className="trait-stat">
                            <span>{stat.label}</span>
                            <strong>{stat.value}</strong>
                            <small>{stat.detail}</small>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="editor-actions">
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
                              {creature.stage}
                              {" • "}
                              {creature.maturityPct}
                              % grown
                              {" • "}
                              {creature.killCount}
                              {" "}
                              kills
                            </span>
                            <span className="upgrade-bonus">
                              {creature.active ? "Active body" : `${creature.remainingGrowth} growth points left`}
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
