import type { Match, PlayerInput } from './engine';
// An observation channel, never a reference to the live Match or input object.
// Deliberately absent from published builds and opt-in even on localhost.
const enabled = import.meta.env.DEV && ['localhost','127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('virtual-player');
let last = 0;
export function observeLab(match: Match, input: PlayerInput, phone: boolean, tracking?: unknown) {
 if (!enabled || performance.now()-last < 30) return;
 last=performance.now();
 const snapshot=JSON.stringify({at:last,phase:match.phase,timer:match.timer,score:match.score,server:match.server,winner:match.winner,ball:match.ball,ballVisible:match.ballVisible,paddles:match.paddles,body:match.body,hand:match.handedness,input,phone,tracking,impacts:match.impacts,impactSequence:match.impactSequence,message:match.message});
 Object.defineProperty(window,'__labSnapshot',{configurable:true,get:()=>JSON.parse(snapshot)});
}
