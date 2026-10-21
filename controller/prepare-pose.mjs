import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const directory=new URL('../public/pose-runtime/',import.meta.url);
await fs.mkdir(directory,{recursive:true});
const model=new URL('pose_landmarker_lite.task',directory);
let bytes;try{bytes=await fs.readFile(model);}catch{
 const response=await fetch('https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task');
 if(!response.ok)throw Error(`Model download failed: ${response.status}`);bytes=Buffer.from(await response.arrayBuffer());
}
if(createHash('sha256').update(bytes).digest('hex')!=='59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a')throw Error('Pose model checksum mismatch');
await fs.writeFile(model,bytes);
await fs.cp(new URL('../node_modules/@mediapipe/tasks-vision/wasm/',import.meta.url),new URL('wasm/',directory),{recursive:true});
console.log('Pose model and WASM prepared locally; webcam frames stay in the browser.');

const handModel=new URL('hand_landmarker.task',directory);
let handBytes;try{handBytes=await fs.readFile(handModel);}catch{const response=await fetch('https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task');if(!response.ok)throw Error('Hand model download failed');handBytes=Buffer.from(await response.arrayBuffer());}
if(createHash('sha256').update(handBytes).digest('hex')!=='fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1')throw Error('Hand model checksum mismatch');
await fs.writeFile(handModel,handBytes);
