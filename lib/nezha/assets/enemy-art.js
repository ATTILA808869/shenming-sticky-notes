function paintEnemy(target,kind,frame,color){
  const p=(ink,x,y,w,h)=>{target.fillStyle=ink;target.fillRect(x,y,w,h);};
  const dark='#202b32',gold='#ffd079',white='#f5efd6';
  if(kind==='dragon'){
    p(dark,1,12,22,9);p(dark,3,7,18,15);p(dark,5,2,4,11);p(dark,15,2,4,11);
    p(gold,6,3,2,7);p(gold,16,3,2,7);p(color,4,9,16,10);p(color,2,13,20,6);
    p('#6c5148',7,19,10,3);p(gold,8,17,8,3);p(dark,10,18,1,1);p(dark,13,18,1,1);
    p(white,6,12,4,3);p(white,14,12,4,3);p(dark,8,12,2,3);p(dark,14,12,2,3);
    p('#e87749',10,8,4,2);p(gold,2,19+frame,4,2);p(gold,18,19-frame,4,2);
    return;
  }
  p(dark,5,3,14,3);p(dark,3,6,18,14);p(dark,2,15,20,5);
  p(color,6,5,12,2);p(color,4,7,16,12);
  p(color,4,18,4,2+frame);p(color,10,18,4,3-frame);p(color,16,18,4,2+frame);
  p(dark,7,10,3,4);p(dark,14,10,3,4);p(white,7,10,1,1);p(white,14,10,1,1);p(dark,10,15,4,1);
  if(kind==='runner'){
    p(dark,0,9,5,3);p(gold,0,9,4,1);p(dark,19,8,5,3);p(gold,20,9,4,1);
  }
  if(kind==='guard'){
    p('#475b68',5,6,14,3);p('#a1b9bc',6,6,12,1);
    p(dark,15,12,7,9);p('#8eafb5',16,13,5,7);p(gold,18,15,1,3);
  }
  if(kind==='healer'){
    p('#527a63',4,5,16,3);p(white,11,5,2,6);p(white,9,7,6,2);
  }
  if(kind==='caster'){
    p(dark,8,1,8,5);p('#7a61a2',10,1,4,5);p(gold,11,4,2,2);
    p(dark,19,7,2,13);p(gold,18,5,4,4);
  }
  if(kind==='mini'||kind==='boss'){
    p(dark,3,2,3,5);p(dark,18,2,3,5);p(gold,4,2,2,4);p(gold,18,2,2,4);
    p(white,8,16,2,2);p(white,14,16,2,2);
  }
}
const enemyColors={shade:'#e1ded0',runner:'#f09273',guard:'#718d9f',healer:'#82cb9f',caster:'#af9fdb'};

const NezhaWorldArt=(()=>{
  const pickupArt=new Map();
  function pickupSprite(ctx,file,x,y,size){
    let art=pickupArt.get(file);
    if(!art){
      art=new Image();art.decoding='async';art.src='/games/nezha/'+file;
      pickupArt.set(file,art);
    }
    if(!art.naturalWidth)return false;
    ctx.drawImage(art,Math.round(x-size/2),Math.round(y-size/2),size,size);
    return true;
  }
  const pixel=(ctx,color,x,y,w,h)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
  function circle(ctx,x,y,r,fill,stroke,line=2){
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);
    if(fill){ctx.fillStyle=fill;ctx.fill();}
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();}
  }
  function star(ctx,x,y,r,color){
    ctx.beginPath();
    for(let i=0;i<10;i++){
      const a=i*Math.PI/5-Math.PI/2,len=i%2?r*.46:r;
      ctx.lineTo(x+Math.cos(a)*len,y+Math.sin(a)*len);
    }
    ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#77403e';ctx.lineWidth=1;ctx.stroke();
  }
  function background(ctx,view,mapWidth,mapHeight,elapsed){
    const tileWidth=48;
    const block=(color,x,y,w,h)=>pixel(ctx,color,x,y,w,h);
    block('#263c42',view.x,view.y,view.width,view.height);
    const tiles=['#435c60','#486369','#40585d'];
    const stone=['#637775','#596e6c','#687975'];
    for(let row=Math.max(0,Math.floor(view.y/32));row*32<=view.y+view.height&&row*32<mapHeight;row++){
      for(let col=Math.max(0,Math.floor(view.x/tileWidth));col*tileWidth<=view.x+view.width&&col*tileWidth<mapWidth;col++){
        const x=col*tileWidth,y=row*32,seed=(row*17+col*13)%19;
        const lane=Math.abs(x-mapWidth/2)<150||Math.abs(y-mapHeight/2)<104;
        block((lane?stone:tiles)[seed%3],x,y,46,30);
        block(lane?'#83918a':'#597378',x,y,46,2);
        block('#30464b',x+2,y+28,42,2);
        if(seed<4){block('#334e53',x+14,y+8,10,2);block('#334e53',x+22,y+10,2,6);}
        if(seed>15){block('#395756',x+6,y+20,8,6);block('#5c7770',x+8,y+18,4,2);}
      }
    }
    ctx.strokeStyle='#aa8054';ctx.lineWidth=6;ctx.strokeRect(8,8,mapWidth-16,mapHeight-16);
    const flame=Math.floor(elapsed*5)%2;
    for(let x=240;x<mapWidth;x+=480)for(let y=210;y<mapHeight;y+=420){
      if(x<view.x-110||x>view.x+view.width+110||y<view.y-110||y>view.y+view.height+110)continue;
      block('#31484d',x-47,y-39,94,82);block('#9a805b',x-45,y-37,90,78);
      block('#657771',x-40,y-32,80,68);block('#87918a',x-34,y-26,68,56);
      block('#6a6c58',x-4,y-20,8,40);block('#6a6c58',x-20,y-4,40,8);
      block('#b79a68',x-9,y-9,18,18);block('#7a5d4c',x-4,y-4,8,8);
      for(const offset of [-55,55]){
        const cx=x+offset;
        block('#25363c',cx-8,y-5,16,9);block('#32292a',cx-3,y-34,6,34);
        block('#a9473c',cx-9,y-31,18,20);block('#e9834f',cx-7,y-32,14,18);
        block(flame?'#ffe0a2':'#ffc474',cx-3,y-29,6,12);
        block('#ffc66b',cx-6,y-35,12,3);block('#ffc66b',cx-6,y-14,12,3);
        block('#a9473c',cx-1,y-11,2,5);
      }
    }
  }
  function gem(ctx,x,y){
    if(pickupSprite(ctx,'loot-xp.png',x,y,16))return;
    pixel(ctx,'#625450',x-5,y-3,10,7);
    pixel(ctx,'#ffcb65',x-3,y-5,6,10);
    pixel(ctx,'#ffe5a0',x-1,y-4,2,5);
  }
  function drop(ctx,x,y,kind,time=0){
    if(NezhaRules.isTowerRelic(kind)){
      const lift=Math.round(Math.sin(time*6)*3);
      ctx.save();
      pixel(ctx,'#251f34a0',x-20,y+7,40,8);
      ctx.strokeStyle='#ffcf77';ctx.lineWidth=2;ctx.strokeRect(x-23,y-5,46,22);
      if(!pickupSprite(ctx,NezhaRules.towerRelics[kind].file,x,y-20+lift,54))star(ctx,x,y-18,15,'#ffcf77');
      for(let i=0;i<3;i++){
        const dx=(i-1)*18,dy=(Math.floor(time*16)+i*8)%26;
        pixel(ctx,i%2?'#fff0af':'#d6a8ff',Math.round(x+dx),Math.round(y-10-dy),3,3);
      }
      ctx.restore();return;
    }
    if(kind==='bomb'||kind==='heal'||kind==='magnet'){
      if(!pickupSprite(ctx,'loot-'+kind+'.png',x,y,34))star(ctx,x,y,10,'#ffe2a0');
    }
  }
  function relicGuide(ctx,view,item){
    if(!item)return;
    const left=view.x+54,right=view.x+view.width-54,top=view.y+64,bottom=view.y+62;
    if(right<=left||bottom<=top||item.x>=left&&item.x<=right&&item.y>=top&&item.y<=bottom)return;
    const x=Math.min(right,Math.max(left,item.x)),y=Math.min(bottom,Math.max(top,item.y));
    ctx.save();ctx.translate(x,y);
    pixel(ctx,'#211d2e',-20,-20,40,40);ctx.strokeStyle='#ffcf77';ctx.lineWidth=2;ctx.strokeRect(-20,-20,40,40);
    ctx.save();ctx.rotate(Math.atan2(item.y-y,item.x-x));
    ctx.fillStyle='#ffdf91';ctx.beginPath();ctx.moveTo(11,0);ctx.lineTo(-4,-8);ctx.lineTo(-4,8);ctx.closePath();ctx.fill();ctx.restore();
    ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.textBaseline='top';
    const name=NezhaRules.towerRelics[item.kind??'tome'].name;
    ctx.strokeStyle='#211d2e';ctx.lineWidth=4;ctx.strokeText(name,0,23);ctx.fillStyle='#ffebac';ctx.fillText(name,0,23);
    ctx.restore();
  }
  function relicPickup(ctx,spark){
    ctx.save();ctx.globalAlpha=Math.min(1,spark.life*2);
    ctx.font='bold 18px system-ui';ctx.textAlign='center';ctx.lineWidth=4;
    ctx.strokeStyle='#211d2e';ctx.fillStyle='#ffdf91';
    const {x}=spark,y=spark.y-35-(1.4-spark.life)*12;
    const label='已取得'+NezhaRules.towerRelics[spark.relic??'tome'].name;
    ctx.strokeText(label,x,y);ctx.fillText(label,x,y);ctx.restore();
  }
  function relicShield(ctx,x,y){
    circle(ctx,x,y-8,30,'#ffcc6030','#fff1aa',2);
    circle(ctx,x,y-8,25,null,'#ffc25799',1);
  }
  function relicEffect(ctx,spark){
    const age=1-spark.life/.5,stone=spark.kind==='relic-stone';
    ctx.save();ctx.globalAlpha=Math.min(1,spark.life*2);
    if(stone)circle(ctx,spark.x,spark.y,35+age*80,null,'#d3e3e6',3);
    else star(ctx,spark.x,spark.y-27,14+age*14,'#fff0ad');
    ctx.restore();
  }
  function magnet(ctx,view,time,pulses,flights,target,pulseTime){
    if(!pulses.length&&!flights.length)return;
    ctx.save();
    for(const pulse of pulses){
      const p=target(pulse);if(!p)continue;
      const age=time-pulse.startedAt;
      for(const delay of [0,.12]){
        const t=(age-delay)/(pulseTime-delay);
        if(t<0||t>=1)continue;
        ctx.globalAlpha=(1-t)*.85;
        circle(ctx,p.x,p.y,24+142*t,null,'#71d8ff',4-2*t);
      }
    }
    for(const item of flights){
      const p=target(item),t=(time-item.startedAt)/item.duration;
      if(!p||t<0||t>=1)continue;
      const remaining=(1-t)**2;
      const dx=item.x-p.x,dy=item.y-p.y,x=p.x+dx*remaining,y=p.y+dy*remaining;
      if(x<view.x-24||x>view.x+view.width+24||y<view.y-24||y>view.y+view.height+24)continue;
      const tail=(1-Math.max(0,t-.075))**2;
      ctx.globalAlpha=(1-t*.55)*.75;
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(p.x+dx*tail,p.y+dy*tail);
      ctx.strokeStyle=item.kind==='xp'?'#ffdc88':item.kind==='heal'?'#ff97b0':item.kind==='bomb'?'#ffae68':'#71d8ff';
      ctx.lineWidth=item.kind==='xp'?3:5;ctx.stroke();
      ctx.globalAlpha=1-t*.55;
      if(item.kind==='xp')gem(ctx,x,y);
      else drop(ctx,x,y,item.kind);
    }
    ctx.restore();
  }
  function bomb(ctx,spark,flashTime){
    const fade=Math.min(1,Math.max(0,spark.life/flashTime));
    ctx.save();ctx.globalAlpha=fade;
    star(ctx,spark.x,spark.y-6,16+23*(1-fade),'#ffb563');
    star(ctx,spark.x,spark.y-6,7+10*(1-fade),'#fff0a3');
    ctx.restore();
  }
  return {background,gem,drop,relicGuide,relicPickup,relicShield,relicEffect,magnet,bomb,star,circle,pixel};
})();

const NezhaCombatArt=(()=>{
  const bossSheets=new Map();
  const bossCell=224;
  function prepareTowerBoss(id){
    if(!bossSheets.has(id)){
      const img=new Image();img.decoding='async';img.src='/games/nezha/tower-boss-'+id+'.webp';
      bossSheets.set(id,img);
    }
    return bossSheets.get(id);
  }
  function create(ctx){
    const layers=new Map();
    const {pixel}=NezhaWorldArt;
    const circle=(...args)=>NezhaWorldArt.circle(ctx,...args);
    NezhaSkillArt.preload();
    function sprite(key,w,h,paint){
      if(layers.has(key))return layers.get(key);
      const pic=document.createElement('canvas');pic.width=w;pic.height=h;
      paint(pic.getContext('2d'));layers.set(key,pic);return pic;
    }
    function drawActorSprite(pic,x,y,scale,flip){
      const w=pic.width*scale,h=pic.height*scale;
      ctx.save();ctx.translate(Math.round(x),Math.round(y));
      if(flip)ctx.scale(-1,1);
      ctx.drawImage(pic,-w/2,-h+4,w,h);ctx.restore();
    }
    function drawTowerBoss(enemy,elapsed,frozen){
      const sheet=prepareTowerBoss(enemy.towerSprite);
      if(!sheet.naturalWidth)return;
      const pose=NezhaRules.towerGuardianPose(enemy,elapsed);
      const facing=(pose>0&&pose<4?enemy.castFacing:undefined)??enemy.facing??1;
      const size=Math.round(enemy.r*3.27);
      const bob=pose===0&&!frozen?Math.round(Math.sin(elapsed*6)*2):0;
      ctx.save();ctx.imageSmoothingEnabled=false;
      if(frozen){
        if('filter' in ctx)ctx.filter='grayscale(1)';
        else ctx.globalAlpha=.72;
      }
      ctx.drawImage(sheet,pose*bossCell,facing<0?0:bossCell,bossCell,bossCell,
        Math.round(enemy.x-size/2),Math.round(enemy.y+enemy.r*.50-size)+bob,size,size);
      ctx.restore();
    }
    function enemyActor(enemy,elapsed,kind,isBoss){
      const frozen=elapsed<(enemy.petrifiedUntil??0);
      const casting=!frozen&&(Boolean(enemy.aim)||Boolean(enemy.special)||Boolean(enemy.casting)||(isBoss&&enemy.cast<.28));
      const frame=frozen?0:casting?1:Math.floor(elapsed*7+(enemy.phase??0))%2;
      const y=Math.round(enemy.y)+(enemy.stun>0?0:frame*3);
      const color=frozen?'#9a9da2':enemy.flash>0?'#fff4bd':enemy.color??(enemyColors[kind]??'#ded8f0');
      pixel(ctx,'#20313688',Math.round(enemy.x-enemy.r/2),Math.round(y),enemy.r,5);
      if(enemy.towerSprite)drawTowerBoss(enemy,elapsed,frozen);
      else{
        const pic=sprite(kind+':'+color+':'+frame,24,24,layer=>paintEnemy(layer,kind,frame,color));
        const scale=isBoss?4:enemy.mini?2.5:kind==='guard'?1.85:1.55;
        drawActorSprite(pic,enemy.x,y+enemy.r*.68,scale,enemy.facing<0);
      }
      if(elapsed<(enemy.jigongSlowUntil??0)){
        pixel(ctx,'#5bc9df',Math.round(enemy.x-enemy.r),Math.round(enemy.y)+7,9,3);
        pixel(ctx,'#bbf6ff',Math.round(enemy.x+enemy.r)-8,Math.round(enemy.y)+9,6,3);
      }
      if(elapsed<(enemy.jigongWaterUntil??0)){
        const drop=Math.floor(elapsed*13+(enemy.phase??0))%8;
        pixel(ctx,'#75cfee',Math.round(enemy.x-enemy.r/2),Math.round(y)+drop,3,5);
        pixel(ctx,'#b5effc',Math.round(enemy.x+enemy.r/2),Math.round(y)+7-drop,3,4);
      }
      if(casting&&!enemy.towerSprite){
        pixel(ctx,'#f18b54',enemy.x-4,y-enemy.r-14,8,8);
        pixel(ctx,'#ffe69a',enemy.x-2,y-enemy.r-16,4,12);
      }
      if(enemy.healFlashUntil>elapsed||enemy.stun>0){
        const ink=enemy.stun>0?'#ffd879':'#94ebac';
        pixel(ctx,ink,enemy.x-2,y-enemy.r-17,4,10);
        pixel(ctx,ink,enemy.x-5,y-enemy.r-14,10,4);
      }
      if(enemy.mini){
        ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.textBaseline='bottom';
        ctx.fillStyle='#fff1db';ctx.fillText(enemy.name,enemy.x,y-enemy.r-15);
      }
      if(!isBoss&&enemy.hp<enemy.maxHp){
        pixel(ctx,'#283237',enemy.x-enemy.r,y-enemy.r-9,enemy.r*2,4);
        pixel(ctx,'#f09c7e',enemy.x-enemy.r,y-enemy.r-9,enemy.r*2*Math.max(0,enemy.hp/enemy.maxHp),4);
      }
    }
    function ingot(x,y){
      NezhaSkillArt.paint(ctx,'ingot',x,y,37);
    }
    function qi(bolt){
      if(bolt.basePower!==null){
        NezhaSkillArt.paint(ctx,'ingot',bolt.x,bolt.y,18,0,bolt.angle);return;
      }
      ctx.save();ctx.translate(bolt.x,bolt.y);ctx.rotate(bolt.angle);
      pixel(ctx,'#77e9bc78',-24,-2,18,4);
      ctx.beginPath();ctx.moveTo(-7,-12);ctx.quadraticCurveTo(28,0,-7,12);
      ctx.quadraticCurveTo(12,0,-7,-12);ctx.closePath();
      ctx.fillStyle='#7af0c4';ctx.fill();ctx.strokeStyle='#236776';ctx.lineWidth=2;ctx.stroke();
      pixel(ctx,'#e9fff2',7,-2,7,4);
      ctx.restore();
    }
    function warning(x,y,r,charge,seal=false){
      circle(x,y,r,'#ec655647','#ffb082',2);
      if(charge>0)circle(x,y,r*Math.sqrt(charge),'#ff885b55');
      if(seal){
        pixel(ctx,'#ffd18b',x-2,y-8,4,16);
        pixel(ctx,'#ffd18b',x-8,y-2,16,4);
      }
    }
    function enemyShot(shot){
      if(shot.style==='tower-qi'){
        ctx.save();ctx.translate(shot.x,shot.y);ctx.rotate(Math.atan2(shot.dy,shot.dx));
        pixel(ctx,'#123c47',-22,-13,33,26);pixel(ctx,'#309da6',-16,-10,27,20);
        pixel(ctx,'#76ead2',-7,-8,20,16);pixel(ctx,'#e6ffca',1,-4,12,8);
        pixel(ctx,'#53c2b5',-32,-5,13,3);pixel(ctx,'#96ffd0',-29,5,13,3);
        ctx.restore();return;
      }
      const tail=shot.radius*2;
      circle(shot.x-shot.dx*tail,shot.y-shot.dy*tail,shot.radius*.65,'#ec6640ab');
      circle(shot.x,shot.y,shot.radius,'#ff8e66','#4d2d31',2);
      circle(shot.x,shot.y,shot.radius*.46,'#fff2bb');
    }
    function jigong(shot){
      const {index,x,y,angle,age}=shot;
      if(index===0){
        NezhaSkillArt.paint(ctx,'slipper',x,y,39*shot.r/16,age);
      }else if(index===1){
        NezhaSkillArt.paint(ctx,'water',x,y,24*shot.r/11,age,angle+Math.PI);
      }else{
        vortex(x,y,shot.r,age,1.7);
      }
    }
    function ring(shot,time){
      NezhaSkillArt.paint(ctx,shot.fire?'samadhi':'qiankun',shot.x,shot.y,shot.fire?21:29,time,shot.fire?shot.angle+Math.PI:time*8);
    }
    function wheel(point,scale){
      NezhaSkillArt.paintWheel(ctx,point,scale);
    }
    function brick(mark){
      const t=Math.max(0,Math.min(1,1-mark.left/.44));
      const x=mark.fromX+(mark.x-mark.fromX)*t;
      const y=mark.fromY+(mark.y-mark.fromY)*t-Math.sin(t*Math.PI)*55;
      NezhaSkillArt.paint(ctx,mark.ingot?'ingot':'brick',x,y,36);
    }
    function vortex(x,y,r,age,stretch=1){
      const cell=r>21?3:2;
      for(let arm=0;arm<2;arm++)for(let i=0;i<12;i++){
        const angle=age*8+arm*Math.PI-i*.23,reach=r*(.21+i*.069);
        const px=Math.round((x+Math.cos(angle)*reach)/cell)*cell,py=Math.round((y+Math.sin(angle)*reach/stretch)/cell)*cell;
        pixel(ctx,i<4?'#e0fff0':i<8?'#79dec4':'#469b958c',px,py,cell*(i<6?2:1),cell);
      }
    }
    function eye({x,y},age,r){vortex(x,y,r,age);}
    function skillBurst(mark,life){
      const progress=Math.max(0,1-mark.life/life);
      const reach=mark.r*(.2+progress*.8);
      ctx.save();ctx.globalAlpha=Math.min(1,mark.life/life*1.8);
      for(let i=0;i<12;i++){
        const angle=i*Math.PI/6+progress*.5;
        const x=Math.round(mark.x+Math.cos(angle)*reach),y=Math.round(mark.y+Math.sin(angle)*reach);
        pixel(ctx,mark.kind==='ring-burst'?'#f47348':'#e2a54c',x-3,y-2,7,5);
        pixel(ctx,'#fff0ac',x-1,y-1,3,2);
      }
      ctx.restore();
    }
    const bossColors={meteor:['#fa8354','#ffe09a'],ring:['#71d9ef','#e0fbff'],
      line:['#be9aff','#fff0ba'],cross:['#e99967','#ffe7a6'],qi:['#60dcc2','#e8ffca']};
    function bossWarning(mark,charge){
      const colors=bossColors[mark.pattern];
      if(!colors){warning(mark.x,mark.y,mark.r,charge);return;}
      const {x,y,r}=mark,[color,light]=colors;
      circle(x,y,r,color+'43',light,3);
      circle(x,y,r*Math.sqrt(charge),color+'58');
      const count=mark.pattern==='ring'?6:4;
      for(let i=0;i<count;i++){
        const a=i*Math.PI*2/count-Math.PI/2;
        pixel(ctx,light,Math.round(x+Math.cos(a)*r*.85)-2,Math.round(y+Math.sin(a)*r*.85)-2,5,5);
      }
    }
    function bossImpact(mark){
      const {x,y,r}=mark,[color,light]=bossColors[mark.pattern]??bossColors.meteor;
      const t=Math.max(0,1-mark.life/.32),reach=r*(.28+.66*t);
      ctx.save();ctx.globalAlpha=Math.min(1,mark.life*4.2);
      circle(x,y,reach,color+'34',color,2);
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4,px=Math.round(x+Math.cos(a)*reach),py=Math.round(y+Math.sin(a)*reach);
        if(mark.pattern==='line'){
          pixel(ctx,color,px-5,py-20,7,14);pixel(ctx,light,px-2,py-10,6,14);pixel(ctx,color,px+2,py,5,12);
        }else if(mark.pattern==='ring'){
          pixel(ctx,color,px-6,py-8,12,14);pixel(ctx,light,px-2,py-12,5,16);
        }else{
          const rise=mark.pattern==='meteor'?Math.round(25*(1-t)):0;
          pixel(ctx,color,px-5,py-5-rise,11,10);pixel(ctx,light,px-2,py-2-rise,5,4);
        }
      }
      ctx.restore();
    }
    function bossLane(lane){
      if(lane.phase!=='charge')return;
      const dash=lane.pattern==='dash',color=dash?'#ff8560':'#76ead2',light=dash?'#ffde9d':'#dfffc4';
      ctx.save();ctx.translate(lane.x,lane.y);ctx.rotate(lane.angle);
      for(const a of dash?[0]:NezhaRules.qiFan){
        ctx.save();ctx.rotate(a);
        pixel(ctx,color+'46',0,-lane.r,lane.length,lane.r*2);
        pixel(ctx,color+'61',0,-lane.r,lane.length*lane.charge,lane.r*2);
        pixel(ctx,light,0,-lane.r,lane.length,2);pixel(ctx,light,0,lane.r-2,lane.length,2);
        for(let n=44;n<lane.length-5;n+=60){
          ctx.strokeStyle=light;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(n-8,-6);ctx.lineTo(n,0);ctx.lineTo(n-8,6);ctx.stroke();
        }
        ctx.restore();
      }
      ctx.restore();
    }
    function dashTrail(mark){
      ctx.save();ctx.globalAlpha=Math.min(1,mark.life/.24)*.65;
      ctx.translate(mark.x,mark.y);ctx.rotate(mark.angle);
      pixel(ctx,'#e96953',-48,-25,60,50);pixel(ctx,'#fcb26a',-48,-12,42,24);
      pixel(ctx,'#ffe098',-36,-3,37,6);
      ctx.restore();
    }
    function aim(enemy,shape){
      if(shape.seal){warning(shape.seal.x,shape.seal.y,shape.seal.r,shape.charge,true);return;}
      ctx.save();ctx.globalAlpha=.55+.4*shape.charge;ctx.strokeStyle='#ffb38e';ctx.lineWidth=2;ctx.setLineDash([8,6]);
      ctx.beginPath();ctx.moveTo(enemy.x,enemy.y);
      ctx.lineTo(enemy.x+shape.dx*shape.range,enemy.y+shape.dy*shape.range);ctx.stroke();ctx.restore();
    }
    return {prepareTowerBoss,enemyActor,warning,aim,qi,enemyShot,ingot,jigong,ring,wheel,brick,eye,skillBurst,bossWarning,bossImpact,bossLane,dashTrail};
  }
  return {create};
})();
