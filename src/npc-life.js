import {npcsFor,resolveNpc,settlement,hash,REGION,LIMIT,heightAt,WATER} from './world.js?v=11';
import {landingBay,shipVisitor,portBroker,resolvePortPerson,parkedShipObstacles} from './landing-port.js?v=24';
import {villageHouses,villageObstacles} from './scene-layout.js?v=24';
import {hitsObstacle,findSurfacePath} from './world-collision.js?v=24';

// Absolute time, not frame counters: unloading a colony never resets a person's day.
export const WORLD_EPOCH=Date.UTC(2026,0,1),DAY_MS=30*60*1000;
const pausedAt=(life,now)=>(life.pausedMs||0)+(life.meeting?Math.max(0,Math.min(now,life.meeting.until)-(life.meeting.startedAt||life.meeting.until)):0);
const routes=new Map(),mod=(n,d)=>((n%d)+d)%d;
export function worldDay(now=Date.now()){return Math.floor((now-WORLD_EPOCH)/DAY_MS);}
export function roadPeopleFor(rx,rz){
 const s=settlement(rx,rz);
 return [0,1].map(axis=>({id:`${s.id}:runner:${axis}`,name:['Vex','Neri','Sol','Kade','Lumi','Rook'][Math.floor(hash(rx,rz,9200+axis)*6)],role:'wayfarer',affiliation:axis?'Dugall Freight':'Independent Drifters',village:s.name,home:s.id,road:true,axis,x:s.x,z:s.z,y:s.y}));
}
export function baseNpc(id){const match=/^v:(-?\d+):(-?\d+):runner:([01])$/.exec(String(id));if(match){const rx=+match[1],rz=+match[2];if(Math.abs(rx*REGION)>LIMIT||Math.abs(rz*REGION)>LIMIT)return null;return roadPeopleFor(rx,rz)[+match[3]];}return resolvePortPerson(id)||resolveNpc(id);}
function visitorRoute(n,s){
 const bay=landingBay(s),hatch={x:bay.x+3.2,z:bay.z+5.2},ramp={x:bay.x+6.5,z:bay.z+5.2},houses=villageHouses(s),door=h=>({x:h.x+Math.sin(h.rotation)*(h.depth/2+1.5),z:h.z+Math.cos(h.rotation)*(h.depth/2+1.5)}),market={x:s.x+18,z:s.z+7},bar=door(houses[2]),pod=door(houses[5]),broker=portBroker(s),obstacles=[...villageObstacles(s),...parkedShipObstacles({...bay,id:n.shipId,parked:true})],clear=(a,b)=>!obstacles.some(o=>hitsObstacle(a,b,o,.5)),segments=[];let duration=0;
 const add=(a,b,seconds,activity,data={})=>{segments.push({a,b,start:duration,duration:seconds,activity,moving:a.x!==b.x||a.z!==b.z,...data});duration+=seconds;};
 const walk=(a,b,activity,data)=>{const points=findSurfacePath(a,b,clear,{step:1,margin:16});if(!points)throw Error(`No visitor route in ${s.id}`);let previous=a;for(const q of points){const seconds=Math.hypot(q.x-previous.x,q.z-previous.z)/1.45;if(seconds)add(previous,q,seconds,activity,data);previous=q;}};
 for(let visit=0;visit<6;visit++){
  const objective=['supplies','bar','meeting'][(visit+Math.floor(hash(s.rx,s.rz,9614)*3))%3],target=objective==='supplies'?market:objective==='bar'?bar:{x:broker.x+1.8,z:broker.z},stay=visit%2===0,common={visit,objective,stay,completed:false};
  add(hatch,hatch,22,'bringing the skiff in to land',{...common,phase:'landing',available:false});
  add(hatch,hatch,5,'opening the hatch',{...common,phase:'unloading',available:false,checkpoint:`I landed ${n.shipName} at ${s.name}.`});
  walk(hatch,ramp,'stepping down from my ship',{...common,phase:'disembarking',available:true});
  walk(ramp,target,objective==='supplies'?'walking to the supply counter':objective==='bar'?'walking to the hull bar':`walking to meet ${broker.name}`,{...common,phase:'walking',available:true});
  add(target,target,objective==='bar'?45:35,objective==='supplies'?'buying nutrient pods and fuel cells':objective==='bar'?'having a drink inside the hull bar':`trading road reports with ${broker.name}`,{...common,phase:'objective',available:objective!=='bar',inside:objective==='bar'});
  const completed=objective==='supplies'?'I bought nutrient pods and fuel cells at the supply counter.':objective==='bar'?'I visited the hull bar and listened to the local gossip.':`I exchanged road reports with ${broker.name}.`;
  add(target,target,3,'finishing my business',{...common,phase:'finished',available:true,completed:true,checkpoint:completed});
  common.completed=true;let from=target;
  if(stay){walk(target,pod,'walking to my rented crew pod',{...common,phase:'walking',available:true});add(pod,pod,80,'resting inside a rented crew pod',{...common,phase:'lodging',available:false,inside:true,checkpoint:'I rented a crew pod for a short rest.'});from=pod;}
  walk(from,ramp,'returning to my own ship',{...common,phase:'returning',available:true});
  walk(ramp,hatch,'boarding my skiff',{...common,phase:'boarding',available:true});
  add(hatch,hatch,5,'sealing the hatch',{...common,phase:'sealed',available:false});
  add(hatch,hatch,18,'launching for the next colony',{...common,phase:'takeoff',available:false});
  add(hatch,hatch,55,'flying between colonies',{...common,phase:'away',available:false,checkpoint:`I departed in ${n.shipName}.`});
 }
 return {segments,duration,offset:hash(s.rx,s.rz,9615)*duration};
}
function routeFor(n){
 if(routes.has(n.id))return routes.get(n.id);n=baseNpc(n.id)||n;
 const [,rx,rz]=n.home.split(':'),s=settlement(+rx,+rz);if(n.visitor){const route=visitorRoute(n,s);routes.set(n.id,route);return route;}let stops;
 if(n.broker){stops=[{x:n.x,z:n.z,activity:'checking landing manifests at the comms counter',wait:60},{x:n.x,z:n.z,activity:'selling fuel permits to passing pilots',wait:50}];}else if(n.road){
  const e=settlement(+rx+(n.axis===0?1:0),+rz+(n.axis===1?1:0)),mid={x:(s.x+e.x)/2+Math.sin(+rx+(+rz))*55,z:(s.z+e.z)/2+Math.cos(+rx-(+rz))*55};
  const inset=(a,b)=>{const length=Math.hypot(b.x-a.x,b.z-a.z);return {x:a.x+(b.x-a.x)*60/length,z:a.z+(b.z-a.z)*60/length};};
  stops=[{...inset(s,mid),activity:`collecting freight at ${s.name}`,wait:65},{...mid,activity:'checking the road beacon',wait:20},{...inset(e,mid),activity:`delivering freight to ${e.name}`,wait:65},{...mid,activity:'checking the return manifest',wait:20}];
 }else if(n.role==='smith'){
  stops=[{x:n.x,z:n.z,activity:'working the induction bay',wait:160},{x:n.x+1,z:n.z-3,activity:'checking alloy stock',wait:55},{x:n.x+1,z:n.z+3,activity:'taking a breather by the bay',wait:40}];
 }else{
  const tasks={gatherer:['sorting recovered salvage','checking the colony recycler','inspecting nutrient stores','resting before another salvage run'],keeper:['checking arrival manifests','listening to colony comms','inspecting the beacon','taking a quiet break'],wayfarer:['sorting freight manifests','waiting for the next shuttle','checking road reports','resting between deliveries']}[n.role];
  stops=[[-12,8],[-12,-17],[3,-17],[14,3]].map(([x,z],i)=>({x:s.x+x,z:s.z+z,activity:tasks[i],wait:35+hash(+rx,+rz,9400+i+Number(n.id.at(-1))*4)*55}));
 }
 const obstacles=n.road?[]:[...villageObstacles(s),...parkedShipObstacles({...landingBay(s),id:`${s.id}:skiff`,parked:true})],clear=(a,b)=>!obstacles.some(o=>hitsObstacle(a,b,o,.5)),segments=[];let duration=0;
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
 return {...n,...(n.visitor?{phase:segment.phase,completed:segment.completed,objective:segment.objective,stay:segment.stay,available:segment.available,inside:segment.inside||false,visit:Math.floor(((now-WORLD_EPOCH-pausedAt(life,now))/1000+route.offset)/route.duration)*6+segment.visit,phaseProgress:Math.max(0,Math.min(1,t))}:{}),x,z,y:n.road?Math.max(WATER+.8,heightAt(x,z)):heightAt(x,z),activity,moving,heading:Math.atan2(segment.b.x-segment.a.x,segment.b.z-segment.a.z),schedule:route.segments.filter(s=>!s.moving).map(s=>s.activity),day:worldDay(now)};
}
export function locateNpc(id,now=Date.now(),life={}){const n=npcAt(baseNpc(id),now,life[id]||{});return n?.available===false?null:n;}
export function portShipAt(s,now=Date.now(),life={}){
 const pilot=shipVisitor(s),at=npcAt(pilot,now,life[pilot.id]||{}),bay=landingBay(s),t=at.phaseProgress,ease=t*t*(3-2*t),landing=at.phase==='landing',takeoff=at.phase==='takeoff',flying=landing||takeoff,q=landing?1-ease:takeoff?ease:0;
 return {id:pilot.shipId,name:pilot.shipName,pilot:pilot.id,x:bay.x+(landing?-1:1)*q*65,y:bay.y+q*55,z:bay.z-q*35,phase:at.phase,visible:at.phase!=='away',parked:!flying&&at.phase!=='away',hatchOpen:['disembarking','walking','objective','finished','lodging','returning','boarding'].includes(at.phase),enginePower:flying?1:at.phase==='sealed'?.6:0,visit:at.visit};
}
export function portCollisionsNear(p,now=Date.now(),life={},radius=270){const shapes=[],rx=Math.floor(p.x/REGION),rz=Math.floor(p.z/REGION);for(let x=rx-1;x<=rx+1;x++)for(let z=rz-1;z<=rz+1;z++){if(Math.abs(x*REGION)>LIMIT||Math.abs(z*REGION)>LIMIT)continue;const s=settlement(x,z);if(Math.hypot(s.x-p.x,s.z+13-p.z)<radius)shapes.push(...parkedShipObstacles(portShipAt(s,now,life)));}return shapes;}
export function peopleNear(p,now=Date.now(),life={},radius=850){
 if(p.dungeon)return [];
 const rx=Math.floor(p.x/REGION),rz=Math.floor(p.z/REGION),people=[];
 for(let x=rx-1;x<=rx+1;x++)for(let z=rz-1;z<=rz+1;z++){if(Math.abs(x*REGION)>LIMIT||Math.abs(z*REGION)>LIMIT)continue;const s=settlement(x,z),town=Math.hypot(s.x-p.x,s.z-p.z)<radius+60;for(const n of [...(town?[...npcsFor(s),portBroker(s),shipVisitor(s)]:[]),...roadPeopleFor(x,z)]){const person=npcAt(n,now,life[n.id]);if(Math.hypot(person.x-p.x,person.z-p.z)<radius)people.push(person);}}
 for(const n of people.filter(n=>n.broker)){const pilot=people.find(p=>p.visitor&&p.home===n.home&&p.objective==='meeting'&&p.phase==='objective');if(pilot){n.activity=`exchanging road reports with ${pilot.name}`;n.heading=Math.PI/2;}}
 return people;
}
export function advanceNpcLife(n,life={},now=Date.now()){
 const observations=[...(life.observations||[])],seen=new Set(observations.map(o=>o.id)),add=o=>{if(!seen.has(o.id)){seen.add(o.id);observations.push(o);}};
 // Remember actual routine checkpoints, catch up at most one world day after an absence.
 const since=Math.max(life.updatedAt||now-1,now-DAY_MS),route=routeFor(n),seconds=(now-WORLD_EPOCH-pausedAt(life,now))/1000+route.offset,start=(since-WORLD_EPOCH-pausedAt(life,since))/1000+route.offset;
 for(let cycle=Math.floor(start/route.duration);cycle<=Math.floor(seconds/route.duration);cycle++)for(const segment of route.segments.filter(s=>!s.moving&&(!n.visitor||s.checkpoint))){
  const tick=cycle*route.duration+segment.start,createdAt=WORLD_EPOCH+(tick-route.offset)*1000+pausedAt(life,now);
  if(tick>start&&tick<=seconds&&!(life.meeting&&life.meeting.until>createdAt))add({id:n.visitor?`${n.id}:visit:${cycle*6+segment.visit}:${segment.phase}`:`${n.id}:routine:${worldDay(createdAt)}:${segment.activity}`,kind:n.visitor?'visit':'routine',createdAt,summary:segment.checkpoint||`I was ${segment.activity}.`});
 }
 if(!observations.length){const at=npcAt(n,now,life);add({id:`${n.id}:first:${worldDay(now)}`,kind:'routine',createdAt:now,summary:`I was ${at.activity}.`});}
 const at=n.visitor?npcAt(n,now,life):null;return {...life,...(at?{visit:{number:at.visit,shipId:n.shipId,objective:at.objective,phase:at.phase,stay:at.stay,completed:at.completed,cargo:at.objective==='supplies'&&at.completed?{nutrientPods:3,fuelCells:2}:{nutrientPods:0,fuelCells:0}}}:{}),updatedAt:Math.max(life.updatedAt||0,now),observations};
}
export function witnessAction(p,a,now=Date.now(),life={}){
 if(p.dungeon||!['move','gather','talk','attack','jump','forge-start'].includes(a.type))return [];
 const descriptions={move:`I saw ${p.name} ${a.runDistance>0?'running through':'passing through'} the colony tracks.`,gather:`I saw ${p.name} recover salvage nearby.`,talk:`${p.name} stopped to speak with me.`,attack:`I saw ${p.name} swing a weapon.`,jump:`I saw ${p.name} jump in their suit.`, 'forge-start':`${p.name} rented the induction bay.`};
 return peopleNear(p,now,life,24).filter(n=>n.available!==false&&(a.type!=='talk'||n.id===a.target)).map(n=>({npc:n.id,observation:{id:`${n.id}:seen:${worldDay(now)}:${p.id}:${a.type}:${a.target||''}`,kind:'witness',createdAt:now,summary:descriptions[a.type]}}));
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
