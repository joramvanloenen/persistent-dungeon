import {CHUNK,BIOMES,hash,biomeAt,heightAt,waterDistance,roadDistance,roadSegments,nearestSettlement,smithFor} from './world.js?v=10';
import {ruinFor,TILE} from './dungeons.js?v=10';

// These placements also drive collisions. Keep the existing village layout and seed.
export function villageHouses(s){return Array.from({length:7},(_,i)=>{const angle=i*Math.PI*2/7,r=27+hash(s.rx,s.rz,1700+i)*8;return {id:`${s.id}:house:${i}`,x:s.x+Math.cos(angle)*r,z:s.z+Math.sin(angle)*r,y:s.y,rotation:-angle+Math.PI/2,width:7+hash(s.rx,s.rz,1800+i)*3,depth:7+hash(s.rx,s.rz,1900+i)*4};});}
export const circle=(id,x,z,radius)=>({id,x,z,radius});
export const box=(id,x,z,width,depth,rotation=0)=>({id,x,z,width,depth,rotation});
function offset(h,x,z){const c=Math.cos(h.rotation),s=Math.sin(h.rotation);return {x:h.x+c*x+s*z,z:h.z-s*x+c*z};}
export function homeObstacles(h){const out=[box(h.id,h.x,h.z,9,8,h.rotation)];for(const x of [-4.7,4.7]){const p=offset(h,x,6.2);out.push(box(`${h.id}:fence:${x}`,p.x,p.z,.25,6,h.rotation));}const p=offset(h,-5.8,0);out.push(box(`${h.id}:crate`,p.x,p.z,1.4,1.4,h.rotation));return out;}
export function villageObstacles(s){const out=villageHouses(s).map(h=>box(h.id,h.x,h.z,h.width,h.depth,h.rotation));out.push(box(`${s.id}:shuttle`,s.x,s.z+13,12,10),circle(`${s.id}:well`,s.x,s.z-1,2),box(`${s.id}:dummy`,s.x+13,s.z-11,1.1,1));const n=smithFor(s);if(n)out.push(box(`${s.id}:forge`,n.forgeX,n.forgeZ,5,4),box(`${s.id}:anvil`,n.forgeX+4,n.forgeZ+1,2.5,1.1));return out;}
export function ruinRubble(r){return Array.from({length:7},(_,i)=>{let angle=i*2.1;const rad=8+hash(r.rx,r.rz,4700+i)*6;if(Math.abs(Math.sin(angle)*rad)<3.5&&Math.cos(angle)>0)angle+=.55;return {id:`${r.id}:rock:${i}`,x:r.x+Math.sin(angle)*rad,z:r.z+Math.cos(angle)*rad};});}
export function ruinObstacles(r){const out=[box(`${r.id}:left`,r.x-3,r.z,1.4,1.6),box(`${r.id}:right`,r.x+3,r.z,1.4,1.6),box(`${r.id}:back`,r.x,r.z-.25,4.6,.5)];for(const n of ruinRubble(r))out.push(circle(n.id,n.x,n.z,1.65));for(const x of [-7,7])out.push(box(`${r.id}:pillar:${x}`,r.x+x,r.z-5,1.1,1.1));return out;}
export function resourceObstacle(n){if(n.kind==='wood')return circle(n.id,n.x,n.z,.5*n.scale);if(n.kind==='stone')return circle(n.id,n.x,n.z,1.2*n.scale);return null;}
export function caveObstacles(d,depleted=new Set()){
 const out=[],tile=TILE;for(const r of d.rooms){const x=(r.x+1.5)*tile,z=(r.z+1.5)*tile;out.push(circle(`${d.id}:pillar:${r.id}`,x,z,.75),circle(`${d.id}:brazier:${r.id}`,x+2,z,.45));for(let i=0;i<4;i++)out.push(circle(`${d.id}:rubble:${r.id}:${i}`,(r.x+2+(i*3.7)%(r.w-4))*tile,(r.z+r.h-1.7)*tile,.5));if(r.id>0)out.push(box(`${d.id}:altar:${r.id}`,r.cx*tile,(r.z+r.h-2)*tile,4,1.7));}
 for(const n of d.nodes)if(!depleted.has(n.id))out.push(n.kind==='wood'?box(n.id,n.x,n.z,1.7,1.3):n.kind==='berries'?box(n.id,n.x,n.z,1.3,.9):circle(n.id,n.x,n.z,n.kind==='stone'?.9:.8));for(const x of [-2.2,2.2])out.push(box(`${d.id}:exit:${x}`,d.entrance.x+x,d.entrance.z,.65,.7));return out;
}
const cache=new Map();
export function foliageFor(cx,cz){
 const key=`${cx}:${cz}`;if(cache.has(key))return cache.get(key);
 const segments=roadSegments(Math.floor(cx*CHUNK/1024),Math.floor(cz*CHUNK/1024)),ruins=[],rx=Math.floor(cx*CHUNK/1024),rz=Math.floor(cz*CHUNK/1024);for(let a=rx-1;a<=rx+1;a++)for(let b=rz-1;b<=rz+1;b++)ruins.push(ruinFor(a,b));
 const centerBiome=biomeAt((cx+.5)*CHUNK,(cz+.5)*CHUNK),density={forest:115,meadow:48,marsh:76,highlands:28,tundra:30,desert:16}[centerBiome],trees=[],plants=[];
 const clear=(x,z,padding=0)=>waterDistance(x,z)>10+padding&&nearestSettlement(x,z).distance>50&&roadDistance(x,z,segments)>6+padding&&!ruins.some(r=>Math.hypot(r.x-x,r.z-z)<20);
 for(let i=0;i<density;i++){const x=cx*CHUNK+hash(cx,cz,5100+i*2)*CHUNK,z=cz*CHUNK+hash(cx,cz,5101+i*2)*CHUNK;if(!clear(x,z,5))continue;trees.push({id:`tree:${cx}:${cz}:${i}`,x,z,y:heightAt(x,z),height:13+hash(cx,cz,5400+i)*1.5,variant:hash(cx,cz,5800+i)<.5?0:1,biome:biomeAt(x,z)});}
 const count=centerBiome==='desert'?120:650;
 for(let i=0;i<count;i++){const x=cx*CHUNK+hash(cx,cz,6000+i*2)*CHUNK,z=cz*CHUNK+hash(cx,cz,6001+i*2)*CHUNK;if(!clear(x,z))continue;const biome=biomeAt(x,z),y=heightAt(x,z),r=hash(cx,cz,7500+i);plants.push({x,z,y,height:biome==='marsh'?1.8+r:.55+r*.8,width:1.2+r,kind:'grass',biome});if(i%4===0)plants.push({x:x+.8,z:z-.6,y,height:1.9+r,width:2.3+r,kind:'shrub',variant:i%2,biome});if(i%7===0&&biome!=='desert'&&biome!=='tundra')plants.push({x,z,y,height:1.1,width:.8,kind:'flowers',biome});}
 const result={trees,plants};cache.set(key,result);if(cache.size>192)cache.delete(cache.keys().next().value);return result;
}
export function outsideHome(n,homes=[]){return !homes.some(h=>Math.hypot(h.x-n.x,h.z-n.z)<12);}
