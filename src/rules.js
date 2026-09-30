import {initialPlayer,nearestSettlement,waterDistance,resolveResource,resolveNpc,LIMIT,roadDistance,roadSegments,REGION} from './world.js';
import {normalizePlayer} from './homes.js?v=2';
import {resolveDungeon,resolveCaveResource,cavePathClear,caveWalkable,roomAt,ruinFor} from './dungeons.js?v=2';
export const RESOURCE_LABELS={wood:'wood',stone:'stone',berries:'berries',fiber:'fiber'};
export function cleanName(s){return String(s||'Traveler').trim().slice(0,28)||'Traveler';}
export function validateAction(input,a,context={}) {
 const p=normalizePlayer(input),next=structuredClone(p),now=context.now||Date.now();let extra={},summary='';
 if(!a||typeof a.type!=='string')throw Error('Choose an action.');
 const surface=()=>{if(p.dungeon)throw Error('Leave the dungeon first.');};
 switch(a.type){
 case 'return-home':next.x=p.house.doorX;next.z=p.house.doorZ;next.dungeon=null;summary=`Woke at your home in ${p.house.villageName}`;extra={home:p.house.id};break;
 case 'enter-dungeon':{
  surface();const d=resolveDungeon(a.target);if(!d)throw Error('These ruins cannot be found.');if(Math.hypot(p.x-d.x,p.z-d.z)>17)throw Error('Walk closer to the entrance.');
  next.dungeon={id:d.id,x:d.spawn.x,z:d.spawn.z};next.caves[d.id]??={entered:true,rooms:[],gathered:[]};next.caves[d.id].entered=true;
  if(!next.caves[d.id].rooms.includes(0))next.caves[d.id].rooms.push(0);summary=`Entered ${d.dungeonName}`;extra={dungeon:d.id};break;
 }
 case 'leave-dungeon':{
  if(!p.dungeon)throw Error('You are already outside.');const d=resolveDungeon(p.dungeon.id);if(Math.hypot(p.dungeon.x-d.entrance.x,p.dungeon.z-d.entrance.z)>10)throw Error('Find the stairs to leave the dungeon.');
  next.dungeon=null;next.x=d.x;next.z=d.z+9;summary=`Returned to ${d.name}`;extra={dungeon:d.id};break;
 }
 case 'move':{
  const x=Number(a.x),z=Number(a.z);if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>LIMIT||Math.abs(z)>LIMIT)throw Error('That destination is outside Evermere.');
  const start=p.dungeon||p,trail=Array.isArray(a.trail)?a.trail:[];if(trail.length>80||trail.some(q=>!Number.isFinite(q.x)||!Number.isFinite(q.z)))throw Error('Invalid movement trail.');const points=[start,...trail,{x,z}];const distance=points.slice(1).reduce((sum,q,i)=>sum+Math.hypot(q.x-points[i].x,q.z-points[i].z),0),elapsed=Math.max(2,(now-(p.updatedAt||now))/1000);
  if(distance>Math.min(240,elapsed*18+18))throw Error('You are moving too far in one step.');
  if(p.dungeon){if(a.space!==p.dungeon.id)throw Error('Your location changed. Reload and try again.');const d=resolveDungeon(p.dungeon.id);if(points.slice(1).some((q,i)=>!cavePathClear(d,points[i],q)))throw Error('A dungeon wall blocks the way.');next.dungeon.x=x;next.dungeon.z=z;const room=roomAt(d,x,z);if(room!==null&&!next.caves[d.id].rooms.includes(room))next.caves[d.id].rooms.push(room);extra={dungeon:d.id,room};}
  else{if(a.space&&a.space!=='overworld')throw Error('You are not inside that dungeon.');if(waterDistance(x,z)<-4&&roadDistance(x,z,roadSegments(Math.floor(x/REGION),Math.floor(z/REGION)))>7)throw Error('Deep water blocks the way. Look for a bridge.');next.x=x;next.z=z;const s=nearestSettlement(x,z);if(s.distance<80&&!next.visited.includes(s.id))next.visited.push(s.id);}
  next.distance=(p.distance||0)+distance;next.food=Math.max(5,p.food-distance*.008);next.water=Math.max(5,p.water-distance*.013);summary=`Walked ${Math.round(distance)} m`;break;
 }
 case 'gather':{
  const r=p.dungeon?resolveCaveResource(String(a.target)):resolveResource(String(a.target));if(!r||r.space&&r.space!==p.dungeon?.id)throw Error('This resource does not exist here.');
  const pos=p.dungeon||p;if(Math.hypot(pos.x-r.x,pos.z-r.z)>(p.dungeon?5:11))throw Error('Walk closer to gather this.');
  if(p.dungeon&&!cavePathClear(resolveDungeon(p.dungeon.id),pos,r))throw Error('A dungeon wall blocks the way.');if(context.depleted)throw Error('Someone has already gathered this resource.');
  const count=r.count||(r.kind==='wood'?3:r.kind==='stone'?2:3);next.inventory[r.kind]+=count;
  if(p.dungeon&&!next.caves[p.dungeon.id].gathered.includes(r.id))next.caves[p.dungeon.id].gathered.push(r.id);
  extra={resource:r.id,space:r.space||'overworld',kind:r.kind,count};summary=`Gathered ${count} ${r.kind}`;break;
 }
 case 'eat':if(next.inventory.berries<1)throw Error('Gather some berries first.');next.inventory.berries--;next.food=Math.min(100,next.food+24);summary='Ate berries';break;
 case 'drink':surface();if(nearestSettlement(p.x,p.z).distance>48&&waterDistance(p.x,p.z)>27)throw Error('Find a village well or the edge of a river.');next.water=100;summary='Filled water at a well or river';break;
 case 'rest':surface();if(nearestSettlement(p.x,p.z).distance>85&&Math.hypot(p.x-p.house.x,p.z-p.house.z)>14)throw Error('Rest at home or in a settlement.');next.health=100;next.food=Math.min(100,next.food+8);summary='Rested at the settlement';break;
 case 'rename':next.name=cleanName(a.name);next.house.ownerName=next.name;next.introduced=true;summary=`Now known as ${next.name}`;break;
 case 'talk':{
  surface();const npc=resolveNpc(String(a.target));if(!npc)throw Error('This person does not exist.');if(Math.hypot(p.x-npc.x,p.z-npc.z)>15)throw Error('Walk closer to speak.');
  const message=String(a.message||'').trim();if(!message||message.length>800)throw Error('Write a message of 1–800 characters.');const response=npcReply(npc,p,message,context.memories||[]);extra={npc:npc.id,message,response};summary=`Spoke with ${npc.name}`;break;
 }
 default:throw Error('Unknown action.');
 }
 next.revision=(p.revision||0)+1;next.updatedAt=now;return {player:next,extra,summary};
}
export function npcGreeting(npc,p,known=false){return known?`Ah, ${p.name}. Good to see you back in ${npc.village}. What news do you bring?`:{gatherer:`Mind the roots beyond the road, stranger. I'm ${npc.name}. The woods provide, if you know where to look.`,keeper:`Welcome to ${npc.village}. I'm ${npc.name}, keeper of this place. You've a roof here now; make yourself at home.`,wayfarer:`Another traveler! I'm ${npc.name}. Sit a moment. There's more beyond these hills than the map admits.`}[npc.role];}
export function npcReply(npc,p,message,memories) {
 const mine=memories.filter(m=>m.playerId===p.id),lower=message.toLowerCase(),words=lower.match(/[\p{L}\p{N}]{4,}/gu)||[];
 const stop=new Set(['remember','recall','about','what','told','know','that','your','have','would','please']);
 const scored=memories.map((m,i)=>({m,score:words.filter(w=>!stop.has(w)).reduce((s,w)=>s+(m.message.toLowerCase().includes(w)?1:0),0),i})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.i-b.i),match=scored[0]?.m;
 if(/remember|recall|told|memory|know about|what did|onthoud|weet|verteld/.test(lower)){const m=match||mine[0]||memories[0];return m?`${m.playerId===p.id?'You':m.playerName||'A traveler'} spoke of this: “${m.message}” A detail like that stays with a person.`:`We haven't traded stories yet, ${p.name}. What should I remember?`;}
 if(/ruin|dungeon|cave|barrow|ancient/.test(lower))return `There's an old ruin beyond ${npc.village}, a short walk into the wilderness. A stair descends beneath its broken arch. Take provisions, and remember your way back. The map marks it with a diamond.`;
 if(/home|house|roof/.test(lower))return `Your cottage stands on the edge of ${p.house?.villageName||npc.village}. Follow the house mark on your map. You'll wake at your own doorstep when you return.`;
 if(/water|thirst|drink/.test(lower))return `Try the well in ${npc.village}. Cold, clean water. The riverbanks will do in a pinch, but cross the deep channels by a bridge.`;
 if(/food|hungry|berries|gather|surviv/.test(lower))return 'Those red berry bushes beyond the cottages will fill your belly. Save some for the old ruins. Wood, stone, and good fiber are worth carrying too.';
 if(/road|where|village|settlement|travel/.test(lower))return `Follow the ochre road, and sooner or later you'll find another hearth. Or leave it behind—there are older places hidden between the settlements.`;
 if(/build|craft/.test(lower))return 'Keep your timber straight and your stone dry. A cottage is a beginning. In time, there will be more to build.';
 if(/hello|hi\b|hey|greet/.test(lower))return npcGreeting(npc,p,mine.length>0);
 if(match&&match.playerId!==p.id)return `${match.playerName||'Another traveler'} spoke of something similar: “${match.message}” Strange how stories find each other.`;
 const starts={gatherer:'They say the woods keep secrets. People do too.',keeper:'I hear a good many tales by this well.',wayfarer:'On the road, a story can be worth as much as a meal.'};
 return `${starts[npc.role]} ${/\?$/.test(message)?`I can't answer that yet, ${p.name}. But I'll keep your question in mind.`:`“${message}” I'll remember your words, ${p.name}.`}`;
}
export function createPlayer(id,name,plot=0){const p=normalizePlayer({...initialPlayer(id,cleanName(name)),introduced:false,updatedAt:Date.now()},plot);p.x=p.house.doorX;p.z=p.house.doorZ;return p;}
