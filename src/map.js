import {BIOMES,REGION,biomeAt,heightAt,waterDistance,roadSegments,roadDistance,settlement} from './world.js';
export function drawMap(canvas,center,span,player,{detailed=false,waypoint=null,visited=[]}={}){
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,ratio=h/w,step=detailed?4:3;
 const roads=roadSegments(Math.floor(center.x/REGION),Math.floor(center.z/REGION));
 for(let py=0;py<h;py+=step)for(let px=0;px<w;px+=step){const x=center.x+(px/w-.5)*span,z=center.z+(py/h-.5)*span*ratio;let color=BIOMES[biomeAt(x,z)].color;
  if(waterDistance(x,z)<0)color=0x487f83;else if(roadDistance(x,z,roads)<Math.max(6,span/w*1.5))color=0xbb9e6a;
  const shade=Math.max(.68,Math.min(1.12,.91+(heightAt(x-8,z-8)-heightAt(x+8,z+8))*.01));ctx.fillStyle=`rgb(${((color>>16)&255)*shade},${((color>>8)&255)*shade},${(color&255)*shade})`;ctx.fillRect(px,py,step,step);
 }
 const toPixel=(x,z)=>[(x-center.x)/span*w+w/2,(z-center.z)/(span*ratio)*h+h/2];
 const rx=Math.floor(center.x/REGION),rz=Math.floor(center.z/REGION),r=Math.ceil(span/REGION/2)+1;
 for(let a=rx-r;a<=rx+r;a++)for(let b=rz-r;b<=rz+r;b++){const s=settlement(a,b),[px,py]=toPixel(s.x,s.z);if(px<10||py<10||px>w-10||py>h-10)continue;ctx.fillStyle=visited.includes(s.id)?'#f4daa0':'#ccad72';ctx.beginPath();ctx.arc(px,py,detailed?4:2.5,0,6.28);ctx.fill();if(detailed){ctx.font='14px Georgia';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#1a3025';ctx.strokeText(s.name,px,py-10);ctx.fillStyle='#f5e3b6';ctx.fillText(s.name,px,py-10);}}
 if(waypoint){const [px,py]=toPixel(waypoint.x,waypoint.z);ctx.strokeStyle='#ffe39d';ctx.lineWidth=2;ctx.beginPath();ctx.arc(px,py,7,0,6.28);ctx.stroke();}
 const [px,py]=toPixel(player.x,player.z);ctx.fillStyle='#fff3ca';ctx.strokeStyle='#162c22';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(px,py-7);ctx.lineTo(px-4,py+4);ctx.lineTo(px+4,py+4);ctx.closePath();ctx.fill();ctx.stroke();
}
