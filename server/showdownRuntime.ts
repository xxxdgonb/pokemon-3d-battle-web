import { createServer } from "node:http";
import { createRequire } from "node:module";
import { WebSocketServer, type WebSocket } from "ws";
import type { BattleStream as BattleStreamType } from "pokemon-showdown";
const require = createRequire(import.meta.url);
const {BattleStream, Dex} = require("pokemon-showdown") as {BattleStream: typeof BattleStreamType; Dex: typeof import("pokemon-showdown").Dex};

function validatePokemonStateForGeneration(state: PokemonBattleState, generation: Generation): void {
  const dex = Dex.forGen(generation);
  const requestedSpecies = state.formId && state.formId !== "base" ? `${state.speciesId}-${state.formId}` : state.speciesId;
  const species = dex.species.get(requestedSpecies);
  if (!species.exists) throw new Error(`Pokémon is not available in generation ${generation}: ${requestedSpecies}`);
  const speciesAbilityIds = new Set(Object.values(species.abilities).map(ability => ability.toLowerCase().replace(/[^a-z0-9]+/g, "")));
  if (!speciesAbilityIds.has(state.abilityId.toLowerCase().replace(/[^a-z0-9]+/g, ""))) {
    throw new Error(`Ability is not available to ${requestedSpecies}: ${state.abilityId}`);
  }
  if (!dex.abilities.get(state.abilityId).exists) {
    throw new Error(`Unknown ability for generation ${generation}: ${state.abilityId}`);
  }
  if (state.heldItemId && !dex.items.get(state.heldItemId).exists) {
    throw new Error(`Unknown item for generation ${generation}: ${state.heldItemId}`);
  }
  const learnset = dex.species.getLearnsetData(requestedSpecies as never).learnset ?? {};
  const seen = new Set<string>();
  for (const move of state.moves) {
    const id = move.moveId.toLowerCase();
    if (seen.has(id)) throw new Error(`Duplicate move is not allowed: ${move.moveId}`);
    seen.add(id);
    if (!dex.moves.get(id).exists) {
      throw new Error(`Unknown move for generation ${generation}: ${move.moveId}`);
    }
    if (!Object.prototype.hasOwnProperty.call(learnset, id)) {
      throw new Error(`Move is not in the ${requestedSpecies} learnset for generation ${generation}: ${move.moveId}`);
    }
  }
}
import type { Generation, PokemonBattleState } from "../src/core/types";
import { getDexPayload, getGeneration, getLearnset } from "./dexApi";

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
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 9;
}

function isPokemonState(value: unknown): value is PokemonBattleState {
  if (!value || typeof value !== "object") return false;
  const c = value as Partial<PokemonBattleState>;
  const {level, hp, maxHp} = c;
  if (
    typeof c.id !== "string" || c.id.length < 1 || c.id.length > 64 ||
    typeof c.speciesId !== "string" || c.speciesId.length < 1 || c.speciesId.length > 128 ||
    typeof c.formId !== "string" || c.formId.length < 1 || c.formId.length > 128 ||
    !["male", "female", "genderless"].includes(c.gender as string) ||
    typeof c.shiny !== "boolean" ||
    typeof level !== "number" || !Number.isInteger(level) || level < 1 || level > 100 ||
    typeof c.abilityId !== "string" || c.abilityId.length > 128 ||
    !(c.heldItemId === null || (typeof c.heldItemId === "string" && c.heldItemId.length <= 128)) ||
    typeof hp !== "number" || typeof maxHp !== "number" ||
    !Number.isFinite(hp) || !Number.isFinite(maxHp) || hp < 0 || maxHp < 1 || hp > maxHp ||
    !Array.isArray(c.moves) || c.moves.length < 1 || c.moves.length > 4
  ) return false;
  return c.moves.every(move =>
    Boolean(move) &&
    typeof move === "object" &&
    typeof (move as {moveId?: unknown}).moveId === "string" &&
    ((move as {moveId:string}).moveId.length > 0 && (move as {moveId:string}).moveId.length <= 128) &&
    Number.isFinite((move as {pp?: unknown}).pp) &&
    Number.isFinite((move as {maxPp?: unknown}).maxPp) &&
    (move as {pp:number}).pp >= 0 && (move as {maxPp:number}).maxPp >= 1 &&
    (move as {pp:number}).pp <= (move as {maxPp:number}).maxPp,
  );
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
    validatePokemonStateForGeneration(config.player, config.generation);
    validatePokemonStateForGeneration(config.opponent, config.generation);
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
  const direct = Dex.species.get(state.speciesId);
  const requestedSpecies = state.formId && state.formId !== "base" ? `${state.speciesId}-${state.formId}` : state.speciesId;
  const requested = state.formId && state.formId !== "base" ? Dex.species.get(requestedSpecies) : direct;
  const resolvedSpecies = requested.exists ? requested : direct;
  if (!resolvedSpecies.exists) throw new Error(`Unknown Pokémon species/form: ${state.speciesId}${state.formId !== "base" ? `-${state.formId}` : ""}`);
  const species = resolvedSpecies.name;

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
  if (socket.readyState === 1) socket.send(JSON.stringify(value));
}

async function run(): Promise<void> {
  const httpServer = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost:" + PORT);
    if (url.pathname === "/api/learnset") {
      const generation = getGeneration(url.searchParams.get("generation"));
      const species = url.searchParams.get("species");
      if (!generation || !species) {
        response.writeHead(400, {"content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*"});
        response.end(JSON.stringify({error: "generation and species are required"}));
        return;
      }
      response.writeHead(200, {"content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=3600", "access-control-allow-origin": "*"});
      response.end(JSON.stringify({species, moves:getLearnset(generation, species)}));
      return;
    }
    if (url.pathname !== "/api/dex") {
      response.writeHead(200, {"content-type": "text/plain; charset=utf-8"});
      response.end("pokemon-3d-battle-web showdown runtime\n");
      return;
    }
    const generation = getGeneration(url.searchParams.get("generation"));
    if (!generation) {
      response.writeHead(400, {"content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*"});
      response.end(JSON.stringify({error: "generation must be 1-9"}));
      return;
    }
    try {
      response.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=3600",
        "access-control-allow-origin": "*",
      });
      response.end(JSON.stringify(getDexPayload(generation)));
    } catch (error) {
      response.writeHead(500, {"content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*"});
      response.end(JSON.stringify({error: error instanceof Error ? error.message : String(error)}));
    }
  });
  const wss = new WebSocketServer({server: httpServer});



  wss.on("connection", (socket) => {
    let battle: BattleStreamType | null = null;
    let config: BattleConfig | null = null;
    let outputTask: Promise<void> | null = null;
    let commandQueue: Promise<void> = Promise.resolve();

    const stopBattle = async (): Promise<void> => {
      if (!battle) return;
      battle.writeEnd();
      battle = null;
      config = null;
      if (outputTask) await outputTask;
      outputTask = null;
    };

    socket.on("message", (data) => {
      commandQueue = commandQueue.then(async () => {
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

          if (socket.readyState === 1) socket.send(JSON.stringify({type: "ready"}));
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
          sendJson(socket, {type: "battle-started"});
          return;
        }

        if (message.command.startsWith(">p1 move ")) {
          const moveId = message.command.slice(">p1 move ".length).trim().toLowerCase();
          if (!config.player.moves.some(move => move.moveId.toLowerCase() === moveId)) {
            throw new Error(`Player move is not part of the configured moveset: ${moveId}`);
          }
        }

        await battle.write(message.command);

        if (message.command.startsWith(">p1 move ")) {
          const simulator = battle.battle;
          const passiveSide = simulator?.sides[1];
          if (!simulator || !passiveSide) {
            throw new Error("Showdown battle is not initialized.");
          }

          if (passiveSide.requestState === "move" && !passiveSide.isChoiceDone()) {
            passiveSide.choice.actions.push({choice: "pass"});
            simulator.commitChoices();
            simulator.sendUpdates();
          }
        }
        } catch (error) {
          sendJson(socket, {
            type: "error",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }).catch(error => {
        sendJson(socket, {
          type: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      });
    });

    socket.on("close", () => {
      void commandQueue.finally(() => stopBattle());
    });
  });

  httpServer.listen(PORT, "127.0.0.1", () => {
    const address = httpServer.address();
    const port = typeof address === "object" && address ? address.port : PORT;
    console.log(`Showdown runtime listening on ws://localhost:${port}`);
  });
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
