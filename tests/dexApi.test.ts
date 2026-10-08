import {describe,expect,it} from "vitest";
import {getDexPayload} from "../server/dexApi";

type DexSpeciesLike={id:string;num:number;baseSpecies:string;name:string;forme?:string;gen?:number};
type DexPayloadLike={generation:number;species:DexSpeciesLike[];moves:{gen:number}[];abilities:{gen:number}[];items:{gen:number}[]};

describe("generation dex payload",()=>{
  it("returns the complete base National Dex for each generation",()=>{
    const expected=[0,151,251,386,493,649,721,807,807,1025];
    for(let generation=1;generation<=9;generation++){
      const payload=getDexPayload(generation) as DexPayloadLike;
      const base=payload.species.filter(s=>s.baseSpecies===s.name||!s.forme);
      expect(base.length).toBe(expected[generation]);
      expect(Math.max(...base.map(s=>s.num))).toBe(generation===8?905:expected[generation]);
      expect(base.every(s=>(s.gen??generation)<=generation)).toBe(true);
    }
  });

  it("does not leak future moves, abilities, or items into an older generation",()=>{
    for(let generation=1;generation<=9;generation++){
      const payload=getDexPayload(generation) as DexPayloadLike;
      expect(payload.moves.every(x=>(x.gen??generation)<=generation)).toBe(true);
      expect(payload.abilities.every(x=>(x.gen??generation)<=generation)).toBe(true);
      expect(payload.items.every(x=>(x.gen??generation)<=generation)).toBe(true);
    }
  });

  it("keeps later-generation forms attached to older species only when legal for that generation",()=>{
    const gen1=getDexPayload(1) as DexPayloadLike;
    const gen7=getDexPayload(7) as DexPayloadLike;
    expect(gen1.species.some(s=>s.id==="raichualola")).toBe(false);
    expect(gen7.species.some(s=>s.id==="raichualola")).toBe(true);
  });
});
