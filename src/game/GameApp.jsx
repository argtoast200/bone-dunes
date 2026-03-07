import { useEffect, useRef, useState } from "react";

import { SporeSliceGame } from "./SporeSliceGame";

const initialState = {
  mode: "menu",
  zone: "nest",
  message: "Wake at the nest, then head into the dunes for food.",
  objective: "Collect food, hunt threats, and evolve at the nest.",
  dna: 0,
  bestRun: 0,
  runScore: 0,
  sessionDna: 0,
  scavengersDefeated: 0,
  predatorsDefeated: 0,
  herbivoresDefeated: 0,
  huntSummary: "Fresh hatchling. No hunts logged yet.",
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
  editorPulse: 0,
  canOpenEditor: false,
  creatureIdentity: "Dune Nestling Bloomstripe",
  creatureProfile: {
    patternLabel: "Bloomstripe",
    size: 1,
  },
  traitStats: [],
  lastEvolution: null,
  hasSave: false,
  canUpgrade: false,
  controlsHint: "Left click move, WASD/Arrows steer, Space/right click bite, F fullscreen",
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
  const alertTitle = uiState.lowHealth ? "Fracture Alert" : surgeActive ? `Feral Surge x${uiState.surgeLevel}` : uiState.zone === "danger" ? "Apex Bonus Live" : "Quiet Window";
  const alertCopy = uiState.lowHealth
    ? "Health is low. Break line-of-sight, burst away, or get back to the nest."
    : surgeActive
      ? "Your stride hits harder and your bite recovers faster. Chain blooms or kills before the window burns out."
    : uiState.zone === "danger"
      ? `All DNA gains are boosted by ${Math.round((uiState.dangerBoost - 1) * 100)}% while you stay inside the red basin.`
      : uiState.editorOpen
        ? "The nest editor freezes the action so you can shape the creature, compare stats, and lock in a new silhouette."
      : uiState.canUpgrade
        ? "You are home. Heal, refill your burst, then open the creature editor and spend DNA on visible evolutions."
        : "Use the open dunes to route between blooms, then cash in upgrades at the nest.";

  return (
    <div className={`game-shell ${uiState.zone === "danger" ? "is-danger" : ""} ${uiState.lowHealth ? "is-low-health" : ""} ${surgeActive ? "is-surging" : ""}`}>
      <div className="game-stage">
        <div className="game-canvas" ref={mountRef} />

        <div className="hud-layer">
          <header className="top-bar">
            <div className="brand-card">
              <p className="eyebrow">Creature Slice</p>
              <h1>Bone Dunes</h1>
              <p className="status-copy">{uiState.controlsHint}</p>
              <div className={`status-banner ${alertTone}`}>
                <span>{alertTitle}</span>
                <strong>{uiState.gamepadConnected ? "Pad ready" : surgeActive ? `Hot ${Math.round(uiState.surgeCharge * 100)}%` : uiState.runScore > 0 ? `Run ${uiState.runScore}` : uiState.canUpgrade ? "Nest ready" : "Leave the bowl"}</strong>
              </div>
              <div className={`surge-strip ${surgeActive ? "active" : ""}`}>
                <div className="surge-copy">
                  <span>Feral Surge</span>
                  <strong>{surgeActive ? `x${uiState.surgeLevel}` : "Dormant"}</strong>
                </div>
                <div className="meter">
                  <div
                    className="meter-fill surge-fill"
                    style={{ width: `${Math.max(0, Math.min(100, uiState.surgeCharge * 100))}%` }}
                  />
                </div>
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
                  {uiState.canUpgrade ? "Upgrade Window" : uiState.zone === "danger" ? "High Risk" : "Traveling"}
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

            <div className="panel-card message-card">
              <p className="eyebrow">{alertTitle}</p>
              <p>{alertCopy}</p>
              <p className="signal-copy">{uiState.message}</p>
              {uiState.ecosystemNotice && <p className="signal-copy ecosystem-signal">{uiState.ecosystemNotice}</p>}
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
                  <h2>Run Pressure</h2>
                </div>
                <span className="zone-chip">{uiState.bestRun} best</span>
              </div>

              <div className="hunt-grid">
                <div className="hunt-stat">
                  <span>Run score</span>
                  <strong>{uiState.runScore}</strong>
                </div>
                <div className="hunt-stat">
                  <span>DNA this hunt</span>
                  <strong>{uiState.sessionDna}</strong>
                </div>
                <div className="hunt-stat">
                  <span>Predators</span>
                  <strong>{uiState.predatorsDefeated}</strong>
                </div>
                <div className="hunt-stat">
                  <span>Total kills</span>
                  <strong>{totalKills}</strong>
                </div>
                <div className="hunt-stat">
                  <span>Surge</span>
                  <strong>{surgeActive ? `x${uiState.surgeLevel}` : "Idle"}</strong>
                </div>
              </div>

              <p>{uiState.huntSummary}</p>
            </div>

            <div className="panel-card upgrade-card">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Evolution</p>
                  <h2>Creature Editor</h2>
                </div>
                <span className={`zone-pill ${uiState.canUpgrade ? "active" : ""}`}>
                  {uiState.editorOpen ? "Open" : uiState.canUpgrade ? "Ready" : "Return Home"}
                </span>
              </div>

              <div className="evolution-preview">
                <div>
                  <p className="eyebrow">Phenotype</p>
                  <h3>{uiState.creatureIdentity}</h3>
                  <p>
                    {uiState.creatureProfile.patternLabel}
                    {" "}
                    pattern
                    {" "}
                    {uiState.creatureProfile.size > 1.05 ? "with a broader frame." : uiState.creatureProfile.size < 0.95 ? "with a lean, quick frame." : "with a balanced frame."}
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
                {uiState.traitStats.slice(0, 4).map((stat) => (
                  <div key={stat.label} className="trait-stat">
                    <span>{stat.label}</span>
                    <strong>{stat.value}</strong>
                    <small>{stat.detail}</small>
                  </div>
                ))}
              </div>

              {uiState.lastEvolution && (
                <p className="signal-copy">
                  Latest mutation:
                  {" "}
                  <strong>{uiState.lastEvolution.label}</strong>
                  {" "}
                  <span>{uiState.lastEvolution.summary}</span>
                </p>
              )}

              <div className="editor-actions">
                <button
                  className="utility-btn"
                  type="button"
                  disabled={!uiState.canOpenEditor}
                  onClick={() => gameRef.current?.toggleEditor(true)}
                >
                  Open Creature Editor
                </button>
                {uiState.editorOpen && (
                  <button className="utility-btn secondary" type="button" onClick={() => gameRef.current?.toggleEditor(false)}>
                    Close Editor
                  </button>
                )}
              </div>
            </div>
          </aside>

          <div className="bottom-row">
            <div className={`panel-card loop-card ${alertTone}`}>
              <p className="eyebrow">{uiState.zone === "danger" ? "Push Deeper" : "Loop"}</p>
              <p>
                {uiState.activeMigration
                  ? `${uiState.activeMigration.label} is live. Follow the movement and you will run into safer grazers, pressured scavengers, or a predator clash.`
                  : uiState.territoryOwner
                    ? `${uiState.territoryOwner} define this stretch of dunes. Cross their landmark ring for better action, then retreat before the territory closes around you.`
                    : uiState.zone === "danger"
                      ? "Rare blooms and predator hunts spike your run score fast, but the basin turns every mistake into a wipe."
                      : "Collect food, take smart fights, then come home to heal and convert your better movement into longer runs."}
              </p>
            </div>

            <div className="panel-card utility-card">
              <div className="utility-copy">
                <span>Best run</span>
                <strong>{uiState.bestRun}</strong>
              </div>
              <button
                className="utility-btn"
                type="button"
                disabled={!uiState.canOpenEditor}
                onClick={() => gameRef.current?.toggleEditor(true)}
              >
                Creature Editor
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
                <h2>Grow a dune-runner, not a full civilization.</h2>
                <p>
                  Scavenge glowing blooms, burst between safe windows, and dare the predator basin for richer DNA and a better run score.
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
                    <p>Turquoise nest ring heals you and opens the upgrade window.</p>
                    <p>Orange-red predator basin boosts every DNA gain while you stay inside.</p>
                    <p>Best runs come from risking one more bloom or one more kill before retreating.</p>
                  </div>
                </div>

                <div className="menu-stats">
                  <div>
                    <span>Best run</span>
                    <strong>{uiState.bestRun}</strong>
                  </div>
                  <div>
                    <span>Upgrades</span>
                    <strong>{uiState.hasSave ? "Saved" : "Fresh"}</strong>
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
                    <p className="eyebrow">Nest Editor</p>
                    <h2>{uiState.creatureIdentity}</h2>
                  </div>
                  <button className="ghost-btn" type="button" onClick={() => gameRef.current?.toggleEditor(false)}>
                    Close Editor
                  </button>
                </div>

                <div className="editor-summary-grid">
                  <div className="editor-summary-card">
                    <span className="zone-chip">DNA {uiState.dna}</span>
                    <p>
                      {uiState.creatureProfile.patternLabel}
                      {" "}
                      markings on a
                      {" "}
                      {uiState.creatureProfile.size > 1.05 ? "larger" : uiState.creatureProfile.size < 0.95 ? "leaner" : "balanced"}
                      {" "}
                      frame.
                    </p>
                    <p>
                      Buy parts at the nest only. Each mutation changes the live creature model and nudges combat stats.
                    </p>
                    {uiState.lastEvolution && (
                      <div className="evolution-flash">
                        <strong>{uiState.lastEvolution.label}</strong>
                        <span>{uiState.lastEvolution.summary}</span>
                      </div>
                    )}
                  </div>

                  <div className="trait-stat-grid">
                    {uiState.traitStats.map((stat) => (
                      <div key={stat.label} className="trait-stat">
                        <span>{stat.label}</span>
                        <strong>{stat.value}</strong>
                        <small>{stat.detail}</small>
                      </div>
                    ))}
                  </div>
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
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
