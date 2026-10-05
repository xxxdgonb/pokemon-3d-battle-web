# LICENSES

## Policy

No third-party source, model, animation, audio or graphics asset is copied into this project unless its exact license/provenance has been checked.

## Records

### Pokémon 3D API Assets
Source: https://github.com/Pokemon-3D-api/assets
- Code/scripts: MIT.
- Models: README states they are property of Nintendo/Creatures Inc./GAME FREAK inc.
- Decision: D — restricted assets.
- Preserve MIT notice for any repository code actually redistributed.
- Do not interpret repository MIT as a model redistribution license.

### Pokémon Showdown server
Source: https://github.com/smogon/pokemon-showdown
- License: MIT.
- Decision: A/B — dependency or compatible source integration.
- Preserve MIT copyright/license notices for redistributed covered source.
- Preferred implementation: pinned dependency plus narrow adapter boundary.

### Pokémon Showdown Client
Source: https://github.com/smogon/pokemon-showdown-client
- License: AGPL-3.0.
- Decision: C — reference only by default.
- Upstream README specifically warns that this is not the server's MIT license and requests contacting staff for reuse in a differently licensed project.
- No client source/assets are to be copied without separate approval/relicensing.

### Gen 9 Move Animation Project
Source: https://www.pokecommunity.com/threads/the-gen-9-move-animation-project.526189/
- License: no compatible permissive open-source license established in Phase 0.
- Decision: C/D — reference only.
- Preserve requested credits if any separately permitted resource is later used.
- Do not bundle animation/audio/graphics files by default.

### Original CFRU
Source: https://github.com/Skeli789/Complete-Fire-Red-Upgrade
- Public repository metadata identifies GPL-3.0-or-later.
- README also states a strong non-commercial condition for using the repository/assets.
- Decision: D — reference only.
- No ROM, patch, ROM-dependent asset or unclear-provenance CFRU resource may enter this project.

### CFRU Expansion
Source: https://github.com/Shiny-Miner/CFRU-expansion
- No top-level LICENSE found during Phase 0 inspection.
- README identifies it as a fork and credits multiple contributors.
- Decision: D — reference only until file-level provenance is resolved.

## Release gate

Before shipping, verify:
- every model has a documented source/right status,
- every animation/audio asset has compatible permission,
- all required copyright notices are present,
- dependency licenses are compatible,
- no third-party source was copied without preserving required notices.
