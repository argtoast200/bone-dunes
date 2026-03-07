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
  huntSummary: "Fresh hatchling. No hunts logged yet.",
  health: 120,
  maxHealth: 120,
  sprintCharge: 1,
  biteCharge: 1,
  lowHealth: false,
  dangerBoost: 1,
  threatDistance: null,
  zoneTransition: 0,
  upgrades: {
    speed: 0,
    health: 0,
    bite: 0,
    cooldown: 0,
    crest: 0,
  },
  upgradeEntries: [],
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

  const totalKills = uiState.scavengersDefeated + uiState.predatorsDefeated;
  const zoneTitle = uiState.zone === "nest" ? "Safe Nest" : uiState.zone === "danger" ? "Predator Territory" : "Open Dunes";
  const alertTone = uiState.lowHealth ? "warning" : uiState.zone === "danger" ? "danger" : "calm";
  const alertTitle = uiState.lowHealth ? "Fracture Alert" : uiState.zone === "danger" ? "Apex Bonus Live" : "Quiet Window";
  const alertCopy = uiState.lowHealth
    ? "Health is low. Break line-of-sight, burst away, or get back to the nest."
    : uiState.zone === "danger"
      ? `All DNA gains are boosted by ${Math.round((uiState.dangerBoost - 1) * 100)}% while you stay inside the red basin.`
      : uiState.canUpgrade
        ? "You are home. Heal, refill your burst, and spend DNA while the nest is safe."
        : "Use the open dunes to route between blooms, then cash in upgrades at the nest.";

  return (
    <div className={`game-shell ${uiState.zone === "danger" ? "is-danger" : ""} ${uiState.lowHealth ? "is-low-health" : ""}`}>
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
                <strong>{uiState.runScore > 0 ? `Run ${uiState.runScore}` : uiState.canUpgrade ? "Nest ready" : "Leave the bowl"}</strong>
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

              <div className="resource-card">
                <span>Bite</span>
                <strong>{uiState.biteCharge >= 0.98 ? "Ready" : "Recovering"}</strong>
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
                <span className="zone-chip">{uiState.threatDistance ? `Threat ${uiState.threatDistance.toFixed(0)}m` : "Threat unknown"}</span>
              </div>
              <p>{uiState.objective}</p>
            </div>

            <div className="panel-card message-card">
              <p className="eyebrow">{alertTitle}</p>
              <p>{alertCopy}</p>
              <p className="signal-copy">{uiState.message}</p>
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
              </div>

              <p>{uiState.huntSummary}</p>
            </div>

            <div className="panel-card upgrade-card">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Evolution</p>
                  <h2>Nest Upgrades</h2>
                </div>
                <span className={`zone-pill ${uiState.canUpgrade ? "active" : ""}`}>
                  {uiState.canUpgrade ? "Available" : "Return Home"}
                </span>
              </div>

              <div className="upgrade-list">
                {uiState.upgradeEntries.map((upgrade) => (
                  <button
                    key={upgrade.key}
                    type="button"
                    className="upgrade-btn"
                    disabled={!upgrade.canBuy}
                    onClick={() => gameRef.current?.purchaseUpgrade(upgrade.key)}
                  >
                    <div>
                      <strong>{upgrade.label}</strong>
                      <span>{upgrade.description}</span>
                    </div>
                    <div className="upgrade-meta">
                      <span>Lv {upgrade.level}</span>
                      <span>{upgrade.maxed ? "Maxed" : `${upgrade.cost} DNA`}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <div className="bottom-row">
            <div className={`panel-card loop-card ${alertTone}`}>
              <p className="eyebrow">{uiState.zone === "danger" ? "Push Deeper" : "Loop"}</p>
              <p>
                {uiState.zone === "danger"
                  ? "Rare blooms and predator hunts spike your run score fast, but the basin turns every mistake into a wipe."
                  : "Collect food, take smart fights, then come home to heal and convert your better movement into longer runs."}
              </p>
            </div>

            <div className="panel-card utility-card">
              <div className="utility-copy">
                <span>Best run</span>
                <strong>{uiState.bestRun}</strong>
              </div>
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
        </div>
      </div>
    </div>
  );
}
