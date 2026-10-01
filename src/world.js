// Immutable generation v1. Changes to this file must preserve existing IDs and seed.
export const SEED = 731942;
export const GENERATOR_VERSION = 1;
export const CHUNK = 192;
export const REGION = 1024;
export const LIMIT = 32700;
export const WATER = 7;
export const BIOMES = {
  meadow: {name:'Verdant basins', color:0x708d76, tree:0x486d39},
  forest: {name:'Canopy belts', color:0x456f63, tree:0x274e34},
  highlands: {name:'Basalt highlands', color:0x858c91, tree:0x445c49},
  desert: {name:'Red dust flats', color:0xb3977e, tree:0x6c7941},
  tundra: {name:'Frost plains', color:0xa9bbc3, tree:0x46645c},
  marsh: {name:'Algal wetlands', color:0x628681, tree:0x3d6656},
};
export function hash(x,z,s=0) {
  let h=Math.imul(x|0,374761393)^Math.imul(z|0,668265263)^Math.imul(s+SEED,1274126177);
  h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;
}
export function noise(x,z,s=0) {
  const ix=Math.floor(x),iz=Math.floor(z),tx=x-ix,tz=z-iz;
  const u=tx*tx*(3-2*tx),v=tz*tz*(3-2*tz);
  return ((hash(ix,iz,s)*(1-u)+hash(ix+1,iz,s)*u)*(1-v)+(hash(ix,iz+1,s)*(1-u)+hash(ix+1,iz+1,s)*u)*v)*2-1;
}
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function baseHeight(x,z) {return 40+noise(x/1600,z/1600,1)*33+noise(x/430,z/430,2)*23+noise(x/140,z/140,3)*8+noise(x/45,z/45,4)*1.8;}
export function waterDistance(x,z) {
  const band=Math.round(x/2800), riverX=band*2800+Math.sin(z/560+band)*165+Math.sin(z/1730)*190;
  let d=Math.abs(x-riverX)-16;
  const lx=Math.floor(x/3200),lz=Math.floor(z/3200);
  for(let a=lx-1;a<=lx+1;a++)for(let b=lz-1;b<=lz+1;b++) {
    if(hash(a,b,19)>.57)continue;
    const cx=a*3200+700+hash(a,b,20)*1700,cz=b*3200+600+hash(a,b,21)*1800;
    const rx=80+hash(a,b,22)*160,rz=65+hash(a,b,23)*110;
    const q=Math.sqrt(((x-cx)/rx)**2+((z-cz)/rz)**2);
    d=Math.min(d,(q-1)*Math.min(rx,rz));
  }
  return d;
}
export function rawHeight(x,z) {
  const h=baseHeight(x,z),d=waterDistance(x,z);
  return h*smooth(-3,75,d)+(WATER-3)*(1-smooth(-3,75,d));
}
export function biomeAt(x,z) {
  const temp=noise(x/2300,z/2300,38),moist=noise(x/1600,z/1600,39),h=baseHeight(x,z);
  if(temp<-.38)return 'tundra';if(h>65)return 'highlands';if(temp>.27&&moist<.05)return 'desert';
  if(waterDistance(x,z)<110&&moist>.05)return 'marsh';if(moist>.05)return 'forest';return 'meadow';
}
const namesA=['Vesper','Latch','Ion','Rusted','Signal','Spool','Cinder','Dryline','Quiet','Hollow','Glass','Last','Static','Shard','Low','Drift'];
const namesB=['Reach','Relay','Camp','Outpost','Haven','Station','Exchange','Landing','Terminal','Shelter','Yard','Anchor'];
const settlementCache=new Map();
export function settlement(rx,rz) {
  const id=`v:${rx}:${rz}`;if(settlementCache.has(id))return settlementCache.get(id);
  let x=0,z=0;
  for(let i=0;i<64;i++){
    x=rx*REGION+150+hash(rx,rz,90+i*2)*724;z=rz*REGION+150+hash(rx,rz,91+i*2)*724;
    if(waterDistance(x,z)>125&&rawHeight(x,z)>11)break;
  }
  const name=namesA[Math.floor(hash(rx,rz,75)*namesA.length)]+' '+namesB[Math.floor(hash(rx,rz,76)*namesB.length)];
  const s={id,name,x,z,y:rawHeight(x,z),biome:biomeAt(x,z),rx,rz};
  settlementCache.set(id,s);return s;
}
export function nearestSettlement(x,z) {
  const rx=Math.floor(x/REGION),rz=Math.floor(z/REGION);let best,d=Infinity;
  for(let a=rx-1;a<=rx+1;a++)for(let b=rz-1;b<=rz+1;b++){
    const s=settlement(a,b),q=Math.hypot(x-s.x,z-s.z);if(q<d){d=q;best=s;}
  }return {...best,distance:d};
}
export function heightAt(x,z) {
  const h=rawHeight(x,z),rx=Math.floor(x/REGION),rz=Math.floor(z/REGION);
  // Villages are set back from cell borders, so only this region can flatten this point.
  const s=settlement(rx,rz),d=Math.hypot(x-s.x,z-s.z);
  return h+(s.y-h)*(1-smooth(50,96,d));
}
function segDistance(x,z,a,b){const vx=b.x-a.x,vz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*vx+(z-a.z)*vz)/(vx*vx+vz*vz)));return Math.hypot(x-a.x-t*vx,z-a.z-t*vz);}
export function roadSegments(rx,rz) {
  const out=[];
  for(let a=rx-1;a<=rx+1;a++)for(let b=rz-1;b<=rz+1;b++){
    const s=settlement(a,b);
    for(const [dx,dz] of [[1,0],[0,1]]){
      const e=settlement(a+dx,b+dz),mid={x:(s.x+e.x)/2+Math.sin(a+b)*55,z:(s.z+e.z)/2+Math.cos(a-b)*55};
      out.push([s,mid],[mid,e]);
    }
  }return out;
}
export function roadDistance(x,z,segments) {let d=Infinity;for(const [a,b]of segments)d=Math.min(d,segDistance(x,z,a,b));return d;}
export function npcsFor(s) {
 const first=['Mara','Orin','Elsbeth','Rowan','Asta','Tomas','Sable','Finn','Iona','Bram','Maeve','Hugo'];
 const people=['gatherer','keeper','wayfarer'].map((role,i)=>({id:`${s.id}:npc:${i}`,name:first[(Math.floor(hash(s.rx,s.rz,140)*first.length)+i*5)%first.length],role,affiliation:['Independent Drifters','Round Power contract','Dugall Freight'][Math.floor(hash(s.rx,s.rz,8180+i)*3)],village:s.name,x:s.x+[-12,14,3][i],z:s.z+[8,3,-17][i],y:s.y,home:s.id}));const smith=smithFor(s);if(smith)people.push(smith);return people;
}
export function smithFor(s){if(hash(s.rx,s.rz,8150)<.25)return null;return {id:`${s.id}:npc:3`,name:['Bram','Orin','Asta','Hugo'][Math.floor(hash(s.rx,s.rz,8151)*4)],role:'smith',affiliation:'Independent Drifters',village:s.name,home:s.id,x:s.x-10,z:s.z-9,y:s.y,forgeX:s.x-18,forgeZ:s.z-9};}
export function resourcesFor(cx,cz) {
 const nodes=[],roads=roadSegments(Math.floor(cx*CHUNK/REGION),Math.floor(cz*CHUNK/REGION));
 for(let i=0;i<44;i++){
  const x=cx*CHUNK+hash(cx,cz,200+i*2)*CHUNK,z=cz*CHUNK+hash(cx,cz,201+i*2)*CHUNK;
  if(waterDistance(x,z)<16||nearestSettlement(x,z).distance<48||roadDistance(x,z,roads)<6)continue;
  const biome=biomeAt(x,z),r=hash(cx,cz,400+i);
  const kind=r<.48?'wood':r<.69?'stone':r<.84?'berries':'fiber';
  if(kind==='wood'&&(biome==='desert'||biome==='tundra')&&r>.14)continue;
  nodes.push({id:`r:${cx}:${cz}:${i}`,x,z,y:heightAt(x,z),kind,biome,scale:.75+hash(cx,cz,500+i)*.7});
 }return nodes;
}
export function resolveResource(id){const m=/^r:(-?\d+):(-?\d+):(\d+)$/.exec(id);if(!m)return null;const cx=+m[1],cz=+m[2];if(Math.abs(cx*CHUNK)>LIMIT+CHUNK||Math.abs(cz*CHUNK)>LIMIT+CHUNK)return null;return resourcesFor(cx,cz).find(r=>r.id===id)||null;}
export function resolveNpc(id){const m=/^v:(-?\d+):(-?\d+):npc:([0-3])$/.exec(id);if(!m)return null;return npcsFor(settlement(+m[1],+m[2]))[+m[3]]||null;}
export function initialPlayer(id,name='Traveler') {
  const bytes=new Uint32Array(2);globalThis.crypto.getRandomValues(bytes);
  let s;
  for(let i=0;i<32;i++){s=settlement((bytes[0]+i)%7-3,(bytes[1]+i*3)%7-3);if(s.biome==='forest'||s.biome==='meadow')break;}
  return {id,name,x:s.x,z:s.z,home:s.id,health:100,food:100,water:100,inventory:{wood:0,stone:0,berries:3,fiber:0},visited:[s.id],distance:0,revision:0};
}
