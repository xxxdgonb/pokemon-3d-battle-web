import { describe, expect, it } from "vitest";
import { projectShowdownBlock } from "../src/battle/ShowdownStateProjector";
import type { BattleState } from "../src/core/types";
import { parseShowdownBlock } from "../src/battle/ShowdownProtocol";

function createState(): BattleState {
  const pokemon = {
    id:"pika", speciesId:"pikachu", formId:"base", gender:"male" as const, shiny:false,
    level:50, abilityId:"static", heldItemId:null, hp:100, maxHp:100, status:null,
    moves:[{moveId:"thunderbolt",pp:15,maxPp:15},{moveId:"quickattack",pp:30,maxPp:30}],
  };
  return {
    generation:9, phase:"PLAYER_SELECTING_MOVE", turn:1, activeTransactionId:null,
    player:pokemon, opponent:{...pokemon,id:"target",speciesId:"charizard",abilityId:"blaze"},
  };
}

describe("ShowdownStateProjector",()=>{
  it("projects request HP, status and move PP",()=>{
    const block="|request|"+JSON.stringify({
      side:{id:"p1",pokemon:[{active:true,condition:"73/100"}]},
      active:[{moves:[{id:"thunderbolt",pp:12,maxpp:15}]}],
    });
    const state=projectShowdownBlock(createState(),parseShowdownBlock(block));
    expect(state.player.hp).toBe(73);
    expect(state.player.maxHp).toBe(100);
    expect(state.player.moves[0]?.pp).toBe(12);
  });

  it("projects authoritative active identity and ability",()=>{
    const block="|request|"+JSON.stringify({
      side:{id:"p2",pokemon:[{active:true,details:"Charizard, L50, M",condition:"120/120",ability:"blaze"}]},
      active:[{moves:[{id:"flamethrower",pp:10,maxpp:15}]}],
    });
    const state=projectShowdownBlock(createState(),parseShowdownBlock(block));
    expect(state.opponent.speciesId).toBe("charizard");
    expect(state.opponent.gender).toBe("male");
    expect(state.opponent.abilityId).toBe("blaze");
    expect(state.opponent.moves[0]?.pp).toBe(10);
  });

  it("preserves form and shiny identity from Showdown details",()=>{
    const block="|request|"+JSON.stringify({
      side:{id:"p2",pokemon:[{active:true,details:"Charizard, Mega-X, L50, M, shiny",condition:"120/120"}]},
      active:[{moves:[]}]});
    const state=projectShowdownBlock(createState(),parseShowdownBlock(block));
    expect(state.opponent.speciesId).toBe("charizard");
    expect(state.opponent.formId).toBe("mega-x");
    expect(state.opponent.gender).toBe("male");
    expect(state.opponent.shiny).toBe(true);
  });

  it("projects ability and held-item changes",()=>{
    const state=projectShowdownBlock(createState(),parseShowdownBlock([
      "|-ability|p2a: Charizard|intimidate",
      "|-item|p2a: Charizard|leftovers",
      "|-enditem|p2a: Charizard|leftovers",
    ].join("\n")));
    expect(state.opponent.abilityId).toBe("intimidate");
    expect(state.opponent.heldItemId).toBeNull();
  });

  it("does not let raw win events bypass the application state machine",()=>{
    const state=projectShowdownBlock(createState(),parseShowdownBlock("|win|Player"));
    expect(state.phase).toBe("PLAYER_SELECTING_MOVE");
  });

  it("projects damage, healing, status cure, faint and turn events",()=>{
    const block=[
      "|-damage|p2a: Charizard|40/100",
      "|-heal|p2a: Charizard|60/100",
      "|-status|p2a: Charizard|brn",
      "|-curestatus|p2a: Charizard|brn",
      "|turn|3",
      "|faint|p2a: Charizard",
    ].join("\n");
    const state=projectShowdownBlock(createState(),parseShowdownBlock(block));
    expect(state.opponent.hp).toBe(0);
    expect(state.opponent.status).toBeNull();
    expect(state.turn).toBe(3);
  });
});
