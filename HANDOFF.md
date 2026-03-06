# Bone Dunes Handoff

## Recommended next home

Move `bone-dunes-standalone/` into a brand-new repository and deploy that repo to Vercel.

## Current architecture

The standalone app is a minimal Vite + React + Three.js project.

- `src/main.jsx` mounts the app.
- `src/App.jsx` mounts the game UI shell.
- `src/game/SporeSliceGame.js` contains the runtime loop, scene setup, input, combat, saves, and browser testing hooks.
- `src/game/GameApp.jsx` contains the HUD and UI controls.
- `src/game/world.js` builds the biome and ambient scene dressing.
- `src/game/config.js` contains gameplay constants and spawn data.
- `src/game/save.js` handles local save persistence.

## Exact runtime entry

- `bone-dunes-standalone/src/main.jsx`

## Main game files

- `bone-dunes-standalone/src/App.jsx`
- `bone-dunes-standalone/src/index.css`
- `bone-dunes-standalone/src/game/GameApp.jsx`
- `bone-dunes-standalone/src/game/SporeSliceGame.js`
- `bone-dunes-standalone/src/game/world.js`
- `bone-dunes-standalone/src/game/config.js`
- `bone-dunes-standalone/src/game/save.js`
- `bone-dunes-standalone/public/manifest.json`
- `bone-dunes-standalone/public/favicon.svg`
- `bone-dunes-standalone/index.html`
- `bone-dunes-standalone/package.json`
- `bone-dunes-standalone/vite.config.js`
- `bone-dunes-standalone/vercel.json`

## Overwritten files from the original app

These were previously replaced in `whistlewatch-main/` during the game prototype work:

- `whistlewatch-main/src/App.jsx`
- `whistlewatch-main/src/index.css`
- `whistlewatch-main/README.md`

These were modified in place:

- `whistlewatch-main/index.html`
- `whistlewatch-main/package.json`
- `whistlewatch-main/package-lock.json`

The original runtime entry files have now been restored so the legacy app is recoverable.

## Newly created game files in the original workspace

- `whistlewatch-main/src/game/GameApp.jsx`
- `whistlewatch-main/src/game/SporeSliceGame.js`
- `whistlewatch-main/src/game/world.js`
- `whistlewatch-main/src/game/config.js`
- `whistlewatch-main/src/game/save.js`
- `whistlewatch-main/public/manifest.json`
- `whistlewatch-main/progress.md`

## Bypassed but preserved legacy files

The original app shell and most page-based app files remain preserved in `whistlewatch-main/`, including:

- `whistlewatch-main/src/pages.config.js`
- `whistlewatch-main/src/Layout.jsx`
- `whistlewatch-main/src/lib/NavigationTracker.jsx`
- `whistlewatch-main/src/lib/AuthContext.jsx`
- `whistlewatch-main/src/lib/query-client.js`
- `whistlewatch-main/src/lib/PageNotFound.jsx`
- `whistlewatch-main/src/pages/**/*`
- `whistlewatch-main/src/components/**/*`
- `whistlewatch-main/src/api/**/*`
- `whistlewatch-main/src/hooks/**/*`
- `whistlewatch-main/src/utils/**/*`

## Generated files and folders that are not real source

In `whistlewatch-main/`:

- `node_modules/`
- `.npm-cache/`
- `dist/`
- `output/`

In `bone-dunes-standalone/` after local install/build:

- `node_modules/`
- `.npm-cache/`
- `dist/`

## What is safe to deploy

Safe to deploy:

- only `bone-dunes-standalone/`

Not safe to deploy for the game:

- `whistlewatch-main/`
- the mixed workspace root

## What should never be pushed back into the Base44-connected repo

Do not treat the standalone game as a replacement for the original Base44 app entry.

Avoid pushing:

- the standalone game as the main runtime of `whistlewatch-main/`
- deployment-focused changes that repurpose the Base44-oriented repo into the game repo
- Vercel project wiring aimed at the original app root

## Safe mental model

Think of the workspace as two separate things:

- `whistlewatch-main/`: original legacy app, preserved and recoverable
- `bone-dunes-standalone/`: standalone game prepared for later extraction into its own repo
