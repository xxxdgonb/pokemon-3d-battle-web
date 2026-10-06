import type { ShowdownBattleConfig, ShowdownTransport } from "./ShowdownAdapter";

interface RuntimeMessage {
  readonly type: "ready" | "showdown" | "error";
  readonly block?: string;
  readonly message?: string;
}

interface BlockWaiter {
  readonly resolve: (block: string) => void;
  readonly reject: (error: Error) => void;
}

export class WebSocketShowdownTransport implements ShowdownTransport {
  private socket: WebSocket | null = null;
  private readonly listeners = new Set<(block: string) => void>();
  private readonly bufferedBlocks: string[] = [];
  private readonly blockWaiters: BlockWaiter[] = [];
  private readyResolve: (() => void) | null = null;
  private readyReject: ((error: Error) => void) | null = null;

  public constructor(private readonly url = (() => { const params=new URLSearchParams(window.location.search); const host=params.get("runtimeHost"); if(host)return `${window.location.protocol === "https:" ? "wss" : "ws"}://${host}:8787`; return `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/showdown`; })()) {}

  public async connect(config: ShowdownBattleConfig): Promise<void> {
    if (this.socket !== null) throw new Error("Showdown transport is already connected.");

    const socket = new WebSocket(this.url);
    this.socket = socket;

    const ready = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });

    await Promise.race([new Promise<void>((resolve, reject) => {
      const onOpen = (): void => {
        socket.removeEventListener("error", onError);
        socket.addEventListener("message", this.handleMessage);
        socket.addEventListener("error", this.handleSocketError);
        socket.addEventListener("close", this.handleSocketClose);
        socket.send(JSON.stringify({type: "createBattle", config}));
        resolve();
      };
      const onError = (): void => {
        socket.removeEventListener("open", onOpen);
        reject(new Error("Unable to connect to the Showdown runtime."));
      };
      socket.addEventListener("open", onOpen, {once: true});
      socket.addEventListener("error", onError, {once: true});
    }),new Promise<void>((_,reject)=>window.setTimeout(()=>reject(new Error("Timed out connecting to the Showdown runtime.")),5000))]);

    await Promise.race([ready,new Promise<void>((_,reject)=>window.setTimeout(()=>reject(new Error("Timed out waiting for the Showdown runtime readiness handshake.")),5000))]);
  }

  public async send(command: string): Promise<void> {
    if (this.socket === null || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("Showdown transport is not connected.");
    }
    this.socket.send(JSON.stringify({type: "command", command}));
  }

  public async waitForBlock(): Promise<string> {
    const buffered = this.bufferedBlocks.shift();
    if (buffered !== undefined) return buffered;

    return new Promise<string>((resolve, reject) => {
      this.blockWaiters.push({resolve, reject});
    });
  }

  public async close(): Promise<void> {
    const socket = this.socket;
    this.socket = null;
    this.readyResolve = null;
    this.readyReject = null;
    if (!socket) return;

    socket.removeEventListener("message", this.handleMessage);
    socket.removeEventListener("error", this.handleSocketError);
    socket.removeEventListener("close", this.handleSocketClose);
    const error = new Error("Showdown transport closed.");
    for (const waiter of this.blockWaiters.splice(0)) waiter.reject(error);
    socket.close();
    if (socket.readyState !== WebSocket.CLOSED) {
      await new Promise<void>((resolve) => socket.addEventListener("close", () => resolve(), {once: true}));
    }
  }

  public onMessage(listener: (block: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private readonly handleMessage = (event: MessageEvent): void => {
    let message: RuntimeMessage;
    try {
      message = JSON.parse(String(event.data)) as RuntimeMessage;
    } catch {
      this.fail(new Error("Showdown runtime sent invalid JSON."));
      return;
    }

    if (new URLSearchParams(window.location.search).get("browserSmoke") === "1") {
      document.body.dataset.runtimeLastMessage = message.type + (message.block ? ":" + message.block.slice(0, 160) : message.message ? ":" + message.message : "");
    }

    if (message.type === "ready") {
      this.readyResolve?.();
      this.readyResolve = null;
      this.readyReject = null;
      return;
    }

    if (message.type === "showdown" && typeof message.block === "string") {
      const waiter = this.blockWaiters.shift();
      if (waiter) waiter.resolve(message.block);
      else this.bufferedBlocks.push(message.block);
      for (const listener of this.listeners) listener(message.block);
      return;
    }

    if (message.type === "error") {
      this.fail(new Error(message.message ?? "Unknown Showdown runtime error."));
    }
  };

  private readonly handleSocketError = (): void => {
    this.fail(new Error("Showdown runtime WebSocket error."));
  };

  private readonly handleSocketClose = (): void => {
    this.fail(new Error("Showdown runtime WebSocket closed."));
  };

  private fail(error: Error): void {
    if (new URLSearchParams(window.location.search).get("browserSmoke") === "1") {
      document.body.dataset.runtimeError = error.message;
    }
    this.readyReject?.(error);
    this.readyResolve = null;
    this.readyReject = null;
    for (const waiter of this.blockWaiters.splice(0)) waiter.reject(error);
  };
}
