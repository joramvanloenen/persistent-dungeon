import test from 'node:test';
import assert from 'node:assert/strict';
import {installUILayout} from '../src/ui-layout.js';
test('HUD clearance follows dock size and dialog viewport follows keyboard resizing',()=>{
 const values=new Map(),events=new Map(),viewEvents=new Map();let dockTop=510,observed,disconnected=false;
 const dock={getBoundingClientRect:()=>({top:dockTop})},doc={documentElement:{style:{setProperty:(k,v)=>values.set(k,v)}},querySelector:()=>dock};
 const viewport={height:700,offsetTop:0,addEventListener:(k,v)=>viewEvents.set(k,v),removeEventListener:k=>viewEvents.delete(k)};
 const win={innerHeight:700,visualViewport:viewport,addEventListener:(k,v)=>events.set(k,v),removeEventListener:k=>events.delete(k),ResizeObserver:class{constructor(cb){this.callback=cb;}observe(e){observed=e;}disconnect(){disconnected=true;}}};
 const stop=installUILayout(doc,win);assert.equal(observed,dock);assert.equal(values.get('--dock-clearance'),'190px');assert.equal(values.get('--viewport-height'),'700px');
 viewport.height=350;viewport.offsetTop=20;viewEvents.get('resize')();assert.equal(values.get('--viewport-height'),'350px');assert.equal(values.get('--viewport-top'),'20px');
 win.innerHeight=640;dockTop=430;events.get('resize')();assert.equal(values.get('--dock-clearance'),'210px');
 stop();assert.equal(events.size,0);assert.equal(viewEvents.size,0);assert.ok(disconnected);
});
