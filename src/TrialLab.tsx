import {useEffect,useMemo,useRef,useState} from 'react';
import {Canvas,useFrame} from '@react-three/fiber';
import {Line,OrbitControls} from '@react-three/drei';
import {Group,Quaternion} from 'three';
type Row={t:number;p:[number,number,number];estimate:[number,number,number];q:[number,number,number,number]};
type Track={rows:Row[];rmsCm:number;spanCm:number;trackedSpanCm:number;restErrorCm:number};
type Trial={config:{id:string};baseline:Track;tuned:Track};
function Phone({rows,color,truth,time}:{rows:Row[];color:string;truth?:boolean;time:React.MutableRefObject<number>}){
 const group=useRef<Group>(null),q=useMemo(()=>new Quaternion(),[]),nextQ=useMemo(()=>new Quaternion(),[]);
 useFrame(()=>{
  let index=0;while(index<rows.length-2&&rows[index+1].t<time.current)index++;
  const a=rows[index],b=rows[index+1],t=Math.max(0,Math.min(1,(time.current-a.t)/(b.t-a.t)));
  const av=truth?a.p:a.estimate,bv=truth?b.p:b.estimate;
  group.current?.position.set(...av.map((v,i)=>(v+(bv[i]-v)*t)*3) as [number,number,number]);
  if(group.current)group.current.quaternion.copy(q.fromArray(a.q).slerp(nextQ.fromArray(b.q),t));
 });
 const points=useMemo(()=>rows.map(r=>(truth?r.p:r.estimate).map(n=>n*3) as [number,number,number]),[rows,truth]);
 return <><Line points={points} color={color} lineWidth={truth?2:color==='#d8f47c'?4:2} transparent opacity={.65}/><group ref={group}><mesh><boxGeometry args={[.15,.29,.025]}/><meshBasicMaterial color={color} transparent opacity={truth?.6:.65} wireframe={truth}/></mesh><mesh position={[0,0,.015]}><planeGeometry args={[.12,.23]}/><meshBasicMaterial color={color} wireframe/></mesh></group></>;
}
function Clock({time,playing,onTime}:{time:React.MutableRefObject<number>;playing:boolean;onTime:(n:number)=>void}){
 const clock=useRef(0);useFrame((_,dt)=>{if(playing)time.current=(time.current+Math.min(dt,.1))%7;clock.current+=dt;if(clock.current>.1){onTime(time.current);clock.current=0;}});return null;
}
export default function TrialLab(){
 const [trials,setTrials]=useState<Trial[]>([]),[selected,setSelected]=useState(12),[playing,setPlaying]=useState(true),[label,setLabel]=useState(0),[error,setError]=useState('');
 const time=useRef(0),trial=trials[selected];
 useEffect(()=>{fetch(`${import.meta.env.BASE_URL}synthetic-trials.json`).then(r=>{if(!r.ok)throw Error('Generate data with npm run trial:simulate');return r.json();}).then(data=>setTrials(data.results)).catch(e=>setError(String(e)));},[]);
 return <main>
  <Canvas camera={{position:[1.7,1.2,2.1],fov:48}}><color attach="background" args={['#102a34']}/><ambientLight intensity={2}/><directionalLight position={[2,3,3]} intensity={3}/><gridHelper args={[4,20,'#44616b','#253e47']} position={[0,-.55,0]}/><axesHelper args={[.4]}/><OrbitControls target={[0,0,0]} enablePan/><Clock time={time} playing={playing} onTime={setLabel}/>{trial&&<><Phone key={`${selected}-truth`} rows={trial.tuned.rows} color="#ffffff" truth time={time}/><Phone key={`${selected}-baseline`} rows={trial.baseline.rows} color="#ff9b64" time={time}/><Phone key={`${selected}-tuned`} rows={trial.tuned.rows} color="#d8f47c" time={time}/></>}</Canvas>
  <div className="replay-controls"><strong>Virtual phone · tracking lab</strong><p>Known hand path → local accelerometer + orientation → the Android tracker. Synthetic sensors; distances below are before game reach gain.</p><label>Trial <select aria-label="Synthetic phone trial" value={selected} onChange={e=>{setSelected(Number(e.target.value));time.current=0;}}>{trials.map((r,i)=><option key={r.config.id} value={i}>{r.config.id}</option>)}</select></label><p><span style={{color:'#fff'}}>White: known path</span> · <span style={{color:'#ff9b64'}}>Orange: previous tracker</span> · <span style={{color:'#d8f47c'}}>Lime: tuned tracker</span></p>{trial&&<><p>Position RMS error: {trial.baseline.rmsCm.toFixed(1)} → <b>{trial.tuned.rmsCm.toFixed(1)} cm</b><br/>Travel span: known {trial.tuned.spanCm.toFixed(1)} · previous {trial.baseline.trackedSpanCm.toFixed(1)} · tuned {trial.tuned.trackedSpanCm.toFixed(1)} cm</p><input aria-label="Synthetic trial time" type="range" min="0" max="7" step=".01" value={label} onChange={e=>{time.current=Number(e.target.value);setLabel(time.current);setPlaying(false);}}/><p>{label.toFixed(1)} / 7.0 seconds · drag the scene to orbit</p></>}<button onClick={()=>setPlaying(v=>!v)}>{playing?'Pause trial':'Play trial'}</button><button onClick={()=>{time.current=0;setPlaying(true);}}>Restart trial</button><p>Simulation assumes known calibration and sensor axes. Gravity error and inertial drift remain real-device limitations. Orientation mapping stays 1:1.</p>{error&&<p role="alert">{error}</p>}<a href={import.meta.env.BASE_URL}>Back to game</a></div>
 </main>;
}
