import type { BattleState, MoveSlot } from "../core/types";
import type { ShowdownBattleConfig, ShowdownAdapter, ShowdownBattleEvent, ShowdownTransport } from "./ShowdownAdapter";
import { encodeChoice, parseShowdownBlock, type ShowdownProtocolMessage } from "./ShowdownProtocol";

export class RemoteShowdownAdapter implements ShowdownAdapter {
  public readonly runtime = "remote" as const;
  private state: BattleState | null = null;
  private unsubscribe: (() => void) | null = null;
  private readonly pending: ShowdownBattleEvent[] = [];

  public constructor(private readonly transport: ShowdownTransport) {}

  public async createBattle(config: ShowdownBattleConfig): Promise<void> {
    this.unsubscribe = this.transport.onMessage((block) => {
      for (const message of parseShowdownBlock(block)) {
        const event = this.normalize(message);
        if (event) this.pending.push(event);
      }
    });

    await this.transport.connect(config);
    await this.transport.send(`>start {"formatid":"gen${config.generation}customgame"}`);
    await this.transport.waitForBlock();
    this.pending.splice(0);
  }

  public async submitPlayerMove(move: MoveSlot["moveId"]): Promise<readonly ShowdownBattleEvent[]> {
    const pendingBefore = this.pending.length;
    await this.transport.send(`>p1 ${encodeChoice(move)}`);
    await this.transport.waitForBlock();
    return this.pending.splice(pendingBefore);
  }

  public async getState(): Promise<BattleState> {
    if (this.state === null) {
      throw new Error("Showdown battle state is not available yet.");
    }
    return this.state;
  }

  public async dispose(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
    await this.transport.close();
  }

  private normalize(message: ShowdownProtocolMessage): ShowdownBattleEvent | null {
    switch (message.type) {
      case "request":
        return { kind: "request", payload: message.args[0] ?? "", source: message };
      case "damage":
      case "-damage":
        return { kind: "damage", payload: message.args, source: message };
      case "status":
      case "-status":
        return { kind: "status", payload: message.args, source: message };
      case "faint":
        return { kind: "faint", payload: message.args, source: message };
      case "turn":
        return { kind: "turn-end", payload: message.args, source: message };
      default:
        return { kind: "log", payload: message.args, source: message };
    }
  }
}
