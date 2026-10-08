import type { BattleState, MoveSlot } from "../core/types";
import type { ShowdownBattleConfig, ShowdownAdapter, ShowdownBattleEvent, ShowdownTransport } from "./ShowdownAdapter";
import { projectShowdownMessage } from "./ShowdownStateProjector";
import { encodeChoice, parseShowdownBlock, type ShowdownProtocolMessage } from "./ShowdownProtocol";

export class RemoteShowdownAdapter implements ShowdownAdapter {
  public readonly runtime = "remote" as const;
  private state: BattleState | null = null;
  private unsubscribe: (() => void) | null = null;
  private readonly pending: ShowdownBattleEvent[] = [];
  private moveInFlight = false;

  public constructor(private readonly transport: ShowdownTransport) {}

  public async createBattle(config: ShowdownBattleConfig): Promise<void> {
    this.state = {
      generation: config.generation,
      phase: "INIT",
      turn: 0,
      activeTransactionId: null,
      player: config.player,
      opponent: config.opponent,
    };

    this.unsubscribe = this.transport.onMessage((block) => {
      for (const message of parseShowdownBlock(block)) {
        this.state = projectShowdownMessage(this.state!, message);
        const event = this.normalize(message);
        if (event) this.pending.push(event);
      }
    });

    await this.transport.connect(config);
    await this.transport.send(`>start {"formatid":"gen${config.generation}customgame"}`);
    for(let attempt=0;attempt<16;attempt++){
      if(this.pending.some(event=>event.kind==="request"))break;
      await this.transport.waitForBlock();
    }
    if(!this.pending.some(event=>event.kind==="request")){
      throw new Error("Showdown battle did not produce an initial request.");
    }
    this.pending.splice(0);
  }

  public async submitPlayerMove(move: MoveSlot["moveId"]): Promise<readonly ShowdownBattleEvent[]> {
    if (this.moveInFlight) throw new Error("A player move is already in flight.");
    this.moveInFlight = true;
    try {
        await this.transport.send(`>p1 ${encodeChoice(move)}`);
      for(let attempt=0;attempt<16;attempt++){
        if(this.pending.some(event=>event.kind==="move"||event.kind==="battle-end"))break;
        await this.transport.waitForBlock();
      }
      return this.pending.splice(0);
    } finally {
      this.moveInFlight = false;
    }
  }

  public async getState(): Promise<BattleState> {
    if (this.state === null) {
      throw new Error("Showdown battle state is not available yet.");
    }
    return this.state;
  }

  public async dispose(): Promise<void> {
    this.moveInFlight = false;
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
      case "-heal":
        return { kind: "heal", payload: message.args, source: message };
      case "-sethp":
        return { kind: "sethp", payload: message.args, source: message };
      case "move":
        return { kind: "move", payload: message.args, source: message };
      case "-anim":
        return { kind: "anim", payload: message.args, source: message };
      case "-miss":
        return { kind: "miss", payload: message.args, source: message };
      case "-immune":
        return { kind: "immune", payload: message.args, source: message };
      case "-fail":
        return { kind: "failed", payload: message.args, source: message };
      case "-crit":
        return { kind: "crit", payload: message.args, source: message };
      case "-supereffective":
      case "-resisted":
        return { kind: "effectiveness", payload: message.args, source: message };
      case "status":
      case "-status":
        return { kind: "status", payload: message.args, source: message };
      case "-curestatus":
        return { kind: "curestatus", payload: message.args, source: message };
      case "-boost":
        return { kind: "boost", payload: message.args, source: message };
      case "-unboost":
        return { kind: "unboost", payload: message.args, source: message };
      case "-ability":
        return {kind:"ability",payload:message.args,source:message};
      case "-item":
        return {kind:"item",payload:message.args,source:message};
      case "-enditem":
        return {kind:"enditem",payload:message.args,source:message};
      case "-formechange":
      case "detailschange":
        return { kind: "formechange", payload: message.args, source: message };
      case "-weather":
        return {kind:"fieldstart",payload:message.args,source:message};
      case "-fieldstart":
        return {kind:"fieldstart",payload:message.args,source:message};
      case "-fieldend":
        return {kind:"fieldend",payload:message.args,source:message};
      case "-fieldactivate":
        return {kind:"fieldactivate",payload:message.args,source:message};
      case "-sidestart":
        return {kind:"sidestart",payload:message.args,source:message};
      case "-sideend":
        return {kind:"sideend",payload:message.args,source:message};
      case "-start":
        return {kind:"start",payload:message.args,source:message};
      case "-end":
        return {kind:"end",payload:message.args,source:message };
      case "faint":
        return { kind: "faint", payload: message.args, source: message };
      case "win":
        return { kind: "battle-end", payload: message.args, source: message };
      case "turn":
        return { kind: "turn-end", payload: message.args, source: message };
      default:
        return { kind: "log", payload: message.args, source: message };
    }
  }
}
