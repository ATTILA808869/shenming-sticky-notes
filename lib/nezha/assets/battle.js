const arena=document.querySelector('#battle-arena'),ink=arena.getContext('2d');
const stage=document.querySelector('#stage'),linkState=document.querySelector('#link-state');
const players=document.querySelector('#players'),retry=document.querySelector('#retry');
const art={nezha:new Image(),jigong:new Image()};
art.nezha.src='/games/nezha/nezha-sheet.png';
art.jigong.src='/games/nezha/jigong-attack-sheet.png';
const keys=new Set();
let state=null,me=null,socket=null,touch=null,retryTimer=null,tries=0,joining=false,permanent=false,inputKey='';

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
function release(){touch=null;keys.clear();sendInput();}
window.addEventListener('blur',release);
window.addEventListener('pagehide',()=>{
  release();
  if(socket){permanent=true;socket.close();}
});
window.addEventListener('pageshow',event=>{if(event.persisted){permanent=false;void join();}});
arena.addEventListener('pointerdown',event=>{
  if(touch)return;
  arena.setPointerCapture(event.pointerId);
  touch={id:event.pointerId,fromX:event.clientX,fromY:event.clientY,x:0,y:0};
});
arena.addEventListener('pointermove',event=>{
  if(touch?.id!==event.pointerId)return;
  touch.x=(event.clientX-touch.fromX)/34;touch.y=(event.clientY-touch.fromY)/34;
});
for(const type of ['pointerup','pointercancel','lostpointercapture'])arena.addEventListener(type,event=>{
  if(touch?.id===event.pointerId){touch=null;sendInput();}
});
setInterval(sendInput,50);

function show(state){
  if(players.children.length!==state.players.length)players.replaceChildren(...state.players.map(()=>{
    const row=document.createElement('li');row.append(document.createElement('span'),document.createElement('span'));return row;
  }));
  state.players.forEach((p,index)=>{
    const row=players.children[index];
    text(row.firstElementChild,p.name+(p.id===me?'（你）':''));
    text(row.lastElementChild,'Lv.'+p.level+'　♥ '+p.hp+(p.connected?'':'・離線'));
  });
  const guardian=state.enemies.find(enemy=>enemy.guardian);
  text(stage,'第 '+state.stage+' 關　擊退 '+state.stageKills+' / '+state.goal+(guardian?'　'+guardian.name+' '+guardian.hp+'/'+guardian.maxHp:''));
  const messages={waiting:'等待隊友進入同一房間…',won:'兩人合作通過三關！',lost:'本局結束',closed:'房間已結束'};
  text(linkState,messages[state.state]??'');
}
function paint(){
  const density=Math.min(window.devicePixelRatio||1,2);
  const w=Math.max(1,Math.round(arena.clientWidth*density)),h=Math.max(1,Math.round(arena.clientHeight*density));
  if(w!==arena.width||h!==arena.height){arena.width=w;arena.height=h;}
  ink.setTransform(1,0,0,1,0,0);ink.fillStyle='#172b32';ink.fillRect(0,0,w,h);
  if(state){
    const portrait=w/h<.85;
    const scale=Math.min(w/(portrait?Math.min(state.width,480):state.width),h/state.height);
    const visible=w/scale,focus=state.players.find(p=>p.id===me)?.x??state.width/2;
    const left=Math.max(0,Math.min(state.width-visible,focus-visible/2));
    const ox=visible<state.width?-left*scale:(w-state.width*scale)/2,oy=(h-state.height*scale)/2;
    ink.translate(ox,oy);ink.scale(scale,scale);ink.imageSmoothingEnabled=false;
    for(let y=0;y<state.height;y+=40)for(let x=0;x<state.width;x+=40){
      ink.fillStyle=(x+y)%80?'#31484d':'#304247';ink.fillRect(x,y,38,38);
    }
    for(const bolt of state.bolts){ink.fillStyle='#ffd080';ink.fillRect(bolt.x-4,bolt.y-4,8,8);}
    for(const e of state.enemies){
      ink.fillStyle=e.guardian?'#e67862':'#bdcec7';ink.fillRect(e.x-e.radius,e.y-e.radius,e.radius*2,e.radius*2);
      ink.fillStyle='#18262b';ink.fillRect(e.x-e.radius*.5,e.y-e.radius*.25,4,5);ink.fillRect(e.x+e.radius*.3,e.y-e.radius*.25,4,5);
      ink.fillStyle='#ffda8a';ink.fillRect(e.x-e.radius,e.y-e.radius-6,e.radius*2*Math.max(0,e.hp/e.maxHp),3);
    }
    for(const p of state.players){
      const img=art[p.character],jigong=p.character==='jigong',frame=jigong?840:724,anchor=jigong?485:319;
      ink.globalAlpha=p.hp===0?.32:p.connected?1:.55;
      const factor=67/724;
      if(img.complete&&img.naturalWidth)ink.drawImage(img,0,0,frame,724,p.x-anchor*factor,p.y-56,frame*factor,67);
      else{ink.fillStyle='#ffd080';ink.fillRect(p.x-11,p.y-11,22,22);}
      ink.fillStyle='#213133';ink.fillRect(p.x-22,p.y+10,44,6);
      ink.fillStyle=p.id===me?'#92dfba':'#ffd080';ink.fillRect(p.x-22,p.y+10,44*p.hp/100,5);
      ink.globalAlpha=1;
    }
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
      let packet;
      try{packet=JSON.parse(event.data);}catch{return;}
      if(packet.type==='joined'){me=packet.player;tries=0;retry.hidden=true;sendInput();}
      if(packet.state){state=packet.state;show(state);}
    });
    connection.addEventListener('close',event=>{
      if(socket!==connection)return;
      socket=null;me=null;release();
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
