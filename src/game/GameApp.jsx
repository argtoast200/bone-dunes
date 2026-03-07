import { useEffect, useRef, useState } from "react";

import { SporeSliceGame } from "./SporeSliceGame";

const initialState = {
  mode: "menu",
  zone: "nest",
  message: "Wake at the nest, then head into the dunes for food.",
  objective: "Collect food, hunt threats, and evolve at the nest.",
  dna: 0,
  health: 120,
  maxHealth: 120,
  upgrades: {
    speed: 0,
    health: 0,
    bite: 0,
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

  return (
    <div className="game-shell">
      <div className="game-stage">
        <div className="game-canvas" ref={mountRef} />

        <div className="hud-layer">
          <header className="top-bar">
            <div className="brand-card">
              <p className="eyebrow">Creature Slice</p>
              <h1>Bone Dunes</h1>
              <p className="status-copy">{uiState.controlsHint}</p>
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
              <h2>{uiState.zone === "nest" ? "Safe Nest" : uiState.zone === "danger" ? "Predator Territory" : "Open Dunes"}</h2>
              <p>{uiState.objective}</p>
            </div>

            <div className="panel-card message-card">
              <p className="eyebrow">Signal</p>
              <p>{uiState.message}</p>
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
            <div className="panel-card loop-card">
              <p className="eyebrow">Loop</p>
              <p>Collect food. Fight for DNA. Retreat to the nest. Evolve and push farther into the red dunes.</p>
            </div>

            <div className="panel-card utility-card">
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
                  Scavenge glowing food, pick fights you can win, and spend DNA at the nest to survive deeper in the bone dunes.
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
                    <h3>Read the world</h3>
                    <p>Turquoise nest ring is safe and heals.</p>
                    <p>Orange-red ring marks the rich predator zone.</p>
                    <p>Rare food glows hotter and pays more DNA.</p>
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
