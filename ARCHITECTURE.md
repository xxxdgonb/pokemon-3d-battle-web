# ARCHITECTURE

## System goal

A real single-player 1v1 desktop-browser 3D Pokémon-style battle game.

Player flow:
Main Menu → Generation → Pokémon → Details → Form/Gender/Shiny/Ability/Item/Level/Moves → 3D Battle → Victory/Defeat → Restart.

Enemy has no AI and no decision making. It is only a battle target/presentation object.

## Layer separation

UI/UX
→ Application State
→ Battle Presentation
→ Web Battle Adapter
→ Pokémon Showdown Simulator
→ Normalized Data

Rendering is parallel presentation:
Application State
→ 3D Battle Scene
→ PokemonModelLoader
→ CameraController
→ AnimationController
→ MoveAnimationController
→ EffectsRenderer
→ AudioManager

The battle engine never imports Three.js.
The renderer never calculates damage.

## Repository target

- index.html
- package.json
- tsconfig.json
- vite.config.ts
- README.md
- SOURCE_RESEARCH.md
- ARCHITECTURE.md
- PROJECT_STATUS.md
- LICENSES.md
- src/main.ts
- src/app/
- src/core/
- src/battle/
- src/pokemon/
- src/moves/
- src/animation/
- src/effects/
- src/rendering/
- src/audio/
- src/ui/
- src/utils/
- data/generations/
- data/pokemon/
- data/moves/
- data/abilities/
- data/items/
- data/types/
- assets/pokemon/
- assets/maps/
- assets/effects/
- assets/ui/
- assets/audio/
- tests/

## Battle state machine

INIT
→ INTRO
→ PLAYER_SELECTING_MOVE
→ MOVE_VALIDATING
→ MOVE_START
→ MOVE_ANIMATION
→ MOVE_HIT
→ DAMAGE_CALCULATION
→ DAMAGE_APPLICATION
→ SECONDARY_EFFECTS
→ STATUS_PROCESSING
→ FAINT_CHECK
→ VICTORY / DEFEAT / PLAYER_SELECTING_MOVE
→ BATTLE_END

Only one move transaction may be active.

## Move transaction

Each move execution owns:
- action ID
- actor
- target
- move ID
- generation
- animation timeline
- simulator result/events
- damage event
- secondary effects
- final state

UI input is locked for the entire transaction.

The renderer does not mutate HP. HP changes only when the battle adapter emits the authoritative damage event.

Required synchronization:
MOVE_START → attack animation → impact marker → authoritative damage event → HP presentation → secondary effects → faint check.

## Showdown adapter

ShowdownAdapter owns:
- simulator setup
- generation/format selection
- Pokémon set creation
- move validation
- action submission
- simulator event extraction
- normalized battle state projection

The rest of the project never depends directly on undocumented Showdown internals.

Pin the exact Showdown version used by the game.

## Generation model

Generation selection filters legal:
- Pokémon/species/forms
- moves
- abilities
- items
- type chart
- mechanics
- form availability
- generation-specific effects

Filtering occurs before the selection UI exposes an option.

## PokemonModelLoader

Input:
species ID, form ID, gender, shiny.

Resolution order:
1. exact form + gender + shiny
2. exact form + shiny
3. exact form
4. base species + shiny
5. base species
6. placeholder/error representation

Model failure must never terminate the battle engine.

Cache keys include all visual variant fields.

## Animation

Base states:
Idle, Attack, Hit, Hurt, Faint, Victory.

Move timeline:
Start, Charge, Motion/Projectile, Impact, Damage Timing Marker, Secondary Effect, End.

Every move has either a dedicated implementation or an explicitly labelled category fallback.

## Effects

EffectsRenderer owns pooled/reusable:
- projectile
- beam
- slash
- explosion/burst
- elemental particles
- status aura
- buff/debuff
- impact
- screen effect

## Camera

Presets:
Intro, Default, Move, Target, Impact, Faint, Victory.

All temporary camera modifications are scoped and restored after the move timeline.

## UI

DOM/CSS is layered above the WebGL canvas.

Required:
- enemy name/level/HP/status
- player name/level/HP/status
- four move buttons
- type/PP and optional power/accuracy
- battle message
- generation/configuration screens

Use responsive Grid/Flexbox. No single-resolution absolute layout.

## Loading and performance

- lazy-load Pokémon models
- lazy-load required effects/audio
- cache GLB assets
- dispose geometries/materials/textures
- pool transient particles
- avoid per-frame object creation
- avoid repeated DOM updates
- expose renderer statistics during development

## Error handling

Every model, texture, animation, audio, JSON or dependency boundary must have rejection handling, logging and a safe fallback.

A missing visual resource may produce “Model Unavailable” or a fallback effect, but never a white-screen failure.

## Security

- validate external JSON/data
- do not execute metadata as code
- sanitize battle messages
- do not trust remote URLs as executable content
- pin dependencies and review lockfile changes
- keep third-party assets separated from source code

## Tests

Pure:
- damage
- type effectiveness
- move validation
- generation filtering
- state transitions
- form resolution

Integration:
- Showdown adapter
- move transaction
- model loader
- animation event timing

System:
- complete selection flow
- battle
- double-click protection
- model failure
- victory
- defeat
- restart
