import { useEffect, useRef, useState, type MutableRefObject, type PointerEvent } from 'react';
import type { PlayerInput } from './engine';

/** Independent pointer captures let one thumb move while the other swings. */
export default function TouchControls({ input, hand, serve }: { input: MutableRefObject<PlayerInput>; hand: 'left' | 'right'; serve: () => void }) {
 const wheel = useRef<number | null>(null);
 const swing = useRef<{id:number;x:number;y:number;startX:number;startY:number;at:number;distance:number} | null>(null);
 const [stick, setStick] = useState({x:0,y:0});
 useEffect(() => () => { input.current.moveX=0; input.current.moveZ=0; }, [input]);
 const moveWheel = (e:PointerEvent<HTMLDivElement>) => {
  const box=e.currentTarget.getBoundingClientRect(),radius=box.width/2;
  let x=(e.clientX-box.left-radius)/radius,y=(e.clientY-box.top-radius)/radius;
  const length=Math.hypot(x,y);if(length>1){x/=length;y/=length;}
  input.current.moveX=Math.abs(x)<.12?0:x;
  input.current.moveZ=Math.abs(y)<.12?0:y;
  setStick({x:x*30,y:y*30});
 };
 const endWheel = (e:PointerEvent<HTMLDivElement>) => {
  if(wheel.current!==e.pointerId)return;
  wheel.current=null;input.current.moveX=0;input.current.moveZ=0;setStick({x:0,y:0});
 };
 const endSwing = (e:PointerEvent<HTMLDivElement>,cancelled=false) => {
  const p=swing.current;if(!p||p.id!==e.pointerId)return;
  swing.current=null;
  if(!cancelled&&Math.max(p.distance,Math.hypot(e.clientX-p.startX,e.clientY-p.startY))<12&&performance.now()-p.at<350)serve();
 };
 return <div className={`touch-controls paddle-${hand}`}>
  <div className="touch-swing" aria-label="Paddle area: drag to swing, tap to serve"
   onPointerDown={e=>{if(swing.current)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);swing.current={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,at:performance.now(),distance:0};}}
   onPointerMove={e=>{const p=swing.current;if(!p||p.id!==e.pointerId)return;const scale=4/Math.min(window.innerWidth,window.innerHeight);input.current.x=Math.max(-1,Math.min(1,input.current.x+(e.clientX-p.x)*scale));input.current.y=Math.max(-1,Math.min(1,input.current.y-(e.clientY-p.y)*scale));p.x=e.clientX;p.y=e.clientY;p.distance=Math.max(p.distance,Math.hypot(e.clientX-p.startX,e.clientY-p.startY));}}
   onPointerUp={e=>endSwing(e)} onPointerCancel={e=>endSwing(e,true)} onLostPointerCapture={e=>endSwing(e,true)}>
   <span className="touch-swing-hint">Drag to swing · Tap to serve</span>
  </div>
  <div className="touch-wheel" role="group" aria-label="Movement wheel"
   onPointerDown={e=>{if(wheel.current!==null)return;e.preventDefault();wheel.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);moveWheel(e);}}
   onPointerMove={e=>{if(wheel.current===e.pointerId)moveWheel(e);}}
   onPointerUp={endWheel} onPointerCancel={endWheel} onLostPointerCapture={endWheel}>
   <span style={{transform:`translate(${stick.x}px,${stick.y}px)`}} />
   <small>MOVE</small>
  </div>
 </div>;
}
