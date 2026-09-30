import {initialPlayer,nearestSettlement,waterDistance,resolveResource,resolveNpc,LIMIT,roadDistance,roadSegments,REGION} from './world.js';
export const RESOURCE_LABELS={wood:'wood',stone:'stone',berries:'berries',fiber:'fiber'};
export function cleanName(s){return String(s||'Traveler').trim().slice(0,28)||'Traveler';}
export function validateAction(p,a,context={}) {
 const next=structuredClone(p),now=context.now||Date.now();let extra={},summary='';
 if(!a||typeof a.type!=='string')throw Error('Choose an action.');
 switch(a.type){
 case 'move':{
  const x=Number(a.x),z=Number(a.z);if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>LIMIT||Math.abs(z)>LIMIT)throw Error('That destination is outside Evermere.');
  const distance=Math.hypot(x-p.x,z-p.z),elapsed=Math.max(2,(now-(p.updatedAt||now))/1000);
  if(distance>Math.min(240,elapsed*18+18))throw Error('You are moving too far in one step.');
  if(waterDistance(x,z)<-4&&roadDistance(x,z,roadSegments(Math.floor(x/REGION),Math.floor(z/REGION)))>7)throw Error('Deep water blocks the way. Look for a bridge.');
  next.x=x;next.z=z;next.distance=(p.distance||0)+distance;
  next.food=Math.max(5,p.food-distance*.008);next.water=Math.max(5,p.water-distance*.013);
  const s=nearestSettlement(x,z);if(s.distance<65&&!next.visited.includes(s.id))next.visited.push(s.id);
  summary=`Walked ${Math.round(distance)} m`;break;
 }
 case 'gather':{
  const r=resolveResource(String(a.target));if(!r)throw Error('This resource does not exist.');
  if(Math.hypot(p.x-r.x,p.z-r.z)>11)throw Error('Walk closer to gather this.');
  if(context.depleted)throw Error('Someone has already gathered this resource.');
  const count=r.kind==='wood'?3:r.kind==='stone'?2:3;next.inventory[r.kind]+=count;
  extra={resource:r.id,kind:r.kind,count};summary=`Gathered ${count} ${r.kind}`;break;
 }
 case 'eat':if(next.inventory.berries<1)throw Error('Gather some berries first.');next.inventory.berries--;next.food=Math.min(100,next.food+24);summary='Ate berries';break;
 case 'drink':if(nearestSettlement(p.x,p.z).distance>48&&waterDistance(p.x,p.z)>27)throw Error('Find a village well or the edge of a river.');next.water=100;summary='Filled water at a well or river';break;
 case 'rest':if(nearestSettlement(p.x,p.z).distance>60)throw Error('Rest in a settlement.');next.health=100;next.food=Math.min(100,next.food+8);summary='Rested at the settlement';break;
 case 'rename':next.name=cleanName(a.name);summary=`Now known as ${next.name}`;break;
 case 'talk':{
  const npc=resolveNpc(String(a.target));if(!npc)throw Error('This person does not exist.');
  if(Math.hypot(p.x-npc.x,p.z-npc.z)>15)throw Error('Walk closer to speak.');
  const message=String(a.message||'').trim();if(!message||message.length>800)throw Error('Write a message of 1–800 characters.');
  const response=npcReply(npc,p,message,context.memories||[]);
  extra={npc:npc.id,message,response};summary=`Spoke with ${npc.name}`;break;
 }
 default:throw Error('Unknown action.');
 }
 next.revision=(p.revision||0)+1;next.updatedAt=now;
 return {player:next,extra,summary};
}
export function npcReply(npc,p,message,memories) {
 const mine=memories.filter(m=>m.playerId===p.id),lower=message.toLowerCase();
 const words=lower.match(/[\p{L}\p{N}]{4,}/gu)||[];
 const scored=memories.map((m,i)=>({m,score:words.reduce((s,w)=>s+(m.message.toLowerCase().includes(w)?1:0),0),i})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.i-b.i);
 const match=scored[0]?.m;
 if(/remember|recall|told|memory|know about|what did|onthoud|weet|verteld/.test(lower)){
  const m=match||mine[0]||memories[0];return m?`I remember ${m.playerId===p.id?'you':m.playerName||'another traveler'} telling me: “${m.message}”${mine.length>1?` You and I have spoken ${mine.length} times before.`:''} I keep what people tell me.`:`We haven't spoken before, ${p.name}. Tell me something and I'll keep it in mind.`;
 }
 if(/water|thirst|drink/.test(lower))return `The well in ${npc.village} is clean. You can also refill at a riverbank. Stay out of the deep water; the roads have bridges.`;
 if(/food|hungry|berries|gather|surviv/.test(lower))return 'Look for the small red berry bushes outside the village. Trees give wood, rocks give stone, and pale grass gives fiber. Walk close, then gather.';
 if(/road|where|village|settlement|travel/.test(lower))return `The ochre roads lead to other settlements. Your map will help you choose a direction. I live here in ${npc.village}, but there's a lot of world beyond it.`;
 if(/build|house|craft/.test(lower))return 'Keep your wood, stone, and fiber. Building will come later; those supplies will be useful.';
 if(/hello|hi\b|hey|greet/.test(lower))return mine.length?`Good to see you again, ${p.name}. Last time you told me: “${mine[0].message}”`:`Welcome, ${p.name}. I'm ${npc.name}, the ${npc.role} here. What brings you to ${npc.village}?`;
 if(match&&match.playerId!==p.id)return `That reminds me of what ${match.playerName||'a traveler'} told me: “${match.message}” I'll remember your account too.`;
 const starts={gatherer:'I spend my days in the woods, but I listen when travelers speak.',keeper:`Stories find their way to ${npc.village}.`,wayfarer:'Every traveler carries a different piece of the world.'};
 return `${starts[npc.role]} I'll remember that you told me: “${message}”`;
}
export function createPlayer(id,name){return {...initialPlayer(id,cleanName(name)),updatedAt:Date.now()};}
