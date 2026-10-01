import {hash,settlement,heightAt,waterDistance,roadDistance,roadSegments,REGION,LIMIT} from './world.js?v=10';
export const TILE=2.8;
const cache=new Map(),ruinCache=new Map();
export function dungeonId(rx,rz){return `d:${rx}:${rz}`;}
export function ruinFor(rx,rz){
 const key=dungeonId(rx,rz);if(ruinCache.has(key))return ruinCache.get(key);const s=settlement(rx,rz);let x,z;
 for(let i=0;i<80;i++){const angle=hash(rx,rz,2400+i)*Math.PI*2,r=165+hash(rx,rz,2500+i)*95;x=s.x+Math.cos(angle)*r;z=s.z+Math.sin(angle)*r;if(waterDistance(x,z)>65&&roadDistance(x,z,roadSegments(rx,rz))>16)break;}
 const styles=['Buried processing complex','Flooded research annex','Freight Wars bunker'];
 const result={id:dungeonId(rx,rz),name:`${s.name} ${['Decommissioned Site','Industrial Relic','Sealed Facility'][Math.floor(hash(rx,rz,2600)*3)]}`,dungeonName:styles[Math.floor(hash(rx,rz,2601)*3)],x,z,y:heightAt(x,z),rx,rz,style:Math.floor(hash(rx,rz,2601)*3)};ruinCache.set(key,result);return result;
}
export function resolveDungeon(id){const m=/^d:(-?\d+):(-?\d+)$/.exec(String(id));if(!m||Math.abs(+m[1]*REGION)>LIMIT||Math.abs(+m[2]*REGION)>LIMIT)return null;return generateDungeon(+m[1],+m[2]);}
export function generateDungeon(rx,rz){
 const id=dungeonId(rx,rz);if(cache.has(id))return cache.get(id);
 const width=85,height=67,cells=new Uint8Array(width*height),rooms=[],count=9+Math.floor(hash(rx,rz,2700)*4);
 const carve=(x,z)=>{if(x>0&&z>0&&x<width-1&&z<height-1)cells[z*width+x]=1;};
 const paintRoom=r=>{for(let z=r.z;z<r.z+r.h;z++)for(let x=r.x;x<r.x+r.w;x++)carve(x,z);};
 for(let i=0;i<count;i++){
  const col=i%4,row=Math.floor(i/4),w=9+Math.floor(hash(rx,rz,2800+i)*6),h=9+Math.floor(hash(rx,rz,2900+i)*6);
  const x=5+col*20+Math.floor(hash(rx,rz,3000+i)*3),z=5+row*20+Math.floor(hash(rx,rz,3100+i)*3);
  const room={id:i,x,z,w,h,cx:x+Math.floor(w/2),cz:z+Math.floor(h/2),name:i===0?'Access lock':['Reactor hall','Transit control','Extraction chamber','Cargo hold','Quarantine bay','Service gallery','Cooling reservoir'][Math.floor(hash(rx,rz,3200+i)*7)]};rooms.push(room);paintRoom(room);
 }
 const edges=[];
 function connect(a,b,variant){const ax=a.cx,az=a.cz,bx=b.cx,bz=b.cz,mx=variant?bx:ax,mz=variant?az:bz;const line=(x0,z0,x1,z1)=>{const n=Math.max(Math.abs(x1-x0),Math.abs(z1-z0));for(let i=0;i<=n;i++){const x=Math.round(x0+(x1-x0)*i/Math.max(1,n)),z=Math.round(z0+(z1-z0)*i/Math.max(1,n));for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)carve(x+dx,z+dz);}};line(ax,az,mx,mz);line(mx,mz,bx,bz);edges.push([a.id,b.id]);}
 const linked=new Set([0]);while(linked.size<rooms.length){let pair,d=Infinity;for(const a of rooms)if(linked.has(a.id))for(const b of rooms)if(!linked.has(b.id)){const q=Math.hypot(a.cx-b.cx,a.cz-b.cz);if(q<d){d=q;pair=[a,b];}}connect(...pair,hash(rx,rz,3300+linked.size)>.5);linked.add(pair[1].id);}
 for(let i=1;i<rooms.length-1;i++)if(hash(rx,rz,3400+i)>.6)connect(rooms[i],rooms[i+1],hash(rx,rz,3450+i)>.5);
 const nodes=[];for(const room of rooms){const n=3+Math.floor(hash(rx,rz,3500+room.id)*3);for(let j=0;j<n;j++){
  const x=(room.x+2+hash(rx,rz,3600+room.id*13+j)*(room.w-4))*TILE,z=(room.z+2+hash(rx,rz,3800+room.id*13+j)*(room.h-4))*TILE;
  const kind=['stone','wood','fiber','berries'][(j+room.id)%4];nodes.push({id:`c:${rx}:${rz}:${nodes.length}`,space:id,x,z,y:0,kind,label:{stone:'silicate deposit',wood:'structural biomass',fiber:'biofilament stores',berries:'sealed nutrient pods'}[kind],room:room.id,count:kind==='stone'?5:kind==='wood'?4:3,scale:.9+hash(rx,rz,4000+nodes.length)*.35});
 }}
 const entrance={x:rooms[0].cx*TILE,z:(rooms[0].z+2)*TILE},spawn={x:entrance.x,z:entrance.z+5.6};
 const dungeon={...ruinFor(rx,rz),width,height,cells,rooms,edges,nodes,entrance,spawn};cache.set(id,dungeon);return dungeon;
}
export function caveWalkable(d,x,z,radius=.42){for(const [dx,dz]of [[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]]){const tx=Math.floor((x+dx)/TILE),tz=Math.floor((z+dz)/TILE);if(tx<0||tz<0||tx>=d.width||tz>=d.height||!d.cells[tz*d.width+tx])return false;}return true;}
export function cavePathClear(d,a,b){const n=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.7);for(let i=0;i<=n;i++)if(!caveWalkable(d,a.x+(b.x-a.x)*i/Math.max(1,n),a.z+(b.z-a.z)*i/Math.max(1,n)))return false;return true;}
export function roomAt(d,x,z){const tx=x/TILE,tz=z/TILE;return d.rooms.find(r=>tx>=r.x&&tx<r.x+r.w&&tz>=r.z&&tz<r.z+r.h)?.id??null;}
export function resolveCaveResource(id){const m=/^c:(-?\d+):(-?\d+):(\d+)$/.exec(String(id));if(!m)return null;const d=resolveDungeon(dungeonId(+m[1],+m[2]));return d?.nodes.find(n=>n.id===id)||null;}
export function caveStatus(id,player,depleted){const d=resolveDungeon(id),p=player.caves?.[id],collected=d.nodes.filter(n=>depleted.has(n.id)).length;return {entered:!!p?.entered,rooms:p?.rooms?.length||0,totalRooms:d.rooms.length,explored:(p?.rooms?.length||0)===d.rooms.length,collected,total:d.nodes.length,cleared:collected===d.nodes.length};}
