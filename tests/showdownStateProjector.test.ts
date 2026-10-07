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

  it("normalizes combined Showdown form names",()=>{
    const block="|request|"+JSON.stringify({
      side:{id:"p2",pokemon:[{active:true,details:"Charizard-Mega-X, L50, M, shiny",condition:"120/120"}]},
      active:[{moves:[]}]});
    const state=projectShowdownBlock(createState(),parseShowdownBlock(block));
    expect(state.opponent.speciesId).toBe("charizard");
    expect(state.opponent.formId).toBe("mega-x");
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

  it("projects stat stages with Showdown clamping",()=>{
    const state=projectShowdownBlock(createState(),parseShowdownBlock([
      "|-boost|p2a: Charizard|atk|2",
      "|-unboost|p2a: Charizard|atk|1",
      "|-unboost|p2a: Charizard|def|9",
    ].join("\n")));
    expect(state.opponent.statStages?.atk).toBe(1);
    expect(state.opponent.statStages?.def).toBe(-6);
  });

  it("projects volatile and side conditions without touching HP",()=>{
    const state=projectShowdownBlock(createState(),parseShowdownBlock([
      "|-start|p2a: Charizard|Substitute",
      "|-end|p2a: Charizard|Substitute",
      "|-fieldstart|move: Grassy Terrain",
      "|-sidestart|p2: Opponent|Stealth Rock",
    ].join("\n")));
    expect(state.opponent.hp).toBe(100);
    expect(state.opponent.volatileConditions).toEqual([]);
    expect(state.fieldConditions).toContain("move: Grassy Terrain");
    expect(state.opponentSideConditions).toContain("Stealth Rock");
  });

  it("removes field and side conditions authoritatively",()=>{
    const state=projectShowdownBlock(createState(),parseShowdownBlock([
      "|-fieldstart|move: Grassy Terrain",
      "|-sidestart|p2: Opponent|Stealth Rock",
      "|-fieldend|move: Grassy Terrain",
      "|-sideend|p2: Opponent|Stealth Rock",
    ].join("\n")));
    expect(state.fieldConditions).toEqual([]);
    expect(state.opponentSideConditions).toEqual([]);
  });

  it("does not let raw win events bypass the application state machine",()=>{
    const state=projectShowdownBlock(createState(),parseShowdownBlock("|win|Player"));
    expect(state.phase).toBe("PLAYER_SELECTING_MOVE");
  });

  it("projects weather start and clear events",()=>{
    const state=projectShowdownBlock(createState(),parseShowdownBlock([
      "|-weather|SunnyDay|[from] ability: Drought",
      "|-weather|none",
    ].join("\n")));
    expect(state.fieldConditions).toEqual([]);

    const active=projectShowdownBlock(createState(),parseShowdownBlock("|-weather|RainDance"));
    expect(active.fieldConditions).toContain("RainDance");
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
