import {spawn} from "node:child_process";
import net from "node:net";

async function freePort(){return new Promise((resolve,reject)=>{const server=net.createServer();server.once("error",reject);server.listen(0,"127.0.0.1",()=>{const address=server.address();const port=typeof address==="object"&&address?address.port:0;server.close(error=>error?reject(error):resolve(port));});});}

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
const runtime=start(process.execPath,["node_modules/tsx/dist/cli.mjs","server/showdownRuntime.ts"],{PORT:"0"});
let vite=null; let driver=null; let sessionId="";
const vitePort=await freePort();
const driverPort=await freePort();
async function waitDriver(timeout=10000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    try{const response=await fetch("http://127.0.0.1:"+driverPort+"/status"); if(response.ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error("ChromeDriver did not start.");
}
async function driverRequest(path,options={}){
  const response=await fetch("http://127.0.0.1:"+driverPort+path,{headers:{"content-type":"application/json"},...options});
  const body=await response.json();
  if(!response.ok || body.value?.error)throw new Error(JSON.stringify(body));
  return body.value;
}
try{
  const runtimePort=await waitForRuntime(runtime);
  vite=start(process.execPath,["node_modules/vite/bin/vite.js","--host","127.0.0.1","--port",String(vitePort),"--strictPort"],{PORT:String(vitePort),SHOWDOWN_PORT:String(runtimePort)});
  await waitHttp("http://127.0.0.1:"+runtimePort+"/");
  await waitHttp("http://127.0.0.1:"+vitePort+"/");
  await waitHttp("http://127.0.0.1:"+vitePort+"/api/dex?generation=9");
  await waitHttp("http://127.0.0.1:"+vitePort+"/src/main.ts");
  await waitHttp("http://127.0.0.1:"+vitePort+"/src/ui/App.ts");
  driver=start("chromedriver",["--port="+driverPort,"--url-base=/"]);
  await waitDriver();
  const capabilities={browserName:"chrome",pageLoadStrategy:"none","goog:chromeOptions":{binary:"/usr/bin/chromium",args:["--headless=new","--no-sandbox","--disable-dev-shm-usage","--use-gl=swiftshader","--enable-unsafe-swiftshader","--window-size=1440,900"]}};
  const session=await driverRequest("/session",{method:"POST",body:JSON.stringify({capabilities:{alwaysMatch:capabilities}})});
  sessionId=session.sessionId;
  await driverRequest("/session/"+sessionId+"/url",{method:"POST",body:JSON.stringify({url:"http://127.0.0.1:"+vitePort+"/tests/browserHarness.html?browserSmoke=1"})});
  const deadline=Date.now()+60000; let title="";
  while(Date.now()<deadline){
    const result=await driverRequest("/session/"+sessionId+"/execute/sync",{method:"POST",body:JSON.stringify({script:"return document.title;",args:[]})});
    title=String(result);
    if(title==="BROWSER_SMOKE_PASSED" || title.startsWith("BROWSER_SMOKE_FAILED:"))break;
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  if(title!=="BROWSER_SMOKE_PASSED"){
    let diagnostic="unknown";
    try{
      diagnostic=String(await driverRequest("/session/"+sessionId+"/execute/sync",{method:"POST",body:JSON.stringify({script:"return JSON.stringify({url:location.href,readyState:document.readyState,title:document.title,step:document.body?.dataset.browserSmokeStep??null,body:document.body?.innerText.slice(-2000)??null,datasets:document.body?{...document.body.dataset}:{}});",args:[]})}));
    }catch(error){diagnostic=String(error);}
    throw new Error((title&&title!=="Pokémon 3D Battle Browser Smoke"?title:"Browser smoke timeout.")+" | diagnostic="+diagnostic);
  }
  const canvas=await driverRequest("/session/"+sessionId+"/execute/sync",{method:"POST",body:JSON.stringify({script:"return document.body.dataset.browserSmokeCanvas === \"true\";",args:[]})});
  if(canvas!==true)throw new Error("Three.js canvas was not present at completion.");
  console.log("Chromium browser/WebGL smoke test passed.");
}finally{
  if(sessionId){try{await driverRequest("/session/"+sessionId,{method:"DELETE"});}catch{}}
  driver?.kill("SIGTERM"); vite?.kill("SIGTERM"); runtime.kill("SIGTERM");
}
