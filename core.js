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
  // Public, routable ways only. Service roads are kept for driving but driveways, parking aisles and
  // private/no-access ways are excluded so Smart never hides a target on someone's property.
  function overpassQuery(lat,lon,radius,mode) {
    const walk=mode==='walk';
    const types=walk?'footway|path|pedestrian|living_street|residential|unclassified|tertiary|track':'living_street|residential|unclassified|tertiary|service';
    const r=Math.round(Math.max(50,Math.min(3000,radius))), la=(+lat).toFixed(5), lo=(+lon).toFixed(5);
    return '[out:json][timeout:8];way[highway~"^('+types+')$"][access!~"^(private|no|customers|permit|military|restricted|destination|delivery|agricultural|forestry)$"]["'+(walk?'foot':'motor_vehicle')+'"!~"^(no|private)$"][service!~"^(driveway|parking_aisle|drive-through|emergency_access|private)$"][area!=yes](around:'+r+','+la+','+lo+');out geom 60;';
  }
  function roadPointsFrom(data) {
    const points=[];
    for(const way of data?.elements||[]){
      const t=way.tags||{};
      if(t.barrier||t.motorcar==='no'||t.motorcar==='private'||t.indoor==='yes'||t.tunnel==='yes')continue;
      for(const p of way.geometry||[])if(validPoint(p.lat,p.lon))points.push({lat:+p.lat.toFixed(6),lon:+p.lon.toFixed(6)});
    }
    return points;
  }
  // Ramer–Douglas–Peucker on lat/lon in metres-ish space. Keeps trail uploads small (was up to 1500 raw points every 15 s).
  function simplifyTrail(trail,toleranceM=4,maxPoints=400) {
    const pts=(trail||[]).filter(p=>Array.isArray(p)&&validPoint(p[0],p[1]));
    if(pts.length<=2)return pts.map(p=>[+p[0].toFixed(5),+p[1].toFixed(5)]);
    const k=111320, cos=Math.cos(pts[0][0]*Math.PI/180);
    const segDist=(p,a,b)=>{const ax=a[1]*k*cos,ay=a[0]*k,bx=b[1]*k*cos,by=b[0]*k,px=p[1]*k*cos,py=p[0]*k,dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy;let t=l?((px-ax)*dx+(py-ay)*dy)/l:0;t=Math.max(0,Math.min(1,t));return Math.hypot(px-ax-t*dx,py-ay-t*dy);};
    let tol=toleranceM,out;
    do{
      const keep=new Uint8Array(pts.length);keep[0]=keep[pts.length-1]=1;const stack=[[0,pts.length-1]];
      while(stack.length){const [s,e]=stack.pop();let max=0,idx=-1;for(let i=s+1;i<e;i++){const d=segDist(pts[i],pts[s],pts[e]);if(d>max){max=d;idx=i;}}if(max>tol&&idx>0){keep[idx]=1;stack.push([s,idx],[idx,e]);}}
      out=pts.filter((_,i)=>keep[i]);tol*=1.6;
    }while(out.length>maxPoints);
    return out.map(p=>[+p[0].toFixed(5),+p[1].toFixed(5)]);
  }
  function bearing(lat1,lon1,lat2,lon2) {
    const r=Math.PI/180,dLon=(lon2-lon1)*r;
    const y=Math.sin(dLon)*Math.cos(lat2*r), x=Math.cos(lat1*r)*Math.sin(lat2*r)-Math.sin(lat1*r)*Math.cos(lat2*r)*Math.cos(dLon);
    return ((Math.atan2(y,x)/r)+360)%360;
  }
  // Shortest-turn rotation: keeps a CSS-rotated needle from spinning the long way round when crossing north.
  const unwrapAngle = (previous,next) => previous==null?next:previous+((((next-previous+180)%360+360)%360)-180);
  const elimRoundAt = (now,startedAt,period=300000) => startedAt+(Math.floor(Math.max(0,now-startedAt)/period)+1)*period;
  return {validPoint,distance,checkpointIndex,targetFor,canArrive,shouldFinish,rankPlayers,smoothHeading,whisperPhase,destination,overpassQuery,roadPointsFrom,simplifyTrail,bearing,unwrapAngle,elimRoundAt};
});
