import {spawn} from "node:child_process";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const node = process.execPath;
const tsxCli = resolve(root, "node_modules", "tsx", "dist", "cli.mjs");
const viteCli = resolve(root, "node_modules", "vite", "bin", "vite.js");
const children = [];

function start(script, args = [], env = process.env) {
  const child = spawn(node, [script, ...args], {
    cwd: root,
    stdio: "inherit",
    env,
    windowsHide: false,
  });
  children.push(child);
  return child;
}

const server = start(tsxCli, ["server/showdownRuntime.ts"]);
const vite = start(viteCli, ["--host", "127.0.0.1"], {
  ...process.env,
  SHOWDOWN_HOST: "127.0.0.1",
  SHOWDOWN_PORT: process.env.SHOWDOWN_PORT ?? "8787",
});

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  setTimeout(() => process.exit(code), 250);
}

server.on("error", error => {
  console.error("Showdown runtime failed to start:", error);
  shutdown(1);
});

vite.on("error", error => {
  console.error("Vite failed to start:", error);
  shutdown(1);
});

server.on("exit", (code, signal) => {
  if (!shuttingDown) {
    console.error(`Showdown runtime exited (code=${code ?? "null"}, signal=${signal ?? "null"}).`);
    shutdown(code && code !== 0 ? code : 1);
  }
});

vite.on("exit", (code, signal) => {
  if (!shuttingDown) {
    console.error(`Vite exited (code=${code ?? "null"}, signal=${signal ?? "null"}).`);
    shutdown(code && code !== 0 ? code : 1);
  }
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
