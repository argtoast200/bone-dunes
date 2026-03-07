Original prompt: Desktop controls were rework. Left click sets a ground move target. WASD and arrow keys give direct camera-relative movement. Shift sprints. Space and right click bite. Bite short lunge and more forgiving target assist. Browser default key behavior suppressed to prevent scroll/focus glitches. Add a move target marker. Test-only autostart query hook (?autostart=1) and window.__sporeSliceGameInstance for deterministic browser testing. npm run build passes. click-to-move traveled about 16.6 world units. arrow steering traveled about 3.5 world units. Space bite reduced nearby enemy HP by 22. right-click bite reduced nearby enemy HP by 22. Success criteria: Bone Dunes is live from the standalone app only. The control scheme is left click to move, WASD or arrows for tight steering, Shift sprint, Space or right click to bite. Movement feels responsive. Bite lands reliably when an enemy is close. The original legacy app remains untouched and recoverable.

## Notes

- Initial inspection: current repo is already the standalone app, but desktop controls still use world-relative keyboard movement and left mouse attack.
- Needed changes: click-to-move target, camera-relative steering, right-click bite, default browser input suppression, move target marker, test autostart hook, deterministic test instance exposure.
- Implemented desktop control rework in `src/game/SporeSliceGame.js`: left-click ground targeting, camera-relative WASD/arrow movement, right-click bite, bite lunge/assist expansion, move target marker, browser-default suppression, `?autostart=1`, and `window.__sporeSliceGameInstance`.
- Updated HUD/menu control copy in `src/game/GameApp.jsx` and disabled canvas text/touch selection in `src/index.css`.
- `npm run build` passes after the control changes.
- Browser verification:
  - left click generated a move target and moved the player about 17.7 world units in 1.6s
  - arrow-key steering moved the player about 3.3 world units in 460ms
  - `Space` bite reduced nearby scavenger HP from 44 to 22
  - right-click bite reduced nearby scavenger HP from 44 to 22
  - no browser console errors were reported during the validation runs
