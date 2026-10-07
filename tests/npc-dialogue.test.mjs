import test from 'node:test';import assert from 'node:assert/strict';
import {npcProfile,npcStage,dialogueChoices} from '../src/npc-dialogue.js';
import {npcGreeting,npcReply} from '../src/rules.js';
import {settlement,npcsFor} from '../src/world.js';
import {shipVisitor,portBroker} from '../src/landing-port.js';
import {roadPeopleFor,npcAt,WORLD_EPOCH} from '../src/npc-life.js';
const p={id:'character-reader',name:'Ada'};
const roster=s=>[...npcsFor(s),...roadPeopleFor(s.rx,s.rz),shipVisitor(s),portBroker(s)];
test('all NPC types receive stable individual backgrounds, ambitions and voices without modifying world IDs',()=>{
 const all=Array.from({length:12},(_,i)=>roster(settlement(i-6,0))).flat(),stories=new Set(),voices=new Set();
 for(const n of all){const profile=npcProfile(n);assert.equal(profile.id,n.id);assert.deepEqual(profile,npcProfile(JSON.parse(JSON.stringify({...n,x:n.x+900,activity:'on another job'}))));voices.add(profile.voice);stories.add(npcReply(n,p,'Tell me your story.',[]));assert.ok(profile.background&&profile.goal&&profile.keepsake);assert.match(npcStage(n),new RegExp(n.name));assert.ok(npcGreeting(n,p).includes(n.name));assert.ok(!npcGreeting(n,p,true).includes(profile.background));}
 assert.equal(voices.size,8);assert.ok(stories.size>all.length*.85);assert.ok(all.some(n=>n.broker)&&all.some(n=>n.visitor)&&all.some(n=>n.role==='smith'));
});
test('characters answer personal topics and every contextual choice has a usable response',()=>{
 for(const n of roster(settlement(0,0))){const c=npcProfile(n);assert.ok(npcReply(n,p,'Tell me your story.',[]).includes(c.background));assert.ok(npcReply(n,p,'What is your ambition?',[]).includes(c.goal));assert.ok(npcReply(n,p,'What do you do off duty?',[]).includes(c.interest));assert.ok(npcReply(n,p,'What is your favourite keepsake?',[]).includes(c.keepsake));assert.ok(npcReply(n,p,'Thank you!',[]).length>10);
  const choices=dialogueChoices(n);assert.equal(choices.length,3);for(const choice of choices){const reply=npcReply({...n,activity:'checking fuel cells'},p,choice.line,[]);assert.ok(reply&&!reply.includes('undefined'));assert.ok(reply.length<1000);}
 }
 assert.match(dialogueChoices(shipVisitor(settlement(0,0)))[1].label,/Loose Bolt/);assert.match(dialogueChoices(portBroker(settlement(0,0)))[1].label,/arriving pilots/);
});
test('personality never fabricates, rewrites or leaks player memory on greeting; explicit recalls retain attribution',()=>{
 for(const n of roster(settlement(0,0))){const old={playerId:p.id,playerName:p.name,message:'My ship is named Blue Lantern and I once said hello.',response:'Old saved reply remains untouched.'},other={playerId:'other',playerName:'Jo',message:'My silver antenna is hidden at home.'},memories=[other,old],snapshot=JSON.stringify(memories);
  assert.match(npcReply(n,p,'Remember when I said hello?',memories),/My ship is named Blue Lantern and I once said hello\./);assert.match(npcReply(n,p,'What do you know about my ship?',memories),/Blue Lantern/);assert.match(npcReply(n,p,'Remember the silver antenna?',memories),/Jo spoke/);assert.doesNotMatch(npcGreeting(n,p,true),/Blue Lantern|silver antenna/);assert.equal(JSON.stringify(memories),snapshot);
  assert.match(npcReply(n,p,'What have you seen?',[],[{summary:'I saw Ada jump.',createdAt:1,kind:'witness'}]),/I saw Ada jump\./);
 }
});
test('pilot conversations describe their actual business and unknown questions remain honest',()=>{
 const n=npcAt(shipVisitor(settlement(0,0)),WORLD_EPOCH+280000);assert.ok(npcReply(n,p,'Why are you here?',[]).includes(n.activity));assert.ok(npcReply(n,p,'Tell me your story.',[]).includes(npcProfile(n).background));assert.doesNotMatch(npcReply(n,p,'Where is the secret dragon reactor?',[]),/undefined/);
 const answer=npcReply(n,p,'Can you reverse gravity?',[]);assert.match(answer,/beyond what I know|won’t pretend|hole in my education|don’t know enough/);
});
