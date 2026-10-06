import {spawn} from "node:child_process";

function start(command,args,env={}){
  return spawn(command,args,{env:{...process.env,...env},stdio:["ignore","pipe","pipe"]});
}
async function waitHttp(url,timeout=10000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    try{const response=await fetch(url);if(response.ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

const runtime=start(process.execPath,["node_modules/tsx/dist/cli.mjs","server/showdownRuntime.ts"],{PORT:"8791"});
const vite=start(process.execPath,["node_modules/vite/bin/vite.js","--host","127.0.0.1"],{PORT:"5173",SHOWDOWN_PORT:"8791"});

try{
  await waitHttp("http://127.0.0.1:8791/");
  await waitHttp("http://127.0.0.1:5173/");
 
  const chromium=start("chromium",[
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-gl=swiftshader",
    "--enable-unsafe-swiftshader",
    "--virtual-time-budget=60000",
    "--timeout=60000",
    "--run-all-compositor-stages-before-draw",
    "--dump-dom",
    "http://127.0.0.1:5173/tests/browserHarness.html?browserSmoke=1&runtimeHost=127.0.0.1&runtimePort=8791",
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
