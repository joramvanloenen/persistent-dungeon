import {createPlayer,validateAction} from '../../../src/rules.js';
import {normalizePlayer} from '../../../src/homes.js';
import {resolveNpc,CHUNK,REGION} from '../../../src/world.js';
// Auth and all mutation validation happen here, before the atomic SQL transaction.
const base=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const allowed=Deno.env.get('GAME_ORIGIN')||'https://joramvanloenen.github.io';
const headers={'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`};
async function db(path:string,options:RequestInit={}){const r=await fetch(base+'/rest/v1/'+path,{...options,headers:{...headers,...options.headers}});const data=r.status===204?null:await r.json();if(!r.ok)throw Error(data.message||'World storage is unavailable.');return data;}
const enc=encodeURIComponent;
const memory=(m:any)=>({id:m.id,npc:m.npc,playerId:m.player_id,playerName:m.player_name,message:m.message,response:m.response,createdAt:new Date(m.created_at).getTime()});
Deno.serve(async(request:Request)=>{
 const cors={'Access-Control-Allow-Origin':allowed,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
 const reply=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(request.headers.get('origin')&&request.headers.get('origin')!==allowed)return reply({error:'This origin is not allowed.'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(request.method!=='POST')return reply({error:'Use POST.'},405);
 try{
  const auth=request.headers.get('authorization');if(!auth)return reply({error:'Sign in to your traveler.'},401);
  const u=await fetch(base+'/auth/v1/user',{headers:{Authorization:auth,apikey:key}});if(!u.ok)return reply({error:'Your sign-in expired. Please sign in again.'},401);const user=await u.json();
  const raw=await request.text();if(raw.length>10000)return reply({error:'Request too large.'},413);const body=JSON.parse(raw);
  const provision=await db('rpc/provision_game_player',{method:'POST',body:JSON.stringify({actor_id:user.id,initial_state:createPlayer(user.id,'Traveler')})});
  const p=normalizePlayer(provision.player,provision.plot);
  if(body.path==='state'){
   const cx=Math.floor(p.x/CHUNK),cz=Math.floor(p.z/CHUNK),rx=Math.floor(p.x/REGION),rz=Math.floor(p.z/REGION),spaces:string[]=[],villages:string[]=[];
   for(let x=rx-1;x<=rx+1;x++)for(let z=rz-1;z<=rz+1;z++){spaces.push(`d:${x}:${z}`);villages.push(`v:${x}:${z}`);}if(p.dungeon&&!spaces.includes(p.dungeon.id))spaces.push(p.dungeon.id);
   const nodes=await db(`game_nodes?or=(and(space.eq.overworld,cx.gte.${cx-4},cx.lte.${cx+4},cz.gte.${cz-4},cz.lte.${cz+4}),space.in.(${spaces.map(enc).join(',')}))&select=id`);
   const homeRows=await db('game_homes?village=in.('+villages.map(enc).join(',')+')&select=state&limit=200');const homes=homeRows.map((h:any)=>h.state).filter(Boolean);if(!homes.some((h:any)=>h.owner===p.id))homes.push(p.house);
   const others=await db('game_players?updated_at=gte.'+enc(new Date(Date.now()-120000).toISOString())+'&select=id,state&limit=50');
   const players=others.map((n:any)=>{const pos=n.state.dungeon||n.state;return {id:n.id,name:n.state.name,x:pos.x,z:pos.z,space:n.state.dungeon?.id||'overworld'};}).filter((n:any)=>n.space===(p.dungeon?.id||'overworld')&&Math.hypot(n.x-(p.dungeon||p).x,n.z-(p.dungeon||p).z)<900);
   const events=await db('game_events?actor=eq.'+enc(user.id)+'&order=created_at.desc&limit=20');
   return reply({player:p,depleted:nodes.map((n:any)=>n.id),homes,players,events:events.map((e:any)=>({...e,createdAt:new Date(e.created_at).getTime()}))});
  }
  if(body.path==='memory'){
   const n=resolveNpc(String(body.npc));if(!n||Math.hypot(n.x-p.x,n.z-p.z)>20)return reply({error:'Walk closer to this person.'},400);
   const offset=Math.max(0,Math.min(1000000,Math.floor(Number(body.offset)||0)));const m=await db('game_memories?npc=eq.'+enc(n.id)+(body.personal?'&player_id=eq.'+enc(user.id):'')+'&order=id.desc&limit=201&offset='+offset);return reply({memories:m.slice(0,200).reverse().map(memory),hasMore:m.length>200});
  }
  if(body.path==='action'){
   const a=body.action;let depleted=false,memories:any[]=[];
   if(a?.type==='gather')depleted=(await db('game_nodes?id=eq.'+enc(String(a.target))+'&select=id')).length>0;
   if(a?.type==='talk'){
    const recent=await db('game_memories?npc=eq.'+enc(String(a.target))+'&order=created_at.desc&limit=200');memories=recent.map(memory);
    const words=String(a.message||'').match(/[\p{L}\p{N}]{4,}/gu)||[];
    const needle=words.filter((w:string)=>!['remember','about','what','told','know','that','your','have'].includes(w.toLowerCase())).slice(0,4).map((w:string)=>w.replace(/[^\p{L}\p{N}]/gu,''));
    if(needle.length){const q=needle.map((w:string)=>'message.ilike.'+enc('*'+w+'*')).join(',');const found=await db('game_memories?npc=eq.'+enc(String(a.target))+'&or=('+q+')&order=created_at.desc&limit=100');memories=[...found.map(memory),...memories];}
   }
   const result=validateAction(p,a,{depleted,memories});
   await db('rpc/apply_game_action',{method:'POST',body:JSON.stringify({actor_id:user.id,expected_revision:body.revision,next_state:result.player,action_type:a.type,action_summary:result.summary,extra:result.extra})});
   return reply(result);
  }
  return reply({error:'Unknown world request.'},400);
 }catch(e){console.error('world request failed',String(e));return reply({error:(e as Error).message||'The world could not save that action.'},400);}
});
