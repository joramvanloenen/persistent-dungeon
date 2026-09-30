import {ruinFor} from './dungeons.js?v=2';
import {BIOMES,REGION,biomeAt,heightAt,waterDistance,roadSegments,roadDistance,settlement} from './world.js';
export function drawMap(canvas,center,span,player,{detailed=false,waypoint=null,visited=[],home=null}={}){
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,ratio=h/w,step=detailed?4:3;
 const roads=roadSegments(Math.floor(center.x/REGION),Math.floor(center.z/REGION));
 for(let py=0;py<h;py+=step)for(let px=0;px<w;px+=step){const x=center.x+(px/w-.5)*span,z=center.z+(py/h-.5)*span*ratio;let color=BIOMES[biomeAt(x,z)].color;
  if(waterDistance(x,z)<0)color=0x487f83;else if(roadDistance(x,z,roads)<Math.max(6,span/w*1.5))color=0xbb9e6a;
  const shade=Math.max(.68,Math.min(1.12,.91+(heightAt(x-8,z-8)-heightAt(x+8,z+8))*.01));ctx.fillStyle=`rgb(${((color>>16)&255)*shade},${((color>>8)&255)*shade},${(color&255)*shade})`;ctx.fillRect(px,py,step,step);
 }
 const toPixel=(x,z)=>[(x-center.x)/span*w+w/2,(z-center.z)/(span*ratio)*h+h/2];
 const rx=Math.floor(center.x/REGION),rz=Math.floor(center.z/REGION),r=Math.ceil(span/REGION/2)+1;
 for(let a=rx-r;a<=rx+r;a++)for(let b=rz-r;b<=rz+r;b++){const s=settlement(a,b),[px,py]=toPixel(s.x,s.z);if(px<10||py<10||px>w-10||py>h-10)continue;ctx.fillStyle=visited.includes(s.id)?'#f4daa0':'#ccad72';ctx.beginPath();ctx.arc(px,py,detailed?4:2.5,0,6.28);ctx.fill();if(detailed){ctx.font='14px Georgia';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#1a3025';ctx.strokeText(s.name,px,py-10);ctx.fillStyle='#f5e3b6';ctx.fillText(s.name,px,py-10);}}
 for(let a=rx-r;a<=rx+r;a++)for(let b=rz-r;b<=rz+r;b++){const ruin=ruinFor(a,b),[px,py]=toPixel(ruin.x,ruin.z);if(px<6||py<6||px>w-6||py>h-6)continue;ctx.fillStyle='#b8cec2';ctx.beginPath();ctx.moveTo(px,py-4);ctx.lineTo(px+4,py);ctx.lineTo(px,py+4);ctx.lineTo(px-4,py);ctx.closePath();ctx.fill();}
 if(home){const [px,py]=toPixel(home.x,home.z);ctx.fillStyle='#ffe3a2';ctx.beginPath();ctx.moveTo(px,py-8);ctx.lineTo(px+7,py-1);ctx.lineTo(px+5,py-1);ctx.lineTo(px+5,py+6);ctx.lineTo(px-5,py+6);ctx.lineTo(px-5,py-1);ctx.lineTo(px-7,py-1);ctx.closePath();ctx.fill();}
 if(waypoint){const [px,py]=toPixel(waypoint.x,waypoint.z);ctx.strokeStyle='#ffe39d';ctx.lineWidth=2;ctx.beginPath();ctx.arc(px,py,7,0,6.28);ctx.stroke();}
 const [px,py]=toPixel(player.x,player.z);ctx.fillStyle='#fff3ca';ctx.strokeStyle='#162c22';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(px,py-7);ctx.lineTo(px-4,py+4);ctx.lineTo(px+4,py+4);ctx.closePath();ctx.fill();ctx.stroke();
}

export function drawCaveMap(canvas,d,player,{detailed=false,depleted=new Set()}={}){
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,p=player.dungeon||player,visited=new Set(player.caves?.[d.id]?.rooms||[0]);ctx.fillStyle='#10201d';ctx.fillRect(0,0,w,h);
 const margin=15,scale=Math.min((w-margin*2)/d.width,(h-margin*2)/d.height),ox=(w-d.width*scale)/2,oz=(h-d.height*scale)/2;
 for(let z=0;z<d.height;z++)for(let x=0;x<d.width;x++){if(!d.cells[z*d.width+x])continue;const room=d.rooms.find(r=>x>=r.x&&x<r.x+r.w&&z>=r.z&&z<r.z+r.h);if(room&&!visited.has(room.id))continue;ctx.fillStyle=room?'#72836a':'#445d51';ctx.fillRect(ox+x*scale,oz+z*scale,scale+.2,scale+.2);}
 if(detailed)for(const room of d.rooms)if(visited.has(room.id)){ctx.fillStyle='#e8d4a3';ctx.font='12px Georgia';ctx.textAlign='center';ctx.fillText(room.name,ox+room.cx*scale,oz+(room.cz-1)*scale);}
 const mark=(x,z,color,size)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(ox+x/2.8*scale,oz+z/2.8*scale,size,0,6.28);ctx.fill();};
 for(const node of d.nodes)if(visited.has(node.room)&&!depleted.has(node.id))mark(node.x,node.z,'#d8b86e',detailed?2.5:1.2);
 mark(d.entrance.x,d.entrance.z,'#b2d9cd',detailed?4:2.4);mark(p.x,p.z,'#fff2c8',detailed?4:2.5);
}
