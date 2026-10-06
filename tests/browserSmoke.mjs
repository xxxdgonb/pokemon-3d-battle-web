import {spawn} from "node:child_process";
import {WebSocket} from "ws";

function start(command,args,env={}){
  return spawn(command,args,{env:{...process.env,...env},stdio:["ignore","pipe","pipe"]});
}
async function verifyWebSocketProxy(){
  const socket=new WebSocket("ws://127.0.0.1:5173/showdown");
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error("Timed out connecting to Vite Showdown WebSocket proxy.")),5000);
    socket.once("open",()=>socket.send(JSON.stringify({type:"createBattle",config:{generation:9,player:{id:"p1",speciesId:"pikachu",formId:"base",gender:"male",shiny:false,level:50,abilityId:"static",heldItemId:null,hp:100,maxHp:100,status:null,moves:[{moveId:"tackle",pp:35,maxPp:35}]},opponent:{id:"p2",speciesId:"charizard",formId:"base",gender:"male",shiny:false,level:50,abilityId:"blaze",heldItemId:null,hp:100,maxHp:100,status:null,moves:[{moveId:"tackle",pp:35,maxPp:35}]}}})));
    socket.on("message",data=>{const message=JSON.parse(data.toString());if(message.type!=="ready")return;clearTimeout(timeout);socket.close();resolve();});
    socket.once("error",reject);
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

const runtime=start(process.execPath,["node_modules/tsx/dist/cli.mjs","server/showdownRuntime.ts"],{PORT:"8787"});
const vite=start(process.execPath,["node_modules/vite/bin/vite.js","--host","127.0.0.1"],{PORT:"5173"});

try{
  await waitHttp("http://127.0.0.1:8787/");
  await waitHttp("http://127.0.0.1:5173/");
  await verifyWebSocketProxy();

  const chromium=start("chromium",[
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-gl=swiftshader",
    "--enable-unsafe-swiftshader",
    "--virtual-time-budget=12000",
    "--run-all-compositor-stages-before-draw",
    "--dump-dom",
    "http://127.0.0.1:5173/tests/browserHarness.html?browserSmoke=1&runtimeHost=127.0.0.1&runtimeHost=127.0.0.1",
  ]);

  const chunks=[];
  const errors=[];
  chromium.stdout.on("data",chunk=>chunks.push(chunk.toString()));
  chromium.stderr.on("data",chunk=>errors.push(chunk.toString()));
  const code=await new Promise(resolve=>chromium.once("exit",resolve));
  const html=chunks.join("");
  if(code!==0)throw new Error(`Chromium exited with code ${code}: ${errors.join("").slice(-2000)}`);
  const result=html.match(/<title>(BROWSER_SMOKE_[^<]*)<\/title>/)?.[1] ?? "";
  if(result!=="BROWSER_SMOKE_PASSED"){
    const bodyStart=html.indexOf("<body");
    const bodyEnd=html.lastIndexOf("</body>");
    const bodyText=bodyStart>=0 ? html.slice(bodyStart,bodyEnd>=0 ? bodyEnd : undefined) : html;
    throw new Error(`Browser UI smoke did not pass: title=${result||"missing"} html-tail=${bodyText.slice(-3000)}`);
  }
  console.log("Chromium browser/WebGL smoke test passed.");
}finally{
  vite.kill("SIGTERM");
  runtime.kill("SIGTERM");
}
