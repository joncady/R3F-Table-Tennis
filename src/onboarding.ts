export class PlayGate {
 readySince:number|null=null;
 update(now:number,phone:boolean,camera:boolean,tracking:boolean){
  if(!phone||!camera||!tracking){this.readySince=null;return false;}
  if(this.readySince===null)this.readySince=now;
  return now-this.readySince>=800;
 }
 reset(){this.readySince=null;}
}
