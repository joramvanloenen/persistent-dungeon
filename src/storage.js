import CONFIG from '../config.js';
import {createPlayer,validateAction} from './rules.js?v=6';
import {normalizePlayer} from './homes.js?v=6';
const LOCAL_KEY='evermere-local-v1';
export class Store {
 constructor(){this.mode=CONFIG.apiUrl?'server':CONFIG.supabaseUrl&&CONFIG.supabasePublishableKey?'cloud':'local';this.session=null;this.local=null;this.localError=null;this.listeners=[];this.queue=Promise.resolve();}
 async init(){
  if(this.mode==='local'){
   let raw;try{raw=localStorage.getItem(LOCAL_KEY);}catch{this.localError='Browser storage is blocked. Progress cannot be saved on this device.';}
   if(raw){try{this.local=JSON.parse(raw);if(!this.local.player||!this.local.nodes||!this.local.memories)throw Error();}catch{throw Error('The local save could not be read. Export or repair it before continuing.');}}
   if(!this.local)this.local={player:createPlayer(crypto.randomUUID(),'Traveler'),nodes:{},memories:[],events:[]};
   this.local.player=normalizePlayer(this.local.player);this.saveLocal();return;
  }
  if(this.mode==='server'){this.session=localStorage.getItem('evermere-server-token');return;}
  if(this.mode==='cloud'){
   const {createClient}=await import('../vendor/supabase.js');
   this.auth=createClient(CONFIG.supabaseUrl,CONFIG.supabasePublishableKey);
   const {data,error}=await this.auth.auth.getSession();if(error)throw error;this.session=data.session;
   this.auth.auth.onAuthStateChange((_event,session)=>{this.session=session;this.listeners.forEach(f=>f(session));});
  }
 }
 onAuth(fn){this.listeners.push(fn);}
 get signedIn(){return this.mode==='local'||!!this.session;}
 async login(email,password,signup=false){
  if(this.mode==='server'){const r=await fetch(CONFIG.apiUrl.replace(/\/$/,'')+'/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,signup})});const data=await r.json();if(!r.ok)throw Error(data.error);this.session=data.token;localStorage.setItem('evermere-server-token',data.token);return data.token;}
  const r=signup?await this.auth.auth.signUp({email,password,options:{emailRedirectTo:location.href}}):await this.auth.auth.signInWithPassword({email,password});
  if(r.error)throw r.error;this.session=r.data.session;return r.data.session;
 }
 async logout(){if(this.mode==='server'){await fetch(CONFIG.apiUrl.replace(/\/$/,'')+'/api/auth',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+this.session},body:JSON.stringify({path:'logout'})});localStorage.removeItem('evermere-server-token');this.session=null;}if(this.auth)await this.auth.auth.signOut();}
 async request(path,body){
  if(this.mode==='local')return this.localRequest(path,body);
  let url,headers={'Content-Type':'application/json'};
  if(this.mode==='cloud'){
   const {data,error}=await this.auth.auth.getSession();if(error)throw error;
   if(!data.session)throw Error('Sign in to save your traveler.');
   headers.Authorization=`Bearer ${data.session.access_token}`;headers.apikey=CONFIG.supabasePublishableKey;
   url=CONFIG.supabaseUrl+'/functions/v1/world';
  }else{url=CONFIG.apiUrl.replace(/\/$/,'')+'/api/world';headers.Authorization='Bearer '+this.session;}
  const response=await fetch(url,{method:'POST',headers,body:JSON.stringify({path,...body}),credentials:'omit'});
  let data;try{data=await response.json();}catch{throw Error('The world server returned an unreadable response.');}
  if(!response.ok){if(response.status===401){this.session=null;if(this.mode==='server')localStorage.removeItem('evermere-server-token');else if(this.auth)await this.auth.auth.signOut();}throw Error(data.error||'The world server is unavailable.');}return data;
 }
 action(action,player){const task=()=>this.request('action',{action,revision:player.revision});const pending=this.queue.then(task,task);this.queue=pending.catch(()=>{});return pending;}
 async localRequest(path,body={}){
  const raw=localStorage.getItem(LOCAL_KEY);if(raw){const latest=JSON.parse(raw);if(latest.player.revision>this.local.player.revision){this.local=latest;this.local.player=normalizePlayer(this.local.player);}}
  const l=this.local;
  if(path==='state')return {player:structuredClone(l.player),depleted:Object.keys(l.nodes),homes:[l.player.house],players:[],events:l.events.slice(-12).reverse()};
  if(path==='memory'){const memories=l.memories.filter(m=>m.npc===body.npc&&(!body.personal||m.playerId===l.player.id)).slice().reverse();const offset=Math.max(0,Math.min(1000000,Number(body.offset)||0));return {memories:memories.slice(offset,offset+200).reverse(),hasMore:memories.length>offset+200};}
  if(path==='action'){
   // Local preview follows the same server rules, including atomic resource claims.
   if(!Number.isInteger(body.revision)||body.revision!==l.player.revision)throw Error('Your traveler changed in another session. Reload and try again.');
   const a=body.action,result=validateAction(l.player,a,{depleted:!!l.nodes[a.target],memories:l.memories.filter(m=>m.npc===a.target).slice().reverse()});
   const previous=structuredClone(l);l.player=result.player;
   if(a.type==='gather')l.nodes[a.target]=Date.now();
   if(a.type==='talk')l.memories.push({id:crypto.randomUUID(),npc:a.target,playerId:l.player.id,playerName:l.player.name,message:result.extra.message,response:result.extra.response,createdAt:Date.now()});
   l.events.push({id:crypto.randomUUID(),type:a.type,summary:result.summary,createdAt:Date.now(),data:result.extra});
   try{this.saveLocal();}catch(e){this.local=previous;throw e;}
   return {...result,depleted:Object.keys(l.nodes)};
  }throw Error('Unknown world request.');
 }
 saveLocal(){if(this.localError)throw Error(this.localError);try{localStorage.setItem(LOCAL_KEY,JSON.stringify(this.local));}catch{throw Error('Your browser could not save progress. Free storage and try again.');}}
 exportLocal(){return JSON.stringify({format:'evermere-local-v1',savedAt:Date.now(),...this.local},null,2);}
 importLocal(raw){const s=JSON.parse(raw);if(s.format!=='evermere-local-v1'||!s.player?.inventory||!Array.isArray(s.memories)||!Array.isArray(s.events)||!s.nodes)throw Error('That is not an Evermere save.');const old=this.local;this.local=s;try{this.saveLocal();}catch(e){this.local=old;throw e;}}
}
