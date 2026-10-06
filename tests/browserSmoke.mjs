import {spawn} from "node:child_process";
import {createConnection} from "node:net";
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
async function waitDevToolsPort(process){
  return new Promise((resolve,reject)=>{
    let buffer="";
    const timeout=setTimeout(()=>reject(new Error("Chromium did not announce a DevTools endpoint.")),10000);
    const onData=chunk=>{
      buffer+=chunk.toString();
      const match=buffer.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//);
      if(match){clearTimeout(timeout);process.stderr.off("data",onData);resolve(Number(match[1]));}
    };
    process.stderr.on("data",onData);
    process.once("error",reject);
    process.once("exit",code=>{if(code!==0)reject(new Error(`Chromium exited before DevTools startup: ${code}`));});
  });
}
async function cdp(ws,url,method,params={}){
  const socket=new WebSocket(ws);
  await new Promise((resolve,reject)=>{socket.once("open",resolve);socket.once("error",reject);});
  let id=0;
  const call=(name,args={})=>new Promise((resolve,reject)=>{
    const requestId=++id;
    const timeout=setTimeout(()=>reject(new Error(`CDP timeout: ${name}`)),10000);
    const handler=raw=>{
      const message=JSON.parse(raw.toString());
      if(message.id!==requestId)return;
      clearTimeout(timeout);socket.off("message",handler);
      if(message.error)reject(new Error(message.error.message)); else resolve(message.result);
    };
    socket.on("message",handler);socket.send(JSON.stringify({id:requestId,method:name,params:args}));
  });
  await call("Page.enable");
  await call("Runtime.enable");
  await call("Page.navigate",{url});
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
    "--remote-debugging-port=0","--remote-debugging-address=127.0.0.1",
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
