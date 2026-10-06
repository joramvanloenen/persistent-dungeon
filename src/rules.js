import {locateNpc} from './npc-life.js?v=19';
import {RESOURCE_NAMES,loreReply,containsPowerball} from './fringe-lore.js?v=11';
import {applyTransit,planetAt,planetContains} from './planets.js?v=11';
import {initialPlayer,nearestSettlement,waterDistance,resolveResource,resolveNpc,LIMIT,roadDistance,roadSegments,REGION,smithFor,settlement} from './world.js?v=11';
import {normalizePlayer} from './homes.js?v=11';
import {applyActionGame} from './action-game.js?v=11';
import {buildSurfaceCollisions,waterPathClear} from './world-collision.js?v=19';
import {resolveDungeon,resolveCaveResource,cavePathClear,caveWalkable,roomAt,ruinFor} from './dungeons.js?v=11';
export const RESOURCE_LABELS=RESOURCE_NAMES;
export function cleanName(s){return String(s||'Traveler').trim().slice(0,28)||'Traveler';}
export function validateAction(input,a,context={}) {
 const p=normalizePlayer(input),next=structuredClone(p),now=context.now||Date.now();let extra={},summary='';
 if(!a||typeof a.type!=='string')throw Error('Choose an action.');
 const surface=()=>{if(p.dungeon)throw Error('Leave the facility first.');};
 switch(a.type){
 case 'return-home':next.x=p.house.doorX;next.z=p.house.doorZ;next.dungeon=null;summary=`Rejoined your landing pod in ${p.house.villageName}`;next.planet=planetAt(next.x,next.z).id;if(!next.visitedPlanets.includes(next.planet))next.visitedPlanets.push(next.planet);extra={home:p.house.id};break;
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
  const x=Number(a.x),z=Number(a.z);if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>LIMIT||Math.abs(z)>LIMIT)throw Error('That destination is outside the survey.');
  const start=p.dungeon||p,trail=Array.isArray(a.trail)?a.trail:[];if(trail.length>80||trail.some(q=>!Number.isFinite(q.x)||!Number.isFinite(q.z)))throw Error('Invalid movement trail.');const points=[start,...trail,{x,z}];const distance=points.slice(1).reduce((sum,q,i)=>sum+Math.hypot(q.x-points[i].x,q.z-points[i].z),0),elapsed=Math.max(2,(now-(p.updatedAt||now))/1000);
  if(distance>Math.min(240,elapsed*24+18))throw Error('You are moving too far in one step.');
  if(p.dungeon){if(a.space!==p.dungeon.id)throw Error('Your location changed. Reload and try again.');const d=resolveDungeon(p.dungeon.id);if(points.slice(1).some((q,i)=>!cavePathClear(d,points[i],q)))throw Error('A dungeon wall blocks the way.');next.dungeon.x=x;next.dungeon.z=z;const room=roomAt(d,x,z);if(room!==null&&!next.caves[d.id].rooms.includes(room))next.caves[d.id].rooms.push(room);extra={dungeon:d.id,room};}
  else{if(points.slice(1).some(q=>!planetContains(p.planet,q.x,q.z)))throw Error('This survey ends here. Book transit to reach another planet.');if(a.space&&a.space!=='overworld')throw Error('You are not inside that dungeon.');const homes=context.homes||[p.house],collision=buildSurfaceCollisions(points,{homes,depletedIds:context.depletedIds||[]});if(points.slice(1).some((q,i)=>collision.blocked(points[i],q)))throw Error('A solid obstacle blocks the way. Walk around it.');if(points.slice(1).some((q,i)=>!waterPathClear(points[i],q)))throw Error('Deep water blocks the way. Look for a bridge.');next.x=x;next.z=z;const s=nearestSettlement(x,z);if(s.distance<80&&!next.visited.includes(s.id))next.visited.push(s.id);}
  const running=Number(a.runDistance||0);if(!Number.isFinite(running)||running<0||running>distance+.5)throw Error('Invalid running distance.');next.actionStats.runDistance+=running;next.distance=(p.distance||0)+distance;next.food=Math.max(5,p.food-distance*.008-running*.005);next.water=Math.max(5,p.water-distance*.013-running*.008);summary=`${running>0?'Traveled':'Walked'} ${Math.round(distance)} m`;break;
 }
 case 'gather':{
  const r=p.dungeon?resolveCaveResource(String(a.target)):resolveResource(String(a.target));if(!r||r.space&&r.space!==p.dungeon?.id)throw Error('This resource does not exist here.');
  const pos=p.dungeon||p;if(Math.hypot(pos.x-r.x,pos.z-r.z)>(p.dungeon?5:11))throw Error('Walk closer to gather this.');
  if(p.dungeon&&!cavePathClear(resolveDungeon(p.dungeon.id),pos,r))throw Error('A dungeon wall blocks the way.');if(context.depleted)throw Error('Someone has already gathered this resource.');
  const count=r.count||(r.kind==='wood'?3:r.kind==='stone'?2:3);next.inventory[r.kind]+=count;
  if(r.kind==='stone')next.inventory.iron+=p.dungeon?2:1;const powerball=containsPowerball(r);if(powerball)next.inventory.powerballs++;
  if(p.dungeon&&!next.caves[p.dungeon.id].gathered.includes(r.id))next.caves[p.dungeon.id].gathered.push(r.id);
  extra={resource:r.id,space:r.space||'overworld',kind:r.kind,count};summary=`Recovered ${count} ${RESOURCE_NAMES[r.kind].toLowerCase()}${r.kind==='stone'?` and ${p.dungeon?2:1} alloy fragments`:''}${powerball?' · Powerball recovered':''}`;break;
 }
 case 'eat':if(next.inventory.berries<1)throw Error('Gather some nutrient pods first.');next.inventory.berries--;next.food=Math.min(100,next.food+24);summary='Consumed a nutrient pod';break;
 case 'drink':surface();if(nearestSettlement(p.x,p.z).distance>48&&waterDistance(p.x,p.z)>27)throw Error('Find a colony recycler or a riverbank.');next.water=100;summary='Refilled the water reservoir';break;
 case 'rest':surface();if(nearestSettlement(p.x,p.z).distance>85&&Math.hypot(p.x-p.house.x,p.z-p.house.z)>14)throw Error('Rest at your landing pod or in a colony.');next.health=100;next.food=Math.min(100,next.food+8);summary='Recovered at the colony';break;
 case 'rename':next.name=cleanName(a.name);next.house.ownerName=next.name;next.introduced=true;summary=`Now known as ${next.name}`;break;
 case 'talk':{
  surface();const npc=locateNpc(String(a.target),now,context.npcLife);if(!npc)throw Error('This person does not exist.');if(Math.hypot(p.x-npc.x,p.z-npc.z)>15)throw Error('Walk closer to speak.');
  const message=String(a.message||'').trim();if(!message||message.length>800)throw Error('Write a message of 1–800 characters.');const response=npcReply(npc,p,message,context.memories||[],context.npcLife?.[npc.id]?.observations||[]);extra={npc:npc.id,message,response};summary=`Spoke with ${npc.name}`;break;
 }
 default:{const result=applyTransit(p,next,a,now)||applyActionGame(p,next,a,now);if(!result)throw Error('Unknown action.');({summary,extra}=result);}
 }
 next.revision=(p.revision||0)+1;next.updatedAt=now;return {player:next,extra,summary};
}
export function npcGreeting(npc,p,known=false){return known?`Back on the surface, ${p.name}? ${npc.village} is still holding together. What did you find?`:{gatherer:`Fresh landing? I'm ${npc.name}. Out here, biomass and silicate are worth more than promises. Keep your scanner close.`,keeper:`Welcome to ${npc.village}. I'm ${npc.name}, colony steward. Your landing pod is yours. Beyond our beacon, you're on your own.`,wayfarer:`I'm ${npc.name}. Freight runner. Dugall gets you here; the Drifters teach you how to stay alive. Looking for another planet?`,smith:`${npc.name}. Fabricator. Bring alloy fragments, biomass, and credits. I'll rent you the induction bay. Orange heat, then a clean strike pattern.`}[npc.role];}
export function npcReply(npc,p,message,memories,observations=[]) {
 const mine=memories.filter(m=>m.playerId===p.id),lower=message.toLowerCase(),words=lower.match(/[\p{L}\p{N}]{4,}/gu)||[];
 const stop=new Set(['remember','recall','about','what','told','know','that','your','have','would','please']);
 const scored=memories.map((m,i)=>({m,score:words.filter(w=>!stop.has(w)).reduce((s,w)=>s+(m.message.toLowerCase().includes(w)?1:0),0),i})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.i-b.i),match=scored[0]?.m;
 if(/schedule|routine|your day|what are you doing|where are you going/.test(lower))return `Right now I'm ${npc.activity||'working in the colony'}. My usual circuit: ${(npc.schedule||[]).join('; ')||'the colony tracks'}.`;
 if(/observ|notice|seen|saw|happening|news|around here/.test(lower)){const matching=observations.filter(o=>words.some(w=>!['what','have','noticed','around','here','seen','observations'].includes(w)&&o.summary.toLowerCase().includes(w)));const recent=(matching.length?matching:observations).slice().sort((a,b)=>(b.kind==='witness')-(a.kind==='witness')||b.createdAt-a.createdAt).slice(0,3);return recent.length?recent.map(o=>o.summary).join(' '):`I'm ${npc.activity||'watching the colony tracks'}. No fresh sightings to report yet.`;}
 const history=loreReply(message);
 if(/remember|recall|told|memory|onthoud|weet|verteld|what did (?:i|we|you) (?:say|tell)/.test(lower)||/know about|what did/.test(lower)&&!history){const m=match||mine[0]||memories[0];return m?`${m.playerId===p.id?'You':m.playerName||'A traveler'} spoke of this: “${m.message}” A detail like that stays with a person.`:`We haven't traded stories yet, ${p.name}. What should I remember?`;}
 if(history)return history;
 if(/ruin|dungeon|cave|barrow|ancient|facility|bunker|site/.test(lower))return `There's a sealed industrial site beyond ${npc.village}. Old freight hardware, abandoned extraction lines, active security. Diamond marks on the survey locate the access locks. Supplies remain below, but don't count on the power being off.`;
 if(/home|house|roof|pod/.test(lower))return `Your landing pod is at the edge of ${p.house?.villageName||npc.village}. Its marker is on your surface survey. You'll wake there when you return; your cargo and conversations stay with you.`;
 if(/planet|transit|shuttle|ship|land/.test(lower))return 'Open your surface map and choose Planet transit. Colony beacons connect you to Dugall shuttles. Your arrival voucher covers one trip; later passage costs four credits or a Powerball. No public transit runs this far out.';
 if(/water|thirst|drink/.test(lower))return `The recycler in ${npc.village} is clean. Your suit can filter river water too. Stay on the freight bridges when the channels deepen.`;
 if(/food|hungry|berries|gather|surviv|supplies/.test(lower))return 'Nutrient pods grow in the low bushes. Biomass, silicate, and biofilament keep your kit working. Some mineral deposits contain Powerballs. Fabricators also refine them from silicate and alloy fragments.';
 if(/road|where|village|settlement|travel|colony/.test(lower))return `Follow the service tracks to another beacon. Every colony here has its own arrangements. Round Power contracts, Dugall freight, independent Drifters. There is no authority to settle your disputes for you.`;
 if(/smith|forge|weapon|craft|fabricat/.test(lower)){const s=nearestSettlement(p.x,p.z);let best=null,dist=Infinity;for(let x=s.rx-2;x<=s.rx+2;x++)for(let z=s.rz-2;z<=s.rz+2;z++){const n=smithFor(settlement(x,z));if(n&&Math.hypot(p.x-n.x,p.z-n.z)<dist){best=n;dist=Math.hypot(p.x-n.x,p.z-n.z);}}return best?`${best.name} runs a fabrication bay in ${best.village}. Look for the tool mark on your survey. Salvage silicate for alloy fragments, or buy a supply bundle. Pay the rental fee, heat the blank, and complete its strike pattern.`:'Follow a colony beacon to find a fabrication bay.';}
 if(/hello|hi\b|hey|greet/.test(lower))return npcGreeting(npc,p,mine.length>0);
 if(match&&match.playerId!==p.id)return `${match.playerName||'Another traveler'} spoke of something similar: “${match.message}” Strange how stories find each other.`;
 const starts={gatherer:'Old hardware keeps secrets. Drifters do too.',keeper:'I hear a lot over the colony comms.',wayfarer:'A good story can buy passage out here.',smith:'Alloy holds its shape. I hold onto a good story.'};
 return `${starts[npc.role]} ${/\?$/.test(message)?`I can't answer that yet, ${p.name}. But I'll keep your question in mind.`:`“${message}” I'll remember your words, ${p.name}.`}`;
}
export function createPlayer(id,name,plot=0){const p=normalizePlayer({...initialPlayer(id,cleanName(name)),introduced:false,updatedAt:Date.now()},plot);p.x=p.house.doorX;p.z=p.house.doorZ;return p;}
