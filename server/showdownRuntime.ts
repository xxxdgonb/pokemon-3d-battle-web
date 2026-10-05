import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { BattleStream } from "pokemon-showdown";
import type { Generation, PokemonBattleState } from "../src/core/types";

const PORT = Number(process.env.PORT ?? 8787);
const MAX_MESSAGE_BYTES = 256 * 1024;

interface BattleConfig {
  readonly generation: Generation;
  readonly player: PokemonBattleState;
  readonly opponent: PokemonBattleState;
}
interface CreateBattleMessage { readonly type: "createBattle"; readonly config: BattleConfig; }
interface CommandMessage { readonly type: "command"; readonly command: string; }
type ClientMessage = CreateBattleMessage | CommandMessage;

function isGeneration(value: unknown): value is Generation {
  return Number.isInteger(value) && value >= 1 && value <= 9;
}

function isPokemonState(value: unknown): value is PokemonBattleState {
  if (!value || typeof value !== "object") return false;
  const c = value as Partial<PokemonBattleState>;
  return typeof c.id === "string" && typeof c.speciesId === "string" &&
    typeof c.formId === "string" && typeof c.gender === "string" &&
    typeof c.shiny === "boolean" && Number.isInteger(c.level) &&
    typeof c.abilityId === "string" &&
    (c.heldItemId === null || typeof c.heldItemId === "string") &&
    Number.isFinite(c.hp) && Number.isFinite(c.maxHp) && Array.isArray(c.moves);
}

function parseClientMessage(raw: string): ClientMessage {
  if (raw.length > MAX_MESSAGE_BYTES) throw new Error("Client message is too large.");
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object") throw new Error("Client message must be an object.");
  const c = value as Record<string, unknown>;

  if (c.type === "createBattle") {
    if (!c.config || typeof c.config !== "object") throw new Error("Missing battle config.");
    const config = c.config as Record<string, unknown>;
    if (!isGeneration(config.generation) ||
        !isPokemonState(config.player) || !isPokemonState(config.opponent)) {
      throw new Error("Invalid battle configuration.");
    }
    return {
      type: "createBattle",
      config: {
        generation: config.generation,
        player: config.player,
        opponent: config.opponent,
      },
    };
  }

  if (c.type === "command" && typeof c.command === "string") {
    if (!c.command.startsWith(">")) throw new Error("Simulator commands must start with >.");
    if (c.command.startsWith(">start ")) return {type: "command", command: c.command};
    if (/^>p1 move [a-z0-9-]+$/i.test(c.command)) return {type: "command", command: c.command};
    throw new Error("Command is not allowed by the browser battle runtime.");
  }

  throw new Error("Unknown client message.");
}

interface ShowdownPokemonSet {
  readonly name: string;
  readonly species: string;
  readonly item: string;
  readonly ability: string;
  readonly moves: string[];
  readonly nature: string;
  readonly teraType: string;
  readonly gender: string;
  readonly evs: Record<string, number>;
  readonly ivs: Record<string, number>;
  readonly level: number;
  readonly shiny: boolean;
}

function toPokemonSet(state: PokemonBattleState): ShowdownPokemonSet {
  const species = state.formId && state.formId !== "base"
    ? `${state.speciesId}-${state.formId}`
    : state.speciesId;

  return {
    name: state.id,
    species,
    item: state.heldItemId ?? "",
    ability: state.abilityId,
    moves: state.moves.map(move => move.moveId),
    nature: "Serious",
    teraType: "",
    gender: state.gender === "genderless" ? "" : state.gender,
    evs: {hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0},
    ivs: {hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31},
    level: state.level,
    shiny: state.shiny,
  };
}

function sendJson(socket: WebSocket, value: unknown): void {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(value));
}

async function run(): Promise<void> {
  const httpServer = createServer((_request, response) => {
    response.writeHead(200, {"content-type": "text/plain; charset=utf-8"});
    response.end("pokemon-3d-battle-web showdown runtime\n");
  });
  const wss = new WebSocketServer({server: httpServer});

  wss.on("connection", (socket) => {
    let battle: BattleStream | null = null;
    let config: BattleConfig | null = null;
    let outputTask: Promise<void> | null = null;

    const stopBattle = async (): Promise<void> => {
      if (!battle) return;
      battle.writeEnd();
      battle = null;
      config = null;
      if (outputTask) await outputTask;
      outputTask = null;
    };

    socket.on("message", async (data) => {
      try {
        const message = parseClientMessage(data.toString());

        if (message.type === "createBattle") {
          await stopBattle();
          battle = new BattleStream({noCatch: false});
          config = message.config;
          const stream = battle;

          outputTask = (async () => {
            try {
              for await (const output of stream) {
                sendJson(socket, {type: "showdown", block: output});
              }
            } catch (error) {
              sendJson(socket, {
                type: "error",
                message: error instanceof Error ? error.message : String(error),
              });
            }
          })();

          sendJson(socket, {type: "ready"});
          return;
        }

        if (!battle || !config) throw new Error("Battle has not been created.");

        if (message.command.startsWith(">start ")) {
          await battle.write(`>start ${JSON.stringify({
            formatid: `gen${config.generation}customgame`,
          })}`);
          await battle.write(`>player p1 ${JSON.stringify({
            name: "Player",
            team: [toPokemonSet(config.player)],
          })}`);
          await battle.write(`>player p2 ${JSON.stringify({
            name: "Opponent",
            team: [toPokemonSet(config.opponent)],
          })}`);
          // The configured teams contain exactly one slot, so team preview has
          // one deterministic legal selection and requires no opponent strategy.
          await battle.write(">p1 team 1");
          await battle.write(">p2 team 1");
          return;
        }

        await battle.write(message.command);
      } catch (error) {
        sendJson(socket, {
          type: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    });

    socket.on("close", () => { void stopBattle(); });
  });

  httpServer.listen(PORT, () => {
    console.log(`Showdown runtime listening on ws://localhost:${PORT}`);
  });
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
