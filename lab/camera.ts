const canvas=document.querySelector<HTMLCanvasElement>('#camera')!;
const ctx=canvas.getContext('2d')!;
const image=new Image();image.src=new URL('./fixtures/player.png',import.meta.url).href;await image.decode();
let covered=false,offset=0,worker:Worker|null=null,busy=false,frames=0;
const status=document.querySelector('#status')!;
function draw(){ctx.fillStyle='#aaa';ctx.fillRect(0,0,960,640);if(!covered)ctx.drawImage(image,offset,0,960,640);requestAnimationFrame(draw);}draw();
async function infer(){if(!worker||busy)return;busy=true;const bitmap=await createImageBitmap(canvas);worker.postMessage({type:'frame',bitmap,timestamp:performance.now(),captureAt:performance.now(),playingHand:'left'},[bitmap]);}
async function start(){if(worker)return;status.textContent='Loading actual MediaPipe models…';worker=new Worker(new URL('../src/pose.worker.ts',import.meta.url),{type:'module'});worker.onmessage=({data})=>{if(data.type==='error'){status.textContent=data.error;busy=false;return;}if(data.type==='ready'){(window as any).labRuntime=data;status.textContent=JSON.stringify(data);setInterval(infer,100);}if(data.type==='result'){busy=false;frames++;const p=data.landmarks;const sample={frames,points:p.length,shoulderX:p.length?(p[11].x+p[12].x)/2:null,confidence:p.length?Math.min(...[11,12,23,24].map(i=>p[i].visibility??0)):0,processingMs:data.processingMs,landmarks:p};(window as any).labVision=sample;status.textContent=JSON.stringify({...sample,landmarks:undefined},null,2);} };worker.postMessage({type:'init',base:new URL('../pose-runtime/',location.href).href,delegate:'CPU',hands:true,waitHands:true});}
(document.querySelector('#start') as HTMLButtonElement).onclick=start;
(document.querySelector('#cover') as HTMLButtonElement).onclick=()=>{covered=!covered;};
(document.querySelector('#offset') as HTMLInputElement).oninput=e=>{offset=Number((e.target as HTMLInputElement).value);};
(window as any).labCamera={start,setOffset:(x:number)=>offset=x,cover:(value:boolean)=>covered=value,stream:()=>canvas.captureStream(30)};
