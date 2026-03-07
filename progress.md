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

## 2026-03-06 Vertical Slice Polish Pass

- Current request: keep the existing standalone app, then raise feel, atmosphere, progression clarity, enemy readability, and replayability without turning it into a bigger game.
- Audit focus before implementation:
  - smoother movement/camera/combat feedback
  - clearer enemy telegraphing and stronger encounter variety
  - more meaningful but still small progression hooks
  - stronger Bone Dunes biome identity
  - cleaner HUD/start flow and session-level motivation
- Implemented targeted polish without rewriting the architecture:
  - added sprint charge, camera lookahead/side offset, hit bursts, pickup bursts, shake, hurt feedback, lunge feedback, and low-health/danger-state presentation
  - added a simple run-score loop with best-run persistence, danger-zone DNA bonus, session hunt stats, and a new bite-cooldown upgrade
  - improved enemy behavior readability with opportunistic scavenger circling/fleeing, predator stalking/windups, telegraph glow, and better hit/death response
  - upgraded the world with extra arches/bones/spires, safer-feeling nest dressing, harsher danger-basin dressing, animated zone particles, and stronger zone lighting/fog identity
  - rebuilt the HUD/start screen around run pressure, area state, sprint/bite meters, and clearer progression messaging
- Validation after the full pass:
  - `npm run build` passes
  - shared web-game client screenshots/state captured at `output/web-game/menu-polish` and `output/web-game/polish-pass-2`
  - visual inspection: menu now reads like a product screen; gameplay HUD/world look substantially more intentional and readable
  - deterministic browser checks:
    - left-click move traveled about `9.8` world units to a valid ground target
    - arrow steering traveled about `6.9` world units over 600ms
    - `Shift` sprint traveled about `9.35` world units over the same interval and consumed about `31%` sprint charge
    - `Space` bite reduced nearby enemy HP by `22`
    - right-click bite reduced nearby enemy HP by `22`
    - no browser console errors beyond the React DevTools info banner
- Scope intentionally protected:
  - skipped stage expansion, species/civilization systems, broad crafting, quest chains, and new biome/maps
  - kept enemy count modest instead of adding more factions
  - kept progression to a few high-payoff hooks rather than building a large tech tree
