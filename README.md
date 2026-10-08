# Pokémon 3D Battle Web

A browser-based 3D Pokémon-style 1v1 battle application using:

- Three.js for 3D presentation
- Pokémon Showdown as the authoritative battle simulator
- a Node.js WebSocket runtime boundary for Showdown
- generation-scoped Showdown Dex/learnset data
- TypeScript state/transaction guards
- Vitest + ESLint + CI verification

## Current status

The repository currently has a working implementation through the Node/WebSocket/Showdown integration boundary.

Verified in GitHub Actions:
- TypeScript + server compilation
- ESLint
- 28 unit tests
- production Vite build
- direct pinned-Showdown passive-opponent smoke test
- real WebSocket runtime smoke test covering battle creation, active move request, move execution and authoritative damage

Chromium/WebDriver browser smoke is verified in CI across three consecutive full battle/restart cycles. Human visual fidelity review and deep GPU profiling remain release-quality checks.

See [PROJECT_STATUS.md](./PROJECT_STATUS.md) for the exact completion matrix and remaining blockers.

## Architecture

`Browser UI -> WebSocket transport -> Node Showdown runtime -> normalized protocol events -> BattleState -> presentation`

The battle engine does not import Three.js, and the renderer does not calculate damage.

The single-player opponent has no AI or active move-selection logic. The Node runtime supplies an explicit internal no-op/pass action after the player's legal choice so Showdown can resolve the turn without inventing opponent behavior.

## Development

Install dependencies:

```bash
npm install
```

Run the browser client:

```bash
npm run dev
```

Run the Showdown runtime in another terminal:

```bash
npm run server
```

The default runtime listens on `ws://localhost:8787`.

Validation:

```bash
npm run check
npm run build
npx tsx tests/showdownPassiveOpponent.smoke.ts
npx tsx tests/showdownRuntime.smoke.ts
```

## Asset and licensing policy

Third-party Pokémon models, animation packs and audio are not automatically vendored merely because they are technically accessible. See [LICENSES.md](./LICENSES.md) for the current provenance and redistribution decisions.

No ROM, ROM patch, ROM-dependent asset or CFRU ROM material is bundled.

## Research and design records

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [SOURCE_RESEARCH.md](./SOURCE_RESEARCH.md)
- [LICENSES.md](./LICENSES.md)
- [PROJECT_STATUS.md](./PROJECT_STATUS.md)
