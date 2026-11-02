/* Shared, deterministic game rules. Also loaded directly by the Node tests. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LuftlinieCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const validPoint = (lat,lon) => Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat)<=90 && Math.abs(lon)<=180;
  function distance(a,b,c,d) {
    if (!validPoint(a,b)||!validPoint(c,d)) return NaN;
    const r=Math.PI/180;
    const h=Math.sin((c-a)*r/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin((d-b)*r/2)**2;
    return 6371000*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));
  }
  const checkpointIndex = (value, count=3) => Number.isInteger(value) ? Math.min(Math.max(0,value),Math.max(0,count-1)) : 0;
  function targetFor(game, player) {
    return game.gameMode==='multi' && game.multiTargets?.length
      ? game.multiTargets[checkpointIndex(player.multiCurrent,game.multiTargets.length)]
      : {lat:game.targetLat,lon:game.targetLon};
  }
  function canArrive(distance,accuracy,radius) {
    return Number.isFinite(distance) && distance<=radius && Number.isFinite(accuracy) && accuracy>=0 && accuracy<=Math.max(15,radius);
  }
  function shouldFinish(game,players) {
    if(game.status && game.status!=='active')return false;
    const racers=Object.values(players||{}).filter(p=>p.role==='navigator'&&!p.withdrawn&&!(game.excludeHost&&p.id===game.hostToken));
    const finishers=racers.filter(p=>p.arrived);
    if (!finishers.length) return false;
    return game.gameMode==='elimination'||game.teamsMode||game.blindFinish===false||racers.every(p=>p.arrived||p.eliminated);
  }
  function rankPlayers(players) {
    return [...players].sort((a,b)=>Number(!!b.arrived)-Number(!!a.arrived)
      || (a.arrived ? (a.arrSec??Infinity)-(b.arrSec??Infinity) : Number(!!a.eliminated)-Number(!!b.eliminated)||(b.multiCurrent||0)-(a.multiCurrent||0)||(a.distance??Infinity)-(b.distance??Infinity))
      || String(a.id).localeCompare(String(b.id)));
  }
  const smoothHeading = (previous,next,factor=.25) => previous==null?next:previous+((((next-previous+180)%360+360)%360)-180)*factor;
  const whisperPhase = (now,startedAt) => {const elapsed=Math.max(0,now-startedAt);const phase=elapsed%60000;return {visible:elapsed>=60000&&phase<8000,remaining:Math.ceil((60000-phase)/1000)};};
  function destination(lat,lon,metres,bearing) {
    const r=Math.PI/180, a=metres/6371000, b=bearing*r, p=lat*r;
    const q=Math.asin(Math.sin(p)*Math.cos(a)+Math.cos(p)*Math.sin(a)*Math.cos(b));
    return {lat:q/r,lon:((lon+Math.atan2(Math.sin(b)*Math.sin(a)*Math.cos(p),Math.cos(a)-Math.sin(p)*Math.sin(q))/r+540)%360)-180};
  }
  return {validPoint,distance,checkpointIndex,targetFor,canArrive,shouldFinish,rankPlayers,smoothHeading,whisperPhase,destination};
});
