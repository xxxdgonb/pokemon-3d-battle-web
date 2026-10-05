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
    process.once("exit", (code) => {
      if (code !== 0) reject(new Error(`Showdown runtime exited before startup: ${code}`));
    });
  });
}

function waitFor(
  socket: WebSocket,
  predicate: (message: {type: string; block?: string; message?: string}) => boolean,
): Promise<{type: string; block?: string; message?: string}> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("message", onMessage);
      reject(new Error("Timed out waiting for Showdown runtime message."));
    }, 5000);
    const onMessage = (data: Buffer | ArrayBuffer | Buffer[]): void => {
      const message = JSON.parse(data.toString()) as {type: string; block?: string; message?: string};
      if (message.type === "error") {
        clearTimeout(timeout);
        socket.off("message", onMessage);
        reject(new Error(message.message ?? "Showdown runtime error."));
        return;
      }
      if (!predicate(message)) return;
      clearTimeout(timeout);
      socket.off("message", onMessage);
      resolve(message);
    };
    socket.on("message", onMessage);
  });
}

const runtime = spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", "server/showdownRuntime.ts"], {
  env: {...process.env, PORT: String(PORT)},
  stdio: ["ignore", "pipe", "pipe"],
});

try {
  await waitForServer(runtime);

  const socket = new WebSocket(URL);
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
  await waitFor(socket, message => message.type === "ready");

  socket.send(JSON.stringify({type: "command", command: '>start {"formatid":"gen9customgame"}'}));
  await waitFor(socket, message => message.type === "showdown" && !!message.block && message.block.includes("|request|") && message.block.includes("\"active\"") && !message.block.includes("\"teamPreview\":true"));

  socket.send(JSON.stringify({type: "command", command: ">p1 move tackle"}));

  const received: string[] = [];
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const message = await waitFor(socket, message => message.type === "showdown" && !!message.block);
    received.push(message.block ?? "");
    const parsed = parseShowdownBlock(received.join("\n"));
    const moveCount = parsed.filter(item => item.type === "move" && item.args[0] === "p1a: Pikachu" && item.args[1] === "Tackle").length;
    const damageCount = parsed.filter(item => item.type === "-damage" && item.args[0] === "p2a: Charizard").length;
    if (moveCount === 1 && damageCount === 1) break;
  }

  const parsed = parseShowdownBlock(received.join("\n"));
  const moveCount = parsed.filter(item => item.type === "move" && item.args[0] === "p1a: Pikachu" && item.args[1] === "Tackle").length;
  const damageCount = parsed.filter(item => item.type === "-damage" && item.args[0] === "p2a: Charizard").length;
  if (moveCount !== 1 || damageCount !== 1) {
    throw new Error(`Runtime integration expected one move and one damage, got move=${moveCount}, damage=${damageCount}.`);
  }

  socket.close();
  await new Promise<void>(resolve => socket.once("close", () => resolve()));
  console.log("Showdown WebSocket runtime smoke test passed.");
} finally {
  runtime.kill("SIGTERM");
}
