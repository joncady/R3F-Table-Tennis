import {FilesetResolver,PoseLandmarker} from '@mediapipe/tasks-vision';
const scope=self as unknown as {onmessage:((event:MessageEvent)=>void)|null;postMessage:(message:unknown)=>void};
let detector:PoseLandmarker|null=null;
let handWorker:Worker|null=null,lastHandTime=0,handBusy=false,handReady=false;
function handRequest(message:unknown,transfer:Transferable[]=[]):Promise<{type:string;error?:string;landmarks?:unknown;worldLandmarks?:unknown}>{return new Promise((resolve,reject)=>{const w=handWorker;if(!w){reject(Error('Hand worker unavailable'));return;}const timeout=setTimeout(()=>reject(Error('Hand worker timed out')),transfer.length?1500:20000);w.onerror=e=>{clearTimeout(timeout);reject(Error(e.message));};w.onmessage=({data})=>{clearTimeout(timeout);if(data.type==='error')reject(Error(data.error));else resolve(data);};w.postMessage(message,transfer);});}
scope.onmessage=async({data})=>{
 try{
  if(data.type==='init'){
   const began=performance.now(),files=await FilesetResolver.forVisionTasks(data.base+'wasm',true);
   let delegate:'GPU'|'CPU'=data.delegate==='CPU'?'CPU':'GPU';
   try{if(delegate==='CPU')throw Error('CPU selected');detector=await PoseLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:data.base+'pose_landmarker_lite.task',delegate:'GPU'},canvas:new OffscreenCanvas(1,1),runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.55,minPosePresenceConfidence:.55,minTrackingConfidence:.55});}
   catch{delegate='CPU';detector=await PoseLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:data.base+'pose_landmarker_lite.task',delegate:'CPU'},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.55,minPosePresenceConfidence:.55,minTrackingConfidence:.55});}
   let handError='';if(data.hands){try{handWorker=new Worker(new URL('./hand.worker.ts',import.meta.url),{type:'module'});const initialize=handRequest({type:'init',base:data.base});if(data.waitHands){await initialize;handReady=true;}else void initialize.then(()=>{handReady=true;scope.postMessage({type:'hand-ready'});}).catch(e=>{handWorker?.terminate();handWorker=null;scope.postMessage({type:'hand-error',error:String(e)});});}catch(e){handError=String(e);handWorker?.terminate();handWorker=null;}}
   scope.postMessage({type:'ready',delegate,handAvailable:handReady,handError,initMs:performance.now()-began});
  }
  if(data.type==='frame'){
   if(!detector)throw Error('Detector is not initialized');
   const began=performance.now();
   try{
    const result=detector.detectForVideo(data.bitmap,data.timestamp);
    if(handWorker&&handReady&&!handBusy&&data.timestamp-lastHandTime>=66){lastHandTime=data.timestamp;handBusy=true;
     const points=result.landmarks[0]||[],wrist=points[data.playingHand==='right'?15:16],width=data.bitmap.width,height=data.bitmap.height;
     let sx=0,sy=0,sw=width,sh=height;
     if(wrist&&(wrist.visibility??0)>.65){const shoulder=points[11]&&points[12]?Math.abs(points[11].x-points[12].x):.2;const span=Math.max(.14,Math.min(.4,shoulder)) * width;sw=Math.min(width,span);sh=Math.min(height,span);sx=Math.max(0,Math.min(width-sw,wrist.x*width-sw/2));sy=Math.max(0,Math.min(height-sh,wrist.y*height-sh/2));}
     const copy=await createImageBitmap(data.bitmap,sx,sy,sw,sh);
     void handRequest({type:'frame',bitmap:copy,timestamp:data.timestamp},[copy]).then(output=>{const handLandmarks=(output.landmarks as {x:number;y:number;z:number}[][]).map(hand=>hand.map(p=>({...p,x:(sx+p.x*sw)/width,y:(sy+p.y*sh)/height,z:p.z*sw/width})));scope.postMessage({type:'hand-result',landmarks:points,handLandmarks,worldHandLandmarks:output.worldLandmarks,captureAt:data.captureAt});}).catch(e=>{handWorker?.terminate();handWorker=null;scope.postMessage({type:'hand-error',error:String(e)});}).finally(()=>{handBusy=false;});
    }
    scope.postMessage({type:'result',captureAt:data.captureAt,processingMs:performance.now()-began,landmarks:result.landmarks[0]||[]});
   }finally{data.bitmap.close();}
  }
 }catch(error){scope.postMessage({type:'error',error:error instanceof Error?error.message:String(error)});}
};
