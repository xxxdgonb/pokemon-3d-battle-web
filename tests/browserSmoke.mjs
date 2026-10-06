import {spawn} from "node:child_process";

function start(command,args,env={}){
  return spawn(command,args,{env:{...process.env,...env},stdio:["ignore","pipe","pipe","pipe","pipe"]});
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
function cdpPipe(process){
  const output=process.stdio[3]; const input=process.stdio[4];
  let nextId=0; let buffer=Buffer.alloc(0); const pending=new Map();
  input.on("data",chunk=>{
    buffer=Buffer.concat([buffer,chunk]);
    while(buffer.length>=4){
      const length=buffer.readUInt32LE(0); if(buffer.length<length+4)return;
      const message=JSON.parse(buffer.subarray(4,length+4).toString()); buffer=buffer.subarray(length+4);
      const entry=pending.get(message.id); if(!entry)continue;
      pending.delete(message.id); clearTimeout(entry.timer);
      if(message.error)entry.reject(new Error(message.error.message)); else entry.resolve(message.result);
    }
  });
  const call=(method,params={},sessionId)=>new Promise((resolve,reject)=>{
    const id=++nextId; const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout: ${method}`));},15000);
    pending.set(id,{resolve,reject,timer}); const body=Buffer.from(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
    const packet=Buffer.alloc(body.length+4); packet.writeUInt32LE(body.length,0); body.copy(packet,4); output.write(packet);
  });
  return {call};
}
const runtime=start(process.execPath,["node_modules/tsx/dist/cli.mjs","server/showdownRuntime.ts"],{PORT:"0"});
let vite=null;let chromium=null;
try{
  const runtimePort=await waitForRuntime(runtime);
  vite=start(process.execPath,["node_modules/vite/bin/vite.js","--host","127.0.0.1"],{PORT:"5173",SHOWDOWN_PORT:String(runtimePort)});
  await waitHttp("http://127.0.0.1:"+runtimePort+"/");
  await waitHttp("http://127.0.0.1:5173/");
  await waitHttp("http://127.0.0.1:5173/api/dex?generation=9");

  chromium=start("chromium",[
    "--headless=new","--no-sandbox","--disable-dev-shm-usage",
    "--use-gl=swiftshader","--enable-unsafe-swiftshader",
    "--remote-debugging-pipe",
    "--window-size=1440,900","about:blank"
  ]);
  const pipe=cdpPipe(chromium);
  const targets=await pipe.call("Target.getTargets");
  const page=targets.targetInfos?.find(target=>target.type==="page");
  if(!page?.targetId)throw new Error("Chromium page target unavailable.");
  const attached=await pipe.call("Target.attachToTarget",{targetId:page.targetId,flatten:true});
  const sessionId=attached.sessionId;
  await pipe.call("Page.enable",{},sessionId);
  await pipe.call("Runtime.enable",{},sessionId);
  await pipe.call("Page.navigate",{url:"http://127.0.0.1:5173/tests/browserHarness.html?browserSmoke=1"},sessionId);

  const deadline=Date.now()+45000;
  let title="";
  let detail="";
  while(Date.now()<deadline){
    const result=await pipe.call("Runtime.evaluate",{expression:"document.title",returnByValue:true},sessionId);
    title=String(result.result?.value??"");
    if(title==="BROWSER_SMOKE_PASSED")break;
    if(title.startsWith("BROWSER_SMOKE_FAILED:")){detail=title;break;}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  if(title!=="BROWSER_SMOKE_PASSED")throw new Error(detail||`Browser smoke timeout; title=${title||"missing"}`);
  const canvas=await pipe.call("Runtime.evaluate",{expression:"Boolean(document.querySelector('.battle-canvas canvas'))",returnByValue:true},sessionId);
  if(canvas.result?.value!==true)throw new Error("Three.js canvas was not present at completion.");
  console.log("Chromium browser/WebGL smoke test passed.");
}finally{

  vite?.kill("SIGTERM");
  runtime.kill("SIGTERM");
  chromium?.kill("SIGTERM");
}
