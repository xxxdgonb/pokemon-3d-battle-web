/* global window, document, HTMLButtonElement, setTimeout */

let browserError=null;
window.addEventListener("error",event=>{browserError=String(event.error?.message ?? event.message);});
window.addEventListener("unhandledrejection",event=>{browserError=String(event.reason?.message ?? event.reason);});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(selector,timeout=10000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    const node=document.querySelector(selector);
    if(node)return node;
    await sleep(50);
  }
  throw new Error("Timed out waiting for "+selector);
}
async function click(selector){
  const node=await waitFor(selector);
  if(node instanceof HTMLButtonElement && node.disabled)throw new Error("Cannot click disabled control: "+selector);
  node.click();
  await sleep(80);
}
async function waitForBattleReady(timeout=15000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    const buttons=Array.from(document.querySelectorAll(".move-grid button"));
    if(buttons.some(button=>!button.disabled && /PP \d+\//.test(button.textContent ?? "")))return;
    await sleep(100);
  }
  throw new Error("Battle controls did not become ready within the timeout.");
}
async function main(){
  document.body.dataset.browserSmokeStep="importing-app";
  await import("/src/main.ts");
  await waitFor("#app");
  const mark=step=>{document.body.dataset.browserSmokeStep=step;};
  mark("start");
  for(const generation of [1,2,3,4,5,6,7,8,9]){
    mark("generation-"+generation+"-start");
    if(generation===1)await click('[data-action="start"]');
    mark("generation-"+generation+"-select");
    await click(`[data-action="generation"][data-value="${generation}"]`);
    mark("generation-"+generation+"-loading");
    await waitFor('[data-action="species"]');

    if(!document.querySelector('[data-action="species"][data-value="pikachu"]')){
      throw new Error("Generation "+generation+" did not expose Pikachu species data.");
    }
    const expectedNationalDex=[0,151,251,386,493,649,721,809,905,1025][generation];
    const pokemonContent=document.querySelector("#content")?.textContent ?? "";
    if(!pokemonContent.includes(expectedNationalDex+" base species in this generation")){
      throw new Error("Generation "+generation+" Dex count mismatch; expected "+expectedNationalDex+".");
    }
    const activeGeneration=document.querySelector('[data-action="generation"][data-value="'+generation+'"]');
    if(activeGeneration?.getAttribute("aria-current")!=="true"){
      throw new Error("Generation "+generation+" did not become the active selection.");
    }
    mark("generation-"+generation+"-verified");
    if(generation!==9){
      await click('[data-action="back"]');
      await waitFor('[data-action="generation"][data-value="1"]');
    }
  }
  mark("configure-species");
  await click('[data-action="species"][data-value="pikachu"]');
  await click('[data-action="next"]');
  const formButton=document.querySelector('[data-action="form"][data-value="pikachu"]');
  if(formButton)await click('[data-action="form"][data-value="pikachu"]');
  else await click('[data-action="next"]');
  mark("configure-gender");
  await click('[data-action="gender"][data-value="male"]');
  await click('[data-action="shiny"][data-value="false"]');
  mark("configure-ability");
  await click('[data-action="ability"]');
  mark("configure-level");
  await click('[data-action="item"][data-value=""]');
  await click('[data-action="level"]');
  await waitFor('.move-picker [data-action="move"]');
  for(let i=0;i<4;i++){
    const move=document.querySelector('.move-picker [data-action="move"]:not(.selected)');
    if(!move)throw new Error("Move picker lost its next selectable move at slot "+(i+1)+".");
    move.click();
    await sleep(80);
  }
  mark("starting-battle");
  const battleButton=await waitFor('[data-action="battle"]');
  if(battleButton instanceof HTMLButtonElement && battleButton.disabled)throw new Error("Enter 3D Battle remained disabled after four move selections.");
  await click('[data-action="battle"]');
  await waitFor(".battle-screen",30000);
  await waitForBattleReady(30000);
  await waitFor(".battle-canvas canvas",30000);
  mark("battle-rendered-check");
  const battleScreen=document.querySelector(".battle-screen");
  const canvas=document.querySelector(".battle-canvas canvas");
  const moveButtons=Array.from(document.querySelectorAll(".move-grid button"));
  if(!battleScreen || !canvas || moveButtons.length===0){
    throw new Error("Battle UI did not finish rendering.");
  }
  for(let turn=0;turn<20;turn++){
    const result=document.querySelector(".battle-result");
    if(result)break;
    const button=Array.from(document.querySelectorAll(".move-grid button")).find(node=>!node.disabled && /Power \d+/.test(node.textContent ?? ""));
    if(!button)throw new Error("Damaging move button disappeared before battle ended.");
    button.click();
    const turnDeadline=Date.now()+15000;
    while(Date.now()<turnDeadline){
      const after=document.querySelector("#opponent-hp")?.textContent ?? "";
      const enabled=!button.disabled;
      if(document.querySelector(".battle-result")){break;}
      if(enabled && after){break;}
      await sleep(50);
    }
    if(!document.querySelector(".battle-result") && button.disabled){
      throw new Error("Move transaction did not complete on turn "+(turn+1)+".");
    }
  }
  if(!document.querySelector(".battle-result"))throw new Error("Battle did not reach a terminal victory/defeat state.");
  document.body.dataset.browserSmokeCanvas=String(Boolean(document.querySelector(".battle-canvas canvas")));
  const restart=document.querySelector('.battle-result button[data-action="restart-battle"]');
  if(!restart)throw new Error("Battle Again control was not rendered.");
  mark("battle-again");
  restart.click();
  await waitFor('[data-action="start"]',10000);
  document.body.dataset.browserSmoke="passed";
  document.title="BROWSER_SMOKE_PASSED";
  document.body.insertAdjacentHTML("beforeend",'<div id="browser-smoke-result">BROWSER_SMOKE_PASSED</div>');
}
main().catch(error=>{
  document.body.dataset.browserSmoke="failed";
  const detail=(document.body.innerText+"\\nERROR:"+String(error.message)+"\\nBROWSER:"+String(browserError??"none")+"\\nBATTLEDEBUG:"+String(document.body.dataset.battleDebug??"none")+"\\nRUNTIMECMD:"+String(document.body.dataset.runtimeLastCommand??"none")+"\\nRUNTIMEMSG:"+String(document.body.dataset.runtimeLastMessage??"none")+"\\nRUNTIMEERR:"+String(document.body.dataset.runtimeError??"none")+"\\nRUNTIMECONNECT:"+String(document.body.dataset.runtimeConnect??"none")+"\\nLASTACTION:"+String(document.body.dataset.lastAction??"none")+"\\nLASTVALUE:"+String(document.body.dataset.lastActionValue??"none")).slice(-3000).replace(/[<>&]/g,"");
  document.title="BROWSER_SMOKE_FAILED:"+detail;
});
