export class PlayGate {
 readySince:number|null=null;
 update(now:number,phone:boolean,camera:boolean,tracking:boolean){
  if(!phone||!camera||!tracking){this.readySince=null;return false;}
  if(this.readySince===null)this.readySince=now;
  return now-this.readySince>=800;
 }
 reset(){this.readySince=null;}
}

// Buffer intent, never an old hand position. A valid fresh pose is still required.
export class TossIntent {
 private until:number|null=null;
 get pending(){return this.until!==null;}
 request(now:number){this.until=now+400;}
 cancel(){this.until=null;}
 take(now:number,allowed:boolean,handAt?:number){
  if(this.until===null)return false;
  if(!allowed||now>=this.until){this.cancel();return false;}
  if(handAt===undefined||!Number.isFinite(handAt)||handAt>now||now-handAt>250)return false;
  this.cancel();return true;
 }
}
