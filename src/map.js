import {ruinFor,TILE,roomAt} from './dungeons.js?v=2';
import {BIOMES,REGION,biomeAt,heightAt,waterDistance,roadSegments,roadDistance,settlement} from './world.js';
const miniCache=new WeakMap(),roomCache=new WeakMap();
function playerMarker(ctx,x,y,heading=0,size=7){
 ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI-heading);ctx.fillStyle='#fffaf0';ctx.strokeStyle='#087d79';ctx.lineWidth=2;
 ctx.beginPath();ctx.moveTo(0,-size);ctx.lineTo(-size*.65,size*.65);ctx.lineTo(0,size*.3);ctx.lineTo(size*.65,size*.65);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
}
function waypointMarker(ctx,x,y){ctx.strokeStyle='#ffb23e';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.stroke();}
function northMarker(ctx,w,h,cameraYaw){
 const radius=Math.min(w,h)/2-12,x=w/2+Math.sin(cameraYaw)*radius,y=h/2-Math.cos(cameraYaw)*radius;
 ctx.fillStyle='#faf9f0';ctx.strokeStyle='#27362e';ctx.lineWidth=3;ctx.font='bold 10px Arial, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.strokeText('N',x,y);ctx.fillText('N',x,y);
}
export function drawMap(canvas,center,span,player,{detailed=false,waypoint=null,visited=[],home=null}={}){
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,ratio=h/w,step=detailed?4:3,roads=new Map();
 const roadsAt=(x,z)=>{const rx=Math.floor(x/REGION),rz=Math.floor(z/REGION),key=`${rx}:${rz}`;if(!roads.has(key))roads.set(key,roadSegments(rx,rz));return roads.get(key);};
 for(let py=0;py<h;py+=step)for(let px=0;px<w;px+=step){const x=center.x+(px/w-.5)*span,z=center.z+(py/h-.5)*span*ratio;let color=BIOMES[biomeAt(x,z)].color;
  if(waterDistance(x,z)<0)color=0x487f83;else if(roadDistance(x,z,roadsAt(x,z))<Math.max(6,span/w*1.5))color=0xbb9e6a;
  const shade=Math.max(.68,Math.min(1.12,.91+(heightAt(x-8,z-8)-heightAt(x+8,z+8))*.01));ctx.fillStyle=`rgb(${((color>>16)&255)*shade},${((color>>8)&255)*shade},${(color&255)*shade})`;ctx.fillRect(px,py,step,step);
 }
 const toPixel=(x,z)=>[(x-center.x)/span*w+w/2,(z-center.z)/span*w+h/2];
 const rx=Math.floor(center.x/REGION),rz=Math.floor(center.z/REGION),r=Math.ceil(span/REGION/2)+1;
 for(let a=rx-r;a<=rx+r;a++)for(let b=rz-r;b<=rz+r;b++){const s=settlement(a,b),[px,py]=toPixel(s.x,s.z);if(px<10||py<10||px>w-10||py>h-10)continue;ctx.fillStyle=visited.includes(s.id)?'#ffd07e':'#d1ac63';ctx.strokeStyle='#3c4336';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(px,py,detailed?5:3,0,Math.PI*2);ctx.fill();ctx.stroke();if(detailed){ctx.font='12px Arial, sans-serif';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#354333';ctx.strokeText(s.name,px,py-12);ctx.fillStyle='#fff7e2';ctx.fillText(s.name,px,py-12);}}
 for(let a=rx-r;a<=rx+r;a++)for(let b=rz-r;b<=rz+r;b++){const ruin=ruinFor(a,b),[px,py]=toPixel(ruin.x,ruin.z);if(px<6||py<6||px>w-6||py>h-6)continue;ctx.fillStyle='#e1d5e6';ctx.strokeStyle='#735078';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(px,py-5);ctx.lineTo(px+5,py);ctx.lineTo(px,py+5);ctx.lineTo(px-5,py);ctx.closePath();ctx.fill();ctx.stroke();}
 if(home){const [px,py]=toPixel(home.x,home.z);ctx.fillStyle='#ffb23e';ctx.strokeStyle='#4d4835';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(px,py-8);ctx.lineTo(px+7,py-1);ctx.lineTo(px+5,py-1);ctx.lineTo(px+5,py+6);ctx.lineTo(px-5,py+6);ctx.lineTo(px-5,py-1);ctx.lineTo(px-7,py-1);ctx.closePath();ctx.fill();ctx.stroke();}
 if(waypoint)waypointMarker(ctx,...toPixel(waypoint.x,waypoint.z));
 if(player)playerMarker(ctx,...toPixel(player.x,player.z),player.heading||0);
}
function roomCells(d){
 if(roomCache.has(d))return roomCache.get(d);const cells=new Int16Array(d.cells.length).fill(-1);
 for(const r of d.rooms)for(let z=r.z;z<r.z+r.h;z++)for(let x=r.x;x<r.x+r.w;x++)cells[z*d.width+x]=r.id;
 roomCache.set(d,cells);return cells;
}
export function drawCaveMap(canvas,d,player,{detailed=false,depleted=new Set(),local=false,heading=0,cameraYaw=0}={}){
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,p=player.dungeon||player,visited=new Set(player.caves?.[d.id]?.rooms||[0]),current=roomAt(d,p.x,p.z);if(current!==null)visited.add(current);
 ctx.fillStyle='#27362e';ctx.fillRect(0,0,w,h);const margin=15,scale=local?w/70:Math.min((w-margin*2)/(d.width*TILE),(h-margin*2)/(d.height*TILE)),ox=local?w/2-p.x*scale:(w-d.width*TILE*scale)/2,oz=local?h/2-p.z*scale:(h-d.height*TILE*scale)/2,rooms=roomCells(d),radius=Math.hypot(w,h)/2;
 if(local){ctx.save();ctx.translate(w/2,h/2);ctx.rotate(cameraYaw);ctx.translate(-w/2,-h/2);}
 for(let z=0;z<d.height;z++)for(let x=0;x<d.width;x++){
  if(!d.cells[z*d.width+x])continue;const px=ox+x*TILE*scale,py=oz+z*TILE*scale,size=TILE*scale;
  if(local?(px+size<w/2-radius||py+size<h/2-radius||px>w/2+radius||py>h/2+radius):(px+size<0||py+size<0||px>w||py>h))continue;
  const room=rooms[z*d.width+x];ctx.fillStyle=room===-1?'#7c8b76':visited.has(room)?'#b6b79e':'#48584a';ctx.fillRect(px,py,size+.1,size+.1);
 }
 if(detailed)for(const room of d.rooms)if(visited.has(room.id)){ctx.fillStyle='#26362d';ctx.font='11px Arial, sans-serif';ctx.textAlign='center';ctx.fillText(room.name,ox+(room.cx+.5)*TILE*scale,oz+(room.cz-1)*TILE*scale);}
 const mark=(x,z,color,size)=>{ctx.fillStyle=color;ctx.strokeStyle='#27362e';ctx.lineWidth=1;ctx.beginPath();ctx.arc(ox+x*scale,oz+z*scale,size,0,Math.PI*2);ctx.fill();ctx.stroke();};
 for(const node of d.nodes)if(visited.has(node.room)&&!depleted.has(node.id))mark(node.x,node.z,'#ffb23e',local?2.5:detailed?2.5:1.2);
 mark(d.entrance.x,d.entrance.z,'#58d4c7',local?4:detailed?4:2.4);playerMarker(ctx,ox+p.x*scale,oz+p.z*scale,heading,local?7:5);
 if(local){ctx.restore();northMarker(ctx,w,h,cameraYaw);}
}
// Keep a larger terrain image and crop around the traveler every frame.
// Terrain generation runs only when crossing the cached area's margin.
export function drawMiniMap(canvas,player,{cave=null,depleted=new Set(),waypoint=null,heading=0,cameraYaw=0}={}){
 if(cave){drawCaveMap(canvas,cave,player,{depleted,local:true,heading,cameraYaw});return;}
 const span=520,w=canvas.width,h=canvas.height,ctx=canvas.getContext('2d'),radius=Math.hypot(w,h)/2,cacheMargin=(Math.min(w,h)-radius-2)*span/w;let cached=miniCache.get(canvas);
 if(!cached||Math.abs(player.x-cached.center.x)>cacheMargin||Math.abs(player.z-cached.center.z)>cacheMargin||cached.home!==player.house?.id){
  const texture=document.createElement('canvas');texture.width=w*2;texture.height=h*2;const center={x:player.x,z:player.z};drawMap(texture,center,span*2,null,{visited:player.visited,home:player.house});cached={texture,center,home:player.house?.id};miniCache.set(canvas,cached);
 }
 const sx=w+(player.x-cached.center.x)/span*w-radius,sy=h+(player.z-cached.center.z)/span*w-radius;
 ctx.save();ctx.translate(w/2,h/2);ctx.rotate(cameraYaw);ctx.translate(-w/2,-h/2);
 ctx.drawImage(cached.texture,sx,sy,radius*2,radius*2,w/2-radius,h/2-radius,radius*2,radius*2);
 if(waypoint)waypointMarker(ctx,w/2+(waypoint.x-player.x)/span*w,h/2+(waypoint.z-player.z)/span*w);
 playerMarker(ctx,w/2,h/2,heading);ctx.restore();northMarker(ctx,w,h,cameraYaw);
}
