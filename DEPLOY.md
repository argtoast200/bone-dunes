# Deploy Bone Dunes Safely

## Recommended approach

The safest approach is:

1. Keep the original `whistlewatch-main/` project as the Base44-oriented app.
2. Treat `bone-dunes-standalone/` as the only deployable home for the game.
3. Move `bone-dunes-standalone/` into its own new Git repository before any Vercel connection.

This keeps the game isolated from:

- the original Base44 app runtime
- the original repo's sync/workflow assumptions
- any chance of accidentally deploying the wrong app

## Should you create a new repo?

Yes. A separate new repo is strongly recommended.

Do not deploy the mixed legacy workspace root if you want the lowest-risk setup.

## Safest local source to deploy

Deploy source: `bone-dunes-standalone/`

Do not deploy source: `whistlewatch-main/`

## Create the clean deployable version

The standalone app is already prepared locally in:

`bone-dunes-standalone/`

It contains only the files needed to run the game as an independent Vite app.

## Move it into a separate repo

1. Create a new empty folder outside the current mixed workspace.
2. Copy the contents of `bone-dunes-standalone/` into that new folder.
3. Initialize a fresh Git repo there.
4. Verify the app still builds locally.
5. Connect that new repo to Vercel.

If you prefer to keep it in the current workspace temporarily, do not point Vercel at the workspace root. Use `bone-dunes-standalone/` as the project root directory.

## Vercel setup

Framework preset:

- `Vite`

Build command:

```bash
npm run build
```

Output directory:

```bash
dist
```

Install command:

```bash
npm install
```

The same settings are also encoded in:

- `vercel.json`

Root directory:

- safest if using a new repo: repo root
- if you temporarily deploy from the current mixed workspace: `bone-dunes-standalone`

## Environment variables

None are required for the current game build.

## Verify deployment worked

After deploy:

1. Load the page.
2. Confirm the title says `Bone Dunes`.
3. Click `Start Hunt` or `Resume Hunt`.
4. Move with `WASD`.
5. Collect a glowing food pickup and verify DNA increases.
6. Refresh the page and verify saved DNA/upgrades persist locally in the browser.

## What not to do

Do not:

- deploy `whistlewatch-main/`
- reconnect this game to Base44 runtime assumptions
- point Vercel at the old Base44-oriented project root
- push this game back into the Base44-connected repo as the main app
- treat the restored legacy project entry as the game entry

## Current deployment status

- Standalone app build path: prepared
- Production build command: confirmed
- Production output directory: confirmed
- No Base44 runtime dependency in the standalone app
