import {spawn} from "node:child_process";
import {rmSync} from "node:fs";

const PORT=9222;
const runtimePort=8787;
const browserData="/tmp/pokemon-3d-browser-smoke";
rmSync(browserData,{recursive:true,force:true});

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
function cdpClient(ws){
  let nextId=0;
  const pending=new Map();
  ws.addEventListener("message",event=>{
    const message=JSON.parse(String(event.data));
    const waiter=pending.get(message.id);
    if(!waiter)return;
    pending.delete(message.id);
    if(message.error)waiter.reject(new Error(JSON.stringify(message.error)));
    else waiter.resolve(message.result);
  });
  const call=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++nextId;
    pending.set(id,{resolve,reject});
    ws.send(JSON.stringify({id,method,params}));
  });
  return {call};
}
async function evaluate(cdp,expression){
  const result=await cdp.call("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true});
  if(result.exceptionDetails)throw new Error(result.exceptionDetails.text ?? "Browser evaluation failed.");
  return result.result?.value;
}
async function waitFor(cdp,expression,timeout=10000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    if(await evaluate(cdp,expression))return;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error(`Browser condition timed out: ${expression}`);
}

const runtime=start(process.execPath,["node_modules/tsx/dist/cli.mjs","server/showdownRuntime.ts"],{PORT:String(runtimePort)});
const vite=start(process.execPath,["node_modules/vite/bin/vite.js","--host","127.0.0.1"],{PORT:"5173"});
const chromium=start("chromium",[
  "--headless=new",
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--disable-background-networking",
  "--remote-debugging-address=127.0.0.1",
  `--remote-debugging-port=${PORT}`,
  "--use-gl=swiftshader",
  "--enable-unsafe-swiftshader",
  `--user-data-dir=${browserData}`,
  "about:blank",
]);

try{
  await waitHttp(`http://127.0.0.1:${runtimePort}/`);
  await waitHttp("http://127.0.0.1:5173/");

  let version;
  await waitHttp(`http://127.0.0.1:${PORT}/json/version`);
  version=await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
  const ws=new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.addEventListener("open",resolve,{once:true});ws.addEventListener("error",reject,{once:true});});
  const cdp=cdpClient(ws);
  const target=await cdp.call("Target.createTarget",{url:"http://127.0.0.1:5173/"});
  const pageWs=await (async()=>{
    const deadline=Date.now()+5000;
    while(Date.now()<deadline){
      const targets=await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const match=targets.find(item=>item.id===target.targetId);
      if(match)return match.webSocketDebuggerUrl;
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    throw new Error("Browser target did not become available.");
  })();
  ws.close();
  const pageSocket=new WebSocket(pageWs);
  await new Promise((resolve,reject)=>{pageSocket.addEventListener("open",resolve,{once:true});pageSocket.addEventListener("error",reject,{once:true});});
  const page=cdpClient(pageSocket);
  await page.call("Runtime.enable");
  await page.call("Page.enable");

  await waitFor(page,'document.querySelector("#app") !== null');
  await evaluate(page,'document.querySelector("[data-action=\\\"start\\\"]").click()');
  await waitFor(page,'document.querySelector("[data-action=\\\"generation\\\"][data-value=\\\"9\\\"]") !== null');
  await evaluate(page,'document.querySelector("[data-action=\\\"generation\\\"][data-value=\\\"9\\\"]").click()');
  await waitFor(page,'document.querySelector("[data-action=\\\"species\\\"][data-value=\\\"pikachu\\\"]") !== null');
  await evaluate(page,'document.querySelector("[data-action=\\\"species\\\"][data-value=\\\"pikachu\\\"]").click()');
  await waitFor(page,'document.querySelector("[data-action=\\\"next\\\"]") !== null');
  await evaluate(page,'document.querySelector("[data-action=\\\"next\\\"]").click()');
  await waitFor(page,'document.querySelector("[data-action=\\\"form\\\"][data-value=\\\"pikachu\\\"]") !== null');
  await evaluate(page,'document.querySelector("[data-action=\\\"form\\\"][data-value=\\\"pikachu\\\"]").click()');
  await waitFor(page,'document.querySelector("[data-action=\\\"gender\\\"]") !== null');
  await evaluate(page,'document.querySelector("[data-action=\\\"gender\\\"][data-value=\\\"male\\\"]").click()');
  await waitFor(page,'document.querySelector("[data-action=\\\"shiny\\\"][data-value=\\\"false\\\"]") !== null');
  await evaluate(page,'document.querySelector("[data-action=\\\"shiny\\\"][data-value=\\\"false\\\"]").click()');
  await waitFor(page,'document.querySelector("[data-action=\\\"ability\\\"]") !== null');
  await evaluate(page,'document.querySelector("[data-action=\\\"ability\\\"]").click()');
  await waitFor(page,'document.querySelector("[data-action=\\\"item\\\"][data-value=\\\"\\\"]") !== null');
  await evaluate(page,'document.querySelector("[data-action=\\\"item\\\"][data-value=\\\"\\\"]").click()');
  await waitFor(page,'document.querySelector("#level") !== null');
  await evaluate(page,'document.querySelector("[data-action=\\\"level\\\"]").click()');
  await waitFor(page,'document.querySelectorAll("[data-action=\\\"move\\\"]").length >= 4');
  await evaluate(page,'Array.from(document.querySelectorAll("[data-action=\\\"move\\\"]")).slice(0,4).forEach(button=>button.click())');
  await waitFor(page,'document.querySelector("[data-action=\\\"battle\\\"]")?.disabled === false');
  await evaluate(page,'document.querySelector("[data-action=\\\"battle\\\"]").click()');
  await waitFor(page,'document.querySelector(".battle-screen") !== null',15000);
  await waitFor(page,'document.querySelector(".battle-canvas canvas") !== null',10000);
  await waitFor(page,'document.querySelectorAll(".move-grid button").length === 4',10000);
  const before=await evaluate(page,'document.querySelector("#opponent-hp")?.textContent ?? ""');
  await evaluate(page,'document.querySelector(".move-grid button").click()');
  await waitFor(page,'document.querySelector("#opponent-hp")?.textContent !== "" && document.querySelector("#opponent-hp")?.textContent !== '+JSON.stringify(before),15000);
  const after=await evaluate(page,'document.querySelector("#opponent-hp")?.textContent ?? ""');
  if(before===after)throw new Error(`Browser battle HP did not change: ${before}`);
  console.log(`Browser/WebGL smoke passed: opponent HP ${before} -> ${after}`);
}finally{
  chromium.kill("SIGTERM");
  vite.kill("SIGTERM");
  runtime.kill("SIGTERM");
}
