// Device labels are hints; all behavior is selected by available browser APIs.
export function detectPhone(nav={}){
 const ua=nav.userAgent||'';
 if(/iPad/i.test(ua)||(/Mac/i.test(nav.platform||'')&&(nav.maxTouchPoints||0)>1))return {kind:'ios',label:'iPad'};
 if(/iPhone|iPod/i.test(ua))return {kind:'ios',label:'iPhone'};
 if(/Android/i.test(ua))return {kind:'android',label:'Android'};
 return {kind:'other',label:'Phone'};
}
export function controllerCapabilities(env){
 return {orientation:typeof env.DeviceOrientationEvent!=='undefined',acceleration:typeof env.DeviceMotionEvent!=='undefined',vibration:typeof env.navigator?.vibrate==='function',audio:typeof (env.AudioContext||env.webkitAudioContext)==='function',wakeLock:typeof env.navigator?.wakeLock?.request==='function'};
}
export function requestSensorAccess(env){
 if(typeof env.DeviceOrientationEvent==='undefined')return Promise.reject(Error('This browser does not expose orientation sensors.'));
 // Invoke every permission request synchronously inside the Connect gesture.
 // Awaiting audio, network or the first permission before starting the second
 // can consume transient user activation on iPhone/iPad.
 const requests=[['orientation',env.DeviceOrientationEvent],['acceleration',env.DeviceMotionEvent]].filter(([,type])=>type&&typeof type.requestPermission==='function').map(([name,type])=>{
  try{return Promise.resolve(type.requestPermission()).then(result=>{if(result!=='granted')throw Error(`${name==='orientation'?'Orientation':'Acceleration'} permission was denied. Tap Connect to retry and allow Motion & Orientation.`);});}
  catch(error){return Promise.reject(error);}
 });
 return Promise.all(requests);
}
