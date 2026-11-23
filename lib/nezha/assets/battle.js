const arena=document.querySelector('#battle-arena'),ink=arena.getContext('2d');
const stage=document.querySelector('#stage'),linkState=document.querySelector('#link-state');
const players=document.querySelector('#players'),retry=document.querySelector('#retry');
const upgradeToggle=document.querySelector('#upgrade-toggle'),upgradePanel=document.querySelector('#upgrade-panel');
const upgradeTitle=document.querySelector('#upgrade-title'),upgradeOptions=document.querySelector('#upgrade-options');
const rankSave=document.querySelector('#rank-save'),scoreStatus=document.querySelector('#score-status');
const art={nezha:new Image(),jigong:new Image()};
art.nezha.src='/games/nezha/nezha-sheet.png';
art.jigong.src='/games/nezha/jigong-attack-sheet.png';
const keys=new Set();
let state=null,me=null,socket=null,touch=null,retryTimer=null,tries=0,joining=false,permanent=false,inputKey='';
let rewardKey=null,choosing=null,submittedFloor=-1,resultPending=false,resultRequestTimer,resultProof=null,scoreTimer;
let zoom=1,pinch=null;
const fingers=new Map(),enemySprites=new Map();

function text(node,value){if(node.textContent!==value)node.textContent=value;}
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
  if(moveKeys.has(key)){event.preventDefault();keys.add(key);sendInput();}
});
window.addEventListener('keyup',event=>{keys.delete(event.key.toLowerCase());sendInput();});
function release(){touch=null;pinch=null;fingers.clear();keys.clear();sendInput();}
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
  if(restoreFocus&&!upgradeToggle.hidden)upgradeToggle.focus();
}
upgradeToggle.onclick=()=>openUpgrade(upgradePanel.hidden);
document.querySelector('#upgrade-close').onclick=()=>openUpgrade(false,true);
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&!upgradePanel.hidden)openUpgrade(false,true);});
function showReward(reward){
  upgradeToggle.hidden=!reward;
  if(!reward){openUpgrade(false);rewardKey=null;return;}
  text(upgradeToggle,'強化 ×'+reward.remaining);
  if(rewardKey===reward.id)return;
  rewardKey=reward.id;choosing=null;
  text(upgradeTitle,reward.title);
  const restoreFocus=upgradeOptions.contains(document.activeElement);
  upgradeOptions.replaceChildren(...reward.options.map(option=>{
    const button=document.createElement('button');button.type='button';button.textContent=option.label;button.disabled=!option.enabled;
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
const clock=value=>Math.floor(value/60)+':'+String(value%60).padStart(2,'0');
function show(state){
  if(players.children.length!==state.players.length)players.replaceChildren(...state.players.map(()=>{
    const row=document.createElement('li');row.append(document.createElement('span'),document.createElement('span'));return row;
  }));
  state.players.forEach((p,index)=>{
    const row=players.children[index];
    text(row.firstElementChild,p.name+(p.id===me?'（你）':''));
    text(row.lastElementChild,'Lv.'+p.level+'　HP '+p.hp+'/'+(p.maxHp??100)+
      (p.connected?(p.hp?'':'・倒地'+(p.revive?' '+Math.floor(100*p.revive)+'%':'')):'・離線'));
  });
  const guardian=state.enemies.find(enemy=>enemy.guardian);
  const activeCast=state.warnings?.find(w=>w.name&&state.floor)?.name;
  const local=state.players.find(p=>p.id===me);
  const phase=state.floor?'無限塔第 '+state.floor+' 層　'+Math.min(state.stageKills,state.goal)+' / '+state.goal:
    state.storyTime===undefined?'第 '+state.stage+' 關　'+state.stageKills+' / '+state.goal:'主線 '+clock(state.storyTime)+' / 8:00　擊退 '+state.kills;
  text(stage,phase+(guardian?'　'+guardian.name+' '+guardian.hp+'/'+guardian.maxHp:'')+(activeCast?'　'+activeCast:''));
  const messages={waiting:'等待隊友進入同一房間…',won:'兩人合作通過三關！',lost:'本局結束',closed:'房間已結束'};
  const partner=state.players.find(p=>p.id!==me);
  const rescue=local?.hp===0?(local.revive?'接受隊友救援…':'倒地・等待隊友救援'):
    partner?.hp===0&&partner.connected?(partner.revive?'正在救援隊友…':'隊友倒地・靠近可救援'):'';
  text(linkState,messages[state.state]??(state.transitioning?'進入第 '+state.floor+' 層':rescue));
  showReward(state.state==='live'?state.reward:null);
  if(state.floor&&state.cleared>submittedFloor&&!resultPending&&rankSave.hidden)requestResult();
}
function circle(x,y,r,fill,stroke,line=2){
  ink.beginPath();ink.arc(x,y,r,0,Math.PI*2);
  if(fill){ink.fillStyle=fill;ink.fill();}
  if(stroke){ink.strokeStyle=stroke;ink.lineWidth=line;ink.stroke();}
}
function drawEnemy(e,seconds){
  const kind=e.kind??(e.guardian?'boss':'shade');
  const color=e.flash?'#fff4bd':e.color??enemyColors[kind]??'#ded8f0';
  const frame=e.aim?1:Math.floor(seconds*7+(e.phase??0))%2;
  const key=kind+':'+color+':'+frame;
  if(!enemySprites.has(key)){
    const pic=document.createElement('canvas');pic.width=pic.height=24;
    paintEnemy(pic.getContext('2d'),kind,frame,color);enemySprites.set(key,pic);
  }
  const size=e.guardian?96:kind==='mini'?60:kind==='guard'?45:38;
  if(e.aim?.seal){
    const {x,y,r}=e.aim.seal;
    circle(x,y,r,'#ad71c44f','#dfaff3',2);
    circle(x,y,Math.max(1,r*e.aim.charge),'#cf9de452',null);
  }else if(e.aim){
    ink.strokeStyle='#ff9768a0';ink.lineWidth=2;ink.setLineDash([8,7]);ink.beginPath();ink.moveTo(e.x,e.y);
    ink.lineTo(e.x+e.aim.dx*e.aim.range,e.y+e.aim.dy*e.aim.range);ink.stroke();ink.setLineDash([]);
    circle(e.x,e.y,e.radius+4,null,'#ffda8a',2);
  }
  ink.drawImage(enemySprites.get(key),Math.round(e.x-size/2),Math.round(e.y-size+e.radius*.65+frame*3),size,size);
  if(e.guardian||e.hp<e.maxHp){
    ink.fillStyle='#382c2c';ink.fillRect(e.x-e.radius,e.y+e.radius+3,e.radius*2,4);
    ink.fillStyle=e.healed?'#91df9a':'#ffcd80';ink.fillRect(e.x-e.radius,e.y+e.radius+3,e.radius*2*Math.max(0,e.hp/e.maxHp),4);
  }
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
const effectInks={
  wheel:['#ffdaad','#f09345'], 'fire-wheel':['#fb854d','#ffd46d'], ring:[null,'#ffd65e'],
  'fire-ring':['#fa8353','#ffd379'], shoe:['#ad5b3a','#ffe6ab'], water:['#4a99c5','#a6edfc'],
  wind:['#81c9bb','#e3ffe5'], eye:['#31676348','#88d8c399'], brick:['#e6a949','#fff4b0'],
  ingot:['#dba844','#fff1a2']
};
function drawEffect(effect,seconds){
  const {x,y,r,kind}=effect,[fill,stroke]=effectInks[kind]??[null,'#ffd080'];
  circle(x,y,r,fill,stroke);
  if(kind==='eye'||kind==='wind'){
    for(let i=0;i<6;i++){
      const a=seconds*5-i*.58,d=(i+2)*r/9;
      ink.fillStyle='#c1f1d5';ink.fillRect(x+Math.cos(a)*d-2,y+Math.sin(a)*d-2,4,4);
    }
  }
}
function paint(now){
  const density=Math.min(window.devicePixelRatio||1,2);
  const w=Math.max(1,Math.round(arena.clientWidth*density)),h=Math.max(1,Math.round(arena.clientHeight*density));
  if(w!==arena.width||h!==arena.height){arena.width=w;arena.height=h;}
  ink.setTransform(1,0,0,1,0,0);ink.fillStyle='#172b32';ink.fillRect(0,0,w,h);
  if(state){
    const portrait=w/h<.85,seconds=now/1000;
    const scale=Math.max(w/1250,h/(portrait?1000:920))*zoom;
    const vw=w/scale,vh=h/scale,focus=state.players.find(p=>p.id===me);
    const left=Math.max(0,Math.min(state.width-vw,(focus?.x??state.width/2)-vw/2));
    const top=Math.max(0,Math.min(state.height-vh,(focus?.y??state.height/2)-vh/2));
    const ox=vw>state.width?(w-state.width*scale)/2:-left*scale;
    const oy=vh>state.height?(h-state.height*scale)/2:-top*scale;
    ink.translate(Math.round(ox),Math.round(oy));ink.scale(scale,scale);ink.imageSmoothingEnabled=false;
    const visible=p=>p.x>=left-320&&p.x<=left+vw+320&&p.y>=top-320&&p.y<=top+vh+320;
    for(let y=Math.floor(top/48)*48;y<Math.min(state.height,top+vh);y+=48)for(let x=Math.floor(left/48)*48;x<Math.min(state.width,left+vw);x+=48){
      ink.fillStyle=(x+y)%96?'#31484d':'#304247';ink.fillRect(x,y,46,46);
    }
    for(const effect of state.effects??[])if(effect.kind==='eye'&&visible(effect))drawEffect(effect,seconds);
    for(const warning of state.warnings??[])for(const mark of warning.marks)if(visible(mark)){
      circle(mark.x,mark.y,mark.r,'#c84e422d','#f48f69',2);
      circle(mark.x,mark.y,mark.r*Math.max(.05,warning.charge),'#df574844',null);
    }
    for(const item of state.loot??[])if(visible(item)){
      const r=item.kind==='xp'?5:10;
      ink.fillStyle={xp:'#9dddce',heal:'#f3826d',magnet:'#92c8fa',bomb:'#ffcd79'}[item.kind];
      if(item.magnet){ink.strokeStyle='#b1f5e46e';ink.strokeRect(item.x-r-3,item.y-r-3,(r+3)*2,(r+3)*2);}
      ink.fillRect(item.x-r,item.y-r,r*2,r*2);
      if(item.kind==='heal'){
        ink.fillStyle='#fff3cb';ink.fillRect(item.x-2,item.y-6,4,12);ink.fillRect(item.x-6,item.y-2,12,4);
      }
    }
    for(const e of state.enemies)if(visible(e))drawEnemy(e,seconds);
    for(const bolt of state.bolts)if(visible(bolt))circle(bolt.x,bolt.y,bolt.r??5,bolt.hostile?'#f78b70':'#ffdb87',bolt.hostile?'#fff0c4':null);
    for(const effect of state.effects??[])if(effect.kind!=='eye'&&visible(effect))drawEffect(effect,seconds);
    for(const s of state.sparks??[])if(visible(s))circle(s.x,s.y,s.r,s.kind==='heal'||s.kind==='magnet'?'#8be6ae30':s.kind==='enemy-impact'?'#fc755c52':'#ffd08048',
      s.kind==='heal'||s.kind==='magnet'?'#91e7b4':'#ffd08066');
    for(const p of state.players)if(visible(p))drawPlayer(p,seconds);
  }
  requestAnimationFrame(paint);
}
function reconnect(){
  if(permanent||retryTimer)return;
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
      if(packet.state){state=packet.state;show(state);}
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
