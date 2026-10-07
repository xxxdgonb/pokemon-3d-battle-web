# PROJECT STATUS

## Current phase

**PHASE 14 — Technical Acceptance Passed / Release Gate**

Phases 0–11 have implementation or verification evidence as described below. PHASE 14 is intentionally not closed until browser/WebGL verification, advanced battle-event coverage, asset/license audit, and repeated-battle soak evidence exist.

Current head: `efcfe162f071f4a2fa6c912ac7dfd2a815a3ba66`

## Evidence

Latest GitHub Actions CI run after the current implementation changes completed successfully (run `37640151905`, commit `8f3d398525ce269a33cfe49ef2e0d3d6fdd25411`).

Verified by CI:
- `npm install`
- `npm run check`
  - TypeScript application/server compilation
  - ESLint
  - 25 Vitest tests
- `npm run build`
- direct pinned-Showdown passive-opponent smoke
- real WebSocket runtime smoke
  - runtime process startup
  - WebSocket connection
  - battle creation
  - team preview
  - active move request
  - player move submission
  - authoritative Showdown move event
  - authoritative damage event
  - duplicate split-event normalization

Real Chromium/WebDriver browser smoke now exercises the battle client, WebGL canvas, full move loop, terminal result, Battle Again, and three repeated cycles in CI. Visual fidelity beyond automated DOM/canvas assertions still requires human visual review.

## Phase matrix

| Phase | Status | Evidence / limitation |
|---|---|---|
| PHASE 0 Research | COMPLETE | Required Showdown, Showdown Client, Pokémon 3D assets, Gen 9 animation resources and original/forked CFRU research completed; licensing gates recorded. |
| PHASE 1 Architecture | COMPLETE | Battle/render separation, WebSocket runtime boundary, transaction model, state machine and asset-provider strategy implemented. |
| PHASE 2 Foundation | COMPLETE | Vite/TypeScript/Three.js/Vitest/ESLint foundation, Node Showdown runtime and CI established. |
| PHASE 3 Pokémon Data | IMPLEMENTED | Pinned Showdown Dex/learnset APIs drive species/move/ability/item data and generation filtering. Runtime API chain is exercised through the server smoke. |
| PHASE 4 3D Renderer | IMPLEMENTED / BROWSER UNVERIFIED | Three.js arena, camera, lighting, GLB loader/cache/fallback, effect disposal and renderer disposal implemented. Browser/WebGL visual inspection remains open. |
| PHASE 5 Battle Engine | IMPLEMENTED | State machine, transaction guard, authoritative core state plus stat stages, volatile/field/side-condition projection and passive no-AI Showdown runtime are implemented and runtime-tested. |
| PHASE 6 Move System | IMPLEMENTED / PRESENTATION EXTENSIBLE | Actual Showdown move validation/execution/damage is authoritative. Miss/immune/fail/crit/effectiveness, status, stat-stage, volatile, field and side-condition events are normalized; additional move-specific presentation can extend the event boundary. |
| PHASE 7 Animation | IMPLEMENTED PROCEDURAL | Dedicated AnimationController and MoveAnimationController now own idle/attack/hit/hurt/faint/victory presentation and impact timing; procedural type fallback effects are explicit. Official/third-party animation packs are not bundled without rights. |
| PHASE 8 Arena | IMPLEMENTED / BROWSER UNVERIFIED | Ground, battle positions, lighting, shadows and camera presets implemented. |
| PHASE 9 UI | IMPLEMENTED / BROWSER UNVERIFIED | Generation/species/form/gender/shiny/ability/item/level/4-move flow, battle HUD, move lock, terminal result and restart flow implemented. |
| PHASE 10 Integration | VERIFIED SERVER/WS | Browser adapter → WebSocket → Node → pinned Showdown → normalized protocol is covered by the real WebSocket smoke. Browser launch remains unverified. |
| PHASE 11 Testing | CI GREEN | 21 unit tests + direct Showdown smoke + real WebSocket runtime smoke + production build pass in CI. |
| PHASE 12 Bug Fixing | HARDENED | Recent fixes cover CommonJS runtime loading, transaction identity, Showdown split duplication, runtime readiness, effect disposal, renderer loop disposal, level HP recalculation, terminal/restart lifecycle, animation timing, model-load single-flight, remote move concurrency and runtime input validation. |
| PHASE 13 Performance | PARTIAL | Lazy model loading/cache, single-flight requests, disposal and transient-effect cleanup are implemented; browser profiling, GPU frame analysis and long-session soak are still required. |
| PHASE 14 Final Audit | NOT CLOSED | Requires browser/WebGL run, repeated battle soak, advanced protocol/state coverage, dependency/security audit and individual asset-license review. |

## Battle architecture

Authoritative path:

`Browser UI -> WebSocket transport -> Node Showdown BattleStream -> normalized Showdown events -> BattleState projector -> presentation coordinator -> UI/3D`

Rules:
- Three.js never calculates battle damage.
- UI never invents HP or damage.
- Showdown remains the battle-rule authority.
- The opponent has no active decision-making. The Node runtime injects an explicit internal no-op/pass action after the player has submitted a legal move.
- A move transaction owns one action identity and cannot accept stale transaction events.
- Damage presentation is gated behind the animation impact marker.
- Showdown `split` duplicate messages are collapsed at the protocol boundary before state/event projection.

## Current implemented safeguards

- runtime readiness handshake before battle commands
- CommonJS-safe loading of the pinned Showdown runtime
- strict client message validation and command allowlist
- single-flight move lock
- stale transaction rejection
- remote adapter move-in-flight guard
- per-WebSocket command serialization
- bounded Pokémon/config field validation before entering Showdown
- impact-before-resolution ordering
- authoritative HP/max HP projection from Showdown conditions
- status and faint projection
- ability/item event normalization
- miss/immune/failed outcome handling
- crit/effectiveness event normalization
- form/shiny/gender identity normalization for Showdown details
- exact move/damage smoke assertions
- WebSocket runtime integration smoke
- renderer animation-loop disposal
- transient effect cancellation/disposal
- battle terminal controls locked
- battle restart disposes transport/renderer and returns to menu
- level changes recalculate pre-battle HP from species base HP
- model-load failure does not crash battle setup

## Known limitations / blockers

### BLOCKER-001 — Pokémon 3D model redistribution rights

The researched Pokémon 3D asset provider's code is permissively licensed, but its README identifies the Pokémon models themselves as Nintendo/Creatures/GAME FREAK property.

Decision:
- do not blanket-vendor third-party Pokémon models
- use provider-backed lazy loading with explicit fallback/error handling
- maintain provenance/licensing records

### BLOCKER-002 — Animation/audio redistribution rights

The researched Gen 9 animation resources contain contributor/project provenance and do not establish a blanket permissive redistribution grant for this Web project.

Decision:
- procedural presentation is used by default
- do not bundle third-party animation/audio packs without per-asset permission/license evidence

### BLOCKER-003 — CFRU provenance / ROM dependency

Original CFRU and forks are useful mechanics references but include ROM/devkit/ROM-dependent material and varying provenance.

Decision:
- no ROM, ROM patch, or ROM-dependent asset is bundled
- mechanics are treated as reference only
- individual fork/license checks remain required before reuse

### BLOCKER-004 — Advanced Showdown state projection

Core authoritative HP/status/faint/turn projection and event normalization are implemented. The remaining fidelity work includes richer handling for:
- multi-hit sequencing beyond the final authoritative HP state
- recoil/drain as explicit presentation events
- stat-stage UI presentation
- richer ability/item activation presentation
- form/transform presentation beyond authoritative identity projection

The battle simulator itself remains authoritative; this blocker is about complete local presentation/state projection, not reimplementing damage formulas.

### BLOCKER-005 — Browser/WebGL verification

Chromium/WebDriver browser smoke is now verified in CI. The harness completed the selection path, WebGL canvas creation, move loop, terminal result, Battle Again, and three consecutive cycles. Human visual fidelity review and deep GPU profiling remain release-quality checks.

### SECURITY-001 — Dependency audit

CI's `npm install` currently reports dependency vulnerabilities (including high/critical findings). This is not yet a release-blocking build failure, but it must be reviewed before production release.

## Test inventory

Current test coverage includes:
- battle state transition legality
- transaction identity and stale-event rejection
- transaction lifecycle
- Showdown protocol parsing/choice validation
- Showdown split-message deduplication
- authoritative request/damage/status/faint/turn projection
- form/shiny identity normalization
- ability/item event projection
- coordinator move-resolution behavior
- remote adapter concurrent-move rejection
- direct pinned-Showdown passive-opponent smoke
- real WebSocket runtime smoke

## Final-audit checklist

Before declaring the project complete:
- [x] CI check passes
- [x] TypeScript build passes
- [x] production Vite build passes
- [x] direct Showdown runtime smoke passes
- [x] real WebSocket runtime smoke passes
- [x] passive opponent has no AI decisions
- [x] duplicate move/damage transaction guard exists
- [x] protocol duplicate split messages are normalized
- [x] terminal battle controls are locked
- [x] battle restart disposes renderer/transport
- [x] automated browser/WebGL runtime walkthrough
- [x] repeated-battle soak in browser (3 CI cycles)
- [x] advanced authoritative state/effect projection core
- [x] authoritative move-resolution presentation coverage (damage, miss, immunity, failure, multi-hit, faint and both-side targets); generic type fallback remains by design
- [ ] GPU/browser performance profiling
- [x] production dependency audit separated from dev dependency audit; compatible overrides applied
- [x] repository-level model/animation/audio provenance audit recorded; restricted Pokémon model rights are not redistributed
- [ ] production release decision

## Technical acceptance

The implementation is considered technically complete for the defined one-Pokémon passive-opponent battle product: CI, production build, dependency audit, Showdown runtime, WebSocket path, and three consecutive Chromium/WebGL battle/restart cycles are green. Remaining release gates are external legal approval for upstream Pokémon model use and human visual/GPU review; neither is something source code can honestly self-certify.

## Status rule

A feature is not marked COMPLETE merely because source code exists. It is marked complete only when the relevant implementation and verification evidence exist. Browser/WebGL work remains explicitly unverified until an actual browser runtime is exercised.


## Current Verification

- CI: GREEN on run `37640867912` at commit `efd516006995050c181334cf0473cce07a257c43`; TypeScript/server type-check, ESLint, tests, production build, dependency audit, passive-opponent smoke, WebSocket runtime smoke, and Chromium/WebGL smoke all passed.
- Browser/WebGL: three consecutive automated browser cycles passed, including Battle Again/restart. Human visual review and deep GPU profiling remain release-quality checks.
