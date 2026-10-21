import { useEffect, useState, type RefObject } from 'react';
export default function FullscreenButton({target}:{target:RefObject<HTMLElement>}) {
 const [active,setActive]=useState(!!document.fullscreenElement),[error,setError]=useState('');
 useEffect(()=>{const change=()=>setActive(!!document.fullscreenElement);document.addEventListener('fullscreenchange',change);return()=>document.removeEventListener('fullscreenchange',change);},[]);
 const toggle=async()=>{setError('');try{if(document.fullscreenElement)await document.exitFullscreen();else if(target.current?.requestFullscreen)await target.current.requestFullscreen();else setError('Fullscreen is unavailable in this browser. Try its browser menu or Add to Home Screen.');}catch{setError('Fullscreen was blocked. Try again, or use your browser menu.');}};
 return <><button onClick={()=>void toggle()} aria-label={active?'Exit fullscreen':'Fullscreen'}>{active?'Exit fullscreen':'Fullscreen'}</button>{error&&<div className="fullscreen-notice" role="status">{error}<button onClick={()=>setError('')}>Dismiss</button></div>}</>;
}
