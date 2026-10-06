import { describe, expect, it } from "vitest";
import { RemoteShowdownAdapter } from "../src/battle/RemoteShowdownAdapter";
import type { ShowdownBattleConfig } from "../src/battle/ShowdownAdapter";

class FakeTransport {
  private listener: ((block: string) => void) | null = null;
  private moveSent = false;

  async connect(_config: ShowdownBattleConfig): Promise<void> {}
  async close(): Promise<void> {}
  onMessage(listener: (block: string) => void): () => void {
    this.listener = listener;
    return () => { this.listener = null; };
  }
  async waitForBlock(): Promise<string> {
    return "";
  }
  async send(command: string): Promise<void> {
    if (command.startsWith(">start ")) {
      this.listener?.('|request|{"side":{"id":"p1","pokemon":[{"active":true,"condition":"100/100"}]},"active":[{"moves":[{"id":"tackle","pp":35,"maxpp":35}]}]}');
      return;
    }
    if (command === ">p1 move tackle" && !this.moveSent) {
      this.moveSent = true;
      this.listener?.('|move|p1a: Pikachu|Tackle|p2a: Charizard\n|-damage|p2a: Charizard|80/100\n|request|{"side":{"id":"p1","pokemon":[{"active":true,"condition":"100/100"}]},"active":[{"moves":[{"id":"tackle","pp":34,"maxpp":35}]}]}');
    }
  }
}

function config(): ShowdownBattleConfig {
  const pokemon = {
    id: "player",
    speciesId: "pikachu",
    formId: "base",
    gender: "male" as const,
    shiny: false,
    level: 50,
    abilityId: "static",
    heldItemId: null,
    hp: 100,
    maxHp: 100,
    status: null,
    moves: [{ moveId: "tackle", pp: 35, maxPp: 35 }],
  };
  return {
    generation: 9,
    player: pokemon,
    opponent: {...pokemon, id: "opponent", speciesId: "charizard", abilityId: "blaze"},
  };
}

describe("RemoteShowdownAdapter", () => {
  it("rejects concurrent player move submissions", async () => {
    const adapter = new RemoteShowdownAdapter(new FakeTransport());
    await adapter.createBattle(config());

    const first = adapter.submitPlayerMove("tackle");
    await expect(adapter.submitPlayerMove("tackle")).rejects.toThrow("already in flight");
    await expect(first).resolves.toHaveLength(3);

    await adapter.dispose();
  });
});
