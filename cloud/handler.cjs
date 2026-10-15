const crypto=require('node:crypto');
const {DynamoDBClient}=require('@aws-sdk/client-dynamodb');
const {DynamoDBDocumentClient,GetCommand,PutCommand,UpdateCommand,DeleteCommand}=require('@aws-sdk/lib-dynamodb');
const {ApiGatewayManagementApiClient,PostToConnectionCommand}=require('@aws-sdk/client-apigatewaymanagementapi');
const db=DynamoDBDocumentClient.from(new DynamoDBClient({}));
const table=process.env.TABLE;
const callback=new ApiGatewayManagementApiClient({endpoint:process.env.WS_CALLBACK});
const origin=process.env.APP_ORIGIN;
const connectionCache=new Map();
const get=async pk=>(await db.send(new GetCommand({TableName:table,Key:{pk},ConsistentRead:true}))).Item;
const put=item=>db.send(new PutCommand({TableName:table,Item:item}));
const send=async(id,value)=>{if(!id)return;try{await callback.send(new PostToConnectionCommand({ConnectionId:id,Data:Buffer.from(JSON.stringify(value))}));}catch(e){if(e.$metadata?.httpStatusCode!==410)throw e;}};
const reply=(statusCode,value)=>({statusCode,headers:{'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify(value)});
function motion(m){return ['x','y','yaw','pitch','roll'].every(k=>Number.isFinite(m[k])&&Math.abs(m[k])<=4)&&(m.q===undefined||(Array.isArray(m.q)&&m.q.length===4&&m.q.every(n=>Number.isFinite(n)&&Math.abs(n)<=1.01)&&Math.abs(Math.hypot(...m.q)-1)<.05))&&(m.swing===undefined||(Array.isArray(m.swing)&&m.swing.length===3&&m.swing.every(n=>Number.isFinite(n)&&Math.abs(n)<=1)))&&(m.seq===undefined||Number.isSafeInteger(m.seq)&&m.seq>=0);}
exports.validMotion=motion;
exports.handler=async event=>{
 try{
  const ctx=event.requestContext||{},route=ctx.routeKey;
  if(ctx.http){
   if(ctx.http.method==='GET'&&event.rawPath==='/health')return reply(200,{ok:true,transport:'AWS WebSocket relay'});
   if(ctx.http.method!=='POST'||event.rawPath!=='/session')return reply(404,{error:'Not found'});
   if(event.headers?.origin!==origin)return reply(403,{error:'Origin rejected'});
   const room=crypto.randomBytes(12).toString('hex'),host=crypto.randomBytes(18).toString('hex'),expires=Math.floor(Date.now()/1000)+7200;
   await put({pk:`room:${room}`,host,expires});
   const fragment=new URLSearchParams({room,relay:process.env.WS_URL});
   return reply(200,{room,host,wsUrl:process.env.WS_URL,phoneUrl:`${process.env.PHONE_URL}#${fragment}`,cloud:true});
  }
  const id=ctx.connectionId;
  if(route==='$connect'){
   if(event.headers?.Origin!==origin&&event.headers?.origin!==origin)return reply(403,{error:'Origin rejected'});
   const q=event.queryStringParameters||{},r=await get(`room:${q.room}`);
   if(!r||r.expires<Date.now()/1000||!['host','phone'].includes(q.role)||(q.role==='host'&&q.host!==r.host))return reply(403,{error:'Pairing rejected'});
   const field=q.role==='host'?'hostId':'phoneId';
   await db.send(new UpdateCommand({TableName:table,Key:{pk:r.pk},UpdateExpression:'SET #role = :id',ConditionExpression:'attribute_not_exists(#role)',ExpressionAttributeNames:{'#role':field},ExpressionAttributeValues:{':id':id}}));
   await put({pk:`conn:${id}`,room:q.room,role:q.role,expires:r.expires});return reply(200,{ok:true});
  }
  const c=connectionCache.get(id)||await get(`conn:${id}`);if(c){if(connectionCache.size>1000)connectionCache.clear();connectionCache.set(id,c);}if(!c)return reply(403,{error:'Unknown connection'});
  const r=await get(`room:${c.room}`);if(!r||r.expires<Date.now()/1000)return reply(403,{error:'Session expired'});
  if(route==='$disconnect'){
   connectionCache.delete(id);
   const field=c.role==='host'?'hostId':'phoneId';
   try{await db.send(new UpdateCommand({TableName:table,Key:{pk:r.pk},UpdateExpression:'REMOVE #role',ConditionExpression:'#role = :id',ExpressionAttributeNames:{'#role':field},ExpressionAttributeValues:{':id':id}}));}catch(e){if(e.name!=='ConditionalCheckFailedException')throw e;}
   await db.send(new DeleteCommand({TableName:table,Key:{pk:c.pk}}));await send(c.role==='host'?r.phoneId:r.hostId,{type:'status',connected:false});return reply(200,{ok:true});
  }
  if(!event.body||Buffer.byteLength(event.body)>2048)return reply(400,{error:'Invalid payload'});
  let m;try{m=JSON.parse(event.body);}catch{return reply(400,{error:'Invalid JSON'});}
  const peer=c.role==='host'?r.phoneId:r.hostId;
  if(m.type==='hello'){await Promise.all([send(id,{type:'status',connected:Boolean(peer)}),send(peer,{type:'status',connected:true})]);}
  else if(c.role==='phone'&&m.type==='motion'&&motion(m))await send(peer,{type:'motion',x:m.x,y:m.y,yaw:m.yaw,pitch:m.pitch,roll:m.roll,...(m.q?{q:m.q}:{}),...(m.swing?{swing:m.swing}:{}),...(m.seq!==undefined?{seq:m.seq}:{})});
  else if(c.role==='phone'&&['toss','pause','recenter','suspend'].includes(m.type))await send(peer,{type:m.type});
  else if(c.role==='host'&&m.type==='impact'&&Number.isFinite(m.strength))await send(peer,{type:'impact',strength:Math.max(0,Math.min(1,m.strength))});
  else if(m.type==='probe'&&Number.isFinite(m.sent)&&Number.isSafeInteger(m.id))await send(peer,{type:'probe',sent:m.sent,id:m.id});
  else return reply(400,{error:'Invalid message'});
  return reply(200,{ok:true});
 }catch(e){console.error('Relay error',e.name);return reply(e.name==='ConditionalCheckFailedException'?409:500,{error:'Relay request failed'});}
};
