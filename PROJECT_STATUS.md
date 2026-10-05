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
15. pure Showdown protocol-to-BattleState projector
16. projector tests for request/damage/status/faint/turn
17. Showdown victory/defeat projection
18. passive opponent integration using Showdown's explicit no-op pass action
19. BattlePresentationCoordinator enforcing impact-before-authoritative-damage
20. activeTransactionId lifecycle bound to BattleState
21. authoritative miss/immune/fail outcomes normalized
22. real Showdown passive-opponent smoke test added
23. CI workflow added for check/build/smoke
24. WebSocket transport now awaits runtime readiness and propagates failures
25. centralized win-event phase ownership
26. normalized heal/sethp/curestatus/boost/unboost/formechange event boundary
27. authoritative move transaction now retains outcome kind/crit/effectiveness metadata

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
- The adapter now owns a pure protocol-to-BattleState projector for HP/max HP, status, move PP, ability and turn updates.
- Projector tests cover request, damage, status, faint and turn messages.

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
Resolved at the architecture level: the Node runtime now injects a Showdown pass action for p2 after a legal p1 move request. This is not a move-selection heuristic or AI decision; Showdown executes the action as an explicit no-op.

Constraint: the integration currently relies on the pinned Showdown BattleStream battle reference and Battle/Side choice APIs. It must be runtime-tested against the pinned Showdown version before this blocker can be marked fully closed.

Impact: until runtime tests pass, the single-player turn loop is not verified.

## Next

PHASE 1 — protocol-to-domain projection and passive-target architecture.


## End-to-end implementation checkpoint
- PHASE 1 Architecture: substantially implemented; runtime verification remains open.
- PHASE 2 Foundation/Data: generation-scoped Showdown Dex and learnset API implemented.
- PHASE 3 Pokémon configuration: species/form/gender/shiny/ability/item/level/moves flow implemented.
- PHASE 4 3D Renderer: Three.js arena, lighting, shadows, GLB lazy loader/cache/fallback implemented.
- PHASE 5 Battle Engine: state machine + transaction guard + passive Showdown opponent implemented.
- PHASE 6 Move System: real Showdown move validation/execution; authoritative outcome classification implemented.
- PHASE 7 Animation: impact timing and procedural generic impact FX implemented; official move animation assets intentionally not bundled without redistribution rights.
- PHASE 8 Arena/Camera: battle arena and camera presets implemented.
- PHASE 9 UI: selection flow, move UI, HP bars, status, responsive layout implemented.
- PHASE 10 Integration: browser → WebSocket → Node Showdown → normalized events → BattleState → presentation chain implemented.
- PHASE 11 Testing: unit tests + real Showdown smoke test + CI configuration present; execution not observed locally.
- PHASE 12 Bug Fixing: transaction race/double-click, runtime readiness, phase ownership, non-damage move resolution, authoritative HP sync addressed during integration.
- PHASE 13 Performance: lazy model loading/cache/disposal and UI transaction lock implemented; browser profiling still required.
- PHASE 14 Final Audit: NOT CLOSED until CI/browser runtime execution, asset availability, licenses, and repeated-battle soak checks are observed.

## Remaining hard blockers
1. Runtime/CI execution evidence is still required; latest dependency fix is queued as CI run #84.
2. Full browser/WebGL smoke test is still required.
3. Complete protocol projection for every advanced effect (weather/terrain/side conditions/volatile effects/stat stages) still requires expansion before claiming full battle-state fidelity.
4. Official/third-party animation and model redistribution rights must be audited individually; current 3D provider explicitly identifies Pokémon models as Nintendo/Creatures/GAME FREAK property. 
