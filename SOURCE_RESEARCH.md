# SOURCE_RESEARCH

Phase 0 research baseline — 2026-10-05.

## Source matrix

| Project | Purpose | License / terms | Decision |
|---|---|---|---|
| Pokemon-3D-api/assets — https://github.com/Pokemon-3D-api/assets | 3D Pokémon model source | Repository code/scripts: MIT. README explicitly says models are property of Nintendo/Creatures Inc./GAME FREAK inc. | D — restricted IP assets; provider/fallback architecture, no blanket vendoring |
| smogon/pokemon-showdown — https://github.com/smogon/pokemon-showdown | Battle simulator and structured battle data | MIT | A/B — primary battle logic candidate |
| smogon/pokemon-showdown-client — https://github.com/smogon/pokemon-showdown-client | Battle presentation/protocol/timing reference | AGPL-3.0; README says reuse in a differently licensed project should be discussed with copyright holder | C — reference only unless separately relicensed |
| Gen 9 Move Animation Project — https://www.pokecommunity.com/threads/the-gen-9-move-animation-project.526189/ | Move animation design/timing | No compatible permissive open-source license established; contributor credits required | C/D — reference only |
| Skeli789/Complete-Fire-Red-Upgrade — https://github.com/Skeli789/Complete-Fire-Red-Upgrade | Gen 8 mechanics/animation/ROM-hacking reference | Public metadata identifies GPL-3.0-or-later; README also contains strong non-commercial language | D — reference only |
| Shiny-Miner/CFRU-expansion — https://github.com/Shiny-Miner/CFRU-expansion | CFRU expansion/fork reference | No top-level LICENSE found; README says it is not affiliated with original CFRU and credits contributors | D — reference only |

## Pokémon 3D API Assets

Verified repository: Pokemon-3D-api/assets, main branch.

Top-level structure:
- .github/
- models/
- scripts/
- LICENSE
- README.md

README describes an automated pipeline using GLB input, Draco geometry optimization, texture resizing to 1024x1024 and WebP compression. Model mapping is controlled by scripts/model_map.json.

The inspected current model_map.json is an empty array, so README examples are not proof of a current complete inventory.

README documents categories for regular, shiny, Gigantamax, Mega, regional, fusion, origin, multi and special forms.

Critical legal finding: repository code is MIT, but the README explicitly states the 3D assets are property of Nintendo/Creatures Inc./GAME FREAK inc.

Engineering decision:
- Do not vendor the whole model repository.
- Implement a provider-based PokemonModelLoader.
- Resolve exact form/gender/shiny first, then progressively fall back.
- A missing model must never stop the battle simulator.

## Pokémon Showdown

Verified repository: smogon/pokemon-showdown, master branch.

README identifies it as a JavaScript/TypeScript battle simulator and data library covering Generations 1–9.

Important simulator/data areas:
- sim/
- data/
- data/pokedex.ts
- data/moves.ts
- data/abilities.ts
- data/items.ts
- data/learnsets.ts
- data/typechart.ts
- data/conditions.ts
- data/formats-data.ts
- data/mods/

sim/index.ts exports Battle, BattleStream, Pokemon, Side, Dex and related APIs.

sim/README.md says the Node package currently works in Node rather than browsers and warns that undocumented APIs are unstable, recommending exact version pinning.

Engineering decision:
- Use a pinned Showdown version through WebBattleAdapter / ShowdownAdapter.
- Keep simulator code isolated from Three.js.
- Normalize simulator results into project-owned battle events.
- Do not reimplement mature damage formulas unless a generation-specific adapter requires it.

## Pokémon Showdown Client

The client is a complete frontend application. Current battle UI code lives under play.pokemonshowdown.com/src/, including panel-battle.tsx and related modules.

License is AGPL-3.0. Its README explicitly distinguishes this from the server MIT license and says reuse of client code in a permissively licensed open-source project should be discussed with the copyright holder.

Engineering decision:
- Do not copy the client wholesale.
- Study message ordering, battle presentation, timing and UI behavior.
- Implement our own MoveAnimationSystem and UI.

## Gen 9 Move Animation Project

Verified public source:
- PokéCommunity thread: https://www.pokecommunity.com/threads/the-gen-9-move-animation-project.526189/
- Eevee Expo resource: https://www.eeveeexpo.com/resources/1480/

The project is led by KRLW890 and Nut0066 with additional contributors. It is a successor to the Gen 8 animation project and incorporates work from Pokémon Reborn and other contributors.

The project uses Essentials-oriented animation data and asks users to preserve credits. The thread lists unfinished/high-priority and special move categories.

Engineering decision:
- Use only the design concepts: charge, projectile/motion, impact, secondary effect, recovery, camera beats and effect categories.
- Do not copy animation files, graphics or audio into this repository until every asset has explicit redistribution permission.

## CFRU

Original CFRU was verified as:
Skeli789/Complete-Fire-Red-Upgrade.

Its README describes a FireRed ROM upgrade with an upgraded battle engine, Gen 8 mechanics, moves, abilities, items, move animations, Mega/Primal/Ultra Burst and Dynamax/G-Max related systems.

The build requires a FireRed ROM and devkitARM/ROM-hacking tooling, proving it is tightly coupled to ROM insertion and is not a browser dependency.

PokéCommunity documentation independently identifies Skeli789/Complete-Fire-Red-Upgrade as the original CFRU repository.

Fork research:
- Shiny-Miner/CFRU-expansion explicitly identifies itself as a fork, not the original.
- ntrxrl/cfru and rexcanyon792/cfru are additional CFRU repositories found during search; their names alone are not evidence of original authorship or identical licensing.

Engineering decision:
- CFRU is mechanics and animation reference only.
- Never copy ROM, ROM patches, ROM-dependent assets or unclear-provenance resources into the Web project.

## Additional repositories worth evaluating later

- hsahovic/poke-env — programmatic Showdown interaction reference.
- pkmn/ps — ecosystem/API reference.
- Zarel/Pokemon-Showdown-Dex — historical Dex reference.

They are not adopted as core dependencies in Phase 0.

## Adopted source strategy

1. Battle truth: pinned Pokémon Showdown simulator.
2. Battle data: normalized through project-owned typed adapters.
3. 3D models: lazy provider/fallback system; rights checked per asset.
4. Move visuals: original Three.js/WebGL implementation with explicit fallback tags.
5. UI: project-owned implementation.
6. CFRU: reference only.
7. Showdown Client: reference only.

## Phase 0 result

Research baseline is complete. Legal/asset verification remains a release gate for any individual third-party asset.
