import {CHUNK,REGION,WATER,BIOMES,hash,noise,heightAt,biomeAt,waterDistance,nearestSettlement,roadSegments,roadDistance,resourcesFor} from './world.js?v=11';
import {ruinFor} from './dungeons.js?v=11';

export const TERRAIN_STEP=CHUNK/20;
export const ENVIRONMENT_FORMS=['boulder','basalt','crystal','husk','wreck','vent'];
export const ROAD_COLORS={forest:[0x6f7b6a,0x51615b,0x36494a],meadow:[0x95957c,0x737a6b,0x526261],marsh:[0x7c9181,0x536f6d,0x354f54],desert:[0xb89c7b,0x988364,0x6e6860],highlands:[0x919692,0x717d80,0x4c5e66],tundra:[0xb8c5c4,0x8d9da2,0x5d737e]};
export const PATCH_COLORS={forest:0x526c48,meadow:0xa0aa73,marsh:0x437f78,desert:0xc7b294,highlands:0x646579,tundra:0xd7dfd6};
const rgb=hex=>[(hex>>16&255)/255,(hex>>8&255)/255,(hex&255)/255];
export function groundTint(x,z){const biome=biomeAt(x,z),base=rgb(BIOMES[biome].color),patch=rgb(PATCH_COLORS[biome]),amount=Math.max(0,noise(x/95,z/95,10031))*.65,variation=.87+(noise(x/21,z/21,10032)+1)*.09;return base.map((c,i)=>(c+(patch[i]-c)*amount)*variation);}
const heightCache=new Map();
function cornerHeight(x,z){const key=`${x}:${z}`;if(!heightCache.has(key)){heightCache.set(key,heightAt(x*TERRAIN_STEP,z*TERRAIN_STEP));if(heightCache.size>32000)heightCache.delete(heightCache.keys().next().value);}return heightCache.get(key);}
// Match the actual triangulated ground mesh so detail surfaces never sink into it.
export function terrainSurfaceHeight(x,z){const ix=Math.floor(x/TERRAIN_STEP),iz=Math.floor(z/TERRAIN_STEP),fx=x/TERRAIN_STEP-ix,fz=z/TERRAIN_STEP-iz,h00=cornerHeight(ix,iz),h10=cornerHeight(ix+1,iz),h01=cornerHeight(ix,iz+1),h11=cornerHeight(ix+1,iz+1);return fx+fz<=1?h00+(h10-h00)*fx+(h01-h00)*fz:h11+(h01-h11)*(1-fx)+(h10-h11)*(1-fz);}
const cache=new Map();
export function roadPiecesFor(cx,cz){
 const segments=roadSegments(Math.floor(cx*CHUNK/REGION),Math.floor(cz*CHUNK/REGION)),out=[],minX=cx*CHUNK,minZ=cz*CHUNK;
 for(const [a,b]of segments){if(Math.max(a.x,b.x)+7<minX||Math.min(a.x,b.x)-7>minX+CHUNK||Math.max(a.z,b.z)+7<minZ||Math.min(a.z,b.z)-7>minZ+CHUNK)continue;
  const length=Math.hypot(b.x-a.x,b.z-a.z),count=Math.ceil(length/12),dx=(b.x-a.x)/length,dz=(b.z-a.z)/length,key=`${a.x.toFixed(3)}:${a.z.toFixed(3)}:${b.x.toFixed(3)}:${b.z.toFixed(3)}`;
  for(let i=0;i<count;i++){const start={x:a.x+(b.x-a.x)*i/count,z:a.z+(b.z-a.z)*i/count},end={x:a.x+(b.x-a.x)*(i+1)/count,z:a.z+(b.z-a.z)*(i+1)/count};if(Math.max(start.x,end.x)+7<minX||Math.min(start.x,end.x)-7>minX+CHUNK||Math.max(start.z,end.z)+7<minZ||Math.min(start.z,end.z)-7>minZ+CHUNK)continue;const x=(start.x+end.x)/2,z=(start.z+end.z)/2;out.push({id:`road:${key}:${i}`,i,start,end,x,z,dx,dz,nx:-dz,nz:dx,length:length/count,bridge:waterDistance(x,z)<22,biome:biomeAt(x,z),wear:hash(Math.round(a.x),Math.round(a.z),10050+i),heading:Math.atan2(dx,dz)});}
 }return out;
}
export function environmentOutsideHome(n,homes=[]){return !homes.some(h=>Math.hypot(h.x-n.x,h.z-n.z)<10+(n.radius||0));}
export function environmentObstacle(n){return {id:n.id,x:n.x,z:n.z,radius:n.radius};}
export function environmentFor(cx,cz){
 const key=`${cx}:${cz}`;if(cache.has(key))return cache.get(key);
 const pieces=roadPiecesFor(cx,cz),segments=roadSegments(Math.floor(cx*CHUNK/REGION),Math.floor(cz*CHUNK/REGION)),resources=resourcesFor(cx,cz),props=[],patches=[],rx=Math.floor(cx*CHUNK/REGION),rz=Math.floor(cz*CHUNK/REGION),ruins=[];
 for(let x=rx-1;x<=rx+1;x++)for(let z=rz-1;z<=rz+1;z++)ruins.push(ruinFor(x,z));
 const clear=(x,z,pad)=>waterDistance(x,z)>12+pad&&nearestSettlement(x,z).distance>96&&roadDistance(x,z,segments)>9+pad&&!ruins.some(r=>Math.hypot(r.x-x,r.z-z)<24+pad);
 const choices={forest:[0,3,3,5],meadow:[0,0,3,4],marsh:[0,2,5,5],desert:[0,1,4,5],highlands:[0,1,1,2],tundra:[0,1,2,2]};
 for(let i=0;i<22;i++){const x=cx*CHUNK+10+hash(cx,cz,10100+i*2)*(CHUNK-20),z=cz*CHUNK+10+hash(cx,cz,10101+i*2)*(CHUNK-20),biome=biomeAt(x,z),scale=.65+hash(cx,cz,10200+i)*1.9,radius=scale*1.65;if(!clear(x,z,radius)||resources.some(r=>Math.hypot(r.x-x,r.z-z)<radius+2.5)||props.some(r=>Math.hypot(r.x-x,r.z-z)<radius+r.radius+3))continue;const list=choices[biome],family=list[Math.floor(hash(cx,cz,10300+i)*list.length)];props.push({id:`env:${cx}:${cz}:${i}`,x,z,y:terrainSurfaceHeight(x,z),scale,radius,family,kind:ENVIRONMENT_FORMS[family],biome,heading:hash(cx,cz,10400+i)*Math.PI*2});}
 for(let i=0;i<30;i++){const x=cx*CHUNK+hash(cx,cz,10500+i*2)*CHUNK,z=cz*CHUNK+hash(cx,cz,10501+i*2)*CHUNK,radius=1.5+hash(cx,cz,10600+i)*4;if(!clear(x,z,0))continue;patches.push({id:`patch:${cx}:${cz}:${i}`,x,z,radius,biome:biomeAt(x,z),phase:hash(cx,cz,10700+i)*Math.PI*2});}
 for(const p of pieces){if(p.i%5!==0)continue;const side=p.i%2?1:-1,offset=p.bridge?4.2:7.6,x=p.x+p.nx*offset*side,z=p.z+p.nz*offset*side;if(Math.floor(x/CHUNK)!==cx||Math.floor(z/CHUNK)!==cz||nearestSettlement(x,z).distance<48||ruins.some(r=>Math.hypot(r.x-x,r.z-z)<22)||(!p.bridge&&(waterDistance(x,z)<15||roadDistance(x,z,segments)<6.8)))continue;props.push({id:`${p.id}:marker`,x,z,y:p.bridge?WATER+1.1:terrainSurfaceHeight(x,z),scale:1,radius:(p.i%10===0&&!p.bridge) ? .7 : .45,family:p.i%10===0&&!p.bridge?7:6,kind:p.bridge?'bridge-marker':p.i%10===0?'relay':'waymark',biome:p.biome,heading:p.heading});}
 const result={pieces,props,patches};cache.set(key,result);if(cache.size>128)cache.delete(cache.keys().next().value);return result;
}
