import {spawn} from "node:child_process";

const isWindows=process.platform==="win32";
const npm=isWindows?"npm.cmd":"npm";
const children=[];

function start(args){
  const child=spawn(npm,args,{stdio:"inherit",env:process.env});
  children.push(child);
  return child;
}

const server=start(["run","server"]);
const vite=start(["exec","vite","--host","127.0.0.1"]);

let shuttingDown=false;
function shutdown(code=0){
  if(shuttingDown)return;
  shuttingDown=true;
  for(const child of children){
    if(!child.killed)child.kill();
  }
  setTimeout(()=>process.exit(code),200);
}
server.on("exit",(code)=>{
  if(!shuttingDown && code && code!==0)shutdown(code);
});
vite.on("exit",(code)=>{
  if(!shuttingDown && code && code!==0)shutdown(code);
});
process.on("SIGINT",()=>shutdown(0));
process.on("SIGTERM",()=>shutdown(0));
