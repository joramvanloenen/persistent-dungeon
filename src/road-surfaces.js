import * as T from '../vendor/three.module.js';
import {noise,nearestSettlement} from './world.js?v=11';
import {ROAD_COLORS} from './environment.js?v=19';

const area=poly=>poly.reduce((sum,a,i)=>{const b=poly[(i+1)%poly.length];return sum+a.x*b.z-b.x*a.z;},0)/2;
const valid=poly=>poly.length>=3&&Math.abs(area(poly))>1e-5;
function normalize(poly){return area(poly)<0?poly.slice().reverse():poly;}
function halfPlane(poly,a,b,inside){
 const value=p=>((b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x))*(inside?1:-1),out=[];
 for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],dp=value(p),dq=value(q),ip=dp>=0,iq=dq>=0;if(ip)out.push(p);if(ip!==iq){const t=dp/(dp-dq);out.push({x:p.x+(q.x-p.x)*t,z:p.z+(q.z-p.z)*t});}}
 return out;
}
export function intersectRoadPolygons(poly,cutter){let result=normalize(poly);cutter=normalize(cutter);for(let i=0;i<cutter.length&&result.length;i++)result=halfPlane(result,cutter[i],cutter[(i+1)%cutter.length],true);return valid(result)?result:[];}
// Convex subtraction produces disjoint convex fragments, suitable for fan triangulation.
export function subtractRoadPolygon(poly,cutter){
 let remainder=normalize(poly);cutter=normalize(cutter);const out=[];
 for(let i=0;i<cutter.length&&valid(remainder);i++){const a=cutter[i],b=cutter[(i+1)%cutter.length],outside=halfPlane(remainder,a,b,false);if(valid(outside))out.push(outside);remainder=halfPlane(remainder,a,b,true);}
 return out;
}
const box=poly=>({minX:Math.min(...poly.map(p=>p.x)),maxX:Math.max(...poly.map(p=>p.x)),minZ:Math.min(...poly.map(p=>p.z)),maxZ:Math.max(...poly.map(p=>p.z))});
const touches=(a,b)=>a.minX<b.maxX&&a.maxX>b.minX&&a.minZ<b.maxZ&&a.maxZ>b.minZ;
function subtractAll(poly,cutters){let fragments=[poly];for(const cutter of cutters)fragments=fragments.flatMap(p=>subtractRoadPolygon(p,cutter));return fragments;}
export function roadSurfacePlan(pieces){
 const bounds=[-5.7,-4.1,-2.7,-1.45,1.45,2.7,4.1,5.7],bands=[0,1,2,1,2,1,0];
 const roads=[...new Map(pieces.map(p=>[p.id,p])).values()].sort((a,b)=>a.id.localeCompare(b.id)).map(p=>{
  const palette=p.bridge?[0x9aa8a5,0x687b83,0x445c68]:ROAD_COLORS[p.biome],at=(q,offset)=>{const width=p.bridge ? 7/5.7 :1+noise(q.x/23,q.z/23,10800)*.075;return {x:q.x+p.nx*offset*width,z:q.z+p.nz*offset*width};},strip=(start,end,lo,hi)=>normalize([at(start,lo),at(end,lo),at(end,hi),at(start,hi)]),footprint=strip(p.start,p.end,-5.7,5.7),paint=[];
  if(p.bridge&&p.i%3!==1)for(const side of [-1,1]){const mid={x:p.start.x+(p.end.x-p.start.x)*.7,z:p.start.z+(p.end.z-p.start.z)*.7};paint.push({poly:strip(p.start,mid,side*5.05,side*5.4),tone:0xc6aa6b});}
  if(!p.bridge&&p.wear>.78){const mid={x:p.start.x+(p.end.x-p.start.x)*.3,z:p.start.z+(p.end.z-p.start.z)*.3},end={x:mid.x+p.dx*.8,z:mid.z+p.dz*.8};paint.push({poly:strip(mid,end,-3.9,3.9),tone:0x7a8781});}
  return {p,palette,strip,footprint,box:box(footprint),paint,neighbors:[]};
 });
 const junctions=[];
 for(let i=0;i<roads.length;i++)for(let j=i+1;j<roads.length;j++){
  const a=roads[i],b=roads[j];if(!touches(a.box,b.box))continue;const poly=intersectRoadPolygons(a.footprint,b.footprint);if(!poly.length)continue;
  a.neighbors.push(b.footprint);b.neighbors.push(a.footprint);
  const tone=new T.Color(a.palette[1]).lerp(new T.Color(b.palette[1]),.5);junctions.push({poly,tone,bridge:a.p.bridge||b.p.bridge,kind:'junction'});
 }
 const surfaces=[];
 for(const road of roads){const {p,palette,strip,paint,neighbors}=road;
  for(let i=0;i<bands.length;i++){
   const tone=new T.Color(palette[bands[i]]).multiplyScalar(.91+p.wear*.16);if(nearestSettlement(p.x,p.z).distance<85&&!p.bridge&&i>0&&i<6)tone.lerp(new T.Color(p.i%3===0?0x849393:0x6c7c80),.45);
   for(const poly of subtractAll(strip(p.start,p.end,bounds[i],bounds[i+1]),[...neighbors,...paint.map(s=>s.poly)]))surfaces.push({poly,tone,bridge:p.bridge,kind:'road'});
  }
  for(const mark of paint)for(const poly of subtractAll(mark.poly,neighbors))surfaces.push({...mark,poly,bridge:p.bridge,kind:'marking'});
 }
 // Intersections occupy the shared footprint exactly once, including three-way joins.
 const claimed=[];for(const junction of junctions){for(const poly of subtractAll(junction.poly,claimed))surfaces.push({...junction,poly});claimed.push(junction.poly);}
 return surfaces;
}
