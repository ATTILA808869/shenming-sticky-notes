const arena=document.querySelector('#arena'),ink=arena.getContext('2d');
const combatArt=NezhaCombatArt.create(ink);
const linkState=document.querySelector('#link-state'),retry=document.querySelector('#retry');
const hud=NezhaUi.mountHud(document,NezhaRules);
const {setText:text}=NezhaUi;
const upgradeToggle=hud.spend,upgradePanel=document.querySelector('#upgrade-panel');
const upgradeTitle=document.querySelector('#upgrade-title'),upgradeOptions=document.querySelector('#upgrade-options');
const upgradeDetail=document.querySelector('#upgrade-detail');
const rankSave=document.querySelector('#rank-save'),scoreStatus=document.querySelector('#score-status');
const menu=document.querySelector('#room-menu'),menuStatus=document.querySelector('#room-menu-status');
const team=document.querySelector('#team-status'),teamName=document.querySelector('#team-name');
const teamHealth=document.querySelector('#team-health'),teamHP=document.querySelector('#team-hp');
const nickname=document.querySelector('#nickname');
const updateLog=NezhaUi.mountUpdateLog(document,release);
const art={nezha:new Image(),jigong:new Image()};
art.nezha.src='/games/nezha/nezha-sheet.png';
art.jigong.src='/games/nezha/jigong-attack-sheet.png';
const keys=new Set();
let state=null,me=null,socket=null,touch=null,retryTimer=null,tries=0,joining=false,permanent=false,inputKey='';
let rewardKey=null,choosing=null,submittedFloor=-1,resultPending=false,resultRequestTimer,resultProof=null,scoreTimer;
let zoom=1,pinch=null;
let receivedAt=0,endingAt=null;
const fingers=new Map();

function movement(){
  if(touch)return [touch.x,touch.y];
  return [Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft')),
    Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'))];
}
function sendInput(){
  if(socket?.readyState!==WebSocket.OPEN||!me)return;
  const [x,y]=movement();
  const key=x+':'+y;
  if(key!==inputKey){inputKey=key;socket.send(JSON.stringify({type:'move',x,y}));}
}
const moveKeys=new Set(['a','d','w','s','arrowleft','arrowright','arrowup','arrowdown']);
window.addEventListener('keydown',event=>{
  const key=event.key.toLowerCase();
  if(event.ctrlKey||event.altKey||event.metaKey||updateLog.open)return;
  if(menu.open){
    if(!event.repeat&&key==='1'){event.preventDefault();menu.close();}
    if(!event.repeat&&key==='2'){event.preventDefault();leaveRoom();}
    return;
  }
  if(key==='escape'&&!event.repeat){
    event.preventDefault();
    if(!upgradePanel.hidden)openUpgrade(false,true);
    else openMenu();
    return;
  }
  if(key==='l'&&!event.repeat&&!upgradeToggle.disabled){event.preventDefault();openUpgrade(upgradePanel.hidden);return;}
  if(!upgradePanel.hidden&&/^[1-8]$/.test(key)&&!event.repeat){
    event.preventDefault();upgradeOptions.children[Number(key)-1]?.click();return;
  }
  if(moveKeys.has(key)){event.preventDefault();keys.add(key);sendInput();}
});
window.addEventListener('keyup',event=>{keys.delete(event.key.toLowerCase());sendInput();});
function release(){touch=null;pinch=null;fingers.clear();keys.clear();sendInput();}
function openMenu(){release();openUpgrade(false);if(!menu.open)menu.showModal();}
function leaveRoom(){permanent=true;release();location.replace('/games/nezha/game');}
document.querySelector('#pause').onclick=openMenu;
document.querySelector('#continue-room').onclick=()=>menu.close();
document.querySelector('#leave-room').onclick=leaveRoom;
document.querySelector('#logout').onclick=async()=>{
  release();
  try{
    const response=await fetch('/games/nezha/api/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    if(!response.ok)throw new Error('暫時無法登出。');
    permanent=true;location.replace('/games/nezha');
  }catch(error){scoreMessage(error.message);}
};
window.addEventListener('blur',release);
window.addEventListener('pagehide',()=>{
  release();
  if(socket){permanent=true;socket.close();}
});
window.addEventListener('pageshow',event=>{if(event.persisted){permanent=false;void join();}});
arena.addEventListener('pointerdown',event=>{
  if(fingers.size>=2)return;
  arena.setPointerCapture(event.pointerId);
  const point={id:event.pointerId,fromX:event.clientX,fromY:event.clientY,clientX:event.clientX,clientY:event.clientY,x:0,y:0};
  fingers.set(event.pointerId,point);
  if(fingers.size===1)touch=point;
  else{
    const [a,b]=fingers.values();
    pinch={distance:Math.max(20,Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)),zoom};
    touch=null;sendInput();
  }
});
arena.addEventListener('pointermove',event=>{
  const point=fingers.get(event.pointerId);
  if(!point)return;
  point.clientX=event.clientX;point.clientY=event.clientY;
  if(pinch){
    const [a,b]=fingers.values();
    zoom=Math.max(.75,Math.min(1.5,pinch.zoom*Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)/pinch.distance));
  }else if(touch){
    touch.x=(event.clientX-touch.fromX)/34;touch.y=(event.clientY-touch.fromY)/34;
  }
});
for(const type of ['pointerup','pointercancel','lostpointercapture'])arena.addEventListener(type,event=>{
  if(!fingers.delete(event.pointerId))return;
  pinch=null;touch=fingers.values().next().value??null;
  if(touch){touch.fromX=touch.clientX;touch.fromY=touch.clientY;touch.x=touch.y=0;}
  sendInput();
});
setInterval(sendInput,50);

function openUpgrade(open,restoreFocus=false){
  upgradePanel.hidden=!open;upgradeToggle.setAttribute('aria-expanded',String(open));
  if(open)upgradeOptions.querySelector('button:enabled')?.focus({preventScroll:true});
  if(restoreFocus&&!upgradeToggle.disabled)upgradeToggle.focus({preventScroll:true});
}
upgradeToggle.onclick=()=>openUpgrade(upgradePanel.hidden);
document.querySelector('#upgrade-close').onclick=()=>openUpgrade(false,true);
function showReward(reward){
  if(!reward){upgradeToggle.disabled=true;openUpgrade(false);rewardKey=null;return;}
  text(upgradeDetail,'剩餘 '+reward.remaining+' 次強化');
  if(rewardKey===reward.id)return;
  rewardKey=reward.id;choosing=null;
  text(upgradeTitle,reward.title);
  const restoreFocus=upgradeOptions.contains(document.activeElement);
  upgradeOptions.replaceChildren(...reward.options.map(option=>{
    const button=document.createElement('button');button.type='button';button.textContent=(option.id+1)+'　'+option.label;button.disabled=!option.enabled;
    button.onclick=()=>{
      if(choosing===reward.id||socket?.readyState!==WebSocket.OPEN)return;
      choosing=reward.id;upgradeOptions.setAttribute('aria-busy','true');
      socket.send(JSON.stringify({type:'pick',rewardId:reward.id,optionId:option.id}));
      setTimeout(()=>{if(choosing===reward.id){choosing=null;upgradeOptions.removeAttribute('aria-busy');}},1300);
    };
    return button;
  }));
  upgradeOptions.removeAttribute('aria-busy');
  if(restoreFocus)upgradeOptions.querySelector('button:not(:disabled)')?.focus();
}
function scoreMessage(message){
  clearTimeout(scoreTimer);text(scoreStatus,message);scoreStatus.hidden=false;
  scoreTimer=setTimeout(()=>{scoreStatus.hidden=true;},5000);
}
function requestResult(){
  if(resultPending)return;
  if(socket?.readyState!==WebSocket.OPEN){if(resultProof)void persistResult(resultProof);return;}
  resultPending=true;rankSave.disabled=true;
  socket.send(JSON.stringify({type:'result'}));
  resultRequestTimer=setTimeout(()=>{resultPending=false;rankSave.disabled=false;rankSave.hidden=false;},4500);
}
rankSave.onclick=requestResult;
async function persistResult(proof){
  clearTimeout(resultRequestTimer);
  if(!proof){resultPending=false;rankSave.disabled=false;rankSave.hidden=!state?.cleared;return;}
  resultProof=proof;resultPending=true;rankSave.disabled=true;
  try{
    const expected=state?.cleared??0;
    const response=await fetch('/games/nezha/api/battle-result',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({proof,publish:true})
    });
    const result=await response.json();
    if(!response.ok)throw new Error(result.error??'暫時無法儲存成績。');
    submittedFloor=Math.max(submittedFloor,result.cleared??expected);rankSave.hidden=true;
    if(expected)scoreMessage(result.updated?'已更新共用排行榜':'已保留較高的排行榜紀錄');
    else scoreMessage('已進入無限塔，濟公禪師解鎖資格已確認');
  }catch(error){rankSave.hidden=false;scoreMessage(error.message);}
  finally{resultPending=false;rankSave.disabled=false;}
}
function endRound(){
  if(endingAt!==null)return;
  endingAt=performance.now();
  release();openUpgrade(false);
  if(menu.open)menu.close();
  if(updateLog.open)updateLog.close();
  const waitForResult=()=>{
    if(state?.floor&&state.cleared>submittedFloor&&!resultPending&&rankSave.hidden)requestResult();
    if(resultPending&&performance.now()-endingAt<6500){setTimeout(waitForResult,200);return;}
    leaveRoom();
  };
  setTimeout(waitForResult,1600);
}
function show(state){
  const guardian=state.enemies.find(enemy=>enemy.guardian);
  const activeCast=state.warnings?.find(w=>w.name&&state.floor)?.name;
  const local=state.players.find(p=>p.id===me);
  const reward=state.state==='live'?state.reward:null;
  if(local){
    const display=local.qi?local:{...NezhaRules.createCharacter(local.character),...local};
    text(nickname,local.name);
    hud.render({player:display,time:state.storyTime??state.time,floor:state.floor,floorKills:state.stageKills,
      waveIndex:state.nextWave,boss:guardian,bossCast:activeCast,needed:local.needed??NezhaRules.levelCost(local.level+1),
      kills:state.kills,ready:reward?.remaining??0});
  }
  const partner=state.players.find(p=>p.id!==me);
  team.hidden=!partner;
  if(partner){
    text(teamName,partner.name+' · Lv.'+partner.level);
    text(teamHealth,!partner.connected?'離線':partner.hp?partner.hp+'/'+partner.maxHp:partner.revive?'救援 '+Math.floor(100*partner.revive)+'%':'倒地');
    teamHP.max=partner.maxHp??100;teamHP.value=partner.hp;
  }
  const messages={waiting:'等待隊友進入同一房間…',won:'本局結束，返回大廳…',lost:'雙人戰鬥結束，返回大廳…',closed:'房間已結束'};
  const rescue=local?.hp===0?(local.revive?'接受隊友救援…':'倒地・等待隊友救援'):
    partner?.hp===0&&partner.connected?(partner.revive?'正在救援隊友…':'隊友倒地・靠近可救援'):'';
  const loot=state.pickupNotice;
  const effect=loot?.kind==='bomb'?'炸彈 · 擊退 '+loot.count+' 隻':loot?.kind==='heal'?'隊伍生命恢復':loot?.kind==='magnet'?'全場戰利品吸取':'';
  text(linkState,messages[state.state]??(state.transitioning?'進入第 '+state.floor+' 層':rescue||effect));
  text(menuStatus,state.state==='waiting'?'等待隊友進入同一房間。':'線上戰鬥不會暫停。');
  showReward(reward);
  if(state.floor&&state.cleared>submittedFloor&&!resultPending&&rankSave.hidden)requestResult();
  if(state.state==='lost'||state.state==='won')endRound();
}
function circle(x,y,r,fill,stroke,line=2){
  ink.beginPath();ink.arc(x,y,r,0,Math.PI*2);
  if(fill){ink.fillStyle=fill;ink.fill();}
  if(stroke){ink.strokeStyle=stroke;ink.lineWidth=line;ink.stroke();}
}
function drawEnemy(e,time){
  const kind=e.kind??(e.guardian?'boss':'shade');
  combatArt.enemyActor({...e,r:e.radius,mini:kind==='mini'},time,kind,e.guardian);
}
const frames={idle:[0,319,668],fly:[1,313,659],attack:[2,387,663]};
function drawPlayer(p,seconds){
  const img=art[p.character],jigong=p.character==='jigong',frame=jigong?840:724;
  const pose=p.attacking?'attack':p.moving?'fly':'idle';
  const [column,ax,ay]=jigong?[p.attacking?(p.attackAge<.1?0:p.attackAge<.185?1:2):0,485,675]:frames[pose];
  const factor=78/724,hover=p.attacking?0:Math.round(Math.sin(seconds*(p.moving?15:5))*(p.moving?3:1));
  if(p.protected)circle(p.x,p.y,23,'#8be6ae26','#94e8be',2);
  ink.globalAlpha=p.hp===0?.45:p.connected?1:.55;
  if(img?.complete&&img.naturalWidth){
    ink.save();ink.translate(Math.round(p.x),Math.round(p.y+7+hover));
    if((p.attacking?p.attackFacing:p.facing)>0)ink.scale(-1,1);
    const cell=Math.min(column,Math.max(0,Math.floor(img.naturalWidth/frame)-1));
    ink.drawImage(img,cell*frame,0,frame,724,-ax*factor,-ay*factor,frame*factor,78);ink.restore();
  }else{ink.fillStyle='#ffd080';ink.fillRect(p.x-11,p.y-11,22,22);}
  ink.globalAlpha=1;
  ink.fillStyle='#332e32';ink.fillRect(p.x-22,p.y+12,44,7);
  ink.fillStyle=p.hp===0?'#8be6ae':p.id===me?'#92dfba':'#ffd080';
  ink.fillRect(p.x-22,p.y+12,44*(p.hp===0?(p.revive??0):Math.min(1,p.hp/(p.maxHp??100))),5);
  if(p.hp===0&&p.connected){
    const r=state.reviveRadius??96;
    circle(p.x,p.y,r,p.revive?'#8be6ae22':null,p.revive?'#93e9bb':'#f0c78e88');
    ink.fillStyle='#fff0d7';ink.font='bold 14px system-ui';ink.textAlign='center';
    ink.fillText(p.revive?'救援 '+Math.floor(p.revive*100)+'%':'倒地',p.x,p.y+35);
  }
}
function drawEffect(effect,time){
  const {kind,x,y,r}=effect;
  const wheelScale=NezhaRules.wheelEvolutionScale;
  if(kind==='eye')combatArt.eye(effect,time-(effect.startedAt??time),r);
  else if(kind==='ring'||kind==='fire-ring')combatArt.ring({...effect,angle:effect.angle??0,fire:kind==='fire-ring'});
  else if(kind==='wheel'||kind==='fire-wheel')combatArt.wheel(effect,kind==='fire-wheel'?wheelScale:1);
  else if(kind==='wheel-trail')combatArt.flame(effect,wheelScale);
  else if(kind==='brick')combatArt.brick({...effect,fromX:effect.fromX??x,fromY:effect.fromY??y,left:effect.left??0});
  else if(kind==='ingot'){circle(x,y,22,'#ffe59225','#ffdb7a90',2);combatArt.ingot(x,y);}
  else if(kind==='shoe'||kind==='water'||kind==='wind'){
    combatArt.jigong({...effect,index:effect.index??['shoe','water','wind'].indexOf(kind),age:effect.age??0});
  }
}
function drawSpark(s){
  if(s.kind==='bomb'){NezhaWorldArt.bomb(ink,s,NezhaRules.loot.bombFlashTime);return;}
  if(s.kind==='boss-xp'){
    ink.save();ink.globalAlpha=Math.min(1,s.life*2);ink.textAlign='center';ink.textBaseline='bottom';
    ink.font='bold 20px system-ui';ink.lineWidth=4;ink.strokeStyle='#24323c';ink.fillStyle='#ffdc88';
    const y=s.y-30-(1.2-s.life)*26,label='+'+s.value+' XP';
    ink.strokeText(label,s.x,y);ink.fillText(label,s.x,y);ink.restore();return;
  }
  if(s.kind==='heal'||s.kind==='revive'){
    ink.save();ink.globalAlpha=Math.min(1,s.life*2);
    circle(s.x,s.y,s.r,'#8be6ae30','#91e7b4');
    ink.textAlign='center';ink.textBaseline='middle';ink.font='bold 20px system-ui';ink.fillStyle='#b2f3c5';
    ink.fillText('+',s.x,s.y);ink.restore();return;
  }
  if(s.kind==='ring-burst'){
    const fade=s.life/NezhaRules.ringExplosionLife;
    ink.save();ink.globalAlpha=fade;circle(s.x,s.y,s.r,'#f57a4d22','#ffe19a');
    NezhaWorldArt.star(ink,s.x,s.y,Math.min(28,s.r*.52)*(1+(1-fade)*.25),'#ffb96f');
    ink.restore();return;
  }
  if(s.r>10)circle(s.x,s.y,s.r,null,'#ffdb8ba8',3);
  else NezhaWorldArt.star(ink,s.x,s.y,8+s.life*35,'#fff1bf');
}
function drawPartnerMarker(p,x,y,w,h){
  if(!p?.connected||x>=18&&x<=w-18&&y>=18&&y<=h-18)return;
  const cx=w/2,cy=h/2,dx=x-cx,dy=y-cy;
  const horizontal=Math.abs(dx)>0?(cx-32)/Math.abs(dx):Infinity;
  const vertical=Math.abs(dy)>0?Math.max(16,cy-(h>360?112:68))/Math.abs(dy):Infinity;
  const t=Math.min(horizontal,vertical),px=cx+dx*t,py=cy+dy*t;
  const color=p.hp>0?'#8ad4b5':'#f78e7c';
  ink.save();ink.translate(px,py);
  ink.fillStyle='#17252ff2';ink.strokeStyle=color;ink.lineWidth=2;
  ink.beginPath();ink.arc(0,0,16,0,Math.PI*2);ink.fill();ink.stroke();
  ink.save();ink.rotate(Math.atan2(dy,dx));
  ink.fillStyle=color;ink.beginPath();ink.moveTo(8,0);ink.lineTo(-4,-5);ink.lineTo(-4,5);ink.closePath();ink.fill();ink.restore();
  if(p.hp===0){
    ink.textBaseline='top';ink.textAlign='center';ink.font='bold 11px system-ui';ink.fillStyle=color;
    ink.fillText('倒地',0,19);
  }
  ink.restore();
}
function paint(now){
  const density=Math.min(window.devicePixelRatio||1,2);
  const w=Math.max(1,Math.round(arena.clientWidth*density)),h=Math.max(1,Math.round(arena.clientHeight*density));
  if(w!==arena.width||h!==arena.height){arena.width=w;arena.height=h;}
  ink.setTransform(1,0,0,1,0,0);ink.fillStyle='#263c42';ink.fillRect(0,0,w,h);
  if(state){
    const portrait=w/h<.85;
    const step=state.state==='live'?Math.min(.05,Math.max(0,(now-receivedAt)/1000)):0;
    const time=(state.clock??state.time)+step;
    const scale=Math.max(w/1250,h/(portrait?1000:920))*zoom;
    const vw=w/scale,vh=h/scale,focus=state.players.find(p=>p.id===me);
    const left=Math.max(0,Math.min(state.width-vw,(focus?.x??state.width/2)-vw/2));
    const top=Math.max(0,Math.min(state.height-vh,(focus?.y??state.height/2)-vh/2));
    const ox=vw>state.width?(w-state.width*scale)/2:-left*scale;
    const oy=vh>state.height?(h-state.height*scale)/2:-top*scale;
    ink.translate(Math.round(ox),Math.round(oy));ink.scale(scale,scale);ink.imageSmoothingEnabled=false;
    const view={x:left,y:top,width:vw,height:vh};
    const visible=p=>p.x>=left-150&&p.x<=left+vw+150&&p.y>=top-150&&p.y<=top+vh+150;
    NezhaWorldArt.background(ink,view,state.width,state.height,time);
    const effects=state.effects??[];
    for(const effect of effects)if(effect.kind==='eye'&&visible(effect))drawEffect(effect,time);
    for(const warning of state.warnings??[])for(const mark of warning.marks)if(visible(mark)){
      combatArt.warning(mark.x,mark.y,mark.r,warning.charge);
    }
    for(const e of state.enemies)if(e.aim&&visible(e))combatArt.aim(e,e.aim);
    for(const item of state.loot??[])if(visible(item)){
      if(item.kind==='xp')NezhaWorldArt.gem(ink,item.x,item.y);
      else NezhaWorldArt.drop(ink,item.x,item.y,item.kind);
    }
    for(const effect of effects)if(effect.kind==='ingot'&&visible(effect))drawEffect(effect,time);
    for(const e of state.enemies)if(visible(e))drawEnemy(e,time);
    for(const bolt of state.bolts)if(!bolt.hostile&&visible(bolt)){
      combatArt.qi({...bolt,angle:bolt.angle??0,basePower:bolt.ingot?1:null});
    }
    for(const effect of effects)if(effect.kind==='wheel-trail'&&visible(effect))drawEffect(effect,time);
    for(const effect of effects)if(!['eye','ingot','wheel-trail'].includes(effect.kind)&&visible(effect))drawEffect(effect,time);
    const roster=new Map(state.players.map(p=>[p.id,p]));
    NezhaWorldArt.magnet(ink,view,time,state.magnetPulses??[],state.magnetFlights??[],item=>roster.get(item.target),
      NezhaRules.loot.magnetPulseTime);
    for(const bolt of state.bolts)if(bolt.hostile&&visible(bolt)){
      combatArt.enemyShot({...bolt,radius:bolt.r,dx:bolt.dx??0,dy:bolt.dy??0});
    }
    for(const p of state.players)if(visible(p))drawPlayer(p,time);
    for(const spark of state.sparks??[])if(visible(spark))drawSpark(spark);
    ink.setTransform(density,0,0,density,0,0);
    const partner=state.players.find(p=>p.id!==me);
    if(partner)drawPartnerMarker(partner,(partner.x*scale+ox)/density,(partner.y*scale+oy)/density,w/density,h/density);
    if(touch){
      const rect=arena.getBoundingClientRect(),x=touch.fromX-rect.left,y=touch.fromY-rect.top;
      const d=Math.max(1,Math.hypot(touch.x,touch.y));
      circle(x,y,34,'#38244a66','#fff4db99');
      circle(x+touch.x/d*25,y+touch.y/d*25,13,'#ffd88ed9');
    }
  }
  requestAnimationFrame(paint);
}
function reconnect(){
  if(permanent||retryTimer||endingAt!==null)return;
  retry.hidden=false;
  text(linkState,'連線中斷，正在嘗試重連…');
  retryTimer=setTimeout(()=>{retryTimer=null;void join();},Math.min(5000,750*2**Math.min(tries++,3)));
}
async function join(){
  if(joining||permanent||socket?.readyState===WebSocket.OPEN||socket?.readyState===WebSocket.CONNECTING)return;
  joining=true;retry.hidden=true;me=null;inputKey='';
  try{
    const response=await fetch('/games/nezha/api/battle-ticket',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    const info=await response.json();
    if(!response.ok){
      if(response.status<500)permanent=true;
      throw new Error(info.error??'無法取得房間連線。');
    }
    const connection=new WebSocket(info.url);
    socket=connection;
    connection.addEventListener('open',()=>connection.send(JSON.stringify({type:'join',ticket:info.ticket})));
    connection.addEventListener('message',event=>{
      if(socket!==connection)return;
      let packet;
      try{packet=JSON.parse(event.data);}catch{return;}
      if(packet.type==='joined'){me=packet.player;tries=0;retry.hidden=true;sendInput();}
      if(packet.type==='result')void persistResult(packet.proof);
      if(packet.state){state=packet.state;receivedAt=performance.now();show(state);}
    });
    connection.addEventListener('close',event=>{
      if(socket!==connection)return;
      socket=null;me=null;release();
      showReward(null);
      if(event.code===4004||event.code===4005){
        permanent=true;retry.hidden=true;text(linkState,event.code===4004?'重連保留時間已結束。':'已在另一個頁面連線。');return;
      }
      if(!permanent)reconnect();
    });
  }catch(error){text(linkState,error.message);if(!permanent)reconnect();}
  finally{joining=false;}
}
retry.onclick=()=>{clearTimeout(retryTimer);retryTimer=null;void join();};
void join();requestAnimationFrame(paint);
