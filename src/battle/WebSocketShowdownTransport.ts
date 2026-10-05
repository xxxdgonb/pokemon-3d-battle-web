import type { ShowdownBattleConfig, ShowdownTransport } from "./ShowdownAdapter";

interface RuntimeMessage {
  readonly type: "ready" | "showdown" | "error";
  readonly block?: string;
  readonly message?: string;
}

export class WebSocketShowdownTransport implements ShowdownTransport {
  private socket: WebSocket | null = null;
  private readonly listeners = new Set<(block: string) => void>();
  private readonly bufferedBlocks: string[] = [];

  public constructor(private readonly url = "ws://localhost:8787") {}

  public async connect(config: ShowdownBattleConfig): Promise<void> {
    if (this.socket !== null) throw new Error("Showdown transport is already connected.");

    const socket = new WebSocket(this.url);
    this.socket = socket;

    await new Promise<void>((resolve, reject) => {
      const onOpen = (): void => {
        socket.removeEventListener("error", onError);
        socket.addEventListener("message", this.handleMessage);
        socket.send(JSON.stringify({type: "createBattle", config}));
        resolve();
      };
      const onError = (): void => {
        socket.removeEventListener("open", onOpen);
        reject(new Error("Unable to connect to the Showdown runtime."));
      };
      socket.addEventListener("open", onOpen, {once: true});
      socket.addEventListener("error", onError, {once: true});
    });
  }

  public async send(command: string): Promise<void> {
    if (this.socket === null || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("Showdown transport is not connected.");
    }
    this.socket.send(JSON.stringify({type: "command", command}));
  }

  public async close(): Promise<void> {
    const socket = this.socket;
    this.socket = null;
    if (!socket) return;

    socket.removeEventListener("message", this.handleMessage);
    socket.close();
    await new Promise<void>((resolve) => {
      if (socket.readyState === WebSocket.CLOSED) {
        resolve();
        return;
      }
      socket.addEventListener("close", () => resolve(), {once: true});
    });
  }

  public onMessage(listener: (block: string) => void): () => void {
    this.listeners.add(listener);
    for (const block of this.bufferedBlocks.splice(0)) listener(block);
    return () => this.listeners.delete(listener);
  }

  private readonly handleMessage = (event: MessageEvent): void => {
    const message = JSON.parse(String(event.data)) as RuntimeMessage;
    if (message.type === "showdown" && typeof message.block === "string") {
      if (this.listeners.size === 0) {
        this.bufferedBlocks.push(message.block);
      } else {
        for (const listener of this.listeners) listener(message.block);
      }
      return;
    }
    if (message.type === "error") {
      console.error("Showdown runtime:", message.message ?? "Unknown runtime error.");
    }
  };
}
