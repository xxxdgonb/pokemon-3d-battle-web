import { Dex } from "pokemon-showdown";
import type { Generation } from "../src/core/types";

const cache = new Map<Generation, unknown>();

function validGeneration(value: number): value is Generation {
  return Number.isInteger(value) && value >= 1 && value <= 9;
}

function id(value: {id: string}): string {
  return value.id;
}

export function getDexPayload(generation: Generation): unknown {
  const cached = cache.get(generation);
  if (cached) return cached;

  const dex = Dex.mod(`gen${generation}`);
  const species = dex.species.all()
    .filter(s => s.exists && !s.isNonstandard && s.num > 0 && s.num <= 1025)
    .map(s => ({
      id: id(s), name: s.name, num: s.num, baseSpecies: s.baseSpecies,
      forme: s.forme, types: [...s.types], abilities: {...s.abilities},
      gender: s.gender, genderRatio: s.genderRatio, isMega: s.isMega,
      isGigantamax: s.isGigantamax, gen: s.gen,
      baseStats: {...s.baseStats},
    }));

  const moves = dex.moves.all()
    .filter(m => m.exists && !m.isNonstandard)
    .map(m => ({
      id: id(m), name: m.name, type: m.type, category: m.category,
      basePower: m.basePower, accuracy: m.accuracy, pp: m.pp,
      priority: m.priority, target: m.target, desc: m.shortDesc || m.desc,
      gen: m.gen,
    }));

  const abilities = dex.abilities.all()
    .filter(a => a.exists && !a.isNonstandard)
    .map(a => ({id: id(a), name: a.name, shortDesc: a.shortDesc || a.desc, gen: a.gen}));

  const items = dex.items.all()
    .filter(i => i.exists && !i.isNonstandard)
    .map(i => ({id: id(i), name: i.name, desc: i.shortDesc || i.desc, gen: i.gen}));

  const payload = {generation, species, moves, abilities, items};
  cache.set(generation, payload);
  return payload;
}

export function getGeneration(value: string | null): Generation | null {
  if (value === null) return null;
  const n = Number(value);
  return validGeneration(n) ? n : null;
}


export function getLearnset(generation: Generation, speciesId: string): string[] {
  const dex = Dex.mod(`gen${generation}`);
  const data = dex.species.getLearnsetData(speciesId as never);
  return Object.keys(data.learnset ?? {});
}
