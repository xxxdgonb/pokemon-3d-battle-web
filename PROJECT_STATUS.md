# PROJECT STATUS

## Current phase

PHASE 0 — Research: COMPLETE

PHASE 1 — Architecture: IN PROGRESS

No gameplay implementation is claimed.

## Repository baseline

Repository: https://github.com/xxxdgonb/pokemon-3d-battle-web
Default branch: main

Initial state:
- README.md empty
- ARCHITECTURE.md empty
- SOURCE_RESEARCH.md empty
- PROJECT_STATUS.md empty
- LICENSES.md empty
- no package.json
- no src/
- no data/
- no assets/
- no tests/

This is a foundation-from-zero project.

## PHASE 0 completed

- verified the five requested source categories
- verified exact core repositories
- identified original CFRU as Skeli789/Complete-Fire-Red-Upgrade
- searched CFRU forks/expansions rather than assuming fork names were original
- inspected README, LICENSE and package metadata where available
- inspected important data/asset directories
- identified Showdown as the primary battle-logic candidate
- identified Showdown Client as AGPL presentation reference
- identified 3D model asset ownership as a separate rights issue
- identified Gen 9 animation resources as reference-only pending per-asset permission
- established architecture and licensing gates

## PHASE 1

Status: IN PROGRESS

Completed in this increment:
1. Vite + TypeScript foundation
2. Three.js renderer shell with resize/dispose boundary
3. typed battle domain contracts
4. Showdown adapter boundary without assuming browser runtime compatibility
5. explicit battle state machine with illegal-transition rejection
6. Vitest configuration and first state-machine tests
7. ESLint + TypeScript-ESLint configuration
8. build/lint/check scripts
9. browser-to-Node Showdown transport boundary
10. Showdown protocol parser and command validation
11. battle transaction guard for single-flight moves and impact/damage ordering
12. pinned Node Showdown runtime dependency
13. WebSocket transport and Node BattleStream service boundary
14. framed Showdown block synchronization

Important implementation boundary:
- Showdown is not imported into the browser yet. Its execution environment must be verified before selecting browser, worker, or server runtime.
- Renderer owns presentation only; battle state and damage authority remain outside Three.js.
- No Pokémon, move, ability, item or model data is fabricated in this phase.

Runtime decision:
- The current Showdown simulator package is Node-only, so it is not a browser dependency.
- The browser side now talks to an abstract WebSocket transport boundary.
- A Node service now owns the pinned Showdown BattleStream runtime.
- The service validates the incoming battle envelope and converts the configured Pokémon into Showdown team sets.
- The browser waits for framed Showdown output blocks instead of assuming a synchronous response.
- The adapter still does not project Showdown protocol into authoritative BattleState.
- The opponent is currently represented as a real Showdown player, so passive/no-AI single-player turn semantics are NOT solved yet.

Testing:
- Tests were added but NOT executed in this environment.
- No npm install, build, lint, browser or WebGL runtime test has been claimed.
- Static source review only.

## Later phases

PHASE 2 Project Foundation — NOT STARTED
PHASE 3 Pokémon Data — NOT STARTED
PHASE 4 3D Renderer — NOT STARTED
PHASE 5 Battle Engine — NOT STARTED
PHASE 6 Move System — NOT STARTED
PHASE 7 Animation System — NOT STARTED
PHASE 8 Battle Arena — NOT STARTED
PHASE 9 UI — NOT STARTED
PHASE 10 Integration — NOT STARTED
PHASE 11 Testing — NOT STARTED
PHASE 12 Bug Fixing — NOT STARTED
PHASE 13 Performance — NOT STARTED
PHASE 14 Final Audit — NOT STARTED

## Testing status

STATIC CHECK ONLY.

This increment was inspected through repository source reads and GitHub writes. npm install, npm test, npm run build, npm run lint, browser launch, WebGL runtime test and the Node Showdown service have NOT been executed in this environment.

Do not interpret the new server/transport code as runtime-verified.

No npm install, npm test, npm run build, npm run lint, browser launch, WebGL runtime test or production build has been executed. The repository currently has no application toolchain to execute.

## Blockers

### BLOCKER-001 — 3D model redistribution
Pokemon-3D-api's repository code is MIT, but its README says the models are property of Nintendo/Creatures Inc./GAME FREAK inc.

Impact: blanket model vendoring is not approved.

Solution: provider/fallback model loader plus asset provenance records.

### BLOCKER-002 — animation/audio redistribution
The Gen 9 Move Animation Project requests contributor credits and incorporates resources from multiple projects. A compatible permissive redistribution license was not established.

Impact: no downloaded animation pack/audio is bundled by default.

Solution: recreate animation behavior in our own system.

### BLOCKER-003 — CFRU provenance
Original CFRU and forks contain ROM-dependent material and multiple contributors; forks cannot be assumed to have identical licensing.

Impact: no direct CFRU source/assets.

Solution: mechanics and presentation reference only.

## Current blockers

### BLOCKER-004 — authoritative Showdown state projection
Protocol events are parsed, but the adapter does not yet construct authoritative BattleState from requests, switch/damage/status/faint/turn messages.

Impact: the UI cannot safely drive HP/status/phase from Showdown yet.

Next: implement a pure protocol-to-domain projector and tests for damage/status/faint/request ordering.

### BLOCKER-005 — passive opponent semantics
A normal Showdown battle expects both sides to submit legal choices. The current runtime supplies a real p2 team but intentionally does not invent an AI decision.

Impact: the requested “enemy has no AI and no active decisions” behavior is not yet implemented.

Next: design a Showdown-compatible single-player/passive-target integration that preserves Showdown as the battle-rule authority without silently introducing AI.

## Next

PHASE 1 — protocol-to-domain projection and passive-target architecture.
