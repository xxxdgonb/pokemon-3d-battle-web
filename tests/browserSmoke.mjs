import {Buffer} from "node:buffer";
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
let vite=null; let driver=null; let sessionId="";
async function waitDriver(timeout=10000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    try{const response=await fetch("http://127.0.0.1:9515/status"); if(response.ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error("ChromeDriver did not start.");
}
async function driverRequest(path,options={}){
  const response=await fetch("http://127.0.0.1:9515"+path,{headers:{"content-type":"application/json"},...options});
  const body=await response.json();
  if(!response.ok || body.value?.error)throw new Error(JSON.stringify(body));
  return body.value;
}
try{
  const runtimePort=await waitForRuntime(runtime);
  vite=start(process.execPath,["node_modules/vite/bin/vite.js","--host","127.0.0.1"],{PORT:"5173",SHOWDOWN_PORT:String(runtimePort)});
  await waitHttp("http://127.0.0.1:"+runtimePort+"/");
  await waitHttp("http://127.0.0.1:5173/");
  await waitHttp("http://127.0.0.1:5173/api/dex?generation=9");
  driver=start("chromedriver",["--port=9515","--url-base=/"]);
  await waitDriver();
  const capabilities={browserName:"chrome","goog:chromeOptions":{binary:"/usr/bin/chromium",args:["--headless=new","--no-sandbox","--disable-dev-shm-usage","--use-gl=swiftshader","--enable-unsafe-swiftshader","--window-size=1440,900"]}};
  const session=await driverRequest("/session",{method:"POST",body:JSON.stringify({capabilities:{alwaysMatch:capabilities}})});
  sessionId=session.sessionId;
  await driverRequest("/session/"+sessionId+"/url",{method:"POST",body:JSON.stringify({url:"http://127.0.0.1:5173/tests/browserHarness.html?browserSmoke=1"})});
  const deadline=Date.now()+60000; let title="";
  while(Date.now()<deadline){
    const result=await driverRequest("/session/"+sessionId+"/execute/sync",{method:"POST",body:JSON.stringify({script:"return document.title;",args:[]})});
    title=String(result);
    if(title==="BROWSER_SMOKE_PASSED" || title.startsWith("BROWSER_SMOKE_FAILED:"))break;
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  if(title!=="BROWSER_SMOKE_PASSED")throw new Error(title||"Browser smoke timeout.");
  const canvas=await driverRequest("/session/"+sessionId+"/execute/sync",{method:"POST",body:JSON.stringify({script:"return document.querySelectorAll(\"canvas\").length > 0;",args:[]})});
  if(canvas!==true)throw new Error("Three.js canvas was not present at completion.");
  console.log("Chromium browser/WebGL smoke test passed.");
}finally{
  if(sessionId){try{await driverRequest("/session/"+sessionId,{method:"DELETE"});}catch{}}
  driver?.kill("SIGTERM"); vite?.kill("SIGTERM"); runtime.kill("SIGTERM");
}
