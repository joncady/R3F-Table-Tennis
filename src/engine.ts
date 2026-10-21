export type Side = 0 | 1;
export type Phase = 'ready' | 'serve' | 'toss' | 'rally' | 'point' | 'over';
export const other = (side: Side): Side => side === 0 ? 1 : 0;
export const serverFor = (score: number[]): Side => (Math.floor((score[0] + score[1]) < 20 ? (score[0] + score[1]) / 2 : score[0] + score[1]) % 2) as Side;
export const winnerFor = (score: number[]): Side | null => Math.max(...score) >= 11 && Math.abs(score[0] - score[1]) >= 2 ? (score[0] > score[1] ? 0 : 1) : null;
export interface PlayerInput { x: number; y: number; moveX?: number; moveZ?: number; bodyX?:number; heldHand?:{x:number;y:number;z:number};requireTrackedHand?:boolean; phone?: boolean; swingOffset?: [number,number,number]; orientation?: [number, number, number, number] }
// World-space angular velocity (radians/second), shared by play and AI prediction.
export interface BallState { x: number; y: number; z: number; vx: number; vy: number; vz: number; wx: number; wy: number; wz: number }
export const SPIN = { brushGain: 9, max: 90, magnus: .0035, drag: .22, maxAcceleration: 3 };
export function flyBall(b: BallState, dt: number) {
 const clamp = (v: number) => Math.max(-SPIN.maxAcceleration, Math.min(SPIN.maxAcceleration, v));
 const ax = clamp(SPIN.magnus * (b.wy * b.vz - b.wz * b.vy));
 const ay = clamp(SPIN.magnus * (b.wz * b.vx - b.wx * b.vz));
 const az = clamp(SPIN.magnus * (b.wx * b.vy - b.wy * b.vx));
 b.vx += ax * dt; b.vy += (ay - 9.8) * dt; b.vz += az * dt;
 b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
 const decay = Math.exp(-SPIN.drag * dt); b.wx *= decay; b.wy *= decay; b.wz *= decay;
}
export function bounceBall(b: BallState) {
 const topspin = b.wx * Math.sign(b.vz);
 b.y = 1.58;
 b.vy = Math.abs(b.vy) * Math.max(.76, Math.min(.94, .88 - topspin * .001));
 b.vz += b.wx * .012;
 b.vx -= b.wz * .012;
 b.wx *= .72; b.wy *= .88; b.wz *= .72;
}
export interface CameraSway { yaw: number; pitch: number; x: number; y: number }
export function followSwing(sway: CameraSway, vx: number, vy: number, dt: number, strength: number) {
 const clamp = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v));
 const alpha = 1 - Math.exp(-Math.min(dt, .1) * 5);
 sway.yaw += (clamp(-vx * .003, .028) * strength - sway.yaw) * alpha;
 sway.pitch += (clamp(vy * .002, .018) * strength - sway.pitch) * alpha;
 sway.x += (clamp(vx * .006, .045) * strength - sway.x) * alpha;
 sway.y += (clamp(vy * .003, .02) * strength - sway.y) * alpha;
}
export type Rotation = [number, number, number, number];
export function localPoint(x: number, y: number, z: number, q: Rotation) {
 // Inverse unit quaternion rotates a world-space displacement into paddle space.
 const [qx, qy, qz, qw] = [-q[0], -q[1], -q[2], q[3]];
 const tx = 2 * (qy * z - qz * y), ty = 2 * (qz * x - qx * z), tz = 2 * (qx * y - qy * x);
 return {x:x + qw * tx + qy * tz - qz * ty, y:y + qw * ty + qz * tx - qx * tz, z:z + qw * tz + qx * ty - qy * tx};
}
export function blendRotation(a: Rotation, b: Rotation, t: number): Rotation {
 const sign = a.reduce((sum, n, i) => sum + n * b[i], 0) < 0 ? -1 : 1;
 const q = a.map((n, i) => n + (sign * b[i] - n) * t);
 const length = Math.hypot(...q) || 1;
 return q.map(n => n / length) as Rotation;
}
export class Match {
 multiplayer = false;
 far = {handedness:'right' as 'left'|'right', backhand:false, body:{x:0,z:4.05}, brush:{x:0,y:0}, rotation:[0,0,0,1] as Rotation};
 impacts = [0,0];
 handedness: 'left' | 'right' = 'right';
 backhand = false;
 impactSequence = 0;
 impactStrength = 0;
 constructor(handedness: 'left' | 'right' = 'right', private random:()=>number = Math.random) {
  this.handedness = handedness;
  this.paddles[0].x = handedness === 'right' ? .55 : -.55;
  this.paddles[1].x=-.55;
  this.holdBall();
 }
 setHand(hand: 'left' | 'right') { this.handedness = hand; this.backhand = false; this.paddles[0].x = this.body.x + (hand === 'right' ? .55 : -.55); this.holdBall(); }

 // Swap the complete court into the other player's local coordinate frame.
 // This keeps movement, service, brush spin and collision rules identical at both ends.
 mirror() {
  for (const p of this.paddles) { p.x=-p.x; p.z=-p.z; p.vx=-p.vx; p.vz=-p.vz; }
  this.paddles.reverse();
  const b=this.ball; b.x=-b.x; b.z=-b.z; b.vx=-b.vx; b.vz=-b.vz; b.wx=-b.wx; b.wz=-b.wz;
  [this.body,this.far.body]=[this.far.body,this.body];
  [this.brush,this.far.brush]=[this.far.brush,this.brush];
  [this.paddleRotation,this.far.rotation]=[this.far.rotation,this.paddleRotation];
  [this.handedness,this.far.handedness]=[this.far.handedness,this.handedness];
  [this.backhand,this.far.backhand]=[this.far.backhand,this.backhand];
  this.score.reverse(); this.impacts.reverse(); this.server=other(this.server); this.last=other(this.last);
  if(this.winner!==null)this.winner=other(this.winner);
 }
 // A consistent, bounded placement error per incoming shot avoids robotic perfect tracking.
 aiShot = -1; aiError = {x:0,y:0};
 score = [0, 0]; phase: Phase = 'ready'; server: Side = 0; winner: Side | null = null;
 ball: BallState = { x: 0, y: 2, z: 3.1, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0 };
 brush = { x: 0, y: 0 };
 paddleRotation: Rotation = [0,0,0,1];
 body = { x: 0, z: 4.05 };
 paddles = [{ x: 0, y: 1.9, z: 3.05, vx: 0, vy: 0, vz: 0 }, { x: 0, y: 1.9, z: -3.05, vx: 0, vy: 0, vz: 0 }];
 last: Side = 0; bounces = 0; serving = false; net = false; timer = 0; aiClock = 0; aiTarget = { x: 0, y: 1.9 }; message = 'First to 11 · win by two';
 requireTrackedHand=false;
 get ballVisible(){if(!this.requireTrackedHand)return true;if(this.phase==='point'||this.phase==='over')return false;return !((this.phase==='ready'||this.phase==='serve')&&this.server===0&&!this.heldHand);}
 heldHand:{x:number;y:number;z:number}|undefined;
 holdBall() {
  if(this.requireTrackedHand&&this.server===0&&!this.heldHand)return;
  if(!this.multiplayer&&this.server===0&&this.heldHand){Object.assign(this.ball,this.heldHand,{vx:0,vy:0,vz:0,wx:0,wy:0,wz:0});return;}
  const p = this.paddles[this.phase === 'ready' ? 0 : this.server];
  const q = this.server === 0 ? this.paddleRotation : this.far.rotation;
  const local = localPoint(0,.6,-.22,[-q[0],-q[1],-q[2],q[3]]);
  const held = this.server === 0 ? local : {x:-local.x,y:local.y,z:-local.z};
  Object.assign(this.ball, { x: p.x + held.x, y: p.y + held.y, z: p.z + held.z, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0 });
 }
 start() { this.phase = 'serve'; this.message = 'Your serve — Space to toss'; }
 point(winner: Side, reason: string) {
  if (this.phase !== 'rally' && this.phase !== 'toss') return;
  this.score = this.score.map((n, i) => n + (i === winner ? 1 : 0));
  this.winner = winnerFor(this.score); this.phase = this.winner === null ? 'point' : 'over';
  this.message = `${winner === 0 ? 'You' : 'AI'} ${winner === 0 ? 'win' : 'wins'} the point · ${reason}`;
  this.timer = 1.5; this.server = serverFor(this.score);
 }
 serve(upwardSpeed=4.4) {
  if (this.phase !== 'serve') return;
  if(this.requireTrackedHand&&this.server===0&&!this.heldHand)return;
  if(this.multiplayer && this.server===1){this.mirror();try{this.serve();}finally{this.mirror();}return;}
  if (this.server === 0) {
   this.holdBall();
   this.ball.vy = Number.isFinite(upwardSpeed)?Math.max(3,Math.min(6,upwardSpeed)):4.4;
   this.phase = 'toss'; this.timer = 0; this.message = 'Toss — swing as the ball drops'; return;
  }
  const direction = 1;
  Object.assign(this.ball, { x: this.paddles[this.server].x * .45, y: 2.15, z: -direction * 3.1, vx: 0, vy: -.5, vz: direction * 4.8, wx: 0, wy: 0, wz: 0 });
  this.applyBrush(this.server);
  this.last = this.server; this.bounces = 0; this.serving = true; this.net = false; this.phase = 'rally'; this.timer = 0; this.message = 'Rally — track, time, return';
 }
 applyBrush(side: Side) {
  const b = this.ball;
  this.impacts[side]++;
  if (side === 0) { this.impactSequence++; this.impactStrength = Math.min(1, Math.hypot(this.brush.x, this.brush.y, Math.max(0, -this.paddles[0].vz)) / 10 + .2); }
  const direction = side === 0 ? -1 : 1;
  const clamp = (n: number) => Math.max(-SPIN.max, Math.min(SPIN.max, n));
  b.wx = clamp(b.wx * .25 + (side === 0 ? this.brush.y : 0) * direction * SPIN.brushGain);
  b.wy = clamp(b.wy * .25 + (side === 0 ? this.brush.x : 0) * direction * SPIN.brushGain);
  b.wz *= .25;
 }
 hit(side: Side) {
  if(this.multiplayer && side===1){this.mirror();try{this.hit(0);}finally{this.mirror();}return;}
  if (side === this.last) { this.point(other(side), 'double hit'); return; }
  if (!this.bounces || (this.serving && this.bounces < 2)) { this.point(other(side), 'volley before the bounce'); return; }
  const b = this.ball; const p = this.paddles[side];
  const targetX = side === 0 ? Math.max(-1.25, Math.min(1.25, p.x * .45 + (b.x - p.x) * 1.2 + p.vx * .16)) : (this.random() - .5) * 2.2;
  const targetZ = side === 0 ? -1.65 : 1.65;
  // Use the same brush sample for shot pace and spin.
  const strokeSpeed = side === 0 ? Math.hypot(this.brush.x, this.brush.y, Math.max(0, -p.vz)) : 0;
  const flight = Math.max(.64, .88 - strokeSpeed * .025);
  b.vx = (targetX - b.x) / flight; b.vz = (targetZ - b.z) / flight; b.vy = (1.58 - b.y + 4.9 * flight * flight) / flight;
  this.applyBrush(side);
  this.last = side; this.bounces = 0; this.serving = false; this.net = false;
 }
 movePlayer(dt:number,input:PlayerInput){
 const move = (value:number,target:number,speed:number)=>value+Math.max(-speed*dt,Math.min(speed*dt,target-value));
 this.paddleRotation=input.phone&&input.orientation?[...input.orientation]:[0,0,0,1];
 const oldBodyX = this.body.x;
 const oldPaddles = this.paddles.map(p => ({ ...p }));
 const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
 if(Number.isFinite(input.bodyX)){this.body.x=move(this.body.x,clamp(input.bodyX!, -1.9,1.9),4.8);this.body.z=4.05;}
 else {this.body.x = clamp(this.body.x + (input.moveX ?? 0) * 2.4 * dt, -1.9, 1.9);this.body.z = clamp(this.body.z + (input.moveZ ?? 0) * 1.2 * dt, 3.75, 4.5);}
 const player = this.paddles[0];
 const hand = this.handedness === 'right' ? 1 : -1;
 player.x = move(player.x, this.body.x + hand * .55 + (input.phone && input.swingOffset ? clamp(input.swingOffset[0], -3, 3) : clamp(input.x, -1, 1) * 2), input.phone ? 22 : 10);
 const relative = (player.x - this.body.x) * hand;
 if (relative < -.12) this.backhand = true;
 else if (relative > .12) this.backhand = false;
 player.y = move(player.y, 1.9 + (input.phone && input.swingOffset ? clamp(input.swingOffset[1], -1, 1.3) : clamp(input.y, -1, 1) * .8), input.phone ? 18 : 10);
 player.vx = (player.x - oldPaddles[0].x) / dt;
 player.vy = (player.y - oldPaddles[0].y) / dt;
 const brushAlpha = 1 - Math.exp(-dt * 24);
 this.brush.x += (player.vx - (this.body.x - oldBodyX) / dt - this.brush.x) * brushAlpha;
 this.brush.y += (player.vy - this.brush.y) * brushAlpha;
 // Mouse strokes sweep the paddle forward, then it returns to its resting reach.
 player.z = move(player.z, this.body.z - 1 + (input.phone && input.swingOffset ? clamp(input.swingOffset[2], -.6, .45) : -Math.min(.32, Math.hypot(player.vx, player.vy) * .035)), input.phone ? 12 : 4);
 player.vz = (player.z - oldPaddles[0].z) / dt;
 }
 step(dt: number, input: PlayerInput, secondInput?:PlayerInput) {
  if(this.multiplayer && this.server===1 && (this.phase==='serve'||this.phase==='toss')){
   this.mirror();try{this.step(dt,secondInput??{x:0,y:0},input);}finally{this.mirror();}return;
  }
  if(input.requireTrackedHand!==undefined)this.requireTrackedHand=input.requireTrackedHand;this.heldHand=input.heldHand;
  if (this.phase === 'ready') { if(Number.isFinite(input.bodyX))this.movePlayer(dt,input);this.holdBall(); return; }
  if (this.phase === 'over') return;
  const move = (value: number, target: number, speed: number) => value + Math.max(-speed * dt, Math.min(speed * dt, target - value));
 const oldRotation = [...this.paddleRotation] as Rotation;
 const f=this.far.rotation;const oldFarRotation:Rotation=[f[2],f[3],-f[0],-f[1]];
 this.paddleRotation = input.phone && input.orientation ? [...input.orientation] : [0,0,0,1];
 const oldPaddles = this.paddles.map(p => ({...p}));
 this.movePlayer(dt,input);
 if(secondInput){this.mirror();try{this.movePlayer(dt,secondInput);}finally{this.mirror();}}
 const player=this.paddles[0];
 const clamp = (n:number,low:number,high:number)=>Math.max(low,Math.min(high,n));
 this.timer += dt;
  if (this.phase === 'point') { if (this.timer >= 3) { this.phase = 'serve'; this.timer = 0; this.message = this.server === 0 ? 'Your serve — Space to toss' : 'AI serving…'; } return; }
  if (this.phase === 'serve') {
   this.holdBall();
   if (!this.multiplayer && this.server === 1 && this.timer > 1.2) this.serve(); return;
  }
  if (this.phase === 'toss') {
   const b = this.ball;
   const oldY = b.y;
   b.vy -= 9.8 * dt; b.y += b.vy * dt;
   // Closest point on the moving paddle's sweep catches fast lateral strokes.
   const old = oldPaddles[0];
   const dx = player.x - old.x, dy = player.y - old.y, dz = player.z - old.z;
   const length = dx * dx + dy * dy + dz * dz;
   const t = length > 0 ? clamp(((b.x - old.x) * dx + ((oldY + b.y) / 2 - old.y) * dy + (b.z - old.z) * dz) / length, 0, 1) : 0;
   const contactPoint = input.phone ? localPoint(b.x - old.x - dx * t, b.y - old.y - dy * t, b.z - old.z - dz * t, this.paddleRotation) : {x:b.x - old.x - dx * t,y:b.y - old.y - dy * t,z:b.z - old.z - dz * t};
   const contact = Math.hypot(contactPoint.x / .455, contactPoint.y / .43, contactPoint.z / .23) <= 1;
   if (contact && b.vy < 0 && Math.hypot(player.vx, player.vy, player.vz) > .8) {
    const flight = .36;
    b.vx = -b.x * .2;
    b.vz = (1.35 - b.z) / flight;
    b.vy = (1.58 - b.y + 4.9 * flight * flight) / flight;
    this.applyBrush(0);
    this.last = 0; this.bounces = 0; this.serving = true; this.net = false;
    this.phase = 'rally'; this.timer = 0; this.message = 'Serve struck — rally';
   } else if (b.y < 1.5 || this.timer > 3) this.point(1, 'missed service toss');
   return;
  }
  const b = this.ball; const previous = { ...b };
  if(!this.multiplayer){
  this.aiClock -= dt;
  if (this.aiClock <= 0) {
   this.aiClock = .14; const time = b.vz < -.1 ? Math.max(0, (-3.05 - b.z) / b.vz) : 0;
   const predicted = { ...b };
   // Bounded rollout includes Magnus curvature, spin decay, and table contact.
   for (let elapsed = 0; elapsed < Math.min(time, 2); elapsed += 1 / 120) {
    const oldY = predicted.y;
    flyBall(predicted, Math.min(1 / 120, time - elapsed));
    if (oldY > 1.58 && predicted.y <= 1.58 && predicted.vy < 0 && Math.abs(predicted.x) <= 1.58 && Math.abs(predicted.z) <= 2.78) bounceBall(predicted);
   }
   if(time>0&&this.aiShot!==this.impactSequence){this.aiShot=this.impactSequence;this.aiError={x:(this.random()+this.random()+this.random()-1.5)*.45,y:(this.random()+this.random()-1)*.16};}
   this.aiTarget = time > 0 ? { x: Math.max(-1.7, Math.min(1.7, predicted.x + this.aiError.x)), y: Math.max(.9, Math.min(3, predicted.y + this.aiError.y)) } : { x: 0, y: 1.9 };
  }
  const ai = this.paddles[1]; ai.x = move(ai.x, this.aiTarget.x, 2.6); ai.y = move(ai.y, this.aiTarget.y, 2.8);
  }
  flyBall(b, dt);
  // Swept plane crossings prevent fast balls skipping thin surfaces.
  if (previous.y > 1.58 && b.y <= 1.58 && b.vy < 0) {
   const t = (previous.y - 1.58) / (previous.y - b.y); const x = previous.x + (b.x - previous.x) * t; const z = previous.z + (b.z - previous.z) * t;
   if (Math.abs(x) <= 1.58 && Math.abs(z) <= 2.78) {
    const side: Side = z > 0 ? 0 : 1;
    const expected = this.serving && this.bounces === 0 ? this.last : other(this.last);
    if (side !== expected) { this.point(other(this.last), 'wrong side of the table'); return; }
    if ((!this.serving && this.bounces >= 1) || (this.serving && this.bounces >= 2)) { this.point(this.last, 'double bounce'); return; }
    this.bounces++; bounceBall(b);
    if (this.serving && this.bounces === 2 && this.net) { this.phase = 'serve'; this.timer = 0; this.message = 'Net serve — let, serve again'; return; }
   }
  }
  if (previous.z * b.z <= 0 && Math.abs(previous.z - b.z) > 0) {
   const t = previous.z / (previous.z - b.z); const height = previous.y + (b.y - previous.y) * t;
   if (height < 1.94 && Math.abs(b.x) < 1.72) { this.net = true; b.vz *= .2; b.vy *= .35; b.z = Math.sign(b.vz) * .01; }
  }
  for (const side of [0, 1] as Side[]) {
   // Contact occurs at the paddle face plus the ball radius, not its center.
   const p = this.paddles[side];
   const sideInput=side===0?input:secondInput;
   if (sideInput?.phone) {
    const old = oldPaddles[side];
    const farQ=this.far.rotation;
    const currentQ:Rotation=side===0?this.paddleRotation:[farQ[2],farQ[3],-farQ[0],-farQ[1]];
    const previousQ=side===0?oldRotation:oldFarRotation;
    const from = localPoint(previous.x - old.x, previous.y - old.y, previous.z - old.z, previousQ);
    const to = localPoint(b.x - p.x, b.y - p.y, b.z - p.z, currentQ);
    const surface = from.z < 0 ? -.14 : .14;
    if ((side===0?b.vz>0:b.vz<0) && (from.z - surface) * (to.z - surface) <= 0 && Math.abs(from.z - to.z) > .00001) {
     const t = (from.z - surface) / (from.z - to.z);
     const world = {x:previous.x + (b.x - previous.x) * t,y:previous.y + (b.y - previous.y) * t,z:previous.z + (b.z - previous.z) * t};
     const local = localPoint(world.x - old.x - (p.x - old.x) * t, world.y - old.y - (p.y - old.y) * t, world.z - old.z - (p.z - old.z) * t, blendRotation(previousQ, currentQ, t));
     if (Math.hypot(local.x / .455, local.y / .43) <= 1) { Object.assign(b, world); this.hit(side); }
    }
    continue;
   }
   const plane = p.z + (side === 0 ? -.14 : .14);
   const oldPlane = oldPaddles[side].z + (side === 0 ? -.14 : .14);
   if ((side === 0 ? b.vz > 0 && previous.z < oldPlane && b.z >= plane : b.vz < 0 && previous.z > oldPlane && b.z <= plane)) {
    const t = (oldPlane - previous.z) / ((b.z - previous.z) - (plane - oldPlane)); const x = previous.x + (b.x - previous.x) * t; const y = previous.y + (b.y - previous.y) * t;
    const px = oldPaddles[side].x + (p.x - oldPaddles[side].x) * t;
    const py = oldPaddles[side].y + (p.y - oldPaddles[side].y) * t;
    if (Math.hypot((x - px) / .455, (y - py) / .43) <= 1) { b.x = x; b.y = y; b.z = plane; this.hit(side); }
   }
  }
  if (b.y < .1 || Math.abs(b.x) > 5 || Math.abs(b.z) > 4.6) this.point(this.bounces >= (this.serving ? 2 : 1) ? this.last : other(this.last), 'missed return');
 }
}
