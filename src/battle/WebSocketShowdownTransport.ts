import type { ShowdownBattleConfig, ShowdownTransport } from "./ShowdownAdapter";

interface RuntimeMessage {
  readonly type: "ready" | "showdown" | "error";
  readonly block?: string;
  readonly message?: string;
}

interface BlockWaiter {
  readonly resolve: (block: string) => void;
  readonly reject: (error: Error) => void;
  timeout: number;
}

export class WebSocketShowdownTransport implements ShowdownTransport {
  private socket: WebSocket | null = null;
  private readonly listeners = new Set<(block: string) => void>();
  private readonly bufferedBlocks: string[] = [];
  private readonly blockWaiters: BlockWaiter[] = [];
  private readyResolve: (() => void) | null = null;
  private readyReject: ((error: Error) => void) | null = null;
  private connecting=false;
  private closed=false;

  public constructor(private readonly url = (() => {
    const params = new URLSearchParams(window.location.search);
    const host = params.get("runtimeHost");
    const port = params.get("runtimePort") ?? "8787";
    if (host) return (window.location.protocol === "https:" ? "wss" : "ws") + "://" + host + ":" + port;
    return (window.location.protocol === "https:" ? "wss" : "ws") + "://" + window.location.host + "/showdown";
  })()) {}

  public async connect(config: ShowdownBattleConfig): Promise<void> {
    if (this.socket !== null || this.connecting) throw new Error("Showdown transport is already connected.");
    this.connecting=true;
    this.closed=false;

    const socket=new WebSocket(this.url);
    this.socket=socket;

    try{
      await new Promise<void>((resolve,reject)=>{
        let settled=false;
        const timeout=window.setTimeout(()=>{
          if(settled)return;
          settled=true;
          socket.removeEventListener("open",onOpen);
          socket.removeEventListener("error",onError);
          reject(new Error("Timed out connecting to the Showdown runtime."));
        },5000);
        const onOpen=():void=>{
          if(settled)return;
          settled=true;
          window.clearTimeout(timeout);
          socket.removeEventListener("error",onError);
          socket.addEventListener("message",this.handleMessage);
          socket.addEventListener("error",this.handleSocketError);
          socket.addEventListener("close",this.handleSocketClose);
          try{
            socket.send(JSON.stringify({type:"createBattle",config}));
            resolve();
          }catch{
            reject(new Error("Unable to send the battle creation request to the Showdown runtime."));
          }
        };
        const onError=():void=>{
          if(settled)return;
          settled=true;
          window.clearTimeout(timeout);
          socket.removeEventListener("open",onOpen);
          reject(new Error("Unable to connect to the Showdown runtime."));
        };
        socket.addEventListener("open",onOpen,{once:true});
        socket.addEventListener("error",onError,{once:true});
      });

      const ready=new Promise<void>((resolve,reject)=>{
        this.readyResolve=resolve;
        this.readyReject=reject;
      });
      await new Promise<void>((resolve,reject)=>{
        let settled=false;
        const timeout=window.setTimeout(()=>{
          if(settled)return;
          settled=true;
          reject(new Error("Timed out waiting for the Showdown runtime readiness handshake."));
        },5000);
        ready.then(()=>{
          if(settled)return;
          settled=true;
          window.clearTimeout(timeout);
          resolve();
        }).catch(error=>{
          if(settled)return;
          settled=true;
          window.clearTimeout(timeout);
          reject(error);
        });
      });
    }catch(error){
      await this.close();
      throw error;
    }finally{
      this.connecting=false;
    }
  }

  public async send(command:string):Promise<void>{
    if(this.socket===null||this.socket.readyState!==WebSocket.OPEN)throw new Error("Showdown transport is not connected.");
    try{
      this.socket.send(JSON.stringify({type:"command",command}));
    }catch{
      this.fail(new Error("Unable to send the battle command to the Showdown runtime."));
      throw new Error("Unable to send the battle command to the Showdown runtime.");
    }
  }

  public async waitForBlock():Promise<string>{
    const buffered=this.bufferedBlocks.shift();
    if(buffered!==undefined)return buffered;
    if(this.closed)throw new Error("Showdown transport is closed.");
    return new Promise<string>((resolve,reject)=>{
      const waiter:BlockWaiter={resolve,reject,timeout:0};
      waiter.timeout=window.setTimeout(()=>{
        const index=this.blockWaiters.indexOf(waiter);
        if(index>=0)this.blockWaiters.splice(index,1);
        reject(new Error("Timed out waiting for the Showdown runtime response."));
      },10000);
      this.blockWaiters.push(waiter);
    });
  }

  public async close():Promise<void>{
    const socket=this.socket;
    this.closed=true;
    this.socket=null;
    this.readyResolve=null;
    this.readyReject=null;
    for(const waiter of this.blockWaiters.splice(0)){
      window.clearTimeout(waiter.timeout);
      waiter.reject(new Error("Showdown transport closed."));
    }
    this.listeners.clear();
    if(!socket)return;

    socket.removeEventListener("message",this.handleMessage);
    socket.removeEventListener("error",this.handleSocketError);
    socket.removeEventListener("close",this.handleSocketClose);
    if(socket.readyState===WebSocket.CLOSED)return;
    try{socket.close();}catch{return;}
    await new Promise<void>(resolve=>{
      if(socket.readyState===WebSocket.CLOSED){resolve();return;}
      const timeout=window.setTimeout(resolve,1500);
      socket.addEventListener("close",()=>{
        window.clearTimeout(timeout);
        resolve();
      },{once:true});
    });
  }

  public onMessage(listener:(block:string)=>void):()=>void{
    this.listeners.add(listener);
    return ()=>this.listeners.delete(listener);
  }

  private readonly handleMessage=(event:MessageEvent):void=>{
    let message:RuntimeMessage;
    try{message=JSON.parse(String(event.data)) as RuntimeMessage;}
    catch{this.fail(new Error("Showdown runtime sent invalid JSON."));return;}

    if(message.type==="ready"){
      this.readyResolve?.();
      this.readyResolve=null;
      this.readyReject=null;
      return;
    }

    if(message.type==="showdown"&&typeof message.block==="string"){
      const waiter=this.blockWaiters.shift();
      if(waiter){
        window.clearTimeout(waiter.timeout);
        waiter.resolve(message.block);
      }
      else this.bufferedBlocks.push(message.block);
      for(const listener of this.listeners)listener(message.block);
      return;
    }

    if(message.type==="error")this.fail(new Error(message.message??"Unknown Showdown runtime error."));
  };

  private readonly handleSocketError=():void=>{
    this.fail(new Error("Showdown runtime WebSocket error."));
  };

  private readonly handleSocketClose=():void=>{
    this.fail(new Error("Showdown runtime WebSocket closed."));
  };

  private fail(error:Error):void{
    this.readyReject?.(error);
    this.readyResolve=null;
    this.readyReject=null;
    for(const waiter of this.blockWaiters.splice(0)){
      window.clearTimeout(waiter.timeout);
      waiter.reject(error);
    }
    if(this.socket&&this.socket.readyState!==WebSocket.CLOSED){
      try{this.socket.close();}catch(error){void error;}
    }
  }
}
