import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { WebSocket } from "ws";
import { parseShowdownBlock } from "../src/battle/ShowdownProtocol";

const PORT = 8790;
const URL = `ws://127.0.0.1:${PORT}`;

const pokemon = (id: string, speciesId: string, abilityId: string) => ({
  id,
  speciesId,
  formId: "base",
  gender: "male" as const,
  shiny: false,
  level: 50,
  abilityId,
  heldItemId: null,
  hp: 100,
  maxHp: 100,
  status: null,
  moves: [{moveId: "tackle", pp: 35, maxPp: 35}],
});

function waitForServer(process: ChildProcessWithoutNullStreams): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Showdown runtime did not start in time.")), 5000);
    const onData = (chunk: Buffer): void => {
      if (!chunk.toString().includes("Showdown runtime listening")) return;
      clearTimeout(timeout);
      process.stdout.off("data", onData);
      resolve();
    };
    process.stdout.on("data", onData);
    process.once("error", reject);
    process.once("exit", code => {
      if (code !== 0) reject(new Error(`Showdown runtime exited before startup: ${code}`));
    });
  });
}

type RuntimeMessage = {type: string; block?: string; message?: string};

function waitForMessage(
  messages: readonly RuntimeMessage[],
  predicate: (message: RuntimeMessage) => boolean,
  deadline: number,
): Promise<RuntimeMessage> {
  return new Promise((resolve, reject) => {
    const check = (): void => {
      const error = messages.find(message => message.type === "error");
      if (error) {
        reject(new Error(error.message ?? "Showdown runtime returned an error."));
        return;
      }
      const match = messages.find(predicate);
      if (match) {
        resolve(match);
        return;
      }
      if (Date.now() >= deadline) {
        reject(new Error(`Timed out waiting for Showdown runtime message. Received: ${messages.map(message => message.type + ":" + (message.block?.slice(0, 120) ?? message.message ?? "")).join(" || ")}`));
        return;
      }
      setTimeout(check, 10);
    };
    check();
  });
}

const runtime = spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", "server/showdownRuntime.ts"], {
  env: {...process.env, PORT: String(PORT)},
  stdio: ["ignore", "pipe", "pipe"],
});

try {
  await waitForServer(runtime);

  const socket = new WebSocket(URL);
  const messages: RuntimeMessage[] = [];
  socket.on("message", data => {
    const message = JSON.parse(data.toString()) as RuntimeMessage;
    if (message.type === "error") {
      messages.push(message);
      return;
    }
    messages.push(message);
  });
  await new Promise<void>((resolve, reject) => {
    socket.once("open", () => resolve());
    socket.once("error", reject);
  });

  socket.send(JSON.stringify({
    type: "createBattle",
    config: {
      generation: 9,
      player: pokemon("p1", "pikachu", "static"),
      opponent: pokemon("p2", "charizard", "blaze"),
    },
  }));
  await waitForMessage(messages, message => message.type === "ready", Date.now() + 5000);

  socket.send(JSON.stringify({type: "command", command: '>start {"formatid":"gen9customgame"}'}));
  await waitForMessage(
    messages,
    message => message.type === "showdown" && !!message.block && message.block.includes("|request|") && message.block.includes("\"active\"") && !message.block.includes("\"teamPreview\":true"),
    Date.now() + 5000,
  );

  socket.send(JSON.stringify({type: "command", command: ">p1 move tackle"}));
  await waitForMessage(
    messages,
    message => message.type === "showdown" && !!message.block && (() => {
      const parsed = parseShowdownBlock(message.block);
      return parsed.some(item => item.type === "move" && item.args[0] === "p1a: p1" && item.args[1] === "Tackle") &&
        parsed.some(item => item.type === "-damage" && item.args[0] === "p2a: p2");
    })(),
    Date.now() + 5000,
  );

  const parsed = parseShowdownBlock(messages.filter(message => message.type === "showdown").map(message => message.block ?? "").join("\n"));
  const moveCount = parsed.filter(item => item.type === "move" && item.args[0] === "p1a: p1" && item.args[1] === "Tackle").length;
  const damageCount = parsed.filter(item => item.type === "-damage" && item.args[0] === "p2a: p2").length;
  if (moveCount !== 1 || damageCount !== 1) {
    throw new Error(`Runtime integration expected one move and one damage, got move=${moveCount}, damage=${damageCount}.`);
  }

  socket.close();
  await new Promise<void>(resolve => socket.once("close", () => resolve()));
  console.log("Showdown WebSocket runtime smoke test passed.");
} finally {
  runtime.kill("SIGTERM");
}
