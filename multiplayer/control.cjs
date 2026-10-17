const https=require('node:https');
const {randomBytes,timingSafeEqual}=require('node:crypto');
const {ECSClient,RunTaskCommand,DescribeTasksCommand,StopTaskCommand}=require('@aws-sdk/client-ecs');
const {EC2Client,DescribeNetworkInterfacesCommand}=require('@aws-sdk/client-ec2');
const {Route53Client,ChangeResourceRecordSetsCommand,GetChangeCommand}=require('@aws-sdk/client-route-53');
const {DynamoDBClient}=require('@aws-sdk/client-dynamodb');
const {DynamoDBDocumentClient,GetCommand,PutCommand,DeleteCommand,UpdateCommand}=require('@aws-sdk/lib-dynamodb');
const ecs=new ECSClient({}),ec2=new EC2Client({}),dns=new Route53Client({}),db=DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TableName=process.env.TABLE,token=()=>randomBytes(24).toString('base64url');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const get=async pk=>(await db.send(new GetCommand({TableName,Key:{pk},ConsistentRead:true}))).Item;
const put=Item=>db.send(new PutCommand({TableName,Item}));
const respond=(statusCode,body)=>({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(body)});
async function release(room){try{await db.send(new DeleteCommand({TableName,Key:{pk:'ACTIVE'},ConditionExpression:'id = :id',ExpressionAttributeValues:{':id':room.id}}));}catch(e){if(e.name!=='ConditionalCheckFailedException')throw e;}}
async function stop(room,reason){
 const active=await get('ACTIVE');
 if(active?.id===room.id){await dns.send(new ChangeResourceRecordSetsCommand({HostedZoneId:process.env.ZONE,ChangeBatch:{Changes:[{Action:'UPSERT',ResourceRecordSet:{Name:process.env.DOMAIN,Type:'A',TTL:10,ResourceRecords:[{Value:'192.0.2.1'}]}}]}}));}
 if(room.task){try{await ecs.send(new StopTaskCommand({cluster:process.env.CLUSTER,task:room.task,reason}));}catch(e){if(e.name!=='InvalidParameterException')throw e;}}
 await db.send(new UpdateCommand({TableName,Key:{pk:room.pk},UpdateExpression:'SET #s = :s',ExpressionAttributeNames:{'#s':'status'},ExpressionAttributeValues:{':s':'stopped'}}));await release(room);
}
function healthyAt(ip){return new Promise(resolve=>{const request=https.get({hostname:ip,servername:process.env.DOMAIN,path:'/health',headers:{Host:process.env.DOMAIN},timeout:2500},response=>{response.resume();resolve(response.statusCode===200);});request.on('timeout',()=>{request.destroy();resolve(false);});request.on('error',()=>resolve(false));});}
async function taskFor(room){if(!room.task)return null;return (await ecs.send(new DescribeTasksCommand({cluster:process.env.CLUSTER,tasks:[room.task]}))).tasks?.[0];}
exports.handler=async event=>{
 const now=Math.floor(Date.now()/1000);
 try{
  if(event.source==='aws.events'){
   const active=await get('ACTIVE');if(!active)return;
   const room=await get(`ROOM#${active.id}`);if(!room){await release(active);return;}
   const task=await taskFor(room);
   if(task?.lastStatus==='STOPPED'){await stop(room,'Already stopped');return;}
   if(now-room.created>7200||(room.heartbeat?now-room.heartbeat>120:now-room.created>600))await stop(room,'Idle watchdog: stale heartbeat or lifetime exceeded');
   return;
  }
  const method=event.requestContext?.http?.method,path=event.rawPath;
  let body={};if(event.body){if(event.body.length>8192)return respond(413,{error:'Too large'});try{body=JSON.parse(event.body);}catch{return respond(400,{error:'Invalid JSON'});}}
  if(method==='GET'&&path==='/health')return respond(200,{ok:true});
  if(method==='POST'&&path==='/rooms'){
   if(!equal(body.key,process.env.LAUNCH_KEY))return respond(403,{error:'Private prototype: a launch key is required'});
   const room={pk:'',id:randomBytes(8).toString('hex'),secret:token(),invite:token(),seats:[{display:token(),phone:token()},{display:token(),phone:token()}],created:now,expires:now+86400,status:'starting'};room.pk=`ROOM#${room.id}`;
   try{await db.send(new PutCommand({TableName,Item:{pk:'ACTIVE',id:room.id,expires:now+7800},ConditionExpression:'attribute_not_exists(pk)'}));}catch(e){if(e.name==='ConditionalCheckFailedException')return respond(409,{error:'A private match server is already running. Join that room or wait for shutdown.'});throw e;}
   try{
    await put(room);
    const result=await ecs.send(new RunTaskCommand({cluster:process.env.CLUSTER,taskDefinition:process.env.TASK,launchType:'FARGATE',count:1,clientToken:room.id,networkConfiguration:{awsvpcConfiguration:{subnets:process.env.SUBNETS.split(','),securityGroups:[process.env.SECURITY_GROUP],assignPublicIp:'ENABLED'}},overrides:{containerOverrides:[{name:'match',environment:[{name:'ROOM_JSON',value:JSON.stringify(room)},{name:'CONTROL_URL',value:process.env.CONTROL_URL}]}]}}));
    if(result.failures?.length||!result.tasks?.[0])throw Error('Container could not start');
    room.task=result.tasks[0].taskArn;await put(room);
    return respond(201,{id:room.id,ticket:room.seats[0].display,invite:room.invite});
   }catch(e){if(room.task)await ecs.send(new StopTaskCommand({cluster:process.env.CLUSTER,task:room.task,reason:'Room setup failed'}));await release(room);throw e;}
  }
  if(method==='POST'&&path==='/heartbeat'){
   const room=await get(`ROOM#${body.id}`);if(!room||!equal(body.secret,room.secret))return respond(403,{error:'Invalid server'});
   if(body.stopped){await db.send(new UpdateCommand({TableName,Key:{pk:room.pk},UpdateExpression:'SET #s = :s',ExpressionAttributeNames:{'#s':'status'},ExpressionAttributeValues:{':s':'stopped'}}));/* watchdog releases after ECS confirms STOPPED */}
   else await db.send(new UpdateCommand({TableName,Key:{pk:room.pk},UpdateExpression:'SET heartbeat = :h',ExpressionAttributeValues:{':h':now}}));
   return respond(200,{ok:true});
  }
  const id=path?.match(/^\/rooms\/([a-f0-9]{16})(\/join)?$/);
  if(id){
   const room=await get(`ROOM#${id[1]}`);if(!room||room.expires<now)return respond(404,{error:'Room expired'});
   if(method==='POST'&&id[2]){
    if(room.status==='stopped')return respond(410,{error:'Match has ended'});
    if(!equal(body.invite,room.invite))return respond(403,{error:'Invalid invite'});
    try{await db.send(new UpdateCommand({TableName,Key:{pk:room.pk},UpdateExpression:'SET joined = :yes',ConditionExpression:'attribute_not_exists(joined)',ExpressionAttributeValues:{':yes':true}}));}catch(e){if(e.name==='ConditionalCheckFailedException')return respond(409,{error:'This invite has already been claimed. Reopen your saved match link.'});throw e;}
    return respond(200,{id:room.id,ticket:room.seats[1].display});
   }
   const ticket=event.queryStringParameters?.ticket,side=room.seats.findIndex(s=>equal(ticket,s.display));if(side<0)return respond(403,{error:'Invalid player ticket'});
   const task=await taskFor(room);if(!task||task.lastStatus==='STOPPED'){await stop(room,'Stopped');return respond(200,{status:'stopped'});}
   if(task.lastStatus!=='RUNNING')return respond(200,{status:'starting'});
   if(!room.ip){
    const eni=task.attachments?.flatMap(a=>a.details||[]).find(d=>d.name==='networkInterfaceId')?.value;
    const ip=eni&&(await ec2.send(new DescribeNetworkInterfacesCommand({NetworkInterfaceIds:[eni]}))).NetworkInterfaces?.[0]?.Association?.PublicIp;
    if(!ip)return respond(200,{status:'starting'});
    const change=await dns.send(new ChangeResourceRecordSetsCommand({HostedZoneId:process.env.ZONE,ChangeBatch:{Changes:[{Action:'UPSERT',ResourceRecordSet:{Name:process.env.DOMAIN,Type:'A',TTL:10,ResourceRecords:[{Value:ip}]}}]}}));
    room.change=change.ChangeInfo.Id;room.dnsReadyAt=now+30;
    await db.send(new UpdateCommand({TableName,Key:{pk:room.pk},UpdateExpression:'SET ip = :ip, dnsChange = :c, dnsReadyAt = :r',ExpressionAttributeValues:{':ip':ip,':c':room.change,':r':room.dnsReadyAt}}));room.ip=ip;
   }
   const changeId=room.dnsChange||room.change;
   if(changeId&&(now<(room.dnsReadyAt||0)||(await dns.send(new GetChangeCommand({Id:changeId}))).ChangeInfo.Status!=='INSYNC'))return respond(200,{status:'starting'});
   const healthy=await healthyAt(room.ip);
   return respond(200,{status:healthy?'ready':'starting',side,wsUrl:`wss://${process.env.DOMAIN}`,phoneToken:room.seats[side].phone,...(side===0?{invite:room.invite}:{})});
  }
  return respond(404,{error:'Unknown route'});
 }catch(error){console.error('Control error',error.name);return respond(500,{error:'Match service unavailable; retry shortly'});}
};
