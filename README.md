# Pokémon 3D Battle Web

A browser-based 3D Pokémon-style 1v1 battle project.

## Development status

PHASE 1 — Architecture implementation.

The current increment establishes:
- Vite + TypeScript application foundation
- Three.js renderer shell
- typed battle domain contracts
- explicit battle state machine
- Showdown adapter boundary
- Vitest and ESLint configuration

The battle simulator is deliberately not imported into the browser until its supported execution environment is verified. No fabricated Pokémon, move, damage, model or animation data is included.

See:
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [SOURCE_RESEARCH.md](./SOURCE_RESEARCH.md)
- [LICENSES.md](./LICENSES.md)
- [PROJECT_STATUS.md](./PROJECT_STATUS.md)

## Commands

```bash
npm install
npm run dev
npm run build
npm test
npm run lint
npm run check
npm run server
```

Runtime testing must be performed in an environment with Node/npm and a browser/WebGL implementation. Until then, repository checks are considered unexecuted rather than assumed successful.
