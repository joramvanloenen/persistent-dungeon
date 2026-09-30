import {settlement,heightAt,waterDistance,roadDistance,roadSegments,hash} from './world.js';
export function homeFor(player,plot=0){
 const match=/^v:(-?\d+):(-?\d+)$/.exec(player.home);if(!match)throw Error('Your home village cannot be found.');
 const s=settlement(+match[1],+match[2]),roads=roadSegments(s.rx,s.rz);let found=-1,x,z,angle;
 for(let candidate=0;candidate<10000;candidate++){
  const ring=Math.floor(candidate/16),spoke=candidate%16;angle=spoke*Math.PI*2/16+.11;const r=65+ring*24;x=s.x+Math.sin(angle)*r;z=s.z+Math.cos(angle)*r;
  if(waterDistance(x,z)<42||roadDistance(x,z,roads)<11)continue;
  if(++found===plot)break;
 }
 const rotation=angle+Math.PI,y=heightAt(x,z);
 return {id:`home:${player.id}`,owner:player.id,ownerName:player.name,village:s.id,villageName:s.name,plot,x,z,y,rotation,doorX:x+Math.sin(rotation)*8,doorZ:z+Math.cos(rotation)*8};
}
export function normalizePlayer(input,plot=input.house?.plot??0){const p=structuredClone(input);p.caves??={};p.dungeon??=null;p.introduced??=p.revision>0;p.house=homeFor(p,plot);p.coins??=24;p.inventory??={wood:0,stone:0,berries:3,fiber:0};p.inventory.iron??=0;p.weapons??=[];p.equipped??=null;p.forge??=null;p.combat??={};p.actionStats??={jumps:0,attacks:0,defeated:0,runDistance:0};return p;}
