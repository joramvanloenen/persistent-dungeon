import {hash,settlement,smithFor} from './world.js?v=6';
import {resolveDungeon,TILE,cavePathClear} from './dungeons.js?v=2';
export const WEAPONS=Object.freeze([
 {id:'dagger',name:'Iron dagger',fee:4,iron:2,wood:1,hits:10,damage:12,reach:4.4,description:'Quick to forge. A dependable first blade.'},
 {id:'sword',name:'Short sword',fee:7,iron:3,wood:2,hits:14,damage:18,reach:5.5,description:'A balanced blade with a longer reach.'},
 {id:'axe',name:'Iron axe',fee:9,iron:4,wood:3,hits:16,damage:24,reach:4.8,description:'A heavy head that strikes hard.'}
]);
export const HEAT={orangeStart:6000,orangeEnd:9000,ruined:11000};
export function resolveSmith(id){const m=/^v:(-?\d+):(-?\d+):npc:3$/.exec(String(id));return m?smithFor(settlement(+m[1],+m[2])):null;}
export function forgeSpot(job){return Math.floor(hash(job.serial,job.step,9200+(job.mistakes||0))*9);}
export function guardiansFor(d){return d.rooms.filter(r=>r.id>0&&r.id%3===2).map(r=>({id:`${d.id}:warden:${r.id}`,name:'Stone sentinel',x:(r.cx+.5)*TILE,z:(r.cz+.5)*TILE,space:d.id,health:36,room:r.id}));}
export function dummyFor(s){return {id:`${s.id}:dummy`,name:'Practice dummy',x:s.x+13,z:s.z-11,y:s.y,health:60,space:'overworld',dummy:true};}
export function resolveOpponent(id){const a=/^d:(-?\d+):(-?\d+):warden:(\d+)$/.exec(String(id));if(a){const d=resolveDungeon(`d:${a[1]}:${a[2]}`);return d?guardiansFor(d).find(n=>n.room===+a[3]):null;}const b=/^v:(-?\d+):(-?\d+):dummy$/.exec(String(id));return b?dummyFor(settlement(+b[1],+b[2])):null;}
export function equippedWeapon(p){return p.weapons?.find(w=>w.id===p.equipped)||null;}
export function heatState(job,now=Date.now()){const elapsed=now-job.startedAt;return {elapsed,level:Math.max(0,Math.min(100,elapsed/HEAT.ruined*100)),ready:elapsed>=HEAT.orangeStart&&elapsed<=HEAT.orangeEnd,ruined:elapsed>=HEAT.ruined};}
export function applyActionGame(p,next,a,now){
 let summary='',extra={};const atSmith=id=>{const s=resolveSmith(id);if(p.dungeon||!s||Math.hypot(p.x-s.x,p.z-s.z)>15)throw Error('Walk closer to the smith.');return s;};
 const jobAtSmith=()=>{if(!p.forge)throw Error('Pay the smith and choose a weapon first.');atSmith(p.forge.smith);return next.forge;};
 switch(a.type){
 case 'smith-buy':{atSmith(a.target);if(p.coins<8)throw Error('You need 8 coins for a material bundle.');next.coins-=8;next.inventory.iron+=2;next.inventory.wood++;summary='Bought 2 iron ore and 1 wood from the smith';break;}
 case 'smith-sell':{atSmith(a.target);if(!['wood','stone','fiber'].includes(a.kind)||p.inventory[a.kind]<5)throw Error('Bring 5 wood, stone, or fiber to trade.');next.inventory[a.kind]-=5;next.coins+=5;summary=`Sold 5 ${a.kind} for 5 coins`;break;}
 case 'forge-start':{const smith=atSmith(a.target),recipe=WEAPONS.find(r=>r.id===a.recipe);if(!recipe)throw Error('Choose a weapon from the catalog.');if(p.forge)throw Error('Finish or abandon your current billet first.');if(p.coins<recipe.fee||p.inventory.iron<recipe.iron||p.inventory.wood<recipe.wood)throw Error('Bring the listed fee, iron ore, and wood.');next.coins-=recipe.fee;next.inventory.iron-=recipe.iron;next.inventory.wood-=recipe.wood;next.forge={smith:smith.id,recipe:recipe.id,serial:p.revision+1,phase:'heat',startedAt:now,step:0,mistakes:0};summary=`Paid ${smith.name} ${recipe.fee} coins to forge an ${recipe.name.toLowerCase()}`;break;}
 case 'forge-transfer':{const job=jobAtSmith();if(job.phase!=='heat')throw Error('The billet is not in the fire.');const state=heatState(job,now);if(state.elapsed<HEAT.orangeStart)throw Error('The metal is still too cold.');if(state.elapsed>HEAT.orangeEnd){job.phase='failed';summary='The overheated billet sparked and broke apart';}else{job.phase='hammer';job.deadline=now+2000;summary='Brought orange-hot metal to the anvil';}break;}
 case 'forge-strike':{const job=jobAtSmith();if(job.phase!=='hammer'||a.step!==job.step)throw Error('That strike belongs to an earlier step.');const recipe=WEAPONS.find(r=>r.id===job.recipe);if(now>job.deadline||a.spot!==forgeSpot(job)){job.mistakes++;job.step=Math.max(0,job.step-1);if(job.mistakes>=3)job.phase='failed';else job.deadline=now+2000;summary=job.phase==='failed'?'The billet lost its shape. Start heating again.':'Missed the mark. One strike lost.';}else{job.step++;if(job.step>=recipe.hits){const weapon={id:`weapon:${p.id}:${job.serial}`,recipe:recipe.id,name:recipe.name,damage:recipe.damage,reach:recipe.reach};next.weapons.push(weapon);next.equipped=weapon.id;next.forge=null;extra={crafted:weapon};summary=`Forged and equipped ${recipe.name}`;}else{job.deadline=now+2000;summary=`Shaped the billet: ${job.step}/${recipe.hits} strikes`;}}break;}
 case 'forge-retry':{const job=jobAtSmith();if(job.phase!=='failed'&&!(job.phase==='heat'&&heatState(job,now).ruined))throw Error('The current billet can still be worked.');Object.assign(job,{phase:'heat',startedAt:now,step:0,mistakes:0});summary='The smith replaced the ruined billet. Heating again.';break;}
 case 'forge-abandon':{jobAtSmith();next.forge=null;summary='Abandoned the paid billet';break;}
 case 'equip':{if(a.weapon!==null&&!p.weapons.some(w=>w.id===a.weapon))throw Error('That weapon is not in your satchel.');next.equipped=a.weapon;summary=a.weapon===null?'Put your weapon away':`Equipped ${p.weapons.find(w=>w.id===a.weapon).name}`;break;}
 case 'jump':{if(now-(p.lastJump||0)<900)throw Error('Land before jumping again.');next.lastJump=now;next.actionStats.jumps++;summary='Jumped';break;}
 case 'attack':{
  const weapon=equippedWeapon(p);if(!weapon)throw Error('Equip a forged weapon before attacking.');if(now-(p.lastAttack||0)<1100)throw Error('Let your weapon recover.');if(!Number.isFinite(a.heading))throw Error('Choose an attack direction.');next.lastAttack=now;next.actionStats.attacks++;summary=`Swung ${weapon.name}`;
  if(a.target){const foe=resolveOpponent(a.target),pos=p.dungeon||p,space=p.dungeon?.id||'overworld';if(!foe||foe.space!==space)throw Error('That opponent is not here.');const dx=foe.x-pos.x,dz=foe.z-pos.z,distance=Math.hypot(dx,dz);if(distance>weapon.reach||distance>.2&&(dx*Math.sin(a.heading)+dz*Math.cos(a.heading))/distance<.25)throw Error('Face your target and move closer.');if(p.dungeon&&!cavePathClear(resolveDungeon(space),pos,foe))throw Error('A dungeon wall blocks your strike.');let hp=p.combat[foe.id]?.health??foe.health;if(hp<=0){if(!foe.dummy)throw Error('This sentinel is already defeated.');hp=foe.health;}hp=Math.max(0,hp-weapon.damage);next.combat[foe.id]={health:hp,lastHit:now};extra={target:foe.id,damage:weapon.damage,health:hp};summary=`Hit ${foe.name} for ${weapon.damage} damage`;
   if(hp===0){next.actionStats.defeated++;if(!foe.dummy){next.coins+=6;next.inventory.iron+=2;summary='Defeated a stone sentinel · 6 coins and 2 iron ore';}else summary='Knocked down the practice dummy';}
   else if(!foe.dummy){const evaded=now-(p.lastJump||0)<1000;next.health=Math.max(0,p.health-(evaded?0:8));extra.retaliation=evaded?0:8;summary+=evaded?' · jumped over its counterattack':' · sentinel countered for 8 damage';if(next.health===0){next.health=60;next.dungeon=null;next.x=p.house.doorX;next.z=p.house.doorZ;extra.returnedHome=true;summary='The sentinel overwhelmed you. You woke at home with your supplies.';}}
  }break;
 }
 default:return null;
 }return {summary,extra};
}
