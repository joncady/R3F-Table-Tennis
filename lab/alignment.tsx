import {useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import useSessionMarker from '../src/useSessionMarker';
function AlignmentLab(){
 const video=useRef<HTMLVideoElement>(null),[verified,setVerified]=useState(false);
 const expected=new URLSearchParams(location.search).get('session')||'tt1:lab:session';
 const status=useSessionMarker(video,expected,true,()=>setVerified(true));
 return <main><h1>Real session scanner</h1><video ref={video} id="camera" autoPlay muted playsInline/><p role="status">{status}</p><output>{verified?'Verified':'Waiting'}</output></main>;
}
createRoot(document.getElementById('root')!).render(<AlignmentLab/>);
