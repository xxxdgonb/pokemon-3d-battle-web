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

Important implementation boundary:
- Showdown is not imported into the browser yet. Its execution environment must be verified before selecting browser, worker, or server runtime.
- Renderer owns presentation only; battle state and damage authority remain outside Three.js.
- No Pokémon, move, ability, item or model data is fabricated in this phase.

Runtime decision:
- The current Showdown simulator package is Node-only, so it is not a browser dependency.
- The browser side now talks to an abstract transport boundary.
- A Node service/worker implementation that owns the pinned Showdown runtime is still required before real battles can execute.
- The adapter currently does not fabricate local battle state or damage.

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

STATIC RESEARCH ONLY.

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

## Next

PHASE 1 — Architecture implementation.
