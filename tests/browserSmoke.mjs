import {spawn} from "node:child_process";
import WebSocket from "ws";

function start(command,args,env={}){
  return spawn(command,args,{env:{...process.env,...env},stdio:["ignore","pipe","pipe"]});
}
async function waitForRuntime(process){
  return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error("Showdown runtime did not announce its listening port.")),5000);
    const onData=chunk=>{
      const match=chunk.toString().match(/Showdown runtime listening on ws:\/\/localhost:(\d+)/);
      if(!match)return;
      clearTimeout(timeout); process.stdout.off("data",onData); resolve(Number(match[1]));
    };
    process.stdout.on("data",onData);
    process.once("error",reject);
    process.once("exit",code=>{if(code!==0)reject(new Error(`Showdown runtime exited before announcing its port: ${code}`));});
  });
}
async function waitHttp(url,timeout=10000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    try{const response=await fetch(url);if(response.ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}
async function waitDevToolsPort(){
  const deadline=Date.now()+10000;
  while(Date.now()<deadline){
    try{
      const response=await fetch("http://127.0.0.1:9222/json/version");
      if(response.ok)return 9222;
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error("Chromium did not expose DevTools on port 9222.");
}
async function cdp(ws,url){
  const socket=new WebSocket(ws);
  await new Promise((resolve,reject)=>{socket.once("open",resolve);socket.once("error",reject);});
  let nextId=0;
  const pending=new Map();
  const onMessage=raw=>{
    const message=JSON.parse(raw.toString());
    if(message.id===undefined)return;
    const entry=pending.get(message.id);
    if(!entry)return;
    pending.delete(message.id);
    clearTimeout(entry.timer);
    if(message.error)entry.reject(new Error(message.error.message));
    else entry.resolve(message.result);
  };
  socket.on("message",onMessage);
  const call=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++nextId;
    const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout: ${method}`));},15000);
    pending.set(id,{resolve,reject,timer});
    socket.send(JSON.stringify({id,method,params}));
  });
  await call("Page.enable");
  await call("Page.navigate",{url});
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{socket.off("message",onLoad);reject(new Error("Timed out waiting for page load."));},15000);
    const onLoad=raw=>{
      const message=JSON.parse(raw.toString());
      if(message.method!=="Page.loadEventFired")return;
      clearTimeout(timer);socket.off("message",onLoad);resolve();
    };
    socket.on("message",onLoad);
  });
  await call("Runtime.enable");
  return {socket,call};
}
const runtime=start(process.execPath,["node_modules/tsx/dist/cli.mjs","server/showdownRuntime.ts"],{PORT:"0"});
let vite=null;let chromium=null;let cdpSession=null;
try{
  const runtimePort=await waitForRuntime(runtime);
  vite=start(process.execPath,["node_modules/vite/bin/vite.js","--host","127.0.0.1"],{PORT:"5173",SHOWDOWN_PORT:String(runtimePort)});
  await waitHttp("http://127.0.0.1:"+runtimePort+"/");
  await waitHttp("http://127.0.0.1:5173/");
  await waitHttp("http://127.0.0.1:5173/api/dex?generation=9");

  chromium=start("chromium",[
    "--headless=new","--no-sandbox","--disable-dev-shm-usage",
    "--use-gl=swiftshader","--enable-unsafe-swiftshader",
    "--remote-debugging-port=9222","--remote-debugging-address=127.0.0.1",
    "--window-size=1440,900","about:blank"
  ]);
  const devToolsPort=await waitDevToolsPort(chromium);
  const targets=await (await fetch(`http://127.0.0.1:${devToolsPort}/json/list`)).json();
  const page=targets.find(target=>target.type==="page");
  if(!page?.webSocketDebuggerUrl)throw new Error("Chromium page target unavailable.");
  cdpSession=await cdp(page.webSocketDebuggerUrl,"http://127.0.0.1:5173/tests/browserHarness.html?browserSmoke=1");

  const deadline=Date.now()+45000;
  let title="";
  let detail="";
  while(Date.now()<deadline){
    const result=await cdpSession.call("Runtime.evaluate",{expression:"document.title",returnByValue:true});
    title=String(result.result?.value??"");
    if(title==="BROWSER_SMOKE_PASSED")break;
    if(title.startsWith("BROWSER_SMOKE_FAILED:")){detail=title;break;}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  if(title!=="BROWSER_SMOKE_PASSED")throw new Error(detail||`Browser smoke timeout; title=${title||"missing"}`);
  const canvas=await cdpSession.call("Runtime.evaluate",{expression:"Boolean(document.querySelector('.battle-canvas canvas'))",returnByValue:true});
  if(canvas.result?.value!==true)throw new Error("Three.js canvas was not present at completion.");
  console.log("Chromium browser/WebGL smoke test passed.");
}finally{
  cdpSession?.socket.close();
  vite?.kill("SIGTERM");
  runtime.kill("SIGTERM");
  chromium?.kill("SIGTERM");
}
