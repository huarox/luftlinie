const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
function fixture(options={}){
  const dom=new JSDOM(html,{url:options.url||'https://example.test/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window, data={'.info':{connected:true,serverTimeOffset:0}},listeners=new Map(),writes=[],disconnects=new Map(),heldReads=new Map();
  const deferRead=path=>{let release;heldReads.set(path,new Promise(r=>{release=r;}));return ()=>{release();heldReads.delete(path);};};
  let timers=0,now=Date.now();const pending=new Map();w.Date.now=()=>now;
  const schedule=(fn,ms,repeat)=>{const id=++timers;pending.set(id,{fn,at:now+(ms||0),repeat});return id;};
  w.setTimeout=(fn,ms)=>schedule(fn,ms,0);w.setInterval=(fn,ms)=>schedule(fn,ms,ms);
  w.clearInterval=w.clearTimeout=id=>pending.delete(id);w.requestAnimationFrame=fn=>options.deferredFrames?w.setTimeout(fn,16):fn();w.matchMedia=()=>({matches:false});
  const tick=async ms=>{const until=now+ms;let count=0;while(true){const next=[...pending].filter(([,t])=>t.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;if(++count>1000)throw Error('Timer loop');const[id,t]=next;now=t.at;if(t.repeat)t.at+=t.repeat;else pending.delete(id);await t.fn();await new Promise(r=>setImmediate(r));}now=until;};
  const layer=()=>{const obj={};for(const method of ['setLatLngs','setTooltipContent','addTo','bindPopup','bindTooltip','setLatLng','setView','invalidateSize','remove','removeLayer','on','flyTo','fitBounds','bringToBack','addLatLng'])obj[method]=()=>obj;obj.attributionControl={remove(){}};return obj;};
  w.L={map:layer,marker:layer,circle:layer,polyline:layer,tileLayer:layer,divIcon:()=>({}),latLngBounds:()=>[],control:{zoom:layer}};
  w.navigator.vibrate=()=>{};w.HTMLMediaElement.prototype.play=()=>Promise.resolve();w.HTMLMediaElement.prototype.pause=()=>{};
  const get=path=>path.split('/').filter(Boolean).reduce((o,k)=>o?.[k],data)??null;
  const put=(path,value)=>{const parts=path.split('/').filter(Boolean),last=parts.pop();let obj=data;for(const key of parts)obj=obj[key]??={};obj[last]=JSON.parse(JSON.stringify(value));};
  const snap=path=>({val:()=>structuredClone(get(path)),exists:()=>get(path)!=null});
  const emit=path=>{for(const [key,fns]of listeners)if(path===key||path.startsWith(key+'/')||key.startsWith(path+'/'))for(const fn of fns)queueMicrotask(()=>{if(listeners.get(key)?.has(fn))fn(snap(key));});};
  const db={ref(path){return {
    once:async()=>{if(heldReads.has(path))await heldReads.get(path);return snap(path);},
    on(event,fn){if(!listeners.has(path))listeners.set(path,new Set());listeners.get(path).add(fn);queueMicrotask(()=>{if(listeners.get(path)?.has(fn))fn(snap(path));});},
    off(){listeners.delete(path);},
    async set(value){writes.push({path,value});put(path,value);emit(path);},
    async update(updates){writes.push({path,value:updates});for(const [key,val]of Object.entries(updates))put(path+'/'+key,val);emit(path);},
    async remove(){put(path,null);emit(path);},
    async transaction(fn){const value=fn(structuredClone(get(path)));if(value===undefined)return {committed:false,snapshot:snap(path)};put(path,value);emit(path);return {committed:true,snapshot:snap(path)};},
    onDisconnect(){return {update:async value=>{disconnects.set(path,value);},cancel:async()=>disconnects.delete(path)};}
  };}};
  w.firebase={initializeApp(){},database:()=>db};w.firebase.database.ServerValue={TIMESTAMP:Date.now()};
  if(options.session)w.localStorage.setItem('ll_session',JSON.stringify(options.session));
  vm.runInContext(fs.readFileSync('core.js','utf8'),dom.getInternalVMContext());
  vm.runInContext(app+'\nwindow.testing={S,App,goScreen,createGameFB,sendPosUpdateQueued,handleGPSPos,startPlayersListener,resetGameState,fillResults,saveGameStats,loadStats,serverNow,findSmartTarget,startGPS,stopGPS,distUnit,showCountdown,runElimCheck,startClientTimer,startSpecRequestsListener,renderNavCards};',dom.getInternalVMContext());
  const a=w.testing;a.S.soundEnabled=false;
  return {w,...a,data,writes,listeners,disconnects,deferRead,put,get,tick,emit,flush:()=>new Promise(resolve=>setImmediate(resolve)),close:async()=>{await new Promise(resolve=>setImmediate(resolve));assert.equal(w.document.querySelector('#load-error'),null,'No uncaught browser errors');w.close();}};
}
function active(f,overrides={}){
  Object.assign(f.S,{gameCode:'ABC234',myToken:'player',myName:'Test',role:'navigator',status:'active',startedAt:Date.now()-20000,targetLat:0,targetLon:0,myLat:0,myLon:0,lastAccuracy:5,_lastFix:f.serverNow(),_isOnline:true,blindFinish:true,...overrides});
  f.put('games/ABC234',{status:'active',gameMode:f.S.gameMode,multiTargets:f.S.multiTargets,startedAt:f.S.startedAt,timeLimitSec:f.S.timeLimitSec,targetLat:0,targetLon:0,arrRadius:50,blindFinish:true,players:{player:{role:'navigator',name:'Test',arrived:false},other:{role:'navigator',name:'Other',arrived:false}}});
}
test('boot leaves only the landing screen interactive and zero distance uses metres',async()=>{
  const f=fixture();await f.flush();assert.equal(f.S.screen,'land');assert.equal(f.w.document.querySelector('#sc-join').inert,true);assert.equal(f.distUnit(0),'m');await f.close();
});
test('game creation reserves a unique lobby and persists host identity before starting',async()=>{
  const f=fixture();await f.flush();await f.createGameFB();const game=f.get('games/'+f.S.gameCode);assert.equal(game.hostToken,f.S.myToken);assert.equal(game.players[f.S.myToken].role,'spectator');assert.equal(JSON.parse(f.w.localStorage.getItem('ll_session')).isHost,true);await f.close();
});
test('team game cannot create a player before a team is chosen',async()=>{
  const f=fixture();await f.flush();f.put('games/ABC234',{status:'lobby',teamsMode:true});f.w.document.querySelector('#inp-code').value='ABC234';f.w.document.querySelector('#inp-name').value='Racer';await f.App.joinGame();assert.equal(f.get('games/ABC234/players'),null);assert.equal(f.w.document.querySelector('#team-pick-field').classList.contains('hidden'),false);await f.close();
});
test('concurrent GPS callbacks advance just one personal checkpoint',async()=>{
  const f=fixture();await f.flush();active(f,{gameMode:'multi',multiTargets:[{lat:0,lon:0},{lat:.02,lon:0},{lat:.04,lon:0}]});
  await Promise.all([f.sendPosUpdateQueued(),f.sendPosUpdateQueued()]);assert.equal(f.S.multiCurrent,1);assert.equal(f.get('games/ABC234/players/player/multiCurrent'),1);assert.equal(f.get('games/ABC234/targetLat'),0);assert.equal(f.get('games/ABC234/players/other/multiCurrent'),null);await f.close();
});
test('poor GPS cannot trigger arrival and local distance renders before the network write',async()=>{
  const f=fixture();await f.flush();active(f,{lastAccuracy:200});await f.sendPosUpdateQueued();assert.equal(f.S.arrived,false);assert.equal(f.w.document.querySelector('#na-dist').textContent,'0');assert.match(f.w.document.querySelector('#na-upd').textContent,/accurate/);await f.close();
});
test('offline movement updates the display without recording an arrival',async()=>{
  const f=fixture();await f.flush();active(f,{_isOnline:false});await f.sendPosUpdateQueued();assert.equal(f.S.arrived,false);assert.equal(f.get('games/ABC234/players/player/arrived'),false);assert.match(f.w.document.querySelector('#na-upd').textContent,/Offline/);await f.close();
});
test('first arrival ends the game when blind finish is disabled',async()=>{
  const f=fixture();await f.flush();active(f,{blindFinish:false});f.put('games/ABC234/blindFinish',false);await f.sendPosUpdateQueued();assert.equal(f.S.arrived,true);assert.equal(f.get('games/ABC234/status'),'finished');await f.close();
});
test('blind finish keeps the game active for the remaining navigator',async()=>{
  const f=fixture();await f.flush();active(f);await f.sendPosUpdateQueued();assert.equal(f.get('games/ABC234/status'),'active');assert.equal(f.get('games/ABC234/players/player/arrived'),true);await f.close();
});
test('host overview never accidentally records an arrival',async()=>{
  const f=fixture();await f.flush();active(f,{role:'spectator',isHost:true});await f.sendPosUpdateQueued();assert.equal(f.S.arrived,false);await f.close();
});
test('leaving detaches game, player and approval listeners',async()=>{
  const f=fixture();await f.flush();active(f);f.startPlayersListener();await f.flush();assert.ok(f.listeners.has('games/ABC234'));f.resetGameState();assert.equal(f.listeners.has('games/ABC234'),false);assert.equal(f.listeners.has('games/ABC234/players'),false);assert.equal(f.S.myToken,null);await f.close();
});
test('rejoin restores checkpoint and does not reset an eliminated navigator',async()=>{
  const f=fixture();await f.flush();active(f);f.put('games/ABC234/gameMode','multi');f.put('games/ABC234/multiTargets',[{lat:0,lon:0},{lat:1,lon:1},{lat:2,lon:2}]);f.put('games/ABC234/players/player',{name:'Test',role:'navigator',multiCurrent:2,eliminated:true,arrived:false,team:'blue',startDist:500});f.S._rejoinCode='ABC234';f.S._rejoinToken='player';await f.App.doRejoin();assert.equal(f.S.multiCurrent,2);assert.equal(f.S.targetLat,2);assert.equal(f.S.eliminated,true);assert.equal(f.S.myTeam,'blue');assert.equal(f.S.gpsWatch,null);await f.close();
});
test('stats are counted once and a DNF never becomes a best time',async()=>{
  const f=fixture();await f.flush();active(f,{status:'finished'});f.saveGameStats(15,2,false);f.saveGameStats(15,2,false);assert.equal(f.loadStats().games,1);assert.equal(f.loadStats().bestTime,null);assert.equal(f.loadStats().wins,0);await f.close();
});
test('smart target failures produce a useful error rather than an arbitrary location',async()=>{
  const f=fixture();await f.flush();f.w.fetch=async()=>{throw new Error('offline');};await assert.rejects(f.findSmartTarget(48.2,16.3,2),/No suitable public route/);await f.close();
});
test('host cannot start an empty game',async()=>{
  const f=fixture();await f.flush();active(f,{isHost:true});f.S.latestPlayers={};await f.App.lockStart();assert.match(f.w.document.querySelector('#toast').textContent,/at least one/);await f.close();
});

test('leaving during countdown never launches the old game',async()=>{
  const f=fixture();await f.flush();active(f,{startedAt:f.serverNow()+3500});let launched=false;
  f.showCountdown(()=>{launched=true;});f.App.goHome();await f.tick(5000);
  assert.equal(launched,false);assert.equal(f.S.screen,'land');await f.close();
});

test('late join uses the running game clock without another three-second countdown',async()=>{
  const f=fixture();await f.flush();active(f);let launched=false;f.showCountdown(()=>{launched=true;});
  assert.equal(launched,true);assert.equal(f.w.document.querySelector('#ov-cd').classList.contains('hidden'),true);await f.close();
});

test('ending during countdown cannot restart navigation or leave an overlay over results',async()=>{
  const f=fixture();await f.flush();active(f,{startedAt:f.serverNow()+3500});f.goScreen('nwait');f.startPlayersListener();await f.flush();
  f.showCountdown(()=>f.goScreen('nactive'));f.put('games/ABC234/status','aborted');f.emit('games/ABC234');await f.flush();await f.tick(5000);
  assert.equal(f.S.screen,'results');assert.equal(f.w.document.querySelector('#ov-cd').classList.contains('hidden'),true);await f.close();
});

test('final elimination survivor wins when the opponent withdraws',async()=>{
  const f=fixture();await f.flush();active(f,{isHost:true,gameMode:'elimination'});f.put('games/ABC234/gameMode','elimination');f.put('games/ABC234/players/other/withdrawn',true);
  await f.runElimCheck();assert.equal(f.get('games/ABC234/status'),'finished');assert.equal(f.get('games/ABC234/players/player/arrived'),true);await f.close();
});

test('an aborted room cannot be finished or receive an arrival from a delayed GPS callback',async()=>{
  const f=fixture();await f.flush();active(f,{blindFinish:false});f.put('games/ABC234/status','aborted');
  await f.sendPosUpdateQueued();assert.equal(f.get('games/ABC234/status'),'aborted');assert.equal(f.get('games/ABC234/players/player/arrived'),false);await f.close();
});

test('a stale GPS fix cannot record arrival after reconnect',async()=>{
  const f=fixture();await f.flush();active(f,{_lastFix:f.serverNow()-60000});await f.sendPosUpdateQueued();assert.equal(f.get('games/ABC234/players/player/arrived'),false);await f.close();
});

test('rejoin restores host setup settings before the host goes back to edit',async()=>{
  const f=fixture();await f.flush();active(f);f.put('games/ABC234/status','lobby');f.put('games/ABC234/hostToken','player');f.put('games/ABC234/idealMin',75);f.put('games/ABC234/diff',5);
  f.S._rejoinCode='ABC234';f.S._rejoinToken='player';await f.App.doRejoin();f.goScreen('setup');
  assert.equal(f.S.idealMin,75);assert.equal(f.S.diff,5);assert.equal(f.w.document.querySelector('#sl-time').value,'75');await f.close();
});

test('spectator request payload cannot replace its validated identity or inject markup',async()=>{
  const f=fixture();await f.flush();active(f,{isHost:true});f.put('games/ABC234/specRequests/safe',{name:'Viewer',token:'x\"><img src=x onerror="alert(1)"/>'});f.startSpecRequestsListener();await f.flush();
  assert.equal(f.w.document.querySelector('#spec-requests img'),null);assert.ok(f.w.document.querySelector('#sr-safe'));await f.close();
});

test('checkpoint text treats malformed remote progress as data, never HTML',async()=>{
  const f=fixture();await f.flush();active(f,{gameMode:'multi'});f.renderNavCards('ha-cards',[{name:'Player',multiCurrent:'<img src=x onerror="alert(1)">'}]);assert.equal(f.w.document.querySelector('#ha-cards img'),null);await f.close();
});

test('first finisher overlay is dismissed when shared results arrive',async()=>{
  const f=fixture();await f.flush();active(f,{blindFinish:false});f.put('games/ABC234/blindFinish',false);f.startPlayersListener();await f.flush();await f.sendPosUpdateQueued();await f.flush();
  assert.equal(f.S.screen,'results');assert.equal(f.w.document.querySelector('#ov-arrive').classList.contains('hidden'),true);await f.close();
});

test('leaving while a join is loading cannot create a player or reopen the waiting room',async()=>{
  const f=fixture();await f.flush();f.put('games/ABC234',{status:'lobby'});f.w.document.querySelector('#inp-code').value='ABC234';
  const release=f.deferRead('games/ABC234');const join=f.App.joinGame();f.App.goHome();release();await join;
  assert.equal(f.S.screen,'land');assert.equal(f.S.gameCode,null);assert.equal(f.get('games/ABC234/players'),null);await f.close();
});

test('leaving while host location is pending does not create an orphan room',async()=>{
  const f=fixture();await f.flush();let located;f.w.navigator.geolocation={getCurrentPosition:fn=>{located=fn;}};
  const create=f.App.goMap();f.App.goHome();located({coords:{latitude:0,longitude:0}});await create;
  assert.equal(f.S.gameCode,null);assert.equal(f.get('games'),null);assert.equal(f.S.screen,'land');await f.close();
});

test('freshly created and joined players register disconnect presence',async()=>{
  const f=fixture();await f.flush();await f.createGameFB();assert.equal(f.disconnects.get('games/'+f.S.gameCode+'/players/'+f.S.myToken)?.online,false);await f.close();
});

test('denied spectator cleanup does not recreate the removed player',async()=>{
  const f=fixture();await f.flush();active(f,{role:'spectator'});f.put('games/ABC234/players/player',null);f.startPlayersListener();await f.flush();await f.flush();
  assert.equal(f.S.screen,'land');assert.equal(f.get('games/ABC234/players/player'),null);await f.close();
});

test('host edits in the lobby reach waiting players before the game starts',async()=>{
  const f=fixture();await f.flush();active(f,{status:'lobby'});f.put('games/ABC234/status','lobby');f.goScreen('nwait');f.startPlayersListener();await f.flush();
  f.put('games/ABC234/timeLimitSec',300);f.put('games/ABC234/transportMode','walk');f.put('games/ABC234/status','active');f.emit('games/ABC234');await f.flush();
  assert.equal(f.S.timeLimitSec,300);assert.equal(f.S.transportMode,'walk');await f.close();
});

test('disconnected expiry is retried on reconnect and cannot overwrite an abort',async()=>{
  const f=fixture();await f.flush();active(f,{startedAt:f.serverNow()-100000,timeLimitSec:1,_isOnline:false});f.startClientTimer();await f.tick(500);
  assert.equal(f.get('games/ABC234/status'),'active');f.S._isOnline=true;f.put('games/ABC234/status','aborted');await f.tick(500);
  assert.equal(f.get('games/ABC234/status'),'aborted');await f.close();
});

test('host and spectator rosters render cached players without waiting for a GPS write',async()=>{
  const f=fixture();await f.flush();active(f);f.S.latestPlayers={player:{name:'Waiting for GPS',role:'navigator'}};
  for(const [screen,prefix]of [['hactive','ha'],['spectator','sp']]){f.goScreen(screen);assert.equal(f.w.document.querySelector('#'+prefix+'-nbadge').textContent,'1');assert.match(f.w.document.querySelector('#'+prefix+'-cards').textContent,/Waiting for GPS/);}await f.close();
});

test('refreshing an invite link offers the existing session instead of creating a duplicate player',async()=>{
  const f=fixture({url:'https://example.test/?join=ABC234',session:{code:'ABC234',token:'player',name:'Test',ts:Date.now()}});
  f.put('games/ABC234',{status:'active'});await f.flush();assert.equal(f.S.screen,'land');assert.equal(f.w.document.querySelector('#rejoin-bar').classList.contains('hidden'),false);await f.close();
});

test('expiry completes after reconnection instead of giving up when offline',async()=>{
  const f=fixture();await f.flush();active(f,{startedAt:f.serverNow()-10000,timeLimitSec:1,_isOnline:false});f.startClientTimer();await f.tick(500);assert.equal(f.get('games/ABC234/status'),'active');
  f.S._isOnline=true;await f.tick(500);assert.equal(f.get('games/ABC234/status'),'finished');await f.close();
});

test('an old tab cannot reset a checkpoint with a routine position update',async()=>{
  const f=fixture();await f.flush();active(f,{gameMode:'multi',myLat:1,multiCurrent:0});f.put('games/ABC234/players/player/multiCurrent',2);await f.sendPosUpdateQueued();assert.equal(f.get('games/ABC234/players/player/multiCurrent'),2);await f.close();
});

test('confirmation dialog makes the game inert and Escape returns focus',async()=>{
  const f=fixture();await f.flush();active(f,{isHost:true});f.goScreen('hactive');f.w.document.querySelector('#ha-end-btn').focus();await f.App.abortGame();await f.flush();
  assert.equal(f.w.document.querySelector('#sc-hactive').inert,true);assert.equal(f.w.document.activeElement.closest('[role="dialog"]').id,'as-abort');
  f.w.document.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await f.flush();assert.equal(f.w.document.querySelector('#sc-hactive').inert,false);assert.equal(f.w.document.activeElement.id,'ha-end-btn');await f.close();
});

test('host cannot restart an ended room using a stale lobby screen',async()=>{
  const f=fixture();await f.flush();active(f,{isHost:true});f.S.latestPlayers={other:{role:'navigator'}};f.put('games/ABC234/status','aborted');f.put('games/ABC234/hostToken','player');
  await f.App.lockStart();assert.equal(f.get('games/ABC234/status'),'aborted');assert.equal(f.w.document.querySelector('#ov-cd').classList.contains('hidden'),true);await f.close();
});

test('deferred browser frames leave the landing interactive and cannot activate an old screen',async()=>{
  const f=fixture({deferredFrames:true});await f.flush();await f.tick(16);assert.equal(f.w.document.querySelector('#sc-land').inert,false);
  f.goScreen('setup');f.goScreen('land');await f.tick(16);assert.equal(f.w.document.querySelectorAll('.sc.active').length,1);assert.equal(f.w.document.querySelector('.sc.active').id,'sc-land');await f.close();
});

test('smart target snaps to the public routing network without waiting on Overpass',async()=>{
  const f=fixture();await f.flush();const calls=[];
  f.w.fetch=async url=>{calls.push(String(url));const m=String(url).match(/nearest\/v1\/driving\/([-\d.]+),([-\d.]+)/);
    if(!m)throw new Error('Overpass should not be needed');
    return {ok:true,json:async()=>({code:'Ok',waypoints:[{location:[+m[1]+0.0003,+m[2]],distance:22}]})};};
  f.S.transportMode='walk';const p=await f.findSmartTarget(48.2,16.37,2);
  const d=f.w.LuftlinieCore.distance(48.2,16.37,p.lat,p.lon);assert.ok(d>1640&&d<2240,'within the distance band: '+d);
  assert.ok(calls.every(u=>u.includes('routed-foot/nearest')));await f.close();
});

test('car targets that are not on the walking network (motorways) are rejected',async()=>{
  const f=fixture();await f.flush();
  f.w.fetch=async url=>{const u=String(url),m=u.match(/nearest\/v1\/driving\/([-\d.]+),([-\d.]+)/);if(!m)throw new Error('offline');
    // car snaps fine, but the nearest walkable point is 300 m away: a motorway
    const off=u.includes('routed-foot')?0.004:0;return {ok:true,json:async()=>({code:'Ok',waypoints:[{location:[+m[1]+off,+m[2]],distance:10}]})};};
  f.S.transportMode='drive';await assert.rejects(f.findSmartTarget(48.2,16.37,5),/No suitable public route/);await f.close();
});
