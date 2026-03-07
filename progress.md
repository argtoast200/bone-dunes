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

## 2026-03-06 Feel Pass 2

- Current request: do one more polish pass focused on feel, visual atmosphere, addictiveness, and heavier attacks/combat.
- Implemented:
  - added heavier bite feedback with micro hit-stop, stronger recoil, FOV kick, extra bite burst, enemy squash/recoil, and more forceful damage reactions
  - added a lightweight `Feral Surge` loop: pickups and kills now feed a short buff window that improves movement/bite recovery and creates a better chain-hunt rhythm without adding a large system
  - added stronger atmospheric motion with a sun halo, circling carrion flocks, and HUD surge presentation so the world feels more alive and the run state is easier to read
- Validation:
  - `npm run build` passes after the second pass
  - shared web-game client screenshot/state captured at `output/web-game/feel-pass-2`
  - visual inspection: the HUD now reads the surge state clearly and the scene has more ambient motion/menace
  - deterministic browser checks:
    - left-click move still responded and traveled about `3.3` world units in the chosen test target/camera setup
    - arrow steering traveled about `6.8` world units
    - `Shift` sprint traveled about `9.34` world units and consumed about `31%` sprint charge
    - `Space` bite still dealt `22`
    - right-click bite still dealt `22`
    - a forced predator kill triggered `Feral Surge x2` with about `55%` surge charge remaining
    - no browser console errors beyond the React DevTools info banner
- Scope still protected:
  - did not add additional progression trees, new map layers, or content-sprawl systems
  - kept the new addictive loop inside the existing food/combat flow instead of building a separate mode

## 2026-03-06 Combat Feel Pass

- Current request: redesign combat feel without bloating scope, focused on better attack timing, clearer hits, stronger enemy reaction, and more readable arcade creature combat.
- Combat audit before implementation:
  - bite was still reading as one blended motion rather than anticipation -> contact -> recovery
  - hit logic still felt too instantaneous, so landed hits and misses looked too similar
  - enemy reactions were mostly visual dressing instead of actual interruption/stagger
  - player attack readability around phase/cooldown/miss state was weak during live play
  - combat juice existed, but it was too uniform and not shaped differently enough for hits vs kills vs misses
- Implemented:
  - replaced the instant bite with a lightweight phased attack flow (`windup`, `strike`, `recovery`) while keeping the same controls and overall architecture
  - added directional bite arc/snap effects, stronger body/head transforms, and more committed attack posing so the bite reads as intentional
  - moved hit resolution into the strike phase so contact happens when the animation says it happens
  - added stronger enemy interruption via stagger/reel timing, telegraph cancel on hit, recoil direction, and more visible weak-enemy reaction
  - added explicit combat-readability state in the HUD/text state so bite can read as `Coiling`, `Snapping`, `Landed`, `Crushed`, `Missed`, or `Broken`
- Validation:
  - `npm run build` passes
  - shared web-game client screenshot/state captured at `output/web-game/combat-pass-1`
  - visual inspection: HUD now reflects combat timing state and the attack pass shows clearer strike/readability than the old placeholder bounce
  - deterministic browser checks:
    - player attack phases now step `idle -> windup -> strike -> recovery`
    - a front-facing `Space` bite dealt `22`, left the scavenger in `staggered`, and reported attack result `hit`
    - a front-facing right-click bite dealt `22`, left the scavenger in `staggered`, and reported attack result `hit`
    - a whiff cleanly reported attack result `miss`
    - no browser console errors beyond the React DevTools info banner
- Scope protected:
  - did not add combo trees, lock-on systems, animation rigs, or a larger combat ruleset
  - kept the pass focused on timing, feedback, and reaction quality inside the existing game loop

## 2026-03-06 Creature Evolution + Editor Pass

- Current request: make progression visibly transform the creature with a lightweight modular evolution system and a simplified nest editor, without rewriting the existing creature-stage slice.
- Plan before implementation:
  - keep the existing creature builder, but turn it into a modular part rig with head/back/tail/legs/body-marking groups driven by a saved creature profile + trait levels
  - attach upgrades by toggling/scaling those prebuilt part groups rather than building a full freeform editor
  - integrate evolution into the current DNA/save loop through a nest-only editor overlay and migrated trait persistence
- Implemented:
  - replaced the old flat upgrade map with trait-based evolution data (`jaw`, `horns`, `crest`, `tail`, `legs`, `spikes`, `glow`) plus save migration, hidden alignment persistence, and a saved creature profile (palette, markings pattern, size)
  - extended the creature model with modular horns, crest, tail fin, rib spikes, marking patterns, longer-leg scaling, and stronger jaw/fang visuals, then reused the same trait application path for evolved enemy variants
  - added evolved enemy variants using the same modular pipeline: `armoredScavenger` and `hornedPredator`, each with stat/behavior tweaks that match their silhouette
  - added a nest-only creature editor overlay with phenotype naming, stat summary, DNA costs, mutation summaries, and transformation feedback while keeping the current game loop intact
  - preserved existing combat/movement feel while letting traits affect damage, movement speed, defense, intimidation, knockback, and bite recovery
  - surfaced the editor through both the side panel and the always-visible utility bar so the evolution screen is easy to reach at the nest
- Validation:
  - `npm run build` passes after the evolution/editor pass
  - shared web-game client captures:
    - `output/web-game/evolution-pass-1`
    - `output/web-game/evolution-pass-2`
    - `output/web-game/evolution-editor`
  - visual inspection:
    - verified the live HUD/gameplay screenshot still renders correctly after the modular-creature changes
    - verified the nest editor layout and mutation list through Playwright snapshot inspection
  - deterministic browser checks:
    - editor opens from the live HUD at the nest and exposes all seven traits with DNA costs and stat summaries
    - purchasing `Crushing Jaw` reduced DNA from `95` to `79` and raised bite damage from `22` to `29`
    - purchasing `Glow Veins` reduced DNA from `79` to `65` and lowered bite cooldown from `0.62s` to `0.57s`
    - reload/resume preserved DNA (`65`), purchased traits (`jaw: 1`, `glow: 1`), creature profile, and hidden alignment values
    - left-click movement still set a move target and moved about `13.07` world units in the deterministic check
    - arrow steering still moved about `3.06` world units in `500ms`
    - `Space` bite dealt `29` after the jaw upgrade
    - right-click bite also dealt `29`
    - no browser console errors were reported beyond the React DevTools info banner
- Scope protected:
  - did not attempt a full freeform Spore editor, species generator, or multi-biome campaign
  - kept alignment hidden and lightweight for future expansion instead of adding social gameplay now

## 2026-03-07 Ecosystem Simulation Pass

- Current request: make Bone Dunes feel alive with a lightweight ecosystem layer inspired by Spore Creature Stage, without rewriting the architecture or bloating the scope.
- Ecosystem plan used:
  - species data lives in lightweight `SPECIES_DEFS` / `MIGRATION_EVENT_DEFS`
  - territories are represented by landmark rings anchored to visible species nests
  - creatures keep the existing enemy entity structure but gain simple needs/state (`patrolling`, `foraging`, `scavenging`, `defending`, `resting`, `fleeing`, `migrating`)
  - migration events temporarily retask species packs instead of spawning a larger simulation
- Implemented:
  - added three explicit species definitions with territory, temperament, diet, pack, nest, and respawn data: `Dune Scavenger`, `Bone Stalker`, and `Burrowing Herbivore`
  - converted enemy spawning to species packs with leader/follower logic while preserving the current creature/combat pipeline
  - added visible species nests and territory rings that pulse on alert, player intrusion, and migration pressure
  - added carcasses, scavenging behavior, predator hunting, herbivore grazing/fleeing, territory defense, and cross-species combat
  - added migration events (`Herd Crossing`, `Stalker Raid`, `Scavenger Swarm`) with deterministic trigger support through `window.__sporeSliceGameInstance.triggerMigrationEvent(...)`
  - tied respawns to species nests so destroying a nest reduces that species presence over time
  - expanded `render_game_to_text` and HUD state with territory owner/label, ecosystem notice, migration state, nearby species, nearby nests, and species-tagged enemies
  - added a compact ecosystem HUD readout plus always-visible territory/migration text in the main area card so the ecosystem remains readable at smaller viewport heights
- Validation:
  - `npm run build` passes after the ecosystem pass
  - shared web-game client captures:
    - `output/web-game/ecosystem-pass-1`
    - `output/web-game/ecosystem-pass-2`
    - `output/web-game/ecosystem-pass-3`
  - visual inspection:
    - the world now surfaces territory feedback in the visible HUD even when the side panel does not fully fit above the fold
    - nest rings, species landmarks, and nearby-species UI make the biome read as inhabited rather than static
  - deterministic browser checks:
    - triggering `Herd Crossing` moved nearby herbivores into explicit `migrating` state with an active migration timer
    - moving the player into `Jaw Basin` set territory ownership to `Bone Stalker` and flipped predators into `defending` / attack states
    - `Stalker Raid` produced cross-species combat, leaving `Dune Scavenger` carcasses and reducing scavenger population from 4 to 2 in the observed run
    - destroying the `Burrowing Herbivore` nest and killing one herbivore prevented that species from returning after 22 seconds, leaving 3 living and 1 hidden/non-respawning member
    - direct control regression check still passed in-browser:
      - move-target travel covered about `12.54` world units
      - a direct bite still reduced scavenger HP from `44` to `15` and returned attack result `hit`
    - no browser console errors beyond the React DevTools info banner
- Scope protected:
  - no full ecological resource graph, breeding system, social gameplay, or map expansion
  - no broad entity-count increase; the pass stays small and emergent rather than simulation-heavy

## 2026-03-07 Xbox Controller Support

- Current request: make the standalone Bone Dunes app playable with an Xbox controller.
- Implementation approach:
  - kept the existing keyboard/mouse path intact and layered Gamepad API support on top of the current input model
  - added a test-only `window.__setTestGamepadState(...)` hook so controller input can be validated deterministically in browser automation
- Implemented:
  - added `navigator.getGamepads()` polling plus `gamepadconnected` / `gamepaddisconnected` handling in `src/game/SporeSliceGame.js`
  - mapped controller input to the current game loop:
    - left stick + D-pad = movement
    - right stick = aim / facing
    - `A`, `X`, `RT`, or `RB` = bite
    - `B`, `LB`, or left-stick press = sprint
    - `Start` = start hunt from menu or toggle the nest editor at the nest
    - `Y` = fullscreen toggle
  - updated state emission / `render_game_to_text` to report controller presence and live stick values
  - updated HUD/menu copy so a connected controller advertises its mapping in the visible UI
- Validation:
  - `npm run build` passes after the controller pass
  - shared web-game client capture:
    - `output/web-game/gamepad-pass-1`
  - controller screenshot captured and visually inspected:
    - `output/playwright-gamepad-connected.png`
  - deterministic browser checks:
    - `A` from the menu started the hunt and reported `gamepad.connected: true` with label `Xbox Wireless Controller`
    - left-stick movement traveled about `6.16` world units in `600ms`
    - left-stick + sprint button traveled about `8.93` world units in `600ms` and reduced sprint charge to about `79%`
    - right-stick aim changed player yaw from about `2.55` to `0.28`
    - controller bite reduced scavenger HP from `44` to `15` and returned attack result `hit`
    - `Start` opened and closed the nest editor when the player was in the nest
    - clearing the test gamepad state returned `gamepad.connected` to `false`
    - no browser console errors beyond the React DevTools info banner
- Scope protected:
  - no separate controller-only movement system or alternate camera rewrite
  - reused the existing movement/combat/editor flows so controller support stays maintainable

## 2026-03-07 Movement + Combat Weight Pass

- Current request: make movement and attacks feel more physical, weighty, and believable without rewriting the game or expanding scope.
- Audit before implementation:
  - player velocity was still chasing targets too directly, so starts/stops felt input-driven instead of body-driven
  - turning was too immediate for the creature size, which flattened the sense of mass
  - bite phases existed, but the strike body motion and forward drive were still too light
  - hits applied damage cleanly but momentum transfer between bodies was still too small
  - camera and terrain were adding readability but not enough physical reinforcement
- Implemented in `src/game/SporeSliceGame.js`:
  - split player motion into controlled movement velocity plus decaying impulse velocity for heavier starts, stops, and hit carry
  - added mass-aware movement stats, move-target slowdown, lighter coasting than a hard snap-stop, and turn-rate limits tied to creature mass
  - added terrain response sampling for slope/sand slowdown plus sprint/run dust bursts
  - added body lean, bank, and stronger attack posing so movement and bites read through the creature silhouette
  - upgraded the bite to drive the whole body forward on strike, tighten the forward hit shape, and exchange more momentum with the target
  - added player body-vs-creature collision push so sprinting into smaller creatures causes visible displacement instead of ghosting through space
  - strengthened enemy reactions with recoil lift/tilt layered on top of stagger and impact pulse
  - updated camera follow with momentum lag, sprint bob, and stronger attack push
  - fixed virtual sprint input so deterministic/mobile-style input uses the same sprint path as keyboard/controller
- Validation:
  - `npm run build` passes after the pass
  - shared web-game client captures:
    - `output/web-game/weight-pass-1`
    - `output/web-game/weight-pass-2`
  - visual inspection:
    - confirmed the live gameplay screenshots still render correctly after the movement rewrite
    - confirmed bite recovery and the heavier posture still read clearly in the HUD/canvas capture
  - deterministic browser checks on the local autostart build:
    - movement hold for about `576ms` reached about `6.7` speed and traveled about `3.13` world units
    - after releasing input, the creature still carried about `0.36` world units before settling instead of snapping dead
    - sprint over the same hold traveled about `3.83` world units, reached about `8.92` speed, and drained sprint charge to about `63%`
    - a controlled front-facing bite dropped a placed scavenger from `44` HP to `15`, displaced it about `0.6` world units, displaced the player about `0.33` world units, applied about `0.35s` stagger, and drove player impulse to about `9.11`
    - attack timing still stepped through `windup -> strike -> recovery`
    - no browser console errors beyond the React DevTools info banner
- Scope protected:
  - no physics engine, combo tree, or combat-system rewrite
  - no save/progression changes beyond using existing stats to derive movement mass
