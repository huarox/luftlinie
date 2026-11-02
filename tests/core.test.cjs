const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../core.js');
test('distance handles zero coordinates, antipodes and invalid coordinates',()=>{
  assert.equal(C.distance(0,0,0,0),0);
  assert.ok(Math.abs(C.distance(0,0,0,1)-111195)<2);
  assert.ok(Number.isFinite(C.distance(90,0,-90,180)));
  assert.ok(Number.isNaN(C.distance(null,0,0,1)));
});
test('destination keeps metres consistent across latitudes and the date line',()=>{
  for(const lat of [0,48,85]){const p=C.destination(lat,179.99,1500,90);assert.ok(Math.abs(C.distance(lat,179.99,p.lat,p.lon)-1500)<.01);assert.ok(C.validPoint(p.lat,p.lon));}
});
test('each navigator has their own checkpoint',()=>{
  const g={gameMode:'multi',multiTargets:[{lat:1,lon:1},{lat:2,lon:2},{lat:3,lon:3}]};
  assert.equal(C.targetFor(g,{multiCurrent:0}).lat,1);
  assert.equal(C.targetFor(g,{multiCurrent:2}).lat,3);
  assert.equal(C.targetFor(g,{multiCurrent:20}).lat,3);
});
test('arrival requires both proximity and usable GPS accuracy',()=>{
  assert.equal(C.canArrive(20,8,25),true);
  assert.equal(C.canArrive(20,100,25),false);
  assert.equal(C.canArrive(60,5,50),false);
  assert.equal(C.canArrive(0,NaN,50),false);
});
test('blind finish waits for racers but ignores withdrawn players and spectators',()=>{
  const p=[{role:'navigator',arrived:true},{role:'navigator',arrived:false},{role:'spectator'}];
  assert.equal(C.shouldFinish({blindFinish:true},p),false);
  assert.equal(C.shouldFinish({blindFinish:false},p),true);
  p[1].withdrawn=true;assert.equal(C.shouldFinish({blindFinish:true},p),true);
  assert.equal(C.shouldFinish({},[{role:'spectator',arrived:true}]),false);
});
test('teams and elimination end on a valid first finisher',()=>{
  const p=[{role:'navigator',arrived:true},{role:'navigator'}];
  assert.equal(C.shouldFinish({teamsMode:true},p),true);
  assert.equal(C.shouldFinish({gameMode:'elimination'},p),true);
});
test('ranking keeps zero-second arrival first and unfinished players behind finishers',()=>{
  const ranked=C.rankPlayers([{id:'a',arrived:true,arrSec:10},{id:'b',arrived:false},{id:'c',arrived:true,arrSec:0}]);
  assert.deepEqual(ranked.map(p=>p.id),['c','a','b']);
});
test('compass smooths through north and recovers from large turns',()=>{
  assert.equal(C.smoothHeading(null,270),270);
  assert.equal(C.smoothHeading(359,1,.5),360);
  assert.equal(C.smoothHeading(0,90,.5),45);
});
test('whisper windows share the game clock and remain stable across reconnects',()=>{
  assert.equal(C.whisperPhase(59999,0).visible,false);
  assert.equal(C.whisperPhase(60000,0).visible,true);
  assert.equal(C.whisperPhase(68000,0).visible,false);
  assert.deepEqual(C.whisperPhase(122000,0),{visible:true,remaining:58});
});
