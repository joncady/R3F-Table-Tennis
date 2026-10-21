import {FilesetResolver,HandLandmarker} from '@mediapipe/tasks-vision';
const scope=self as unknown as {onmessage:((event:MessageEvent)=>void)|null;postMessage:(message:unknown)=>void};
let detector:HandLandmarker|null=null;
scope.onmessage=async({data})=>{try{
 if(data.type==='init'){const files=await FilesetResolver.forVisionTasks(data.base+'wasm',true);detector=await HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:data.base+'hand_landmarker.task',delegate:'CPU'},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.55,minHandPresenceConfidence:.55,minTrackingConfidence:.55});scope.postMessage({type:'ready'});}
 if(data.type==='frame'){try{if(!detector)throw Error('Hand model not initialized');const result=detector.detectForVideo(data.bitmap,data.timestamp);scope.postMessage({type:'hands',landmarks:result.landmarks,worldLandmarks:result.worldLandmarks});}finally{data.bitmap.close();}}
}catch(e){scope.postMessage({type:'error',error:String(e)});}};
