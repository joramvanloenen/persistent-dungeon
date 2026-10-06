import {environmentFor,environmentOutsideHome,environmentObstacle} from './environment.js?v=19';
import {CHUNK,REGION,settlement,resourcesFor,waterDistance,roadDistance,roadSegments} from './world.js?v=11';
import {ruinFor} from './dungeons.js?v=11';
import {homeObstacles,villageObstacles,ruinObstacles,resourceObstacle,foliageFor,outsideHome,circle} from './scene-layout.js?v=11';
export const PLAYER_RADIUS=.65;
const CELL=16;
function local(p,o){const c=Math.cos(o.rotation||0),s=Math.sin(o.rotation||0),x=p.x-o.x,z=p.z-o.z;return {x:c*x-s*z,z:s*x+c*z};}
function distanceSegment(p,a,b){const x=b.x-a.x,z=b.z-a.z,d=x*x+z*z,t=d?Math.max(0,Math.min(1,((p.x-a.x)*x+(p.z-a.z)*z)/d)):0;return Math.hypot(p.x-a.x-t*x,p.z-a.z-t*z);}
function crossesBox(a,b,w,d){let low=0,high=1;for(const [key,half]of [['x',w],['z',d]]){const delta=b[key]-a[key];if(Math.abs(delta)<1e-10){if(Math.abs(a[key])>half)return false;}else{const p=(-half-a[key])/delta,q=(half-a[key])/delta;low=Math.max(low,Math.min(p,q));high=Math.min(high,Math.max(p,q));if(low>high)return false;}}return true;}
export function hitsObstacle(a,b,o,radius=PLAYER_RADIUS){
 if(o.radius!==undefined)return distanceSegment(o,a,b)<o.radius+radius-1e-5;
 const p=local(a,o),q=local(b,o),w=o.width/2,d=o.depth/2;if(crossesBox(p,q,w,d))return true;
 const corners=[{x:-w,z:-d},{x:w,z:-d},{x:w,z:d},{x:-w,z:d}];
 for(let i=0;i<4;i++){const c=corners[i],e=corners[(i+1)%4];if(Math.min(distanceSegment(c,p,q),distanceSegment(e,p,q),distanceSegment(p,c,e),distanceSegment(q,c,e))<radius-1e-5)return true;}return false;
}
export class CollisionIndex{
 constructor(){this.cells=new Map();this.groups=new Map();}
 replace(key,shapes){this.remove(key);this.groups.set(key,shapes);for(const o of shapes){o.cells=[];const r=o.radius??Math.hypot(o.width,o.depth)/2;for(let x=Math.floor((o.x-r-PLAYER_RADIUS)/CELL);x<=Math.floor((o.x+r+PLAYER_RADIUS)/CELL);x++)for(let z=Math.floor((o.z-r-PLAYER_RADIUS)/CELL);z<=Math.floor((o.z+r+PLAYER_RADIUS)/CELL);z++){const id=`${x}:${z}`;if(!this.cells.has(id))this.cells.set(id,new Set());this.cells.get(id).add(o);o.cells.push(id);}}}
 remove(key){for(const o of this.groups.get(key)||[])for(const id of o.cells){const cell=this.cells.get(id);cell.delete(o);if(!cell.size)this.cells.delete(id);}this.groups.delete(key);}
 candidates(a,b){const out=new Set();for(let x=Math.floor((Math.min(a.x,b.x)-PLAYER_RADIUS)/CELL);x<=Math.floor((Math.max(a.x,b.x)+PLAYER_RADIUS)/CELL);x++)for(let z=Math.floor((Math.min(a.z,b.z)-PLAYER_RADIUS)/CELL);z<=Math.floor((Math.max(a.z,b.z)+PLAYER_RADIUS)/CELL);z++)for(const o of this.cells.get(`${x}:${z}`)||[])out.add(o);return out;}
 blocked(a,b=a){for(const o of this.candidates(a,b))if(hitsObstacle(a,b,o))return o;return null;}
}
export function moveWithCollisions(start,dx,dz,clear){
 const p={x:start.x,z:start.z},trail=[],steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.25));
 for(let i=0;i<steps;i++){const x=p.x+dx/steps,z=p.z+dz/steps,q={x,z};if(clear(p,q)){p.x=x;p.z=z;trail.push({...p});}else{const axes=Math.abs(dx)>Math.abs(dz)?['x','z']:['z','x'];for(const axis of axes){const q={...p,[axis]:p[axis]+(axis==='x'?dx:dz)/steps};if(clear(p,q)){p[axis]=q[axis];trail.push({...p});}}}}return {...p,trail};
}
export function appendMovementTrail(trail,start,points,frozen=0){for(const q of points){const b=trail.at(-1)||start;if(Math.hypot(q.x-b.x,q.z-b.z)<1e-8)continue;const a=trail.length>1?trail.at(-2):start,ux=b.x-a.x,uz=b.z-a.z,vx=q.x-b.x,vz=q.z-b.z;if(trail.length>frozen&&Math.abs(ux*vz-uz*vx)<1e-7&&ux*vx+uz*vz>=0)trail[trail.length-1]={x:q.x,z:q.z};else trail.push({x:q.x,z:q.z});}}
export function waterPathClear(a,b){const distance=Math.hypot(b.x-a.x,b.z-a.z),n=Math.max(1,Math.ceil(distance/2));let key,roads;for(let i=1;i<=n;i++){const x=a.x+(b.x-a.x)*i/n,z=a.z+(b.z-a.z)*i/n;if(waterDistance(x,z)>-3)continue;const rx=Math.floor(x/REGION),rz=Math.floor(z/REGION),k=`${rx}:${rz}`;if(key!==k){roads=roadSegments(rx,rz);key=k;}if(roadDistance(x,z,roads)>=7)return false;}return true;}
export function buildSurfaceCollisions(points,{homes=[],depletedIds=[]}={}){
 const index=new CollisionIndex(),depleted=new Set(depletedIds),xs=points.map(p=>p.x),zs=points.map(p=>p.z),minX=Math.min(...xs)-18,maxX=Math.max(...xs)+18,minZ=Math.min(...zs)-18,maxZ=Math.max(...zs)+18;
 for(const h of homes)index.replace(h.id,homeObstacles(h));
 for(let rx=Math.floor(minX/REGION)-1;rx<=Math.floor(maxX/REGION)+1;rx++)for(let rz=Math.floor(minZ/REGION)-1;rz<=Math.floor(maxZ/REGION)+1;rz++){const s=settlement(rx,rz),r=ruinFor(rx,rz);index.replace(s.id,villageObstacles(s));index.replace(r.id,ruinObstacles(r));}
 for(let cx=Math.floor(minX/CHUNK);cx<=Math.floor(maxX/CHUNK);cx++)for(let cz=Math.floor(minZ/CHUNK);cz<=Math.floor(maxZ/CHUNK);cz++){const shapes=resourcesFor(cx,cz).filter(n=>outsideHome(n,homes)&&!depleted.has(n.id)).map(resourceObstacle).filter(Boolean);for(const n of foliageFor(cx,cz).trees)if(outsideHome(n,homes))shapes.push(circle(n.id,n.x,n.z,.45));for(const n of environmentFor(cx,cz).props)if(environmentOutsideHome(n,homes))shapes.push(environmentObstacle(n));index.replace(`chunk:${cx}:${cz}`,shapes);}return index;
}
// Local A* gives tap-to-walk a route around solid props, rather than pushing into them.
export function findSurfacePath(start,end,clear,{step=2.5,margin=32,limit=14000}={}){
 if(!clear(end,end))return null;if(clear(start,end))return [end];const minX=Math.min(start.x,end.x)-margin,maxX=Math.max(start.x,end.x)+margin,minZ=Math.min(start.z,end.z)-margin,maxZ=Math.max(start.z,end.z)+margin;
 const key=(x,z)=>`${x}:${z}`,point=n=>({x:start.x+n.x*step,z:start.z+n.z*step}),open=[],nodes=new Map(),done=new Set();
 const insert=n=>{let a=0,b=open.length;while(a<b){const m=(a+b)>>1;if(open[m].f>n.f)a=m+1;else b=m;}open.splice(a,0,n);};
 const origin={x:0,z:0,g:0,f:Math.hypot(end.x-start.x,end.z-start.z),parent:null};nodes.set('0:0',origin);insert(origin);let goal;
 for(let visits=0;open.length&&visits<limit;visits++){const n=open.pop(),id=key(n.x,n.z);if(done.has(id))continue;done.add(id);const p=point(n);if(Math.hypot(end.x-p.x,end.z-p.z)<step*1.5&&clear(p,end)){goal=n;break;}
  for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const x=n.x+dx,z=n.z+dz,id=key(x,z);if(done.has(id))continue;const q=point({x,z});if(q.x<minX||q.x>maxX||q.z<minZ||q.z>maxZ||!clear(p,q))continue;const g=n.g+Math.hypot(dx,dz)*step;if(g>=(nodes.get(id)?.g??Infinity))continue;const next={x,z,g,f:g+Math.hypot(end.x-q.x,end.z-q.z),parent:n};nodes.set(id,next);insert(next);}}
 if(!goal)return null;const route=[end];for(let n=goal;n.parent;n=n.parent)route.push(point(n));route.reverse();const smooth=[];let from=start;for(let i=0;i<route.length;){let j=route.length-1;while(j>i&&!clear(from,route[j]))j--;smooth.push(route[j]);from=route[j];i=j+1;}return smooth;
}
