# Deploy Checklist

- Verify you are using `bone-dunes-standalone/`, not `whistlewatch-main/`.
- Run `npm install`.
- Run `npm run build`.
- Confirm the build output is `dist/`.
- Create a new repository for the standalone folder.
- Connect only that new repository to Vercel.
- Use framework preset `Vite`.
- Use build command `npm run build`.
- Use output directory `dist`.
- Confirm the deployed page loads and starts the game.
- Confirm food collection increases DNA.
- Confirm the page refreshes without breaking the app.
- Confirm you never pointed Vercel at the Base44-oriented project root.
