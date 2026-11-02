
'use strict';
const Core = LuftlinieCore;
const storage = { getItem(key){try{return localStorage.getItem(key);}catch(_){return null;}}, setItem(key,value){try{localStorage.setItem(key,value);}catch(_){}}, removeItem(key){try{localStorage.removeItem(key);}catch(_){}} };
let serverOffset=0;
const serverNow=()=>Date.now()+serverOffset;

/* ── ERROR BOUNDARY — shows visible message instead of blank page ── */
window.onerror=function(){
  if(document.getElementById('load-error'))return false;
  const box=document.createElement('div');box.id='load-error';box.className='load-error';box.setAttribute('role','alert');
  box.innerHTML='<div><p class="eyebrow">CONNECTION INTERRUPTED</p><h1>Let’s reconnect.</h1><p>A part of Luftlinie couldn’t load. Check your connection, then reload. Your saved game will be available to rejoin.</p><button class="btn-primary" onclick="location.reload()">Reload Luftlinie</button></div>';
  document.body.appendChild(box);return false;
};
/* ═══════════════════════════════════════════════════════════
   LUFTLINIE — Firebase Edition
   Fill in FIREBASE_CONFIG below, then host the file anywhere.
════════════════════════════════════════════════════════════ */

// ── CONFIGURE THIS ────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBVPDeqopZPQNsK_LEfVpG8UUEiZakSYWI",
  authDomain:        "luftlinie-4ea9a.firebaseapp.com",
  databaseURL:       "https://luftlinie-4ea9a-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "luftlinie-4ea9a",
  storageBucket:     "luftlinie-4ea9a.firebasestorage.app",
  messagingSenderId: "326189819495",
  appId:             "1:326189819495:web:9a9418e75b4e1198c516c2"
};
// ─────────────────────────────────────────────────────────

firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.database();
const SV = firebase.database.ServerValue;
db.ref(".info/serverTimeOffset").on("value",snap=>{serverOffset=Number(snap.val())||0;});

const PCOLS = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFB347','#C39BD3','#A8E6CF','#FF8B94'];
const HOME  = { lat:48.210, lon:16.363 }; // Vienna city centre fallback
const DIFF  = {
  labels: ['','Easy','Normal','Medium','Hard','Expert'],
  mult:   [0,3,2.5,2,1.5,1.2],
  descs:  ['','Easy — 3× the ideal drive time','Normal — 2.5× the ideal drive time',
           'Medium — 2× the ideal drive time','Hard — 1.5× the ideal drive time','Expert — 1.2× the ideal drive time'],
};

/* ── STATE ───────────────────────────────────────────────── */
const S = {
  _epoch:0, _countdownTimer:null, _countdownVersion:0,
  /* setup */
  idealMin:30, diff:3, arrRadius:50, mode:'manual', transportMode:'drive', hostRole:'spectator', role:'navigator',
  elimMode:false, blindStart:false, blindFinish:true, excludeHost:true,
  gameMode:'standard', whisperMode:false, teamsMode:false, myTeam:null,
  /* identity */
  gameCode:null, isHost:false, myToken:null, myName:'You',
  hostPlayerToken:null, hostViewActive:true,
  /* rejoin */
  _rejoinCode:null, _rejoinToken:null, _rejoinName:null, _rejoinRole:null,
  /* game data from Firebase */
  targetLat:null, targetLon:null, noiseSeed:0.5,
  timeLimitSec:3600, startedAt:null, status:'idle',
  /* navigation */
  startDist:null, lastDist:null, arrived:false, arrivalElapsed:null,
  eliminated:false,
  /* blind start */
  blindStartDist:0, blindUnlocked:false, blindStartLat:null, blindStartLon:null,
  /* GPS */
  myLat:null, myLon:null, lastAccuracy:null,
  prevLat:null, prevLon:null, prevGPSTime:null,
  speedKmh:0, speedWarnShown:false, gpsWatch:null, gpsInterval:null,
  /* offline queue */
  _offlineQueue:[], _isOnline:true,
  /* maps */
  leafMap:null, leafTgtM:null, rangeRing:null, _ringLabel:null,
  hostMap:null, hostTgtM:null, hostArrCircle:null, hostDots:{}, hostTrails:{},
  specMap:null, specDots:{}, specRoutes:{}, specTgtM:null, specArrCircle:null,
  resMap:null, myTrail:[], playerTrails:{},
  _lastRoutePos:{}, _routePending:{},
  _autoZoomIv:null,
  /* Firebase */
  gameListener:null, playersListener:null,
  /* timer */
  timerIv:null, whisperIv:null, whisperNext:0,
  /* elimination */
  elimIv:null, latestPlayers:{}, nextElimTime:0,
  /* sound */
  soundEnabled:true, audioCtx:null, lastProximityBeep:0, _lastProxBand:null,
  _lastUrgentBeep:-1, _lastElimBeep:-1,
  /* wake lock */
  wakeLock:null, _noSleepVideo:null, _noSleepActive:false,
  /* map orientation */
  mapOrientMode:{host:false,spec:false}, _compassHeading:0, _orientListener:null,
  _compassTarget:null, _compassFrame:null, _compassMap:null,
  /* hot/cold */
  _hcHistory:[], _hcHapticTs:0, _pwaPrompt:null,
  /* sailor */
  _sailorHeading:0, _sailorListener:null,
  /* multi-target */
  multiTargets:[], multiCurrent:0, multiArrived:0,
  /* dynamic target */
  _dynamicMoveIv:null, _dynamicMoveCount:0,
  /* whisper */
  _whisperShowing:false, _whisperHideTimeout:null,
  /* pwa */
  _pwaPrompt:null,
  /* anti-flash */
  _lastLobbyHtml:null, _lastNWaitHtml:null,
  /* screen */
  screen:'land',
};

/* ── UTILS ───────────────────────────────────────────────── */
function hav(a,b,c,d){ return Core.distance(a,b,c,d); }
function fmtDist(m){ if(m==null||isNaN(m))return'—'; if(m>=10000)return(m/1000).toFixed(1); if(m>=1000)return(m/1000).toFixed(2); return Math.round(m)+''; }
function distUnit(m){ return(m==null||m>=1000)?'KM':'M'; }
function fmtTime(s){ s=Math.max(0,Math.floor(s||0)); return`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }
function noiseDist(dist,seed){ return Math.max(0,dist+(seed-0.5)*60); }
function randCode(){ const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>c[n%c.length]).join(''); }
function randToken(){ return crypto.randomUUID().replace(/-/g,''); }
const el  = id => document.getElementById(id);
const set = (id,v) => { const e=el(id); if(e)e.textContent=v; };
const hide = id => { const e=el(id); if(e)e.classList.add('hidden'); };
const show = id => { const e=el(id); if(e)e.classList.remove('hidden'); };
const escHtml = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function gRef(){ return db.ref(`games/${S.gameCode}`); }
function pRef(tok){ return db.ref(`games/${S.gameCode}/players/${tok||S.myToken}`); }
const sameSession=(code,epoch)=>S.gameCode===code&&S._epoch===epoch;
const playerEntries=raw=>Object.entries(raw||{}).filter(([,p])=>p&&typeof p==='object').map(([id,p])=>({...p,id}));

// Only transition a still-active room. A late GPS/timer callback cannot undo an abort.
async function finishGameIf(reason){
  if(S._finishing||!S.gameCode||!S._isOnline)return;
  S._finishing=true;const code=S.gameCode,epoch=S._epoch,ref=gRef();
  try{
    await ref.once('value');
    await ref.transaction(game=>{
      if(!sameSession(code,epoch)||game?.status!=='active')return;
      const expired=Number.isFinite(game.startedAt)&&Number.isFinite(game.timeLimitSec)&&serverNow()>=game.startedAt+game.timeLimitSec*1000;
      if(reason==='expired'?expired:Core.shouldFinish(game,playerEntries(game.players)))return {...game,status:'finished'};
    },undefined,false);
  }catch(_){if(sameSession(code,epoch))set('na-upd','Waiting to sync the end of the game…');}
  finally{if(sameSession(code,epoch))S._finishing=false;}
}

// Haptic feedback — light/medium/heavy. Silent no-op on unsupported devices.
function haptic(style='light'){
  if(!window.navigator||!window.navigator.vibrate) return;
  const patterns={light:10,medium:20,heavy:[30,10,30]};
  navigator.vibrate(patterns[style]||10);
}

function toast(msg,dur=2800){
  const t=el('toast'); t.textContent=msg; t.classList.remove('hidden');
  haptic('light');
  clearTimeout(t._tid); t._tid=setTimeout(()=>t.classList.add('hidden'),dur);
}

/* ── TIMER ───────────────────────────────────────────────── */
function currentTimeRemaining(){
  if(!S.startedAt) return S.timeLimitSec;
  return Math.min(S.timeLimitSec,Math.max(0,S.timeLimitSec-(serverNow()-S.startedAt)/1000));
}
function startClientTimer(){
  clearInterval(S.timerIv);
  const tick=()=>{
    const rem=currentTimeRemaining();
    const txt=fmtTime(rem);
    ['ha-timer','na-timer','sp-timer'].forEach(id=>{
      const e=el(id); if(e){e.textContent=txt;e.classList.toggle('urgent',rem<300);}
    });
    // Urgent timer beeps: single beep at 60s, rapid double-beep at 10s
    if(rem<=60&&rem>59.5){ playTimerWarningSound(); haptic('light'); }
    if(rem<=10&&rem>0&&Math.floor(rem)!==S._lastUrgentBeep){
      S._lastUrgentBeep=Math.floor(rem);
      playTone(880,0.05,0.12);
      setTimeout(()=>playTone(880,0.05,0.10),120);
    }
    // Elim countdown display
    if(S.elimMode&&S.nextElimTime>0){
      const toElim=Math.max(0,(S.nextElimTime-serverNow())/1000);
      const cdTxt='⚡ '+fmtTime(toElim);
      ['ha-elim-cd','sp-elim-cd'].forEach(id=>{
        const e=el(id);if(e){e.textContent=cdTxt;e.classList.toggle('hidden',toElim<=0);}
      });
      // Warning beep 30s before elimination
      if(toElim<=30&&toElim>29.5) playTone(330,0.08,0.12,'triangle');
      // Final warning: pulse at 10s
      if(toElim<=10&&toElim>0&&Math.floor(toElim)!==S._lastElimBeep){
        S._lastElimBeep=Math.floor(toElim);
        playTone(220,0.06,0.10,'triangle');
      }
    }
    if(rem<=0){
      if(S.status==='active')finishGameIf('expired');else clearInterval(S.timerIv);
    }
  };S.timerIv=setInterval(tick,500);tick();
}

/* ── NAVIGATION ──────────────────────────────────────────── */
const PEER_SCREENS=new Set(['hactive','spectator','nactive']);
function goScreen(id){
  const fromId=S.screen;
  if(id!==fromId){stopMapOrientation();stopReplay();}
  const dissolve=PEER_SCREENS.has(id)&&PEER_SCREENS.has(fromId);
  document.querySelectorAll('.sc').forEach(s=>{
    s.classList.remove('active'); s.inert=true; s.setAttribute('aria-hidden','true');
    if(dissolve) s.classList.add('dissolve'); else s.classList.remove('dissolve');
  });
  const sc=el('sc-'+id);
  if(sc){
    sc.inert=false;sc.removeAttribute('aria-hidden');
    if(dissolve) sc.classList.add('dissolve'); else sc.classList.remove('dissolve');
    requestAnimationFrame(()=>{if(S.screen===id)sc.classList.add('active');});
  }
  S.screen=id;
  if(id==='hactive'||id==='spectator'){
    const navs=playerEntries(S.latestPlayers).filter(p=>p.role==='navigator'&&!p.eliminated&&!p.withdrawn);
    const prefix=id==='hactive'?'ha':'sp';set(prefix+'-nbadge',navs.length);renderNavCards(prefix+'-cards',navs);
  }
  if(id==='results'){
    cancelCountdown();['ov-arrive','ov-eliminated','ov-speed','as-abort'].forEach(hide);
    stopGPS();stopWakeLock();stopAutoZoom();
    if(S.status!=='active'){clearInterval(S.timerIv);clearInterval(S.elimIv);stopDynamicTarget();}
  }
  if(id==='setup'){setGameMode(S.gameMode);setMode(S.mode);setTransportMode(S.transportMode);setDiff(S.diff);setRadius(S.arrRadius);setBlindStart(S.blindStart);setBlindFinish(S.blindFinish);setExcludeHost(S.excludeHost);setTeamsMode(S.teamsMode);upSetup();updateGoMapBtn();}
  requestAnimationFrame(()=>{if(S.screen!==id)return;const heading=sc?.querySelector('h1,.top-title');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}});
  const epoch=S._epoch,init={map:initLeafMap,hactive:initHostMap,spectator:initSpecMap,results:initResMap}[id];
  if(init)setTimeout(()=>{if(S._epoch===epoch&&S.screen===id)init();},80);
  if(id==='spectator')updateSpecLeaveBtn();
}
function toggleTheme(){
  const html=document.documentElement;
  const dark=html.getAttribute('data-theme')==='dark';
  html.setAttribute('data-theme',dark?'light':'dark');
  set('theme-label',dark?'Dark mode':'Light mode');storage.setItem('ll_theme',dark?'light':'dark');
  [S.leafMap,S.hostMap,S.specMap,S.resMap].forEach(m=>{
    if(!m)return; m.eachLayer(l=>{if(l._url)m.removeLayer(l);}); addTiles(m);
  });
}
window.toggleTheme=toggleTheme;

/* ── STATE RESET ─────────────────────────────────────────── */
function resetGameState(){
  S._presence?.cancel().catch(()=>{});S._presence=null;S._eliminating=false;S._dynamicPicking=false;
  cancelCountdown();stopMapOrientation();stopReplay();stopDynamicTarget();S._finishing=false;
  clearInterval(S.timerIv); stopGPS();
  if(S.whisperIv){clearInterval(S.whisperIv);S.whisperIv=null;}
  if(S.gameCode){ try{gRef().off();db.ref(`games/${S.gameCode}/specRequests`).off();if(S.myToken)pRef().off();}catch(_){} }
  if(S.playersListener&&S.gameCode){ try{db.ref(`games/${S.gameCode}/players`).off();}catch(_){} }
  [S.leafMap,S.hostMap,S.specMap,S.resMap].forEach(m=>{try{if(m)m.remove();}catch(_){}});
  S.leafMap=null;S.leafTgtM=null;S.rangeRing=null;S._ringLabel=null;
  S.hostMap=null;S.hostTgtM=null;S.hostArrCircle=null;S.hostDots={};S.hostTrails={};
  S.specMap=null;S.specDots={};S.specRoutes={};S.specTgtM=null;S.specArrCircle=null;
  S.resMap=null;S.myTrail=[];S.playerTrails={};S._lastRoutePos={};S._routePending={};
  S.gameCode=null;S.isHost=false;S.myToken=null;S.hostPlayerToken=null;S.hostViewActive=true;
  S.targetLat=null;S.targetLon=null;S.noiseSeed=0.5;
  S.timeLimitSec=3600;S.startedAt=null;S.status='idle';
  S.startDist=null;S.lastDist=null;S.arrived=false;S.arrivalElapsed=null;
  S.eliminated=false;S.blindStartDist=0;S.blindUnlocked=false;S.blindStartLat=null;S.blindStartLon=null;
  S.speedKmh=0;S.speedWarnShown=false;
  S.gameListener=null;S.playersListener=null;S.timerIv=null;
  if(S.elimIv){clearInterval(S.elimIv);S.elimIv=null;}
  S.latestPlayers={};S.lastProximityBeep=0;
  S._hcHistory=[];S._hcHapticTs=0;S._sailorHeading=0;
  S.multiTargets=[];S.multiCurrent=0;S.multiArrived=0;
  S._dynamicMoveIv=null;S._dynamicMoveCount=0;
  S._whisperShowing=false;clearTimeout(S._whisperHideTimeout);S._whisperHideTimeout=null;
  S._lastLobbyHtml=null;S._lastNWaitHtml=null;
  S.lastAccuracy=null;S.prevLat=null;S.prevLon=null;S.prevGPSTime=null;S._lastFix=0;S._lastPositionTimestamp=0;S._lastSent=0;S._lastTrailSent=0;S._writePending=false;S._arrivalPending=false;S._statsSaved=false;S._specListening=false;S._offlineQueue=[];S._epoch=(S._epoch||0)+1;
  setRole('navigator');S.myTeam=null;hide('team-pick-field');hide('route-stats');
  ['ov-arrive','ov-eliminated','ov-speed','ov-cd','as-abort','qr-sheet','rejoin-bar'].forEach(hide);
  set('na-dist','—');set('na-unit','');set('na-eyebrow','');
  stopWakeLock();
  stopMapOrientation();
  S.mapOrientMode={host:false,spec:false};S._lastUrgentBeep=-1;S._lastElimBeep=-1;S.nextElimTime=0;
}
function goHome(){ if(S.gameCode&&S.myToken)pRef().transaction(me=>me?{...me,online:false,withdrawn:!me.arrived}:undefined,undefined,false).catch(()=>{});stopAutoZoom(); stopDynamicTarget(); clearSession(); resetGameState(); goScreen('land'); renderStats(); }

/* ── SETUP ───────────────────────────────────────────────── */
function transportMeta(){
  return S.transportMode==='walk'
    ? {key:'walk', icon:'🚶', timeLabel:'Walking time', noun:'walking time', ring:'walk', speedKmh:5, smart:'walkable path'}
    : {key:'drive', icon:'🚗', timeLabel:'Drive time', noun:'drive time', ring:'drive', speedKmh:40, smart:'road'};
}
function diffDesc(d){
  const m=DIFF.mult[d];
  return `${DIFF.labels[d]} — ${m}× the ideal ${transportMeta().noun}`;
}
function setTransportMode(m){
  S.transportMode=(m==='walk')?'walk':'drive';
  document.querySelectorAll('#seg-travel .seg').forEach(b=>b.classList.toggle('active',b.dataset.v===S.transportMode));
  S.speedWarnShown=false;
  hide('ov-speed');
  upSetup();
  setMode(S.mode);
  updateRangeRing();
}
function upSetup(){
  const t=+(el('sl-time')?el('sl-time').value:'30'); S.idealMin=t;
  const pct=((t-10)/80*100).toFixed(1);
  const sl=el('sl-time'); if(sl)sl.style.setProperty('--pct',pct+'%');
  set('sv-time-label',transportMeta().timeLabel);
  set('sv-time',t+' min'); set('sv-limit',Math.round(t*DIFF.mult[S.diff])+' min');
  set('diff-txt',diffDesc(S.diff));
  updateRangeRing();
}
function setDiff(d){
  S.diff=d;
  document.querySelectorAll('#stars .star').forEach(s=>s.classList.toggle('on',+s.dataset.v<=d));
  set('diff-txt',diffDesc(d)); upSetup();
}
function setMode(m){
  S.mode=m;
  document.querySelectorAll('#seg-mode .seg').forEach(b=>b.classList.toggle('active',b.dataset.v===m));
  set('mode-hint',m==='manual'
    ?"You'll tap the map to drop the secret target. A range ring shows the ideal distance."
    :`A target will be auto-placed on a real ${transportMeta().smart} at a realistic ${transportMeta().noun}.`);
  updateGoMapBtn();
}
function setHostRole(r){
  S.hostRole=r; // kept for backward compat but UI removed
  setMode(S.mode); updateGoMapBtn();
}
function setRadius(r){
  S.arrRadius=r;
  document.querySelectorAll('#seg-radius .mseg').forEach(b=>b.classList.toggle('active',+b.dataset.v===r));
}
function setRole(r){
  S.role=r;
  document.querySelectorAll('#seg-role .seg').forEach(b=>b.classList.toggle('active',b.dataset.v===r));
}
function setElimMode(on){
  S.elimMode=!!on;
  if(on&&S.gameMode==='standard') setGameMode('elimination');
  else if(!on&&S.gameMode==='elimination') setGameMode('standard');
}
function setBlindStart(on){
  if(on&&['hotcold','sailor','whisper'].includes(S.gameMode)){toast('Blind start is available in distance-based modes.');on=false;}
  S.blindStart=!!on;
  const sw=el('sw-blind');if(sw)sw.checked=!!on;
}
function setBlindFinish(on){
  S.blindFinish=!!on;
  const sw=el('sw-blindfinish');if(sw)sw.checked=!!on;
}
function setExcludeHost(on){
  S.excludeHost=!!on;
  const sw=el('sw-excludehost');if(sw)sw.checked=!!on;
}
function updateGoMapBtn(){
  const btn=el('btn-go-map'); if(!btn)return;
  btn.textContent=S.mode==='smart'?'Find Smart Target →':'Place Target on Map →';
}

/* ── MAP TILES ───────────────────────────────────────────── */
function tileUrl(){
  return 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
}
function addTiles(map){ map.attributionControl?.remove(); L.tileLayer(tileUrl(),{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map); }
function pinIcon(col,sz=20){
  return L.divIcon({html:`<div style="width:${sz}px;height:${sz}px;background:${col};border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>`,iconSize:[sz,sz],iconAnchor:[sz/2,sz],className:''});
}
function dotIcon(col,sz=12,glow=false){
  return L.divIcon({html:`<div style="width:${sz}px;height:${sz}px;background:${col};border-radius:50%;border:2px solid white;${glow?`box-shadow:0 0 10px ${col}`:'box-shadow:0 1px 4px rgba(0,0,0,.3)'}"></div>`,iconSize:[sz,sz],iconAnchor:[sz/2,sz/2],className:''});
}

/* ── RANGE RING ──────────────────────────────────────────── */
function idealRangeM(){ return(S.idealMin/60)*transportMeta().speedKmh*1000; }
function updateRangeRing(){
  if(!S.leafMap)return;
  const center=[S.myLat??HOME.lat,S.myLon??HOME.lon],r=idealRangeM();
  if(S.rangeRing)S.leafMap.removeLayer(S.rangeRing);
  S.rangeRing=L.circle(center,{radius:r,color:'#007AFF',weight:1.5,dashArray:'8 6',fillColor:'#007AFF',fillOpacity:.04,interactive:false}).addTo(S.leafMap);
  const labelLat=center[0]+(r/111000);
  if(S._ringLabel)S.leafMap.removeLayer(S._ringLabel);
  S._ringLabel=L.marker([labelLat,center[1]],{icon:L.divIcon({html:`<div class="ring-lbl">~${S.idealMin} min ${transportMeta().ring}</div>`,iconSize:[120,20],iconAnchor:[60,10],className:''}),interactive:false}).addTo(S.leafMap);
}

/* ── LEAF MAP ────────────────────────────────────────────── */
function initLeafMap(){
  if(S.leafMap){S.leafMap.invalidateSize();updateRangeRing();return;}
  const center=[S.myLat??HOME.lat,S.myLon??HOME.lon],zoom=12;
  S.leafMap=L.map('leafmap',{center,zoom});
  addTiles(S.leafMap);
  if(S.myLat!=null) L.marker([S.myLat,S.myLon],{icon:dotIcon('#007AFF',11)}).bindPopup('<b>Your position</b>').addTo(S.leafMap);
  S.leafMap.on('click',e=>placeTarget(e.latlng.lat,e.latlng.lng));
  updateRangeRing();
  if(S.targetLat!=null)placeTarget(S.targetLat,S.targetLon);
}

function placeTarget(lat,lon){
  if(!S.leafMap)return;
  S.targetLat=lat;S.targetLon=lon;
  if(S.leafTgtM)S.leafMap.removeLayer(S.leafTgtM);
  S.leafTgtM=L.marker([lat,lon],{icon:pinIcon('#007AFF',22)}).bindPopup('<b>🎯 Target</b>').addTo(S.leafMap);
  S.leafMap.flyTo([lat,lon],13,{duration:.7,animate:!window.matchMedia('(prefers-reduced-motion: reduce)').matches});
  const myLat=S.myLat??HOME.lat,myLon=S.myLon??HOME.lon;
  const dKm=hav(myLat,myLon,lat,lon)/1000,idealKm=idealRangeM()/1000,pct=Math.round(dKm/idealKm*100);
  const pill=el('map-hint');
  if(pct>140){pill.textContent=`⚠ ${dKm.toFixed(1)} km — ${pct}% of ideal.`;pill.style.cssText='background:rgba(255,59,48,.15);border-color:rgba(255,59,48,.4);color:var(--red)';}
  else if(pct<50){pill.textContent=`⚠ ${dKm.toFixed(1)} km — too close (${pct}%).`;pill.style.cssText='background:rgba(255,159,10,.15);border-color:rgba(255,159,10,.4);color:var(--orange)';}
  else{pill.textContent=`Target set · ${dKm.toFixed(1)} km · ${pct}% of ideal`;pill.style.cssText='';}
  set('map-info',`${lat.toFixed(5)}, ${lon.toFixed(5)}`);
  el('btn-confirm').disabled=false;
}

/* ── SMART TARGET FINDER ─────────────────────────────────── */
async function findSmartTarget(myLat,myLon,idealKm){
  const walk=S.transportMode==='walk';
  const types=walk?'footway|path|pedestrian|living_street|residential|unclassified|tertiary|service':'living_street|residential|unclassified|tertiary|service';
  for(let attempt=0;attempt<3;attempt++){
    const centre=Core.destination(myLat,myLon,idealKm*1000,Math.random()*360);
    const radius=Math.max(150,Math.min(2000,idealKm*600));
    const q='[out:json][timeout:8];way[highway~"^('+types+')$"][access!~"^(private|no|customers|permit|military|restricted|destination|delivery)$"]["'+(walk?'foot':'motor_vehicle')+'"!~"^(no|private)$"](around:'+radius+','+centre.lat+','+centre.lon+');out geom 60;';
    const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),9000);
    try{
      const res=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(q),signal:ctrl.signal});
      if(!res.ok)continue;
      const data=await res.json();const candidates=[];
      for(const way of data.elements||[]){
        if(way.tags?.barrier||way.tags?.motorcar==='no'||way.tags?.motorcar==='private')continue;
        for(const point of way.geometry||[]){const d=hav(myLat,myLon,point.lat,point.lon);if(d>=idealKm*820&&d<=idealKm*1120)candidates.push(point);}
      }
      if(candidates.length)return candidates[Math.floor(Math.random()*candidates.length)];
    }catch(_){}finally{clearTimeout(timer);}
  }
  throw new Error('No suitable public route found. Choose a target on the map or try a shorter distance.');
}

async function smartPick(){
  const btn=el('smart-btn');btn.textContent='Finding…';btn.disabled=true;
  const epoch=S._epoch,code=S.gameCode;
  set('map-hint','Finding a public route near your chosen distance…');
  try{const picked=await findSmartTarget(S.myLat??HOME.lat,S.myLon??HOME.lon,idealRangeM()/1000);if(code===S.gameCode&&epoch===S._epoch)placeTarget(picked.lat,picked.lon);}
  catch(e){toast(e.message,6000);set('map-hint','Tap a publicly accessible place on the map');}
  finally{btn.textContent='✦ Smart';btn.disabled=false;}
}

/* ── CREATE GAME (Firebase) ──────────────────────────────── */
async function createGameFB(){
  if(!S._isOnline)throw new Error('You’re offline. Reconnect before creating a game.');
  const epoch=S._epoch;
  S.timeLimitSec=Math.round(S.idealMin*DIFF.mult[S.diff]*60);
  if(S.gameCode&&S.isHost&&S.status==='lobby'){
    const settings=gameSettings();await gRef().transaction(game=>game?.status==='lobby'&&S._epoch===epoch?{...game,...settings}:undefined,undefined,false);return;
  }
  const token=randToken(),name=S.myName;S.noiseSeed=Math.random();
  const settings=gameSettings();
  for(let attempt=0;attempt<5;attempt++){
    const code=randCode(),ref=db.ref('games/'+code);
    const result=await ref.transaction(current=>current===null&&S._epoch===epoch?{...settings,status:'lobby',hostToken:token,createdAt:SV.TIMESTAMP,players:{[token]:{name,role:'spectator',specApproved:true,arrived:false,eliminated:false,joinedAt:SV.TIMESTAMP}}}:undefined,undefined,false);
    if(S._epoch!==epoch){if(result.committed)await ref.transaction(g=>g?.hostToken===token&&g.status==='lobby'?{...g,status:'aborted'}:undefined);return;}
    if(result.committed){S.myToken=token;S.hostPlayerToken=token;S.gameCode=code;S.isHost=true;S.status='lobby';S.role='spectator';saveSession();await registerPresence();return;}
  }
  throw new Error('Could not reserve a game code. Try again.');
}

function gameSettings(){return {idealMin:S.idealMin,diff:S.diff,arrRadius:S.arrRadius,transportMode:S.transportMode,timeLimitSec:S.timeLimitSec,noiseSeed:S.noiseSeed,hostRole:'spectator',elimMode:S.elimMode,blindStart:S.blindStart,blindFinish:S.blindFinish,excludeHost:S.excludeHost,gameMode:S.gameMode,whisperMode:S.whisperMode,teamsMode:S.teamsMode};}

async function goMap(){
  const epoch=S._epoch;
  S.myName=(el('host-name').value.trim()||storage.getItem('ll_nickname')||'Host').slice(0,20);storage.setItem('ll_nickname',S.myName);
  const btn=el('btn-go-map');btn.disabled=true;btn.textContent='Preparing…';
  try{
    if(S.myLat==null&&navigator.geolocation)await new Promise(resolve=>navigator.geolocation.getCurrentPosition(p=>{if(S._epoch===epoch){S.myLat=p.coords.latitude;S.myLon=p.coords.longitude;}resolve();},()=>resolve(),{timeout:6000,maximumAge:30000}));
    if(S._epoch!==epoch)return;
    await createGameFB();if(S._epoch!==epoch)return;goScreen('map');
    if(S.myLat==null)toast('Location unavailable. The map starts in Vienna; pan to your area.',6000);
    if(S.mode==='smart')await smartPick();
  }catch(e){toast('Could not create game: '+e.message,6000);}
  finally{btn.disabled=false;updateGoMapBtn();}
}

async function confirmTarget(){
  if(S.targetLat==null){toast('Place a target first');return;}
  const btn=el('btn-confirm');btn.disabled=true;btn.textContent='Saving…';
  const code=S.gameCode;
  try{
    let targets=null;
    if(S.gameMode==='multi'){
      targets=[{lat:S.targetLat,lon:S.targetLon}];
      const baseKm=Math.max(.2,hav(S.myLat??HOME.lat,S.myLon??HOME.lon,S.targetLat,S.targetLon)/1000);
      for(let i=1;i<3;i++){btn.textContent='Finding target '+(i+1)+' / 3…';targets.push(await findSmartTarget(targets[i-1].lat,targets[i-1].lon,baseKm*.6));}
    }
    if(code!==S.gameCode)return;
    await gRef().update({targetLat:S.targetLat,targetLon:S.targetLon,multiTargets:targets});
    S.multiTargets=targets||[];S.multiCurrent=0;goScreen('hlobby');renderHLobby();
  }catch(e){toast(e.message,6000);}
  finally{btn.disabled=false;btn.textContent='Confirm target →';}
}

/* ── HOST LOBBY ──────────────────────────────────────────── */
function renderHLobby(){
  const code=S.gameCode||'——';
  const codeEl=el('hl-code');
  if(codeEl&&code.length===6){
    codeEl.innerHTML=`${code.slice(0,3)}<span class="code-sep">·</span>${code.slice(3)}`;
  } else if(codeEl){ codeEl.textContent=code; }
  set('hl-tlim',fmtTime(S.timeLimitSec));
  set('hl-diff',DIFF.labels[S.diff]);
  set('hl-radius',S.arrRadius+'m');
  const modeLabels={standard:'Standard',elimination:'Elimination',whisper:'Whisper',hotcold:'Hot & Cold',sailor:'Sailor',multi:'Multi-Target',dynamic:'Dynamic'};
  set('hl-mode',(S.transportMode==='walk'?'Walking · ':'Driving · ')+(modeLabels[S.gameMode]||S.gameMode));
  set('hl-blind',S.blindStart?'🙈 On':'Off');
  set('hl-blindfinish',S.blindFinish?'🏁 On':'Off');
  set('hl-excludehost',S.excludeHost?'👻 On':'Off');
  startPlayersListener();
  startSpecRequestsListener();
}

function copyLink(){
  const url=`${location.origin}${location.pathname}?join=${S.gameCode}`;
  if(navigator.clipboard)navigator.clipboard.writeText(url).then(()=>toast('Link copied!')).catch(()=>prompt('Copy link:',url));
  else prompt('Copy link:',url);
}

async function lockStart(){
  if(!S._isOnline){toast('Reconnect before starting the game.');return;}
  if(S.targetLat==null){toast('Set a target first');return;}
  const racers=Object.values(S.latestPlayers).filter(p=>p.role==='navigator'&&!p.withdrawn);
  if(!racers.length){toast('Invite at least one navigator to start.');return;}
  if(S.elimMode&&racers.length<2){toast('Elimination needs at least two navigators.');return;}
  if(S.teamsMode&&!['red','blue'].every(team=>racers.some(p=>p.team===team))){toast('Both teams need a navigator.');return;}
  const btn=el('btn-lock');if(btn.disabled)return;btn.disabled=true;btn.textContent='Starting…';
  const code=S.gameCode,epoch=S._epoch,ref=gRef();
  try{
    await ref.once('value');
    const result=await ref.transaction(game=>{
      if(!sameSession(code,epoch)||game?.status!=='lobby'||game.hostToken!==S.myToken)return;
      const racers=playerEntries(game.players).filter(p=>p.role==='navigator'&&!p.withdrawn&&!(game.excludeHost&&p.id===game.hostToken));
      if(!Core.validPoint(game.targetLat,game.targetLon)||!racers.length||(game.gameMode==='elimination'&&racers.length<2)||(game.teamsMode&&!['red','blue'].every(team=>racers.some(p=>p.team===team))))return;
      return {...game,status:'active',startedAt:serverNow()+3500};
    },undefined,false);
    if(!sameSession(code,epoch))return;
    if(!result.committed){toast('The lobby changed. Check the players and try again.');return;}
    applyGame(result.snapshot.val());S.status='active';saveSession();
    showCountdown(()=>{launchHostActive();if(S.gameMode==='dynamic')startDynamicTarget();});
  }catch(e){toast('Could not start: '+e.message);}
  finally{btn.disabled=false;btn.textContent='Start game →';}
}

/* ── FIREBASE LISTENERS ──────────────────────────────────── */
function startPlayersListener(){
  if(S.playersListener) return; // already running
  S.playersListener=true;S.gameListener=true;const listeningCode=S.gameCode;
  db.ref(`games/${S.gameCode}/players`).on('value',snap=>{
    if(S.gameCode!==listeningCode)return;
    const raw=snap.val()||{};
    const players=playerEntries(raw);
    S.latestPlayers=raw;
    players.forEach(p=>{if(Array.isArray(p.trail))S.playerTrails[p.id]=p.trail;});
    if(S.myToken&&!S.isHost&&S.role==='spectator'&&!raw[S.myToken]){toast('The host declined your spectator request.');goHome();return;}
    if(S.isHost&&S.status==='active'){if(Core.shouldFinish({...S,hostToken:S.hostPlayerToken},players))finishGameIf('arrival');else if(S.elimMode)runElimCheck();}
    if(S.role==='spectator'&&!S.isHost&&S.screen==='nwait'&&S.status==='active'&&raw[S.myToken]?.specApproved){goScreen('spectator');startClientTimer();} // cache for elimination check
    const navs=players.filter(p=>p.role==='navigator'&&!p.eliminated&&!p.withdrawn);
    const allNavs=players.filter(p=>p.role==='navigator'&&!p.withdrawn);
    // Show how many navigators are still racing (not arrived, not eliminated)
    const stillRacing=navs.filter(p=>!p.arrived).length;
    set('na-pcount', allNavs.length ? String(allNavs.length) : '—');
    set('ha-pcount', allNavs.length ? String(allNavs.length) : '—');
    set('sp-pcount', allNavs.length ? String(allNavs.length) : '—');
    // Lobby — show everyone including spectators
    if(S.screen==='hlobby'){
      const newHtml=players.length
        ? players.map((p,i)=>`<div class="player-row"><div class="p-dot" style="background:${PCOLS[i%PCOLS.length]}">${escHtml((p.name||'?')[0].toUpperCase())}</div><span class="p-name">${escHtml(p.name)}</span><span class="p-role-tag">${p.role==='spectator'?'👁 Spectator':'🧭 Navigator'}</span></div>`).join('')
        : '<div class="empty-state">Waiting for players…</div>';
      if(newHtml!==S._lastLobbyHtml){const l=el('hl-players');if(l){l.innerHTML=newHtml;S._lastLobbyHtml=newHtml;}}
      set('hl-badge',players.length+' joined');
    }
    // Check if this navigator was eliminated
    if(S.myToken&&!S.eliminated&&S.status==='active'&&S.screen==='nactive'){
      const me=raw[S.myToken];
      if(me&&me.eliminated){
        S.eliminated=true;
        stopGPS();
        playElimSound();
        haptic('heavy');
        const remaining=navs.filter(p=>p.id!==S.myToken).length;
        set('elim-rank',remaining>0?remaining+' player'+(remaining>1?'s':'')+' still in':'Last one out');
        el('ov-eliminated').classList.remove('hidden');
      }
    }
    // Nav wait
    if(S.screen==='nwait'){
      const newHtml=`<div class="player-row"><div class="p-dot" style="background:#007AFF">${escHtml((S.myName||'?')[0].toUpperCase())}</div><span class="p-name">${escHtml(S.myName)} <span style="color:var(--t3)">(you)</span></span></div>${players.length>1?`<div class="nw-others">+${players.length-1} other${players.length>2?'s':''}</div>`:''}`;
      if(newHtml!==S._lastNWaitHtml){const l=el('nw-players');if(l){l.innerHTML=newHtml;S._lastNWaitHtml=newHtml;}}
    }
    // Host active — show active navigators only
    if(S.screen==='hactive'||S.hostViewActive===false&&S.isHost){
      set('ha-nbadge',navs.length);
      renderNavCards('ha-cards',navs);
      updateHostMapDots(allNavs); // show everyone on map including eliminated (greyed)
    }
    // Spectator
    if(S.screen==='spectator'){
      set('sp-nbadge',navs.length);
      renderNavCards('sp-cards',navs);
      if(S.specMap&&S.targetLat!=null) updateSpecMap({players:allNavs,target_lat:S.targetLat,target_lon:S.targetLon,arr_radius:S.arrRadius});
    }
  });
  // Game state listener
  gRef().on('value',snap=>{
    if(!snap.exists())return;
    const g=snap.val();
    if(S.gameCode!==listeningCode)return;
    if(g.multiTargets)S.multiTargets=g.multiTargets;
    S.hostPlayerToken=g.hostToken||S.hostPlayerToken;
    S._dynamicMoveCount=g.dynamicMoveCount||0;
    const target=Core.targetFor(g,{multiCurrent:S.multiCurrent});
    if(Core.validPoint(target.lat,target.lon)){
      S.targetLat=target.lat;S.targetLon=target.lon;
      if(S.hostTgtM)S.hostTgtM.setLatLng([target.lat,target.lon]);
      if(S.hostArrCircle)S.hostArrCircle.setLatLng([target.lat,target.lon]);
      if(S.specTgtM)S.specTgtM.setLatLng([target.lat,target.lon]);
      if(S.specArrCircle)S.specArrCircle.setLatLng([target.lat,target.lon]);
    }
    if(g.status==='active'&&S.status!=='active'){
      S.status='active';applyGame(g);
      if(S.screen==='nwait'){
        showCountdown(()=>{
          if(S.role==='spectator'){if(S.latestPlayers[S.myToken]?.specApproved){goScreen('spectator');startClientTimer();}else set('nw-title','Waiting for host approval');}
          else{goScreen('nactive');startGPS();startClientTimer();}
        });
      }
    }
    if(['finished','aborted'].includes(g.status)&&S.status!==g.status){
      S.status=g.status;cancelCountdown();
      if(S.role==='spectator'&&!S.isHost&&!S.eliminated&&!g.players?.[S.myToken]?.specApproved){goHome();toast('This game has ended.');return;}
      fillResults(playerEntries(g.players));goScreen('results');
      if(g.status==='aborted'&&!S.isHost)toast('Host ended the game',2000);
    }
  });
}

/* ── HOST ACTIVE ─────────────────────────────────────────── */
function launchHostActive(){
  S.hostViewActive=true;
  S._lastUrgentBeep=-1;S._lastElimBeep=-1;
  goScreen('hactive');
  set('ha-code-badge',S.gameCode||'—');
  startClientTimer();
  startSpecRequestsListener();
  const btn=el('btn-role-toggle');
  if(btn)btn.classList.remove('hidden');
  if(S.elimMode&&S.isHost){
    if(S.elimIv)clearInterval(S.elimIv);
    S.nextElimTime=S.startedAt+(Math.floor((serverNow()-S.startedAt)/300000)+1)*300000;
    S.elimIv=setInterval(()=>{runElimCheck().catch(()=>{});S.nextElimTime=S.startedAt+(Math.floor((serverNow()-S.startedAt)/300000)+1)*300000;},5000);
  }
  startWakeLock();
  startAutoZoom();
}

async function toggleMyView(){
  const btn=el('btn-role-toggle');
  const backBtn=el('btn-host-back');
  if(S.hostViewActive){
    try{await pRef().update({role:'navigator'});S.role='navigator';saveSession();}catch(_){toast('Could not switch views. Please reconnect.');return;}
    S.hostViewActive=false;
    goScreen('nactive');
    if(backBtn)backBtn.style.display='';
    if(btn)btn.title='Switch to host view';
    startGPS();
  } else {
    goHostView();
    stopGPS();
  }
}

function goHostView(){
  stopGPS();
  S.hostViewActive=true;
  goScreen('hactive');setTimeout(initHostMap,80);
  set('ha-code-badge',S.gameCode||'—');
  const backBtn=el('btn-host-back');if(backBtn)backBtn.style.display='none';
  const lb=el('spec-leave-btn');if(lb)lb.textContent=S.isHost?'← Host':'Leave';
  const btn=el('btn-role-toggle');
  if(btn)btn.title='Switch to navigator view';
}

function leaveOrHostView(){
  if(S.isHost){ goHostView(); } else { leaveGame(); }
}

// Update spec-leave-btn label based on who is viewing
function updateSpecLeaveBtn(){
  const lb=el('spec-leave-btn');
  if(lb) lb.textContent=S.isHost?'← Host':'Leave';
}

function initHostMap(){
  if(!el('hostmap'))return;
  if(S.hostMap){setTimeout(()=>S.hostMap.invalidateSize(),50);return;}
  const c=S.targetLat!=null?[((S.myLat??HOME.lat)+S.targetLat)/2,((S.myLon??HOME.lon)+S.targetLon)/2]:[HOME.lat,HOME.lon];
  S.hostMap=L.map('hostmap',{center:S.targetLat!=null?[S.targetLat,S.targetLon]:c,zoom:14,zoomControl:false});
  addTiles(S.hostMap);
  L.control.zoom({position:'bottomright'}).addTo(S.hostMap);
  if(S.targetLat!=null){
    S.hostTgtM=L.marker([S.targetLat,S.targetLon],{icon:pinIcon('#2358e8',20)}).bindPopup('<b>Target</b>').addTo(S.hostMap);
    S.hostArrCircle=L.circle([S.targetLat,S.targetLon],{radius:S.arrRadius,color:'#007AFF',fillColor:'#007AFF',fillOpacity:.07,weight:1,dashArray:'4 4'}).addTo(S.hostMap);
  }
  setTimeout(()=>S.hostMap.invalidateSize(),120);
  updateHostMapDots(Object.entries(S.latestPlayers).map(([id,p])=>({...p,id})).filter(p=>p.role==='navigator'));
}

function renderNavCards(elId,players){
  const cards=el(elId);if(!cards||!players)return;
  // Find who is furthest (at risk of next elimination)
  let dangerIdx=-1;
  if(S.elimMode){
    let maxDist=-1;
    players.forEach((p,i)=>{
      if(p.arrived||p.eliminated||p.lat==null)return;
      const d=computeDist(p)||0;
      if(d>maxDist){maxDist=d;dangerIdx=i;}
    });
  }
  cards.innerHTML=players.map((p,i)=>{
    const arr=p.arrived,elim=p.eliminated,isDanger=(i===dangerIdx);
    const distTxt=arr?'Finished':elim?'Eliminated':p.lat!=null?(fmtDist(computeDist(p))+' '+distUnit(computeDist(p))):'Waiting for GPS';
    const cls=`nav-card${arr?' arrived':''}${elim?' elim':''}${isDanger?' danger':''}`;
    return`<div class="${cls}"><div class="nc-dot" style="background:${elim?'#8e8e93':PCOLS[i%PCOLS.length]}"></div><div><div class="nc-name">${escHtml(p.name)}${isDanger?' · at risk':''}</div><div class="nc-dist${arr?' arrived':''}">${distTxt}${S.gameMode==='multi'&&!arr?' · '+(Core.checkpointIndex(p.multiCurrent)+1)+'/3':''}${p.online===false?' · offline':''}</div></div></div>`;
  }).join('');
}

function computeDist(p){const target=Core.targetFor(S,p);return Core.validPoint(p.lat,p.lon)?hav(p.lat,p.lon,target.lat,target.lon):null;}

function updateHostMapDots(players){
  if(!S.hostMap||!players)return;
  Object.values(S.hostDots).forEach(m=>S.hostMap.removeLayer(m));S.hostDots={};
  players.forEach((p,i)=>{
    if(p.lat==null||p.lon==null)return;
    if(!S.playerTrails[p.id])S.playerTrails[p.id]=[];
    const trail=S.playerTrails[p.id],pt=[+p.lat,+p.lon];
    const last=trail[trail.length-1];
    if(!last||hav(last[0],last[1],pt[0],pt[1])>5){trail.push(pt);if(trail.length>1500)trail.splice(1,1);}
    if(trail.length>1){if(S.hostTrails[p.id])S.hostMap.removeLayer(S.hostTrails[p.id]);S.hostTrails[p.id]=L.polyline(trail,{color:PCOLS[i%PCOLS.length],weight:2,opacity:.55,dashArray:'5 4'}).addTo(S.hostMap);}
    S.hostDots[p.id]=L.marker(pt,{icon:dotIcon(PCOLS[i%PCOLS.length],13,true)}).bindTooltip(escHtml(p.name),{permanent:false,direction:'top'}).addTo(S.hostMap);
  });
}

async function abortGame(){
  el('as-abort').classList.remove('hidden');
}
async function confirmAbort(){
  const code=S.gameCode,epoch=S._epoch,ref=gRef();
  try{
    await ref.once('value');
    const result=await ref.transaction(game=>{if(sameSession(code,epoch)&&game?.status==='active')return {...game,status:'aborted'};},undefined,false);
    if(!sameSession(code,epoch))return;
    hide('as-abort');
    if(result.committed){const game=result.snapshot.val();S.status='aborted';fillResults(playerEntries(game.players));goScreen('results');}
  }catch(_){if(sameSession(code,epoch))toast('Could not end the game. Check your connection and try again.');}
}

function cancelAbort(){
  el('as-abort').classList.add('hidden');
}

/* ── ELIMINATION CHECK (host only, runs every 5 min) ─────── */
async function runElimCheck(){
  if(!S.isHost||S.status!=='active'||S._eliminating||!S._isOnline)return;
  S._eliminating=true;const code=S.gameCode,epoch=S._epoch,ref=gRef();
  try{
    await ref.once('value');
    await ref.transaction(game=>{
      if(!sameSession(code,epoch)||game?.status!=='active'||game.gameMode!=='elimination')return;
      const entrants=playerEntries(game.players).filter(p=>p.role==='navigator'&&!(game.excludeHost&&p.id===game.hostToken));
      const active=entrants.filter(p=>!p.arrived&&!p.eliminated&&!p.withdrawn);
      if(entrants.length<2)return;
      const round=Math.floor((serverNow()-game.startedAt)/300000);
      let survivors=active;
      if(active.length>1){
        if(round<1||round<=(game.eliminationRound||0))return;
        const ranked=active.map(p=>{const target=Core.targetFor(game,p);const d=hav(p.lat,p.lon,target.lat,target.lon);return {...p,distance:Number.isFinite(d)?d:Infinity};}).sort((a,b)=>b.distance-a.distance||a.id.localeCompare(b.id));
        game.players[ranked[0].id].eliminated=true;game.eliminationRound=round;survivors=ranked.slice(1);
      }
      if(survivors.length<=1){
        if(survivors[0])Object.assign(game.players[survivors[0].id],{arrived:true,arrSec:Math.max(0,Math.round((serverNow()-game.startedAt)/1000))});
        game.status='finished';
      }
      return game;
    },undefined,false);
  }catch(_){if(sameSession(code,epoch))toast('Elimination could not sync. Retrying shortly.');}
  finally{if(sameSession(code,epoch))S._eliminating=false;}
}

function watchAfterElim(){
  el('ov-eliminated').classList.add('hidden');
  // Switch to spectator view
  S.role='spectator';
  goScreen('spectator');
}

/* ── SPECTATOR APPROVAL ──────────────────────────────────── */
// When a player selects Spectator role and joins, their token is written
// under games/{code}/specRequests/{token} = {name, ts}
// The host sees approval cards and accepts/denies.
// On accept: update player role to 'spectator' approved=true
// On deny: remove the player node entirely

function renderSpecRequests(requests, containerIds){
  const html=requests.length?requests.map(r=>`
    <div class="spec-req-card" id="sr-${r.token}">
      <div class="spec-req-info">
        <div class="spec-req-name">👁 ${escHtml(r.name)}</div>
        <div class="spec-req-sub">Wants to join as spectator</div>
      </div>
      <div class="spec-req-btns">
        <button class="btn-destruct sm" onclick="haptic('light');App.denySpec('${r.token}')">Deny</button>
        <button class="btn-primary" style="font-size:12px;padding:6px 12px" onclick="haptic('medium');App.approveSpec('${r.token}')">Allow</button>
      </div>
    </div>`).join(''):'';
  containerIds.forEach(id=>{
    const c=el(id);
    if(!c)return;
    c.innerHTML=html;
    c.classList.toggle('hidden',!requests.length);
  });
}

async function approveSpec(token){
  if(!S.gameCode)return;
  await db.ref(`games/${S.gameCode}/players/${token}`).update({specApproved:true});
  await db.ref(`games/${S.gameCode}/specRequests/${token}`).remove();
  playApproveSound();haptic('medium');
}
async function denySpec(token){
  if(!S.gameCode)return;
  await db.ref(`games/${S.gameCode}/players/${token}`).remove();
  await db.ref(`games/${S.gameCode}/specRequests/${token}`).remove();
  playDenySound();haptic('light');
}

// Listen for incoming spectator requests (host only)
function startSpecRequestsListener(){
  if(!S.isHost||!S.gameCode||S._specListening)return;S._specListening=true;
  db.ref(`games/${S.gameCode}/specRequests`).on('value',snap=>{
    const raw=snap.val()||{};
    const reqs=Object.entries(raw).filter(([token])=>/^[a-zA-Z0-9_-]+$/.test(token)).map(([token,v])=>({...v,token}));
    renderSpecRequests(reqs,['spec-requests','spec-requests-active','spec-requests-spec']);
    // Badge on host bar
    const badge=el('ha-nbadge');
    if(badge&&reqs.length>0) haptic('light');
  });
}

/* ── JOIN (modified to write specRequest if spectator) ──── */
async function joinGame(){
  const epoch=S._epoch;
  if(!S._isOnline){toast('You’re offline. Reconnect before joining.');return;}
  const code=el('inp-code').value.trim().toUpperCase();const name=(el('inp-name').value.trim()||'Navigator').slice(0,20);
  if(!/^[A-Z0-9]{6}$/.test(code)){toast('Enter the six-character game code.');el('inp-code').focus();return;}
  const btn=document.querySelector('#sc-join .btn-primary');btn.disabled=true;btn.textContent='Joining…';hide('join-err');
  try{
    const snap=await db.ref('games/'+code).once('value');const g=snap.val();
    if(S._epoch!==epoch)return;
    if(!g)throw new Error('No game with that code. Check it and try again.');
    if(!['lobby','active'].includes(g.status))throw new Error('This game has ended. Ask the host for a new code.');
    S.teamsMode=!!g.teamsMode;el('team-pick-field').classList.toggle('hidden',!S.teamsMode||S.role!=='navigator');
    if(S.teamsMode&&S.role==='navigator'&&!S.myTeam){toast('Choose Red or Blue, then join.');return;}
    S.gameCode=code;S.myName=name;S.myToken=randToken();S.isHost=false;S.arrived=false;S.eliminated=false;S.multiCurrent=0;S.startDist=null;
    applyGame(g);storage.setItem('ll_nickname',name);
    await pRef().set({name,role:S.role,team:S.teamsMode?S.myTeam:null,online:true,withdrawn:false,arrived:false,eliminated:false,multiCurrent:0,speedKmh:0,specApproved:false,joinedAt:SV.TIMESTAMP,lastSeen:SV.TIMESTAMP});
    if(!sameSession(code,epoch))return;
    await registerPresence();if(!sameSession(code,epoch))return;
    if(S.role==='spectator')await db.ref('games/'+code+'/specRequests/'+S.myToken).set({name,ts:SV.TIMESTAMP});
    if(!sameSession(code,epoch))return;
    saveSession();set('nw-title',S.role==='spectator'?'Waiting for host approval':'Game '+code);set('nw-name',name);set('nw-role',S.role==='spectator'?'Spectator':'Navigator');
    goScreen('nwait');S.status='lobby';startPlayersListener();
    playJoinSound();
  }catch(e){set('join-err',e.message);show('join-err');}
  finally{btn.disabled=false;btn.textContent='Join game →';}
}
function applyGame(g){
  for(const key of ['idealMin','diff','arrRadius','timeLimitSec','noiseSeed','blindStart','blindFinish','excludeHost','teamsMode','transportMode','gameMode','startedAt','targetLat','targetLon'])if(g[key]!=null)S[key]=g[key];
  if(g.idealMin!=null)el('sl-time').value=S.idealMin;
  S.elimMode=S.gameMode==='elimination';S.whisperMode=S.gameMode==='whisper';S.hostPlayerToken=g.hostToken||null;S.multiTargets=g.multiTargets||[];
  const target=Core.targetFor(g,{multiCurrent:S.multiCurrent});S.targetLat=target.lat;S.targetLon=target.lon;
}

function leaveGame(){ goHome(); }

/* ── SPECTATOR MAP ───────────────────────────────────────── */
function initSpecMap(){
  if(!el('specmap'))return;
  if(S.specMap){setTimeout(()=>S.specMap.invalidateSize(),50);return;}
  S.specMap=L.map('specmap',{center:[HOME.lat,HOME.lon],zoom:10,zoomControl:false});
  addTiles(S.specMap);
  L.control.zoom({position:'bottomright'}).addTo(S.specMap);
  setTimeout(()=>S.specMap.invalidateSize(),100);
  updateSpecMap({players:Object.entries(S.latestPlayers).map(([id,p])=>({...p,id})).filter(p=>p.role==='navigator'),target_lat:S.targetLat,target_lon:S.targetLon,arr_radius:S.arrRadius});
}

function updateSpecMap({players,target_lat,target_lon,arr_radius}){
  if(!S.specMap||!players)return;
  if(target_lat!=null&&!S.specTgtM){
    S.specTgtM=L.marker([target_lat,target_lon],{icon:pinIcon('#007AFF',22)}).bindPopup('<b>🎯 Target</b>').addTo(S.specMap);
    S.specArrCircle=L.circle([target_lat,target_lon],{radius:arr_radius,color:'#007AFF',fillColor:'#007AFF',fillOpacity:.1,weight:1.5,dashArray:'4 4'}).addTo(S.specMap);
    S.specMap.setView([target_lat,target_lon],14);
  }
  Object.entries(S.specDots).forEach(([,m])=>S.specMap.removeLayer(m));S.specDots={};
  players.forEach((p,i)=>{
    if(p.lat==null||p.lon==null)return;
    const col=PCOLS[i%PCOLS.length],pt=[+p.lat,+p.lon];
    const dist=computeDist(p);
    S.specDots[p.id]=L.marker(pt,{icon:dotIcon(col,14,true)}).bindTooltip(`<b>${escHtml(p.name)}</b><br>${p.arrived?'🏁 Arrived':dist!=null?fmtDist(dist)+' '+distUnit(dist):'—'}`,{permanent:false,direction:'top'}).addTo(S.specMap);
    if(target_lat!=null&&!p.arrived&&S.transportMode!=='walk'){
      const lastPos=S._lastRoutePos[p.id];
      const target=Core.targetFor(S,p);const moved=!lastPos||hav(lastPos[0],lastPos[1],pt[0],pt[1])>30||lastPos[2]!==target.lat||lastPos[3]!==target.lon;
      if((moved||!S.specRoutes[p.id])&&!S._routePending[p.id]){
        S._routePending[p.id]=true;
        const target=Core.targetFor(S,p);fetchRoute(p.id,pt,target.lat,target.lon,col);
      }
    }
  });
}

async function fetchRoute(playerId,fromPt,toLat,toLon,col){
  const epoch=S._epoch;
  if(!S.specMap){S._routePending[playerId]=false;return;}
  const url=`https://router.project-osrm.org/route/v1/driving/${fromPt[1]},${fromPt[0]};${toLon},${toLat}?overview=full&geometries=geojson`;
  const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),10000);
  try{
    const res=await fetch(url,{signal:ctrl.signal});clearTimeout(timer);
    if(!res.ok)throw new Error('HTTP '+res.status);
    const data=await res.json();
    if(data.code!=='Ok'||!data.routes||!data.routes[0])throw new Error(data.code||'NoRoute');
    const latlngs=data.routes[0].geometry.coordinates.map(c=>[c[1],c[0]]);
    if(!S.specMap||epoch!==S._epoch){return;}
    if(S.specRoutes[playerId])S.specMap.removeLayer(S.specRoutes[playerId]);
    S.specRoutes[playerId]=L.polyline(latlngs,{color:col,weight:3.5,opacity:.75}).addTo(S.specMap);
    S.specRoutes[playerId].bringToBack();
    S._lastRoutePos[playerId]=[...fromPt,toLat,toLon];
  }catch(_){clearTimeout(timer);}
  finally{if(epoch===S._epoch)S._routePending[playerId]=false;}
}

/* ── GPS ─────────────────────────────────────────────────── */
function startGPS(){
  if(S.gpsWatch!=null)return;
  if(!navigator.geolocation){showGPSWarn('GPS not supported','Your browser does not support geolocation.');return;}
  if(!window.isSecureContext){showGPSWarn('HTTPS required','Open the secure version of Luftlinie to use GPS.');return;}
  S.gpsWatch=navigator.geolocation.watchPosition(handleGPSPos,handleGPSErr,{enableHighAccuracy:true,maximumAge:1000,timeout:15000});
  S.gpsInterval=setInterval(()=>{if(Date.now()-(S._lastFix||0)>20000)showGPSWarn('Waiting for a fresh location','GPS can pause when your phone locks. Keep Luftlinie open.');},10000);
  startWakeLock();if(S.whisperMode)startWhisperTimer();if(S.gameMode==='hotcold')startHotCold();if(S.gameMode==='sailor')startSailor();
}
function stopGPS(){
  if(S.gpsWatch!=null){navigator.geolocation.clearWatch(S.gpsWatch);S.gpsWatch=null;}
  if(S.gpsInterval!=null){clearInterval(S.gpsInterval);S.gpsInterval=null;}
  stopWhisperTimer();
  stopHotCold();
  stopSailor();
}

function handleGPSPos(pos){
  if(S.status!=='active'||S.arrived||S.eliminated)return;
  if(!Core.validPoint(pos.coords.latitude,pos.coords.longitude)||!Number.isFinite(pos.coords.accuracy))return;
  if(pos.timestamp&&(pos.timestamp<=(S._lastPositionTimestamp||0)||Date.now()-pos.timestamp>20000))return;
  S._lastPositionTimestamp=pos.timestamp||Date.now();S._lastFix=Date.now();
  hide('gps-warn');
  const lat=pos.coords.latitude,lon=pos.coords.longitude,acc=pos.coords.accuracy,now=Date.now();
  if(S.prevLat!=null){
    const d=hav(S.prevLat,S.prevLon,lat,lon),dt=(now-S.prevGPSTime)/1000;
    if(dt>0)S.speedKmh=Math.min(300,Number.isFinite(pos.coords.speed)&&pos.coords.speed>=0?pos.coords.speed*3.6:(d>Math.max(acc,S.lastAccuracy||0)?d/dt*3.6:0));
    const speedLimit=S.transportMode==='walk'?18:80;
    if(S.speedKmh>speedLimit&&!S.speedWarnShown){
      set('speed-warn-title',S.transportMode==='walk'?'Walking Mode':'Passenger Mode Only');
      set('speed-warn-body',S.transportMode==='walk'?'You seem to be moving faster than walking pace. Walking mode is intended for players on foot.':'Do not interact with this app while driving.');
      el('ov-speed').classList.remove('hidden');S.speedWarnShown=true;
    }
  }
  S.prevLat=lat;S.prevLon=lon;S.prevGPSTime=now;S.myLat=lat;S.myLon=lon;S.lastAccuracy=acc;
  // Blind start: record the first GPS fix as the "start" point
  if(S.blindStart&&S.blindStartLat==null&&!S.blindUnlocked){
    S.blindStartLat=lat;S.blindStartLon=lon;
  }
  const t=S.myTrail,last=t[t.length-1];
  if(acc<=Math.max(30,S.arrRadius)&&(!last||hav(last[0],last[1],lat,lon)>Math.max(5,acc/2))){t.push([lat,lon]);if(t.length>1500)t.splice(1,1);}
  // GPS pill
  const pill=el('na-gps');
  if(pill){
    if(acc>50){pill.className='na-gps lost';set('na-gps-txt','~'+Math.round(acc)+'m');}
    else{pill.className='na-gps live';set('na-gps-txt','Live');}
  }
  // Host GPS pill (always shows host's own GPS on host bar)
  const hPill=el('ha-gps');
  if(hPill){
    if(acc>50){hPill.className='na-gps lost';set('ha-gps-txt','~'+Math.round(acc)+'m');}
    else{hPill.className='na-gps live';set('ha-gps-txt','Live');}
  }
  // Spectator GPS pill
  const sPill=el('sp-gps');
  if(sPill){
    if(acc>50){sPill.className='na-gps lost';set('sp-gps-txt','~'+Math.round(acc)+'m');}
    else{sPill.className='na-gps live';set('sp-gps-txt','Live');}
  }
  // Ripple: only spawn when showing the number (not in HC/whisper modes)
  // and only when we've actually moved (not every 1s backup poll)
  const moved=!last||hav(last[0],last[1],lat,lon)>8;
  if(moved&&S.gameMode!=='hotcold'&&S.gameMode!=='sailor'&&!S.whisperMode){
    spawnRipple(acc>50?'warn':'auto');
  }
  sendPosUpdateQueued(false);
}
function handleGPSErr(err){
  spawnRipple('error');
  if(err.code===1)showGPSWarn('Location access denied','Tap the 🔒 in your browser bar → Allow Location → refresh.');
  else if(err.code===2)showGPSWarn('GPS signal lost','Move outside or near a window.');
  else set('na-upd','GPS slow — retrying…');
}
function showGPSWarn(title,body){
  show('gps-warn');set('gps-warn-title',title);set('gps-warn-body',body);
  const pill=el('na-gps');if(pill){pill.className='na-gps lost';set('na-gps-txt','Blocked');}
}

async function sendPosUpdate(manual=false){return sendPosUpdateQueued(manual);}

async function manualRefresh(){
  const btn=el('refresh-btn');btn.classList.add('spinning');btn.disabled=true;
  try{await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(p=>{handleGPSPos(p);resolve();},reject,{enableHighAccuracy:true,maximumAge:0,timeout:10000}));}
  catch(e){handleGPSErr(e);}
  finally{btn.classList.remove('spinning');btn.disabled=false;}
}

/* ── NAV DISPLAY ─────────────────────────────────────────── */
function updateNavDisplay(distM){
  if(distM==null)return;S.lastDist=distM;
  const nd=el('na-dist'),nu=el('na-unit'),nc=el('na-center');
  if(nd){
    nd.textContent=fmtDist(distM);nd.classList.remove('updating');
    void nd.offsetWidth;nd.classList.add('updating');
  }
  if(nc){
    nc.classList.remove('prox-close','prox-very-close');
    if(distM<200)nc.classList.add('prox-very-close');
    else if(distM<1000)nc.classList.add('prox-close');
  }
  if(nu) nu.textContent=distUnit(distM);
  set('na-upd','Updated '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'}));
}

function spawnRipple(type='auto'){
  const w=el('na-ripples');if(!w)return;
  const r=document.createElement('div');r.className='rip rip-'+type;
  w.appendChild(r);setTimeout(()=>r.remove(),900);
  // Just pulse opacity on the number — no color change (was causing white/blue/orange flash)
  const nd=el('na-dist');if(!nd)return;
  nd.classList.remove('updating');void nd.offsetWidth;nd.classList.add('updating');
}

/* ── ARRIVAL ─────────────────────────────────────────────── */
function triggerArrival(arrSec,startDist){
  stopGPS();
  el('ov-arrive').classList.remove('hidden');
  set('arr-time','Time: '+fmtTime(arrSec));
  const d=startDist||(S.startDist||0);
  set('arr-dist',d?(d/1000).toFixed(1)+' km straight-line':'');
}
function dismissSpeed(){el('ov-speed').classList.add('hidden');}
function showResults(){
  const code=S.gameCode,epoch=S._epoch;
  el('ov-arrive').classList.add('hidden');
  db.ref(`games/${S.gameCode}/players`).once('value').then(snap=>{
    if(!sameSession(code,epoch))return;
    const raw=snap.val()||{};
    fillResults(Object.entries(raw).map(([id,p])=>({...p,id})));
    goScreen('results');
  });
}

/* ── RESULTS ─────────────────────────────────────────────── */
/* ── RESULTS MAP ─────────────────────────────────────────── */
function initResMap(){
  if(!el('resultmap')||S.resMap){S.resMap?.invalidateSize();return;}
  const target=Core.validPoint(S.targetLat,S.targetLon)?[S.targetLat,S.targetLon]:null;
  const start=S.myTrail[0]||(Core.validPoint(S.myLat,S.myLon)?[S.myLat,S.myLon]:null);
  S.resMap=L.map('resultmap',{center:target||start||[HOME.lat,HOME.lon],zoom:14,zoomControl:false});addTiles(S.resMap);
  const points=[];
  if(target){points.push(target);L.marker(target,{icon:pinIcon('#2358e8',20)}).bindPopup('<b>Target</b>').addTo(S.resMap);}
  if(start){points.push(start);L.marker(start,{icon:dotIcon('#8e8e93',10)}).bindPopup('<b>Start</b>').addTo(S.resMap);}
  if(target&&start)L.polyline([start,target],{color:'#2358e8',weight:1.5,dashArray:'6 5',opacity:.35}).addTo(S.resMap);
  const trails=Object.entries(S.playerTrails).filter(([id])=>id!==S.myToken).map(([,trail],i)=>({trail,color:PCOLS[i%PCOLS.length]}));
  trails.push({trail:S.myTrail,color:'#16846a'});
  trails.forEach(({trail,color})=>{const valid=trail.filter(p=>Array.isArray(p)&&Core.validPoint(p[0],p[1]));if(valid.length>1){points.push(...valid);L.polyline(valid,{color,weight:2.5,opacity:.7}).addTo(S.resMap);}});
  if(points.length>1)try{S.resMap.fitBounds(points,{padding:[50,50],maxZoom:16});}catch(_){}
}

/* ── COUNTDOWN ───────────────────────────────────────────── */
function cancelCountdown(){
  clearTimeout(S._countdownTimer);S._countdownTimer=null;S._countdownVersion++;hide('ov-cd');
}
function showCountdown(cb){
  cancelCountdown();const code=S.gameCode,epoch=S._epoch,version=S._countdownVersion;let previous;
  const tick=()=>{
    if(!sameSession(code,epoch)||version!==S._countdownVersion||S.status!=='active'){cancelCountdown();return;}
    const remaining=S.startedAt-serverNow();
    if(remaining<=0){cancelCountdown();playStartSound();cb();return;}
    show('ov-cd');const n=Math.min(3,Math.ceil(remaining/1000));set('cd-num',n);
    el('cd-arc').style.strokeDashoffset=String(2*Math.PI*72*(1-Math.min(1,remaining/3500)));
    if(n!==previous){playTone(n===1?880:440,.08,.18);haptic('light');previous=n;}
    S._countdownTimer=setTimeout(tick,Math.min(100,remaining));
  };tick();
}

/* ── INIT ────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded',()=>{
  if(storage.getItem('ll_theme')==='dark'||(!storage.getItem('ll_theme')&&window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches)){
    document.documentElement.setAttribute('data-theme','dark');set('theme-label','Light mode');
  }
  var slt=el('sl-time');if(slt)slt.addEventListener('input',upSetup);upSetup();
  if(FIREBASE_CONFIG.apiKey==='YOUR_API_KEY'){
    setTimeout(()=>toast('⚠️ Fill in FIREBASE_CONFIG in the source file',6000),800);
  }

  // Nickname persistence — pre-fill both inputs if saved
  const savedName=storage.getItem('ll_nickname');
  if(savedName){
    const hn=el('host-name');if(hn&&!hn.value)hn.value=savedName;
    const jn=el('inp-name');if(jn&&!jn.value)jn.value=savedName;
  }
  renderStats();
  startOfflineDetection();
  checkBattery();
  const jc=new URLSearchParams(location.search).get('join');
  if(jc&&/^[a-zA-Z0-9]{6}$/.test(jc)){const inp=el('inp-code');if(inp)inp.value=jc.toUpperCase();if(readSession()?.code===jc.toUpperCase()){goScreen('land');checkRejoin();}else goScreen('join');return;}
  goScreen('land');
  setTimeout(checkRejoin, 800);
});

/* ── SOUND ───────────────────────────────────────────────── */
// Apple-inspired: short sine tones, clean attack/decay, no Web Audio harshness
function getAudioCtx(){
  if(!S.audioCtx) S.audioCtx=new(window.AudioContext||window.webkitAudioContext)();
  return S.audioCtx;
}
function playTone(freq,dur=0.08,vol=0.18,type='sine'){
  if(!S.soundEnabled)return;
  try{
    const ctx=getAudioCtx();
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.connect(gain);gain.connect(ctx.destination);
    osc.type=type;osc.frequency.value=freq;
    const now=ctx.currentTime;
    gain.gain.setValueAtTime(0,now);
    gain.gain.linearRampToValueAtTime(vol,now+0.01);  // fast attack
    gain.gain.exponentialRampToValueAtTime(0.001,now+dur); // natural decay
    osc.start(now);osc.stop(now+dur+0.05);
  }catch(_){}
}
function playArrivalSound(){
  // Triumphant rising arpeggio: C5-E5-G5-C6
  playTone(523,0.20,0.22);
  setTimeout(()=>playTone(659,0.20,0.22),110);
  setTimeout(()=>playTone(784,0.20,0.24),220);
  setTimeout(()=>playTone(1047,0.35,0.26),340);
}
function playElimSound(){
  // Deep descending thud
  playTone(220,0.30,0.22,'triangle');
  setTimeout(()=>playTone(150,0.40,0.18,'triangle'),180);
  setTimeout(()=>playTone(100,0.50,0.14,'triangle'),360);
}
function playJoinSound(){
  // Soft two-tone confirm
  playTone(587,0.10,0.12);
  setTimeout(()=>playTone(880,0.12,0.14),120);
}
function playLeaveSound(){
  // Descending two-tone
  playTone(440,0.10,0.10);
  setTimeout(()=>playTone(330,0.14,0.12),120);
}
function playStartSound(){
  // Game start chord: C4-E4-G4 arpeggio (already used in countdown end)
  playTone(523,0.12,0.20);
  setTimeout(()=>playTone(659,0.12,0.20),80);
  setTimeout(()=>playTone(784,0.18,0.22),160);
}
function playApproveSound(){
  playTone(784,0.08,0.14);
  setTimeout(()=>playTone(1047,0.12,0.16),100);
}
function playDenySound(){
  playTone(330,0.12,0.14,'square');
}
function playTimerWarningSound(){
  // Single clear bell at 60s
  playTone(880,0.12,0.16);
}
function playProxEnterSound(band){
  // Distinct sound per band — ascending pitches as you get closer
  const tones=[
    null,                          // band 0: >2km — silent
    ()=>playTone(440,0.06,0.08),   // band 1: 1-2km — soft A4
    ()=>playTone(523,0.07,0.10),   // band 2: 500m-1km — C5
    ()=>{ playTone(659,0.07,0.12); haptic('light'); },       // band 3: 250-500m
    ()=>{ playTone(784,0.08,0.14); haptic('light'); },       // band 4: 100-250m
    ()=>{ playTone(988,0.10,0.16); haptic('medium'); },      // band 5: <100m — hot
  ];
  if(band!==undefined&&band!==null)tones[band]();
}
function toggleSound(){
  S.soundEnabled=!S.soundEnabled;
  const ico=S.soundEnabled?'🔊':'🔇';
  ['sound-btn','sound-btn-host','sound-btn-spec'].forEach(id=>{
    const btn=el(id);
    if(btn){btn.textContent=ico;btn.classList.toggle('active',S.soundEnabled);}
  });
  if(S.soundEnabled){
    try{getAudioCtx().resume();}catch(_){}
    playTone(440,0.06,0.08);
  }
  haptic('light');
}

/* ── BLIND START ─────────────────────────────────────────── */
function updateBlindDisplay(distM){
  const nd=el('na-dist'),nu=el('na-unit'),eyebrow=el('na-eyebrow');
  if(!S.blindStart||S.blindUnlocked){
    if(eyebrow) eyebrow.textContent='';
    if(nd)nd.classList.remove('blind-num');
    updateNavDisplay(distM);
    return;
  }
  // Straight-line distance from the start GPS fix (can't game by walking in circles)
  if(S.blindStartLat!=null&&S.blindStartLon!=null){
    const fromStart=hav(S.blindStartLat,S.blindStartLon,S.myLat,S.myLon);
    if(fromStart>=300){
      S.blindUnlocked=true;
      playTone(523,0.1,0.15);setTimeout(()=>playTone(659,0.15,0.18),100);
      haptic('medium');
      toast('Distance unlocked — you\'ve moved 300m from start',2500);
      if(eyebrow) eyebrow.textContent='';
      if(nd)nd.classList.remove('blind-num');
      updateNavDisplay(distM);
      return;
    }
    const remaining=Math.max(0,Math.ceil(300-fromStart));
    if(eyebrow) eyebrow.textContent=`${Math.round(fromStart)}m from start`;
  } else {
    if(eyebrow) eyebrow.textContent='Acquiring GPS…';
  }
  if(nd){nd.textContent='—';nd.classList.add('blind-num');}
  if(nu) nu.textContent='';
}

/* ── REPLAY ──────────────────────────────────────────────── */
function stopReplay(){S._replayVersion=(S._replayVersion||0)+1;clearTimeout(S._replayTimer);const btn=el('replay-btn');if(btn){btn.disabled=false;btn.textContent='▶ Replay Routes';}}
function playReplay(){
  const btn=el('replay-btn');
  if(!S.resMap||(!S.myTrail.length&&!Object.values(S.playerTrails).some(t=>t.length>1))){toast('No route data to replay');return;}
  btn.disabled=true;btn.textContent='Playing…';
  stopReplay();btn.disabled=true;btn.textContent='Playing…';const epoch=S._epoch,version=S._replayVersion;
  const allTrails=[];
  if(S.myTrail.length>1) allTrails.push({trail:S.myTrail,color:'#34C759'});
  Object.entries(S.playerTrails).forEach(([id,trail],i)=>{
    if(id!==S.myToken&&trail.length>1) allTrails.push({trail,color:PCOLS[i%PCOLS.length]});
  });
  if(!allTrails.length){btn.disabled=false;btn.textContent='▶ Replay Routes';return;}
  // Remove old replay layers
  if(S._replayLayers){S._replayLayers.forEach(l=>{try{S.resMap.removeLayer(l);}catch(_){}});}
  S._replayLayers=[];
  // Animate each trail
  allTrails.forEach(({trail,color})=>{
    const pts=[...trail];
    const line=L.polyline([],{color,weight:3,opacity:.85}).addTo(S.resMap);
    S._replayLayers.push(line);
    let i=0;
    const step=()=>{
      if(i>=pts.length||epoch!==S._epoch||version!==S._replayVersion||S.screen!=='results'){return;}
      line.addLatLng(pts[i]);i++;
      setTimeout(step,30); // ~30fps playback
    };
    step();
  });
  S._replayTimer=setTimeout(()=>{if(version===S._replayVersion){btn.disabled=false;btn.textContent='▶ Replay Routes';}},Math.max(...allTrails.map(t=>t.trail.length))*30+100);
}

/* ── WAKE LOCK ───────────────────────────────────────────── */
// Screen Wake Lock API for Android Chrome + Safari 16.4+
// For older iOS Chrome: hidden autoplay video trick
async function startWakeLock(){
  if(S.wakeLock||S._noSleepActive) return;
  // Try native Wake Lock first
  if('wakeLock' in navigator){
    try{
      S.wakeLock=await navigator.wakeLock.request('screen');
      S.wakeLock.addEventListener('release',()=>{ S.wakeLock=null; });
      return;
    }catch(_){}
  }
  // Fallback: tiny hidden looping video (works on iOS Chrome)
  try{
    if(!S._noSleepVideo){
      const v=document.createElement('video');
      v.setAttribute('playsinline','');v.setAttribute('muted','');
      v.setAttribute('loop','');v.style.cssText='position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1;top:0;left:0';
      // 1-frame black mp4 encoded as base64
      const src='data:video/mp4;base64,AAAAIGZ0eXBtcDQyAAAAAG1wNDJpc29tAAADCG1vb3YAAABsbXZoZAAAAADaBlwX2gZcFwAAA+gAAAPoAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAIUdHJhawAAAFx0a2hkAAAAA9oGXBfaBlwXAAAABAAAAAAAAAPoAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAACidWR0YQAAAJptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAAAAAAAADuaWxzdAAAACepdG9vAAAAH2RhdGEAAAABAAAAAExhdmY1Ny44My4xMDA=';
      v.src=src;
      document.body.appendChild(v);
      S._noSleepVideo=v;
    }
    await S._noSleepVideo.play();
    S._noSleepActive=true;
  }catch(_){}
}
function stopWakeLock(){
  try{ if(S.wakeLock)S.wakeLock.release(); }catch(_){}
  S.wakeLock=null;
  if(S._noSleepVideo){ try{S._noSleepVideo.pause();}catch(_){} S._noSleepActive=false; }
}
// Re-acquire if tab becomes visible again (wake lock auto-releases on page hide)
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&S.status==='active') startWakeLock();
});

/* ── MAP ORIENTATION (heading-up) ────────────────────────── */
// Rotates the Leaflet map CSS to match compass heading.
// Controls and the North indicator are counter-rotated to stay upright.
// Uses webkitCompassHeading (iOS) or absolute DeviceOrientation (Android).
function toggleMapOrientation(which){
  const btn=el(which==='host'?'compass-btn-host':'compass-btn-spec');
  const map=which==='host'?S.hostMap:S.specMap;
  const frame=el(which==='host'?'hostmap-frame':'specmap-frame');
  if(!map||!frame) return;

  S.mapOrientMode[which]=!S.mapOrientMode[which];
  const on=S.mapOrientMode[which];
  if(btn) btn.classList.toggle('active',on);

  if(!on){
    stopMapOrientation();
    frame.style.transform='';
    setTimeout(()=>map.invalidateSize(),50);
    return;
  }

  if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){
    DeviceOrientationEvent.requestPermission()
      .then(state=>{
        if(state==='granted') startMapOrientation(which,map,frame);
        else{ toast('Compass permission denied'); S.mapOrientMode[which]=false; if(btn)btn.classList.remove('active'); }
      })
      .catch(()=>{ toast('Compass not available'); S.mapOrientMode[which]=false; if(btn)btn.classList.remove('active'); });
  } else {
    startMapOrientation(which,map,frame);
  }
}

function startMapOrientation(which,map,frame){
  stopMapOrientation();
  const size=Math.ceil(Math.hypot(frame.parentElement.clientWidth,frame.parentElement.clientHeight));
  Object.assign(frame.style,{width:size+'px',height:size+'px',left:'50%',top:'50%',marginLeft:-size/2+'px',marginTop:-size/2+'px'});
  S.mapOrientMode[which]=true;
  el('compass-btn-'+which)?.classList.add('active');
  map.invalidateSize();

  S._compassTarget=which;
  S._compassFrame=frame;
  S._compassMap=map;

  S._orientListener=(e)=>{
    const heading = e.webkitCompassHeading != null
      ? e.webkitCompassHeading
      : (e.absolute&&e.alpha!=null?(360-e.alpha)%360:null);
    if(heading==null)return;
    S._compassHeading=Core.smoothHeading(S._compassHeading,heading);
    // Rotate only the frame — Leaflet container itself is untouched
    frame.style.transform=`rotate(${-S._compassHeading}deg)`;
    const n=el('compass-btn-'+(which==='host'?'host':'spec'));
    if(n) n.title=Math.round(heading)+'°';
  };
  window.addEventListener('deviceorientation',S._orientListener,true);
  window.addEventListener('deviceorientationabsolute',S._orientListener,true);
}

function stopMapOrientation(){
  if(S._orientListener){
    window.removeEventListener('deviceorientation',S._orientListener,true);
    window.removeEventListener('deviceorientationabsolute',S._orientListener,true);
    S._orientListener=null;
  }
  // Clean up frame transforms
  ['hostmap-frame','specmap-frame'].forEach(id=>{
    const f=el(id);if(f)f.removeAttribute('style');
  });
  ['host','spec'].forEach(which=>{S.mapOrientMode[which]=false;el('compass-btn-'+which)?.classList.remove('active');});
  S._compassMap?.invalidateSize();
  S._compassHeading=null;S._compassFrame=null;S._compassMap=null;S._compassTarget=null;
}

function headingLabel(deg){
  const dirs=['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(deg/45)%8];
}

/* ── PROXIMITY SOUNDS — stepped thresholds ───────────────── */
// Replacing the previous version with cleaner stepped logic.
// Five distinct distance bands, cooldown resets on each band change
// so crossing a threshold always triggers a sound.
const PROX_BANDS=[
  {max:2000,min:1000,freq:400,vol:0.07,cooldown:8000},
  {max:1000,min:500, freq:520,vol:0.09,cooldown:6000},
  {max:500, min:250, freq:660,vol:0.11,cooldown:4000},
  {max:250, min:100, freq:784,vol:0.13,cooldown:2500},
  {max:100, min:0,   freq:988,vol:0.15,cooldown:1500},
];
function playProximitySound(distM){
  if(!S.soundEnabled) return;
  const bandIdx=PROX_BANDS.findIndex(b=>distM<b.max&&distM>=b.min);
  if(bandIdx<0) return;
  const band=PROX_BANDS[bandIdx];
  const now=Date.now();
  const bandChanged=band!==S._lastProxBand;
  if(bandChanged){
    S._lastProxBand=band;
    S.lastProximityBeep=0;
    // Play a distinct entry sound when crossing into a closer band
    playProxEnterSound(bandIdx+1);
    return;
  }
  if(now-S.lastProximityBeep<band.cooldown) return;
  S.lastProximityBeep=now;
  playTone(band.freq,0.07,band.vol);
}

/* ── GAME MODE ───────────────────────────────────────────── */
function setGameMode(m){
  S.gameMode=m;
  S.elimMode=(m==='elimination');
  S.whisperMode=(m==='whisper');
  document.querySelectorAll('.mode-card').forEach(c=>{const selected=c.id==='mode-card-'+m;c.classList.toggle('active',selected);c.setAttribute('aria-pressed',String(selected));});
  if(['hotcold','sailor','whisper'].includes(m))setBlindStart(false);
  const warn=el('mode-warn'),warnTxt=el('mode-warn-txt');
  if(m==='whisper'){
    warnTxt.textContent='Distance reveals once per minute only.';
    warn.classList.remove('hidden');
    setBlindStart(false);
  } else if(m==='hotcold'){
    warnTxt.textContent='No distance shown — find the target by feel. Move and observe the pulse.';
    warn.classList.remove('hidden');
  } else if(m==='sailor'){
    warnTxt.textContent='A compass needle points toward the target. No distance shown — navigate by direction alone.';
    warn.classList.remove('hidden');
  } else if(m==='multi'){
    warnTxt.textContent='Find three checkpoints in order. Pick the first; the next two are found on public routes. Each player keeps their own progress.';
    warn.classList.remove('hidden');
  } else if(m==='dynamic'){
    warnTxt.textContent='Every three minutes, the host looks for a nearby public route and shifts the target. Keep reading the distance.';
    warn.classList.remove('hidden');
  } else {
    warn.classList.add('hidden');
  }
}
function setTeamsMode(on){
  S.teamsMode=!!on;
  const sw=el('sw-teams');if(sw)sw.checked=!!on;
}
function setTeam(t){
  S.myTeam=t;
  el('team-btn-red')&&el('team-btn-red').classList.toggle('active',t==='red');
  el('team-btn-blue')&&el('team-btn-blue').classList.toggle('active',t==='blue');
  haptic('light');
}

/* ── COPY CODE TAP ───────────────────────────────────────── */
function copyCodeTap(){
  const code=S.gameCode;if(!code)return;
  haptic('light');
  if(navigator.clipboard)navigator.clipboard.writeText(code).then(()=>{
    const el2=el('hl-code'),sub=el('hl-code-sub');
    const orig=el2.textContent;
    el2.style.color='var(--green)';sub.textContent='Copied!';
    setTimeout(()=>{el2.style.color='';sub.textContent='Tap to copy';},1400);
  }).catch(()=>toast('Code: '+code,3000));
}

/* ── QR CODE ─────────────────────────────────────────────── */
function showQR(){
  const url=`${location.origin}${location.pathname}?join=${S.gameCode}`;
  set('qr-sub','Game Code: '+S.gameCode);
  const canvas=el('qr-canvas');canvas.innerHTML='';
  if(typeof QRCode!=='undefined'){
    new QRCode(canvas,{text:url,width:200,height:200,colorDark:'#000000',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
    // Round the generated canvas/img
    setTimeout(()=>{const c=canvas.querySelector('canvas,img');if(c)c.style.borderRadius='10px';},50);
  } else {
    canvas.innerHTML='<div style="padding:20px;color:var(--t3);font-size:13px">QR library not loaded</div>';
  }
  el('qr-sheet').classList.remove('hidden');
}
function hideQR(){ el('qr-sheet').classList.add('hidden'); }

/* ── REJOIN ──────────────────────────────────────────────── */
function checkRejoin(){
  try{
    const saved=readSession();
    if(!saved)return;
    const {code,token,name,role,ts}=saved;
    if(!code||!token)return;
    // Only offer rejoin if session is less than 4 hours old
    if(Date.now()-ts>4*60*60*1000){ clearSession();return; }
    // Check if the game still exists and is active
    db.ref(`games/${code}/status`).once('value').then(snap=>{
      const status=snap.val();
      if(status==='active'||status==='lobby'){
        S._rejoinCode=code;S._rejoinToken=token;S._rejoinName=name;S._rejoinRole=role;
        set('rejoin-sub',`Game ${code} is still active`);
        el('rejoin-bar').classList.remove('hidden');
      } else {
        clearSession();
      }
    }).catch(()=>{});
  }catch(_){}
}
function readSession(){try{return JSON.parse(sessionStorage.getItem('ll_session')||storage.getItem('ll_session')||'null');}catch(_){return null;}}
function saveSession(){const value=JSON.stringify({code:S.gameCode,token:S.myToken,name:S.myName,role:S.role,isHost:S.isHost,ts:Date.now()});try{sessionStorage.setItem('ll_session',value);}catch(_){}storage.setItem('ll_session',value);}
function clearSession(){
  const saved=readSession();try{sessionStorage.removeItem('ll_session');}catch(_){}
  try{const shared=JSON.parse(storage.getItem('ll_session')||'null');if(!saved||shared?.token===saved.token)storage.removeItem('ll_session');}catch(_){}
}
function dismissRejoin(){ el('rejoin-bar').classList.add('hidden');clearSession(); }
async function doRejoin(){
  const epoch=S._epoch;
  const code=S._rejoinCode,token=S._rejoinToken;if(!code||!token)return;
  try{
    const snap=await db.ref('games/'+code).once('value');const g=snap.val(),me=g?.players?.[token];
    if(S._epoch!==epoch)return;
    if(!g||!me||!['lobby','active'].includes(g.status)){clearSession();hide('rejoin-bar');throw new Error('That session has ended. Join a new game.');}
    S.gameCode=code;S.myToken=token;S.myName=me.name;S.role=me.role;S.isHost=g.hostToken===token;
    S.multiCurrent=Core.checkpointIndex(me.multiCurrent,g.multiTargets?.length||3);S.arrived=!!me.arrived;S.eliminated=!!me.eliminated;S.arrivalElapsed=me.arrSec??null;S.startDist=me.startDist??null;S.myTeam=me.team||null;S.myTrail=me.trail||[];
    S.blindUnlocked=!!me.blindUnlocked;S.blindStartLat=me.blindStartLat??null;S.blindStartLon=me.blindStartLon??null;
    applyGame(g);S.status=g.status;hide('rejoin-bar');saveSession();await pRef().update({online:true,withdrawn:false});await registerPresence();if(!sameSession(code,epoch))return;
    if(g.status==='lobby'){
      if(S.isHost){if(S.targetLat==null)goScreen('map');else{goScreen('hlobby');renderHLobby();}}else{set('nw-title','Game '+code);set('nw-name',me.name);goScreen('nwait');}
    }else if(S.isHost){launchHostActive();if(S.gameMode==='dynamic')startDynamicTarget();}
    else if(S.arrived){showResults();}
    else if(S.eliminated){goScreen('nactive');show('ov-eliminated');}
    else if(S.role==='spectator'){if(me.specApproved){goScreen('spectator');startClientTimer();}else{goScreen('nwait');set('nw-title','Waiting for host approval');}}
    else{goScreen('nactive');startGPS();startClientTimer();}
    startPlayersListener();toast('Welcome back, '+me.name+'.');
  }catch(e){toast(e.message,5000);}
}

/* ── OFFLINE DETECTION ───────────────────────────────────── */
async function registerPresence(){
  if(!S._isOnline||!S.gameCode||!S.myToken)return;
  const code=S.gameCode,epoch=S._epoch,ref=pRef(),registration=ref.onDisconnect();S._presence=registration;
  try{
    await registration.update({online:false,lastSeen:SV.TIMESTAMP});
    if(!sameSession(code,epoch)){await registration.cancel();return;}
    await ref.transaction(me=>me?{...me,online:true}:undefined,undefined,false);
  }catch(_){} // Re-established when Firebase reports the next connection.
}
function startOfflineDetection(){
  db.ref('.info/connected').on('value',snap=>{
    S._isOnline=snap.val()===true;el('na-offline').classList.toggle('hidden',S._isOnline);
    set('connection-status',S._isOnline?'Connected':'Connecting…');
    if(S._isOnline&&S.myToken){registerPresence();sendPosUpdateQueued();}
  });
  window.addEventListener('offline',()=>{S._isOnline=false;show('na-offline');});
}

/* ── BATTERY WARNING ─────────────────────────────────────── */
async function checkBattery(){
  if(!('getBattery' in navigator)) return;
  try{
    const bat=await navigator.getBattery();
    const update=()=>{
      const low=!bat.charging&&bat.level<0.15;
      var nb=el('na-battery');if(nb)nb.classList.toggle('hidden',!low);
    };
    update();
    bat.addEventListener('levelchange',update);
    bat.addEventListener('chargingchange',update);
  }catch(_){}
}

/* ── GPS ACCURACY RING ───────────────────────────────────── */
/* ── WHISPER MODE TIMER ──────────────────────────────────── */
function startWhisperTimer(){
  if(!S.whisperMode)return;stopWhisperTimer();whisperHide();show('na-whisper-cd');
  const tick=()=>{
    const phase=Core.whisperPhase(serverNow(),S.startedAt);
    set('na-whisper-cd',phase.visible?'SIGNAL LIVE':'NEXT SIGNAL '+fmtTime(phase.remaining));
    if(phase.visible&&!S._whisperShowing&&Core.validPoint(S.myLat,S.myLon))whisperReveal(noiseDist(hav(S.myLat,S.myLon,S.targetLat,S.targetLon),S.noiseSeed));
    if(!phase.visible&&S._whisperShowing)whisperHide();S._whisperShowing=phase.visible;
  };tick();S.whisperIv=setInterval(tick,500);
}

function whisperReveal(distM){
  const nd=el('na-dist'),nu=el('na-unit'),eyebrow=el('na-eyebrow');
  if(nd){
    nd.textContent=fmtDist(distM);
    nd.classList.remove('blind-num','updating');
    void nd.offsetWidth;
    nd.classList.add('updating'); // flash animation
  }
  if(nu) nu.textContent=distUnit(distM);
  if(eyebrow) eyebrow.textContent='Fades in 8s';
  spawnRipple('auto');
  playTone(659,0.10,0.15);setTimeout(()=>playTone(880,0.14,0.18),120);
  haptic('medium');
  // Proximity tint briefly
  const nc=el('na-center');
  if(nc){
    nc.classList.remove('prox-close','prox-very-close');
    if(distM<200) nc.classList.add('prox-very-close');
    else if(distM<1000) nc.classList.add('prox-close');
    setTimeout(()=>nc.classList.remove('prox-close','prox-very-close'),8000);
  }
}

function whisperHide(){
  const nd=el('na-dist'),nu=el('na-unit'),eyebrow=el('na-eyebrow');
  if(nd){nd.textContent='—';}
  if(nu) nu.textContent='';
  if(eyebrow) eyebrow.textContent='';
}

function stopWhisperTimer(){
  clearInterval(S.whisperIv);S.whisperIv=null;
  clearTimeout(S._whisperHideTimeout);S._whisperHideTimeout=null;
  S._whisperShowing=false;
  var nwc=el('na-whisper-cd');if(nwc)nwc.classList.add('hidden');
}

/* ── FILLRESULTS — with team colors, host exclusion, route stats ── */
function fillResults(players){
  const me=players?.find(p=>p.id===S.myToken);if(me){S.arrived=!!me.arrived;S.arrivalElapsed=me.arrSec??null;}
  const elapsed=S.arrivalElapsed!==undefined&&S.arrivalElapsed!==null?S.arrivalElapsed:(S.timeLimitSec-currentTimeRemaining());
  set('res-time',fmtTime(elapsed));set('stat-time',fmtTime(elapsed));
  set('stat-dist',S.startDist?(S.startDist/1000).toFixed(1)+' km':'—');

  // Game mode pill
  var modePill=el('res-mode-pill');
  if(modePill){
    var modeLabels2={standard:'🎯 Standard',elimination:'⚡ Elimination',whisper:'👂 Whisper',hotcold:'🌡️ Hot \u0026 Cold',sailor:'🧭 Sailor',multi:'🎯 Multi-Target',dynamic:'🔄 Dynamic'};
    modePill.textContent=modeLabels2[S.gameMode]||'🏁 Route Revealed';
  }

  // Team result banner
  var teamBanner=el('team-result-banner');
  var teamIco=el('team-result-ico');
  var teamTitle=el('team-result-title');
  if(teamBanner&&S.teamsMode){
    var allP2=players||[];
    var redArr2=allP2.some(function(p){return p.team==='red'&&p.arrived;});
    var blueArr2=allP2.some(function(p){return p.team==='blue'&&p.arrived;});
    if(redArr2||blueArr2){
      teamBanner.classList.remove('hidden');
      if(redArr2&&!blueArr2){teamIco.textContent='\uD83D\uDD34';teamTitle.textContent='Red Team Wins!';teamTitle.style.color='#FF3B30';}
      else if(blueArr2&&!redArr2){teamIco.textContent='\uD83D\uDD35';teamTitle.textContent='Blue Team Wins!';teamTitle.style.color='#007AFF';}
      else{teamIco.textContent='\uD83C\uDFC1';teamTitle.textContent='Both Teams Arrived!';teamTitle.style.color='var(--t1)';}
      // Hide individual winner row
      var wr=el('winner-row');if(wr)wr.classList.add('hidden');
    } else {
      teamBanner.classList.add('hidden');
    }
  } else if(teamBanner){
    teamBanner.classList.add('hidden');
  }

  const rows=el('result-rows');
  if(!rows||!players)return;

  // Build full navigator list
  let navs=players.filter(function(p){return p.role==='navigator';});
  // Host exclusion
  if(S.excludeHost&&S.hostPlayerToken) navs=navs.filter(function(p){return p.id!==S.hostPlayerToken;});
  set('stat-players',navs.length);

  // Sort: arrived first by time, then DNF
  const sorted=Core.rankPlayers(navs.map(p=>({...p,distance:computeDist(p)})));

  // Winner row — teams override
  const winner=sorted.find(p=>p.arrived);
  el('winner-row').classList.toggle('hidden',S.teamsMode&&!!winner);set('res-name',winner?winner.name:(S.status==='active'?'No finishers yet':'No finishers'));set('res-time',winner?fmtTime(winner.arrSec):'—');set('stat-time',winner?fmtTime(winner.arrSec):'—');set('res-winner-sub',winner?'First to reach the target':(S.status==='active'?'The game is still running':'The game ended before anyone reached the target'));
  el('winner-row').querySelector('.winner-ico').textContent=winner?'🏆':'—';
  if(!S.teamsMode&&winner){
    set('res-name',winner.arrived?winner.name:'—');
    var wrDiv=el('winner-row');
    if(wrDiv){
      var wr=el('res-winner-sub');
      if(wr){
        if(S.gameMode==='elimination')wr.textContent='Last one standing';
        else if(S.gameMode==='whisper')wr.textContent='Found it in the whispers';
        else if(S.gameMode==='hotcold')wr.textContent='Felt the way there';
        else if(S.gameMode==='sailor')wr.textContent='Sailed to the target';
        else wr.textContent='First to reach the target';
      }
      const idx=navs.findIndex(p=>p.id===winner.id);
      const col=PCOLS[idx%PCOLS.length];
      wrDiv.style.borderColor=winner.arrived?col:'var(--border)';
      wrDiv.style.background=winner.arrived?col+'18':'rgba(0,0,0,.04)';
    }
  }

  // Leaderboard rows with team color dots
  rows.innerHTML=sorted.map(function(p,i){
    const col=p.team==='red'?'#FF3B30':p.team==='blue'?'#007AFF':PCOLS[i%PCOLS.length];
    const medal=p.arrived?(['\uD83E\uDD47','\uD83E\uDD48','\uD83E\uDD49'][i]||''):'';
    const pos=medal||'<span style="font-size:12px;font-weight:700;color:var(--t3)">'+(i+1)+'</span>';
    const time=p.arrived?fmtTime(p.arrSec):'<span style="color:var(--t3)">DNF</span>';
    const dist=p.startDist?'<span class="rr-dist">'+(p.startDist/1000).toFixed(1)+'km</span>':'';
    var teamTag='';
    if(S.teamsMode&&p.team) teamTag='<span class="rr-team" style="color:'+(p.team==='red'?'#FF3B30':'#007AFF')+'">'+(p.team==='red'?'R':'B')+'</span>';
    return'<div class="rr-row">'+
      '<span class="rr-pos">'+pos+'</span>'+
      '<div class="rr-dot" style="background:'+col+'"></div>'+
      '<span class="rr-name">'+escHtml(p.name)+'</span>'+
      teamTag+
      dist+
      '<span class="rr-time">'+time+'</span>'+
    '</div>';
  }).join('');

  // Route stats for this player
  if(S.myTrail.length>1){
    let walked=0;
    for(let i=1;i<S.myTrail.length;i++) walked+=hav(S.myTrail[i-1][0],S.myTrail[i-1][1],S.myTrail[i][0],S.myTrail[i][1]);
    const eff=S.startDist&&walked>0?Math.min(100,Math.round((S.startDist/walked)*100)):null;
    const myRank=winner&&winner.id===S.myToken?1:sorted.findIndex(function(p){return p.id===S.myToken;})+1;
    set('rs-walked',walked>1000?(walked/1000).toFixed(1)+' km':Math.round(walked)+' m');
    set('rs-efficiency',eff?eff+'%':'—');
    set('rs-rank',myRank>0?myRank+' / '+sorted.length:'—');
    var rs=el('route-stats');if(rs)rs.classList.remove('hidden');
  }

  // Save stats to localStorage
  saveGameStats(elapsed,sorted.length,winner&&winner.id===S.myToken);
}

/* ── HOT & COLD COMPASS ──────────────────────────────────── */
// Bearing from (lat1,lon1) to (lat2,lon2) in degrees 0-360
function bearingTo(lat1,lon1,lat2,lon2){
  const dLon=(lon2-lon1)*Math.PI/180;
  const y=Math.sin(dLon)*Math.cos(lat2*Math.PI/180);
  const x=Math.cos(lat1*Math.PI/180)*Math.sin(lat2*Math.PI/180)
          -Math.sin(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.cos(dLon);
  return((Math.atan2(y,x)*180/Math.PI)+360)%360;
}

function startHotCold(){
  stopHotCold();
  var ndw3=el('na-dist-wrapper');if(ndw3)ndw3.classList.add('hidden');
  var hcs2=el('hc-screen');if(hcs2)hcs2.classList.remove('hidden');
  var rb3=el('refresh-btn');if(rb3)rb3.classList.add('hidden');
  // Init history with current dist if known
  if(!S._hcHistory) S._hcHistory=[];
  if(S.lastDist) S._hcHistory=[{dist:S.lastDist,ts:Date.now()}];
  updateHotColdTrend();
}

function stopHotCold(){
  var ndw4=el('na-dist-wrapper');if(ndw4)ndw4.classList.remove('hidden');
  var hcs3=el('hc-screen');if(hcs3)hcs3.classList.add('hidden');
  var rb4=el('refresh-btn');if(rb4)rb4.classList.remove('hidden');
}

function updateHotColdTrend(){
  const hist=S._hcHistory||[];
  // Need at least 2 readings with meaningful time gap
  if(hist.length<2){
    _applyHCState('neutral',2.5);
    return;
  }
  const oldest=hist[0], newest=hist[hist.length-1];
  const dtSec=(newest.ts-oldest.ts)/1000;
  if(dtSec<0.5){
    _applyHCState('neutral',2.5);
    return;
  }
  // Velocity in m/s: positive = closing in, negative = moving away
  const velMs=(oldest.dist-newest.dist)/dtSec;

  // Map velocity to labels and intensity
  // HOT: closing >1.5 m/s, Warmer: 0.5-1.5, Same: -0.5 to 0.5, Cooler: -0.5 to -1.5, COLD: moving away >1.5
  let t; // +1=hot(closing fast), 0=neutral, -1=cold(moving away fast)
  if(velMs>1.5) t=1;
  else if(velMs>0.5) t=0.5+(velMs-0.5)/1; // maps 0.5..1.5 → 0.5..1 (Warmer→HOT)
  else if(velMs>0.15) t=(velMs-0.15)/0.35; // maps 0.15..0.5 → 0..0.5 (Warmer)
  else if(velMs>-0.15) t=0; // Same
  else if(velMs>-0.5) t=-((0.15+velMs)/0.35); // maps -0.15..-0.5 → 0..-0.5 (Cooler)
  else if(velMs>-1.5) t=-0.5-(-0.5-velMs)/1; // maps -0.5..-1.5 → -0.5..-1 (Cooler→COLD)
  else t=-1; // COLD

  // Pulse duration: HOT=0.5s, neutral=2.5s, COLD=4s
  const dur=2.5-t*1.5; // maps [-1..1] → [4.0s..1.0s]

  _applyHCState(t,dur);
}

function _applyHCState(t,dur){
  // t: -1=cold, 0=neutral, +1=hot (or 'neutral' string for init)
  const isNeutral=(t==='neutral');
  const tNum=isNeutral?0:t;

  // Clamp to [0,1] for color (0=cold, 1=hot)
  const c=(tNum+1)/2; // 0=cold, 1=hot

  // Color gradient cold→neutral→hot
  const lerpC=(a,b,f)=>a.map((v,i)=>Math.round(v+(b[i]-v)*f));
  const cold=[59,130,246],neutral=[120,120,130],hot=[239,68,68];
  let rgb;
  if(c<0.5) rgb=lerpC(cold,neutral,c*2);
  else rgb=lerpC(neutral,hot,(c-0.5)*2);
  const [r,g,b]=rgb;
  const col=`rgb(${r},${g},${b})`;
  const rgbA=(a)=>`rgba(${r},${g},${b},${a})`;

  // Apply to DOM
  const screen=el('hc-screen');
  if(screen){
    screen.style.setProperty('--hc-dur',dur+'s');
    screen.style.background=isNeutral?''
      :`radial-gradient(ellipse at 50% 50%, ${rgbA(0.06+c*0.08)} 0%, transparent 70%)`;
  }
  [el('hc-ring1'),el('hc-ring2'),el('hc-ring3')].forEach(ring=>{
    if(ring) ring.style.color=col;
  });
  const core=el('hc-core');
  if(core){
    core.style.background=`radial-gradient(circle at 40% 35%, ${rgbA(0.2)}, ${rgbA(0.06)})`;
    core.style.boxShadow=`0 0 ${16+Math.round(c*36)}px ${rgbA(0.22)}`;
    core.style.border=`1.5px solid ${rgbA(0.2)}`;
  }
  // Word label — velocity-based feedback, not absolute position
  const word=el('hc-word');
  if(word){
    if(isNeutral||Math.abs(tNum)<0.08){ word.textContent='Same'; word.style.color=''; }
    else if(tNum>0.6){ word.textContent='HOT'; word.style.color=col; }
    else if(tNum>0.15){ word.textContent='Warmer'; word.style.color=col; }
    else if(tNum<-0.6){ word.textContent='COLD'; word.style.color=col; }
    else if(tNum<-0.15){ word.textContent='Cooler'; word.style.color=col; }
    else { word.textContent='Same'; word.style.color=''; }
  }
  // Haptic on strong hot signal
  if(tNum>0.7&&Date.now()-(S._hcHapticTs||0)>Math.max(600,dur*600)){
    haptic('light'); S._hcHapticTs=Date.now();
  }
}

/* ── SAILOR MODE — COMPASS NEEDLE ────────────────────────── */
// A compass needle that always points toward the target.
// bearingTo(myPos, target) = absolute bearing (0-360, 0=North)
// deviceHeading = webkitCompassHeading or 360-alpha
// needleAngle = targetBearing - deviceHeading → arrow rotates to always point at target
function startSailor(){
  stopSailor();hide('na-dist-wrapper');hide('hc-screen');show('sailor-screen');hide('refresh-btn');hide('sailor-distance');
  if(typeof DeviceOrientationEvent==='undefined'){set('sailor-hint','This device has no compass sensor.');hide('enable-compass');return;}
  if(typeof DeviceOrientationEvent.requestPermission==='function'){show('enable-compass');set('sailor-hint','Enable your compass to point toward the target.');}
  else{hide('enable-compass');_startSailorListener();}
}
async function enableCompass(){try{if(await DeviceOrientationEvent.requestPermission()==='granted'){hide('enable-compass');_startSailorListener();}else set('sailor-hint','Compass access was not granted.');}catch(_){set('sailor-hint','Tap Enable compass again to allow access.');}}

function _startSailorListener(){
  if(S._sailorListener)return;S._sailorSmoothHeading=null;
  S._sailorListener=e=>{
    const raw=e.webkitCompassHeading!=null?e.webkitCompassHeading:(e.absolute&&e.alpha!=null?(360-e.alpha)%360:null);
    if(raw==null){set('sailor-hint','Waiting for a compass reading. Hold your phone flat.');return;}
    S._sailorSmoothHeading=Core.smoothHeading(S._sailorSmoothHeading,raw);S._sailorHeading=S._sailorSmoothHeading;
    set('sailor-hint','Follow the blue tip');updateSailorNeedle();
  };
  window.addEventListener('deviceorientation',S._sailorListener,true);window.addEventListener('deviceorientationabsolute',S._sailorListener,true);
}

function stopSailor(){
  if(S._sailorListener){
    window.removeEventListener('deviceorientation',S._sailorListener,true);window.removeEventListener('deviceorientationabsolute',S._sailorListener,true);
    S._sailorListener=null;
  }
  var ndw2=el('na-dist-wrapper');if(ndw2)ndw2.classList.remove('hidden');
  var ss2=el('sailor-screen');if(ss2)ss2.classList.add('hidden');
  var rb2=el('refresh-btn');if(rb2)rb2.classList.remove('hidden');
}

function updateSailorNeedle(){
  if(S.myLat==null||S.targetLat==null||S._sailorHeading==null) return;
  const targetBearing=bearingTo(S.myLat,S.myLon,S.targetLat,S.targetLon);
  const needleAngle=targetBearing-S._sailorHeading;
  const needle=el('sailor-needle');
  if(needle){
    needle.style.transform=`rotate(${needleAngle}deg)`;
    // Add pulse animation when aligned (within 5 degrees)
    const normalizedAngle=((needleAngle%360)+360)%360;
    const isAligned=normalizedAngle<5||normalizedAngle>355;
    needle.classList.toggle('aligned',isAligned);
  }
  // Update distance display
  const dist=hav(S.myLat,S.myLon,S.targetLat,S.targetLon);
  const distTxt=dist>=1000?(dist/1000).toFixed(1)+' km':Math.round(dist)+' m';
  const distEl=el('sailor-distance');
  if(distEl)distEl.classList.add('hidden');
}
/* ── DYNAMIC TARGET — MOVES EVERY 3 MINUTES ──────────────── */
function startDynamicTarget(){
  stopDynamicTarget();if(!S.isHost)return;
  S._dynamicMoveIv=setInterval(async()=>{
    const round=Math.floor((serverNow()-S.startedAt)/180000);
    if(S.status!=='active'||round<1||round<=(S._dynamicMoveCount||0)||S._dynamicPicking)return;
    S._dynamicPicking=true;const code=S.gameCode;
    try{const point=await findSmartTarget(S.targetLat,S.targetLon,.08);if(code!==S.gameCode||S.status!=='active')return;
      const result=await gRef().transaction(game=>game?.status==='active'&&round>(game.dynamicMoveCount||0)?{...game,targetLat:point.lat,targetLon:point.lon,dynamicMoveCount:round}:undefined,undefined,false);if(result.committed&&code===S.gameCode)toast('The target moved. Find the new signal.');
    }catch(_){S._dynamicMoveCount=round;toast('No suitable nearby route found. Target stays in place.');}
    finally{S._dynamicPicking=false;}
  },5000);
}
function stopDynamicTarget(){
  if(S._dynamicMoveIv){clearInterval(S._dynamicMoveIv);S._dynamicMoveIv=null;}
}
function checkTeamArrival(players){
  if(!S.teamsMode) return false;
  const teams={red:false,blue:false};
  players.forEach(p=>{
    if(p.role==='navigator'&&p.arrived&&p.team) teams[p.team]=true;
  });
  if(teams.red||teams.blue){
    const winner=teams.red&&!teams.blue?'🔴 Red Team':!teams.red&&teams.blue?'🔵 Blue Team':'Both Teams';
    set('res-name',winner+' wins!');
    return true;
  }
  return false;
}

/* ── AUTO-ZOOM HOST MAP ───────────────────────────────────── */
function startAutoZoom(){
  if(S._autoZoomIv) clearInterval(S._autoZoomIv);
  S._autoZoomIv=setInterval(()=>{
    if(S.screen!=='hactive'&&S.screen!=='spectator') return;
    const map=S.screen==='hactive'?S.hostMap:S.specMap;
    if(!map) return;
    const pts=[];
    if(S.targetLat!=null) pts.push([S.targetLat,S.targetLon]);
    Object.values(S.latestPlayers).forEach(p=>{
      if(p.lat!=null&&p.lon!=null&&!p.arrived&&!p.eliminated) pts.push([+p.lat,+p.lon]);
    });
    if(pts.length>=2){
      try{ map.fitBounds(L.latLngBounds(pts),{padding:[44,44],maxZoom:14,animate:true}); }
      catch(_){}
    }
  },10000);
}
function stopAutoZoom(){ clearInterval(S._autoZoomIv); S._autoZoomIv=null; }

/* ── OFFLINE GPS QUEUE ───────────────────────────────────── */
async function sendPosUpdateQueued(manual=false){
  if(!S.myToken||S.role!=='navigator'||S.status!=='active'||S.arrived||S.eliminated||serverNow()<S.startedAt||!Core.validPoint(S.myLat,S.myLon)||!Core.validPoint(S.targetLat,S.targetLon))return;
  const dist=hav(S.myLat,S.myLon,S.targetLat,S.targetLon),noised=noiseDist(dist,S.noiseSeed);
  if(S.startDist==null)S.startDist=dist;
  S._hcHistory.push({dist,ts:Date.now()});while(S._hcHistory.length>1&&S._hcHistory[0].ts<Date.now()-8000)S._hcHistory.shift();
  if(S.blindStart&&!S.blindUnlocked)updateBlindDisplay(noised);
  else if(S.gameMode==='hotcold')updateHotColdTrend();
  else if(S.gameMode==='sailor')updateSailorNeedle();
  else if(S.whisperMode){if(S._whisperShowing)updateNavDisplay(noised);}
  else{updateNavDisplay(noised);if(!manual)playProximitySound(dist);}
  if(S.gameMode==='multi'&&(!S.blindStart||S.blindUnlocked))set('na-eyebrow','CHECKPOINT '+(S.multiCurrent+1)+' / '+S.multiTargets.length);
  if(S.gameMode==='dynamic')set('na-eyebrow','MOVING TARGET · SHIFT '+(S._dynamicMoveCount||0));
  if(!S._isOnline){set('na-upd','Offline · distance still updates; arrival needs connection');return;}
  if(!S._lastFix||Date.now()-S._lastFix>20000){set('na-upd','Waiting for a fresh GPS fix before syncing');return;}
  if(S._writePending)return;
  const isArrival=Core.canArrive(dist,S.lastAccuracy,S.arrRadius);
  if(!manual&&!isArrival&&Date.now()-(S._lastSent||0)<2500)return;
  if(dist<=S.arrRadius&&!isArrival)set('na-upd','Near target · waiting for a more accurate GPS fix');
  const code=S.gameCode,token=S.myToken,epoch=S._epoch;S._writePending=true;S._lastSent=Date.now();
  const ref=pRef();
  const upd={lat:S.myLat,lon:S.myLon,accuracy:S.lastAccuracy,speedKmh:S.speedKmh,lastSeen:SV.TIMESTAMP,startDist:S.startDist,online:true,blindUnlocked:S.blindUnlocked,blindStartLat:S.blindStartLat,blindStartLon:S.blindStartLon};
  if(isArrival||Date.now()-(S._lastTrailSent||0)>15000){upd.trail=S.myTrail.slice(-1500);S._lastTrailSent=Date.now();}
  try{
    if(isArrival){
      const room=db.ref('games/'+code),fixTime=S._lastFix,checkpoint=S.multiCurrent;
      await room.once('value');
      const result=await room.transaction(game=>{
        if(!sameSession(code,epoch)||game?.status!=='active'||Date.now()-fixTime>20000)return;
        const me=game.players?.[token];
        if(!me||me.arrived||me.eliminated||me.withdrawn||me.role!=='navigator')return;
        const index=Core.checkpointIndex(me.multiCurrent,game.multiTargets?.length||3);
        if(game.gameMode==='multi'&&index!==checkpoint)return;
        const target=Core.targetFor(game,me),distance=hav(upd.lat,upd.lon,target.lat,target.lon);
        if(!Core.canArrive(distance,upd.accuracy,game.arrRadius))return;
        Object.assign(me,upd);
        if(game.gameMode==='multi'&&index<game.multiTargets.length-1)me.multiCurrent=index+1;
        else Object.assign(me,{arrived:true,arrSec:Math.max(0,Math.round((serverNow()-game.startedAt)/1000))});
        if(Core.shouldFinish(game,playerEntries(game.players)))game.status='finished';
        return game;
      },undefined,false);
      if(!sameSession(code,epoch)||!result.committed)return;
      const game=result.snapshot.val(),me=game.players[token];
      S.multiCurrent=Core.checkpointIndex(me.multiCurrent,game.multiTargets?.length||3);S.multiArrived=S.multiCurrent;
      const target=Core.targetFor(game,me);S.targetLat=target.lat;S.targetLon=target.lon;
      S.arrived=!!me.arrived;S.arrivalElapsed=me.arrSec??null;S._hcHistory=[];saveSession();
      if(game.status==='finished'){S.status='finished';fillResults(playerEntries(game.players));goScreen('results');}
      else if(S.arrived&&S.status==='active')triggerArrival(me.arrSec,S.startDist);
      else if(S.status==='active')toast('Checkpoint '+S.multiCurrent+' found. On to the next!');
      playArrivalSound();
    }else await ref.update(upd);
  }catch(e){if(code===S.gameCode)toast('Could not sync this position. Retrying with your next fix.');}
  finally{if(epoch===S._epoch)S._writePending=false;}
}

/* ── PERSISTENT STATS ────────────────────────────────────── */
function loadStats(){
  try{
    var raw=storage.getItem('ll_stats');
    if(raw)return JSON.parse(raw);
  }catch(_){}
  return{games:0,wins:0,bestTime:null,totalEff:0,effCount:0,totalDist:0};
}
function saveStats(s){
  try{localStorage.setItem('ll_stats',JSON.stringify(s));}catch(_){}
}
function saveGameStats(elapsed,playerCount,won){
  const key=S.gameCode+':'+S.myToken;
  if((S.status==='active'&&!S.arrived)||S.role!=='navigator'||(S.excludeHost&&S.isHost)||S._statsSaved||storage.getItem('ll_counted_'+key))return;
  S._statsSaved=true;storage.setItem('ll_counted_'+key,'1');
  var s=loadStats();
  s.games++;
  if(won)s.wins++;
  if(S.arrived&&Number.isFinite(elapsed)&&(s.bestTime==null||elapsed<s.bestTime))s.bestTime=elapsed;
  if(S.myTrail.length>1){
    var walked=0;
    for(var i=1;i<S.myTrail.length;i++)walked+=hav(S.myTrail[i-1][0],S.myTrail[i-1][1],S.myTrail[i][0],S.myTrail[i][1]);
    if(S.startDist&&walked>0){
      var eff=Math.min(100,Math.round((S.startDist/walked)*100));
      s.totalEff+=eff;s.effCount++;
    }
    s.totalDist+=walked;
  }
  saveStats(s);
}
function renderStats(){
  var s=loadStats();
  if(!s||!s.games){hide('stats-card');return;}
  show('stats-card');
  set('sc-games',s.games);
  set('sc-wins',s.wins);
  set('sc-best',s.bestTime!=null?fmtTime(s.bestTime):'—');
  set('sc-eff',s.effCount>0?Math.round(s.totalEff/s.effCount)+'%':'—');
  set('sc-dist',s.totalDist>1000?(s.totalDist/1000).toFixed(1)+' km':Math.round(s.totalDist)+' m');
}
function toggleStatsCard(){
  var body=el('stats-card-body');
  var chev=el('stats-chevron');
  if(body)body.classList.toggle('hidden');
  if(chev)chev.classList.toggle('open');
}
function resetStats(){
  if(!confirm('Reset all stats?'))return;
  saveStats({games:0,wins:0,bestTime:null,totalEff:0,effCount:0,totalDist:0});
  hide('stats-card');
}
/* ── PWA INSTALL ─────────────────────────────────────────── */
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();
  S._pwaPrompt=e;
  if(!storage.getItem('pwa-dismissed')){
    setTimeout(()=>{var pb=el('pwa-banner');if(pb)pb.classList.remove('hidden');},2500);
  }
});
function pwaInstall(){
  if(!S._pwaPrompt) return;
  S._pwaPrompt.prompt();
  S._pwaPrompt.userChoice.then(()=>{ var pb2=el('pwa-banner');if(pb2)pb2.classList.add('hidden'); });
}
function pwaDismiss(){
  var pb3=el('pwa-banner');if(pb3)pb3.classList.add('hidden');
  storage.setItem('pwa-dismissed','1');
}

/* ── SHARE RESULT CARD (fixed — zoomed map + stats) ─────── */
async function shareResult(){
  try{
    const canvas=document.createElement('canvas');
    const dpr=Math.min(window.devicePixelRatio||1,2);
    const W=600,H=800;
    canvas.width=W*dpr;canvas.height=H*dpr;
    const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
    const dark=document.documentElement.getAttribute('data-theme')==='dark';

    // Background gradient
    const grad=ctx.createLinearGradient(0,0,W,H);
    if(dark){grad.addColorStop(0,'#0a1628');grad.addColorStop(0.5,'#0d1f3c');grad.addColorStop(1,'#05080f');}
    else{grad.addColorStop(0,'#c8e6ff');grad.addColorStop(0.5,'#ddf0fb');grad.addColorStop(1,'#eef4f0');}
    ctx.fillStyle=grad;
    ctx.beginPath();ctx.roundRect?ctx.roundRect(0,0,W,H,24):ctx.rect(0,0,W,H);ctx.fill();

    // Subtle top accent line
    ctx.fillStyle='#007AFF';
    ctx.beginPath();ctx.roundRect?ctx.roundRect(40,36,W-80,3,1.5):ctx.rect(40,36,W-80,3);ctx.fill();

    // Header
    ctx.fillStyle=dark?'rgba(255,255,255,.92)':'rgba(0,0,0,.88)';
    ctx.font='bold 28px -apple-system,Arial,sans-serif';
    ctx.fillText('Luftlinie',40,72);
    ctx.fillStyle=dark?'rgba(255,255,255,.4)':'rgba(0,0,0,.4)';
    ctx.font='12px -apple-system,Arial,sans-serif';
    ctx.fillText('as the crow flies',40,90);

    // Game mode badge
    const modeLabels={standard:'Standard',elimination:'Elimination',whisper:'Whisper',hotcold:'Hot \u0026 Cold',sailor:'Sailor',multi:'Multi-Target',dynamic:'Dynamic'};
    const modeLabel=modeLabels[S.gameMode]||'Standard';
    const modeColors={standard:'#007AFF',elimination:'#FF9F0A',whisper:'#BF5AF2',hotcold:'#FF3B30',sailor:'#34C759',multi:'#007AFF',dynamic:'#FF9F0A'};
    const mCol=modeColors[S.gameMode]||'#007AFF';
    ctx.fillStyle=mCol;
    ctx.beginPath();ctx.roundRect?ctx.roundRect(40,100,100,26,13):ctx.rect(40,100,100,26);ctx.fill();
    ctx.fillStyle='white';ctx.font='bold 12px -apple-system,Arial,sans-serif';
    ctx.fillText(modeLabel,52,118);

    // Game code + date
    ctx.fillStyle=dark?'rgba(255,255,255,.35)':'rgba(0,0,0,.35)';
    ctx.font='12px -apple-system,Arial,sans-serif';
    const dateStr=new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    ctx.fillText('Game '+S.gameCode+'  \u00B7  '+dateStr,152,117);

    // Map area with trails
    const mapX=40,mapY=140,mapW=W-80,mapH=220;
    ctx.save();
    ctx.beginPath();ctx.roundRect?ctx.roundRect(mapX,mapY,mapW,mapH,12):ctx.rect(mapX,mapY,mapW,mapH);ctx.clip();
    ctx.fillStyle=dark?'#0f1a2a':'#d4e8f0';ctx.fillRect(mapX,mapY,mapW,mapH);

    if(S.resMap){
      try{
        const bounds=S.resMap.getBounds();
        const toXY=function(lat,lon){
          const south=bounds.getSouth(),north=bounds.getNorth();
          const west=bounds.getWest(),east=bounds.getEast();
          const latRad=lat*Math.PI/180;
          const mercN=Math.log(Math.tan(Math.PI/4+latRad/2));
          const mercS=Math.log(Math.tan(Math.PI/4+south*Math.PI/360));
          const mercN2=Math.log(Math.tan(Math.PI/4+north*Math.PI/360));
          const nx=(lon-west)/(east-west);
          const ny=1-(mercN-mercS)/(mercN2-mercS);
          return[mapX+nx*mapW,mapY+ny*mapH];
        };
        // Draw trails
        const drawTrail=function(trail,color,weight){
          if(trail.length<2)return;
          ctx.strokeStyle=color;ctx.lineWidth=weight;ctx.lineCap='round';ctx.lineJoin='round';
          ctx.beginPath();
          trail.forEach(function(pt,i){
            var xy=toXY(pt[0],pt[1]);
            i?ctx.lineTo(xy[0],xy[1]):ctx.moveTo(xy[0],xy[1]);
          });
          ctx.stroke();
        };
        // Other player trails
        Object.entries(S.playerTrails).forEach(function(entry){
          var trail=entry[1];
          var idx=parseInt(entry[0])||0;
          if(trail.length>1)drawTrail(trail,PCOLS[idx%PCOLS.length],2);
        });
        // My trail
        if(S.myTrail.length>1)drawTrail(S.myTrail,'#34C759',2.5);
        // Target pin
        if(S.targetLat!=null){
          var tp=toXY(S.targetLat,S.targetLon);
          ctx.fillStyle='#007AFF';ctx.beginPath();ctx.arc(tp[0],tp[1],8,0,Math.PI*2);ctx.fill();
          ctx.fillStyle='white';ctx.beginPath();ctx.arc(tp[0],tp[1],4,0,Math.PI*2);ctx.fill();
        }
        // Start pin
        if(S.myTrail.length>0){
          var sp=toXY(S.myTrail[0][0],S.myTrail[0][1]);
          ctx.fillStyle='#8e8e93';ctx.beginPath();ctx.arc(sp[0],sp[1],5,0,Math.PI*2);ctx.fill();
        }
      }catch(_){}
    }
    ctx.restore();
    // Map border
    ctx.strokeStyle=dark?'rgba(255,255,255,.08)':'rgba(0,0,0,.08)';ctx.lineWidth=1;
    ctx.beginPath();ctx.roundRect?ctx.roundRect(mapX,mapY,mapW,mapH,12):ctx.rect(mapX,mapY,mapW,mapH);ctx.stroke();

    // Winner section
    var winY=mapY+mapH+28;
    if(S.teamsMode){
      // Find which team won
      var teamWinner='';
      var allP=S.latestPlayers?Object.values(S.latestPlayers):[];
      var redArr=allP.some(function(p){return p.team==='red'&&p.arrived;});
      var blueArr=allP.some(function(p){return p.team==='blue'&&p.arrived;});
      if(redArr&&!blueArr)teamWinner='Red Team';
      else if(blueArr&&!redArr)teamWinner='Blue Team';
      else if(redArr&&blueArr)teamWinner='Both Teams';
      if(teamWinner){
        ctx.fillStyle=dark?'rgba(255,255,255,.85)':'rgba(0,0,0,.85)';
        ctx.font='bold 14px -apple-system,Arial,sans-serif';
        ctx.fillText('Team Winner',40,winY);
        ctx.fillStyle='#FF3B30';ctx.font='bold 22px -apple-system,Arial,sans-serif';
        ctx.fillText(teamWinner,40,winY+28);
      }
    } else {
      var winnerRow=el('winner-row');
      var winnerName=el('res-name')?el('res-name').textContent:'—';
      var winnerTime=el('res-time')?el('res-time').textContent:'—';
      ctx.fillStyle=dark?'rgba(255,255,255,.85)':'rgba(0,0,0,.85)';
      ctx.font='bold 14px -apple-system,Arial,sans-serif';
      ctx.fillText('Winner',40,winY);
      ctx.fillStyle='#34C759';ctx.font='bold 22px -apple-system,Arial,sans-serif';
      ctx.fillText(winnerName,40,winY+28);
      ctx.fillStyle=dark?'rgba(255,255,255,.5)':'rgba(0,0,0,.5)';
      ctx.font='16px "SF Mono","Menlo",monospace';
      ctx.fillText(winnerTime,40,winY+50);
    }

    // Stats row
    var statY=winY+(S.teamsMode?65:75);
    var stats=[
      [el('stat-dist')?el('stat-dist').textContent:'—','Distance'],
      [el('stat-time')?el('stat-time').textContent:'—','Best Time'],
      [el('stat-players')?el('stat-players').textContent:'—','Players']
    ];
    // Add efficiency if available
    var effText='';
    if(S.myTrail.length>1){
      var walked=0;
      for(var i=1;i<S.myTrail.length;i++)walked+=hav(S.myTrail[i-1][0],S.myTrail[i-1][1],S.myTrail[i][0],S.myTrail[i][1]);
      var eff=S.startDist&&walked>0?Math.min(100,Math.round((S.startDist/walked)*100)):null;
      effText=eff?eff+'%':'';
    }
    if(effText){
      stats.push([effText,'Efficiency']);
    }
    var statW=stats.length===4?135:170;
    stats.forEach(function(s,i){
      var sx=40+i*statW;
      ctx.fillStyle=dark?'rgba(255,255,255,.85)':'rgba(0,0,0,.85)';
      ctx.font='bold 16px "SF Mono","Menlo",monospace';ctx.fillText(s[0],sx,statY);
      ctx.fillStyle=dark?'rgba(255,255,255,.38)':'rgba(0,0,0,.38)';
      ctx.font='11px -apple-system,Arial,sans-serif';ctx.fillText(s[1],sx,statY+16);
    });

    // Leaderboard
    var lbY=statY+36;
    ctx.fillStyle=dark?'rgba(255,255,255,.5)':'rgba(0,0,0,.5)';
    ctx.font='bold 12px -apple-system,Arial,sans-serif';
    ctx.fillText('Leaderboard',40,lbY);
    lbY+=20;

    var rows2=el('result-rows');
    if(rows2){
      rows2.querySelectorAll('.rr-row').forEach(function(row,i){
        var dot=row.querySelector('.rr-dot');
        var col2=dot&&dot.style.background?dot.style.background:PCOLS[i%PCOLS.length];
        var nameEl=row.querySelector('.rr-name');
        var timeEl=row.querySelector('.rr-time');
        var name=nameEl?nameEl.textContent:'';
        var time=timeEl?timeEl.textContent:'';
        // Dot
        ctx.fillStyle=col2;ctx.beginPath();ctx.arc(50,lbY-3,5,0,Math.PI*2);ctx.fill();
        // Name
        ctx.fillStyle=i===0?(dark?'rgba(255,255,255,.92)':'rgba(0,0,0,.9)'):(dark?'rgba(255,255,255,.7)':'rgba(0,0,0,.7)');
        ctx.font=(i===0?'bold ':'')+'14px -apple-system,Arial,sans-serif';
        ctx.fillText(name,64,lbY);
        // Time
        ctx.textAlign='right';
        ctx.fillStyle=i===0?'#34C759':(dark?'rgba(255,255,255,.45)':'rgba(0,0,0,.45)');
        ctx.font='bold 13px "SF Mono","Menlo",monospace';
        ctx.fillText(time,W-40,lbY);
        ctx.textAlign='left';
        lbY+=26;
      });
    }

    // Footer
    ctx.fillStyle=dark?'rgba(255,255,255,.15)':'rgba(0,0,0,.12)';
    ctx.font='11px -apple-system,Arial,sans-serif';
    ctx.fillText(location.host,40,H-24);
    ctx.textAlign='right';
    ctx.fillText('You know how far. You don\'t know where.',W-40,H-24);
    ctx.textAlign='left';

    canvas.toBlob(async function(blob){
      if(!blob)return;
      var file=new File([blob],'luftlinie-result.png',{type:'image/png'});
      if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
        await navigator.share({files:[file],title:'Luftlinie Result'});
      } else {
        var a=document.createElement('a');
        a.href=URL.createObjectURL(blob);a.download='luftlinie-result.png';a.click();
        toast('Result saved!');
      }
    },'image/png');
  }catch(e){ toast('Could not generate share card'); }
}

/* ── ADVANCED OPTIONS TOGGLE ─────────────────────────────── */
function toggleAdvanced(){
  const toggle=el('adv-toggle');
  const section=el('adv-section');
  if(!toggle||!section)return;
  const open=section.classList.toggle('open');
  toggle.classList.toggle('open',open);toggle.setAttribute('aria-expanded',String(open));section.inert=!open;
  haptic('light');
}

/* ── EXPOSE ──────────────────────────────────────────────── */
window.toggleTheme=toggleTheme;
const App={
  setMode,setTransportMode,setDiff,setRadius,setRole,setHostRole,setElimMode,setBlindStart,setBlindFinish,setExcludeHost,setGameMode,setTeamsMode,setTeam,updateGoMapBtn,upSetup,toggleAdvanced,
  goMap,smartPick,confirmTarget,enableCompass,
  copyLink,copyCodeTap,showQR,hideQR,lockStart,toggleMyView,goHostView,leaveOrHostView,abortGame,confirmAbort,cancelAbort,
  joinGame,leaveGame,
  manualRefresh,dismissSpeed,showResults,shareResult,
  toggleSound,playReplay,watchAfterElim,
  toggleMapOrientation,
  dismissRejoin,doRejoin,
  approveSpec,denySpec,
  pwaInstall,pwaDismiss,
  goHome,
};
const Nav={go:goScreen};

window.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('.mode-card,.adv-toggle,.stats-card-header').forEach(control=>{control.tabIndex=0;control.setAttribute('role','button');control.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();control.click();}});});
  document.querySelectorAll('button[title]').forEach(button=>button.setAttribute('aria-label',button.title));
  document.querySelectorAll('.star').forEach(button=>button.setAttribute('aria-label',DIFF.labels[+button.dataset.v]));
  el('inp-code').addEventListener('keydown',event=>{if(event.key==='Enter')el('inp-name').focus();});
  el('inp-name').addEventListener('keydown',event=>{if(event.key==='Enter')joinGame();});
  if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
  const labels={'as-abort':'End game','qr-sheet':'Scan to join','ov-cd':'Get ready','ov-speed':'Travel reminder','ov-eliminated':'You were eliminated','ov-arrive':'Target reached'};
  const dialogs=Object.entries(labels).map(([id,label])=>{const dialog=el(id);dialog.setAttribute('role','dialog');dialog.setAttribute('aria-label',label);dialog.setAttribute('aria-modal','true');dialog.tabIndex=-1;return dialog;});
  let activeDialog=null,returnFocus=null;
  const focusables=dialog=>[...dialog.querySelectorAll('button,a[href],input,[tabindex="0"]')].filter(node=>!node.disabled&&!node.closest('.hidden'));
  const syncDialog=()=>{
    const next=dialogs.find(dialog=>!dialog.classList.contains('hidden'))||null;
    document.querySelectorAll('.sc').forEach(screen=>{screen.inert=!!next||screen.id!=='sc-'+S.screen;});
    if(next===activeDialog)return;
    if(next){if(!activeDialog)returnFocus=document.activeElement;activeDialog=next;(focusables(next)[0]||next).focus({preventScroll:true});}
    else{activeDialog=null;if(returnFocus?.isConnected&&!returnFocus.closest('[inert],.hidden'))returnFocus.focus({preventScroll:true});returnFocus=null;}
  };
  const observer=new MutationObserver(syncDialog);dialogs.forEach(dialog=>observer.observe(dialog,{attributes:true,attributeFilter:['class']}));syncDialog();
  document.addEventListener('keydown',event=>{
    if(!activeDialog)return;
    if(event.key==='Escape'){
      if(activeDialog.id==='as-abort')cancelAbort();else if(activeDialog.id==='qr-sheet')hideQR();else if(activeDialog.id==='ov-speed')dismissSpeed();
      return;
    }
    if(event.key==='Tab'){
      const items=focusables(activeDialog),first=items[0]||activeDialog,last=items[items.length-1]||activeDialog;
      if(event.shiftKey&&(document.activeElement===first||document.activeElement===activeDialog)){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===activeDialog)){event.preventDefault();first.focus();}
    }
  });
});
