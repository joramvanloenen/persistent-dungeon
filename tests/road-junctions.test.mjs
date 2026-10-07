import test from 'node:test';
import assert from 'node:assert/strict';
import {roadSurfacePlan,intersectRoadPolygons} from '../src/road-surfaces.js';
import {buildRoadSurface} from '../src/environment-render.js';
import {terrainSurfaceHeight} from '../src/environment.js';
import {WATER} from '../src/world.js';

function piece(id,start,end,wear=.5){const length=Math.hypot(end.x-start.x,end.z-start.z),dx=(end.x-start.x)/length,dz=(end.z-start.z)/length;return {id,i:0,start,end,length,dx,dz,nx:-dz,nz:dx,x:(start.x+end.x)/2,z:(start.z+end.z)/2,bridge:false,biome:'meadow',wear};}
const point=(x,z)=>({x,z}),center=point(70,70);
const networks={
 cross:[piece('horizontal',point(25,70),point(115,70),.9),piece('vertical',point(70,25),point(70,115))],
 tee:[piece('through',point(25,70),point(115,70)),piece('stem',point(70,25),center)],
 fork:[0,1,2].map(i=>piece(`arm-${i}`,center,point(70+Math.cos(i*Math.PI*2/3)*45,70+Math.sin(i*Math.PI*2/3)*45))),
 bend:[piece('east',center,point(115,70)),piece('north',center,point(70,115))],
 multi:[piece('east-west',point(25,70),point(115,70)),piece('north-south',point(70,25),point(70,115)),piece('diagonal',point(35,35),point(105,105))]
};
const area=poly=>Math.abs(poly.reduce((s,a,i)=>{const b=poly[(i+1)%poly.length];return s+a.x*b.z-b.x*a.z;},0)/2);
function contains(poly,p){return poly.every((a,i)=>{const b=poly[(i+1)%poly.length];return (b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x)>1e-5;});}
test('crossroads, T joins, forks and bends form one disjoint terrain layer',()=>{
 for(const [name,pieces]of Object.entries(networks)){
  const plan=roadSurfacePlan(pieces);assert.ok(plan.some(s=>s.kind==='junction'),name);assert.deepEqual(plan,roadSurfacePlan([...pieces].reverse()),'Road order must not change junction ownership');
  for(let i=0;i<plan.length;i++)for(let j=i+1;j<plan.length;j++)assert.ok(area(intersectRoadPolygons(plan[i].poly,plan[j].poly))<1e-5,`${name}: overlapping ${plan[i].kind}/${plan[j].kind}`);
  for(let x=63.27;x<77;x+=1.37)for(let z=63.13;z<77;z+=1.31){const p=point(x,z),arms=pieces.some(r=>Math.hypot(x-r.x,z-r.z)<1||Math.abs((x-r.start.x)*r.nz-(z-r.start.z)*r.nx)<1);if(arms)assert.ok(plan.filter(s=>contains(s.poly,p)).length<=1);}
  const mesh=buildRoadSurface(0,0,pieces),p=mesh.geometry.attributes.position;assert.ok(p.count>0);assert.ok(p.count/3<6000);for(let i=0;i<p.count;i++)assert.ok(Math.abs(p.getY(i)-terrainSurfaceHeight(p.getX(i),p.getZ(i))-.035)<.002,'Every road, junction and marking is on the same terrain layer');mesh.geometry.dispose();
 }
});
test('joining three roads neither leaves holes nor doubles the shared junction',()=>{
 const plan=roadSurfacePlan(networks.multi),junctions=plan.filter(s=>s.kind==='junction');
 for(let x=67.21;x<73;x+=.47)for(let z=67.31;z<73;z+=.43)assert.equal(plan.filter(s=>contains(s.poly,point(x,z))).length,1,`Gap or overlap at ${x},${z}`);
 assert.ok(junctions.reduce((sum,s)=>sum+area(s.poly),0)>80);
});
test('bridge crossings share one fourteen-metre deck instead of overlapping slabs',()=>{
 const pieces=networks.cross.map(p=>({...p,bridge:true})),plan=roadSurfacePlan(pieces);
 for(let i=0;i<plan.length;i++)for(let j=i+1;j<plan.length;j++)assert.ok(area(intersectRoadPolygons(plan[i].poly,plan[j].poly))<1e-5);
 for(let x=63.21;x<77;x+=.73)for(let z=63.13;z<77;z+=.69)assert.equal(plan.filter(s=>contains(s.poly,point(x,z))).length,1);
 const mesh=buildRoadSurface(0,0,pieces),p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++)assert.ok(Math.abs(p.getY(i)-Math.max(WATER+1.06,terrainSurfaceHeight(p.getX(i),p.getZ(i))))<.002);mesh.geometry.dispose();
});
