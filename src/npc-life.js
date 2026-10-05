import {npcsFor,resolveNpc,settlement,hash,REGION,LIMIT,heightAt,WATER} from './world.js?v=11';
import {villageObstacles} from './scene-layout.js?v=15';
import {hitsObstacle,findSurfacePath} from './world-collision.js?v=11';

// Absolute time, not frame counters: unloading a colony never resets a person's day.
export const WORLD_EPOCH=Date.UTC(2026,0,1),DAY_MS=30*60*1000;
const pausedAt=(life,now)=>(life.pausedMs||0)+(life.meeting?Math.max(0,Math.min(now,life.meeting.until)-(life.meeting.startedAt||life.meeting.until)):0);
const routes=new Map(),mod=(n,d)=>((n%d)+d)%d;
export function worldDay(now=Date.now()){return Math.floor((now-WORLD_EPOCH)/DAY_MS);}
export function roadPeopleFor(rx,rz){
 const s=settlement(rx,rz);
 return [0,1].map(axis=>({id:`${s.id}:runner:${axis}`,name:['Vex','Neri','Sol','Kade','Lumi','Rook'][Math.floor(hash(rx,rz,9200+axis)*6)],role:'wayfarer',affiliation:axis?'Dugall Freight':'Independent Drifters',village:s.name,home:s.id,road:true,axis,x:s.x,z:s.z,y:s.y}));
}
export function baseNpc(id){const match=/^v:(-?\d+):(-?\d+):runner:([01])$/.exec(String(id));if(match){const rx=+match[1],rz=+match[2];if(Math.abs(rx*REGION)>LIMIT||Math.abs(rz*REGION)>LIMIT)return null;return roadPeopleFor(rx,rz)[+match[3]];}return resolveNpc(id);}
function routeFor(n){
 if(routes.has(n.id))return routes.get(n.id);n=baseNpc(n.id)||n;
 const [,rx,rz]=n.home.split(':'),s=settlement(+rx,+rz);let stops;
 if(n.road){
  const e=settlement(+rx+(n.axis===0?1:0),+rz+(n.axis===1?1:0)),mid={x:(s.x+e.x)/2+Math.sin(+rx+(+rz))*55,z:(s.z+e.z)/2+Math.cos(+rx-(+rz))*55};
  const inset=(a,b)=>{const length=Math.hypot(b.x-a.x,b.z-a.z);return {x:a.x+(b.x-a.x)*60/length,z:a.z+(b.z-a.z)*60/length};};
  stops=[{...inset(s,mid),activity:`collecting freight at ${s.name}`,wait:65},{...mid,activity:'checking the road beacon',wait:20},{...inset(e,mid),activity:`delivering freight to ${e.name}`,wait:65},{...mid,activity:'checking the return manifest',wait:20}];
 }else if(n.role==='smith'){
  stops=[{x:n.x,z:n.z,activity:'working the induction bay',wait:160},{x:n.x+1,z:n.z-3,activity:'checking alloy stock',wait:55},{x:n.x+1,z:n.z+3,activity:'taking a breather by the bay',wait:40}];
 }else{
  const tasks={gatherer:['sorting recovered salvage','checking the colony recycler','inspecting nutrient stores','resting before another salvage run'],keeper:['checking arrival manifests','listening to colony comms','inspecting the beacon','taking a quiet break'],wayfarer:['sorting freight manifests','waiting for the next shuttle','checking road reports','resting between deliveries']}[n.role];
  stops=[[-12,8],[-12,-17],[3,-17],[14,3]].map(([x,z],i)=>({x:s.x+x,z:s.z+z,activity:tasks[i],wait:35+hash(+rx,+rz,9400+i+Number(n.id.at(-1))*4)*55}));
 }
 const obstacles=n.road?[]:villageObstacles(s),clear=(a,b)=>!obstacles.some(o=>hitsObstacle(a,b,o,.5)),segments=[];let duration=0;
 for(let i=0;i<stops.length;i++){
  const a=stops[i],b=stops[(i+1)%stops.length];segments.push({a,b:a,start:duration,duration:a.wait,activity:a.activity,moving:false});duration+=a.wait;
  const points=n.road?[b]:(findSurfacePath(a,b,clear,{step:1.5,margin:14})||[a]);let prev=a;
  for(const q of points){const seconds=Math.hypot(q.x-prev.x,q.z-prev.z)/(n.road?1.9:1.25);if(seconds>0){segments.push({a:prev,b:q,start:duration,duration:seconds,activity:n.road?'walking the freight road':`walking to ${b.activity}`,moving:true});duration+=seconds;}prev=q;}
 }
 const route={segments,duration,offset:hash(+rx,+rz,9500+Number(n.id.at(-1)))*duration};routes.set(n.id,route);if(routes.size>256)routes.delete(routes.keys().next().value);return route;
}
export function npcAt(n,now=Date.now(),life={}){
 if(!n)return null;
 const route=routeFor(n),time=mod((now-WORLD_EPOCH-pausedAt(life,now))/1000+route.offset,route.duration),segment=route.segments.find(s=>time<s.start+s.duration)||route.segments.at(-1),t=(time-segment.start)/segment.duration;
 let x=segment.a.x+(segment.b.x-segment.a.x)*t,z=segment.a.z+(segment.b.z-segment.a.z)*t,activity=segment.activity,moving=segment.moving;
 const meeting=life.meeting;if(meeting&&meeting.until>now){x=meeting.x;z=meeting.z;activity='talking with a traveler';moving=false;}
 return {...n,x,z,y:n.road?Math.max(WATER+.8,heightAt(x,z)):heightAt(x,z),activity,moving,heading:Math.atan2(segment.b.x-segment.a.x,segment.b.z-segment.a.z),schedule:route.segments.filter(s=>!s.moving).map(s=>s.activity),day:worldDay(now)};
}
export function locateNpc(id,now=Date.now(),life={}){return npcAt(baseNpc(id),now,life[id]||{});}
export function peopleNear(p,now=Date.now(),life={},radius=850){
 if(p.dungeon)return [];
 const rx=Math.floor(p.x/REGION),rz=Math.floor(p.z/REGION),people=[];
 for(let x=rx-1;x<=rx+1;x++)for(let z=rz-1;z<=rz+1;z++)for(const n of (Math.abs(x*REGION)>LIMIT||Math.abs(z*REGION)>LIMIT?[]:[...npcsFor(settlement(x,z)),...roadPeopleFor(x,z)])){const person=npcAt(n,now,life[n.id]);if(Math.hypot(person.x-p.x,person.z-p.z)<radius)people.push(person);}
 return people;
}
export function advanceNpcLife(n,life={},now=Date.now()){
 const observations=[...(life.observations||[])],seen=new Set(observations.map(o=>o.id)),add=o=>{if(!seen.has(o.id)){seen.add(o.id);observations.push(o);}};
 // Remember actual routine checkpoints, catch up at most one world day after an absence.
 const since=Math.max(life.updatedAt||now-1,now-DAY_MS),route=routeFor(n),seconds=(now-WORLD_EPOCH-pausedAt(life,now))/1000+route.offset,start=(since-WORLD_EPOCH-pausedAt(life,since))/1000+route.offset;
 for(let cycle=Math.floor(start/route.duration);cycle<=Math.floor(seconds/route.duration);cycle++)for(const segment of route.segments.filter(s=>!s.moving)){
  const tick=cycle*route.duration+segment.start,createdAt=WORLD_EPOCH+(tick-route.offset)*1000+pausedAt(life,now);
  if(tick>start&&tick<=seconds&&!(life.meeting&&life.meeting.until>createdAt))add({id:`${n.id}:routine:${worldDay(createdAt)}:${segment.activity}`,kind:'routine',createdAt,summary:`I was ${segment.activity}.`});
 }
 if(!observations.length){const at=npcAt(n,now,life);add({id:`${n.id}:first:${worldDay(now)}`,kind:'routine',createdAt:now,summary:`I was ${at.activity}.`});}
 return {...life,updatedAt:Math.max(life.updatedAt||0,now),observations};
}
export function witnessAction(p,a,now=Date.now(),life={}){
 if(p.dungeon||!['move','gather','talk','attack','jump','forge-start'].includes(a.type))return [];
 const descriptions={move:`I saw ${p.name} ${a.runDistance>0?'running through':'passing through'} the colony tracks.`,gather:`I saw ${p.name} recover salvage nearby.`,talk:`${p.name} stopped to speak with me.`,attack:`I saw ${p.name} swing a weapon.`,jump:`I saw ${p.name} jump in their suit.`, 'forge-start':`${p.name} rented the induction bay.`};
 return peopleNear(p,now,life,24).filter(n=>a.type!=='talk'||n.id===a.target).map(n=>({npc:n.id,observation:{id:`${n.id}:seen:${worldDay(now)}:${p.id}:${a.type}:${a.target||''}`,kind:'witness',createdAt:now,summary:descriptions[a.type]}}));
}
export function rememberObservation(life,o){return {...life,observations:(life.observations||[]).some(v=>v.id===o.id)?life.observations:[...(life.observations||[]),o]};}
export function meetNpc(n,life,now=Date.now()){const current=npcAt(n,now,life);return {...life,pausedMs:pausedAt(life,now),meeting:{x:current.x,z:current.z,startedAt:now,until:now+120000}};}

export function mergeLifeMaps(current={},incoming={}){
 const result={...current};for(const [id,next]of Object.entries(incoming)){
  const previous=result[id]||{},observations=Array.from(new Map([...(previous.observations||[]),...(next.observations||[])].map(o=>[o.id,o])).values()).sort((a,b)=>a.createdAt-b.createdAt),newerMeeting=(previous.meeting?.startedAt||0)>(next.meeting?.startedAt||0);
  result[id]={...previous,...next,observations,updatedAt:Math.max(previous.updatedAt||0,next.updatedAt||0)};
  if(newerMeeting){result[id].meeting=previous.meeting;result[id].pausedMs=previous.pausedMs;}
 }return result;
}
