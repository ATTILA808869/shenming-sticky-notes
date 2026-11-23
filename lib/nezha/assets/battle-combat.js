const NezhaCombat=(()=>{
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

function create(rules,random=()=>Math.random()){
const {baseStats,qiRange,qiSpeed,ringCooldown,ringExplosionChance,ringExplosionDamage,ringExplosionLife,brickCooldown,
  wheelOrbitRadius,ingotRange,ingotShotInterval,ingotShotDamage,ingotShotSpeed,jigongSpecs,jigongReturnPower,jigongSlowTime,
  jigongSlowInterval,jigongWaterTime,jigongWaterInterval,jigongWaterDamage,jigongWindEyes,jigongWindRingRadius,
  jigongWindRadius,jigongWindTime,jigongWindInterval,jigongWindPower,jigongWindPullSpeed}=rules;
let player,elapsed,mapWidth,mapHeight,boss,sparks;
let targetedBolts,shots,bricks,ingots,jigongShots,jigongWindCasts;
function reset(){targetedBolts=[];shots=[];bricks=[];ingots=[];jigongShots=[];jigongWindCasts=[];}
function frame(current,time,width,height,guardian,effects){
  player=current;elapsed=time;mapWidth=width;mapHeight=height;boss=guardian;sparks=effects;
}
function nearestTargets(enemies){
  return enemies.filter(enemy=>enemy.hp>0&&distance(enemy,player)<490)
    .sort((a,b)=>distance(a,player)-distance(b,player));
}
function applyHit(enemy,amount){
  enemy.hp-=amount; enemy.flash=.15;
  sparks.push({x:enemy.x,y:enemy.y,life:.22,r:8});
}
function damage(enemy,value){
  applyHit(enemy,Math.round(value*player.attack/baseStats.attack));
}
function poseForAttack(target){
  if(player.character==='jigong'&&elapsed<player.attackUntil)return;
  const dx=target.x-player.x;
  player.attackFacing=Math.abs(dx)>2?Math.sign(dx):player.facing;
  player.attackAt=elapsed;
  player.attackUntil=elapsed+(player.character==='jigong'?.315:.23);
}
function launchTargetedBolt(origin,target,speed,basePower=null){
  const angle=Math.atan2(target.y-origin.y,target.x-origin.x);
  targetedBolts.push({x:origin.x,y:origin.y,angle,target,speed,basePower,life:1});
}
function explodeRingHit(center,value,enemies){
  const radius=center.r*5;
  for(const enemy of enemies){
    if(enemy!==center&&enemy.hp>0&&distance(center,enemy)<=radius)damage(enemy,value*ringExplosionDamage);
  }
  sparks.push({x:center.x,y:center.y,r:radius,life:ringExplosionLife,kind:'ring-burst'});
}
function launchJigongVolley(index,skill){
  const spec=jigongSpecs[index],hits=new Map();
  const power=spec.power+skill.damageUpgrades*spec.gain;
  const evolved=player.evolved[index];
  const returnHits=index===0&&evolved?new Set():null;
  if(index===2&&evolved){
    const eyes=Array.from({length:jigongWindEyes},(_,i)=>{
      const angle=i*2*Math.PI/jigongWindEyes;
      return {x:player.x+Math.cos(angle)*jigongWindRingRadius,y:player.y+Math.sin(angle)*jigongWindRingRadius};
    });
    jigongWindCasts.push({eyes,power:spec.power*jigongWindPower,startedAt:elapsed,endsAt:elapsed+jigongWindTime,nextPulse:elapsed+jigongWindInterval});
  }
  for(let i=0;i<skill.count;i++){
    const angle=index===0?(i%8)*Math.PI/4+(i>=16?-Math.PI/16:i>=8?Math.PI/16:0):i*2*Math.PI/skill.count;
    const x=player.x+Math.cos(angle)*18,y=player.y+Math.sin(angle)*18;
    jigongShots.push({index,x,y,originX:player.x,originY:player.y,angle,phase:angle,age:0,life:spec.life,speed:spec.speed,r:spec.r,power,
      seen:new Set(),hits,evolved,returnHits,returning:false});
  }
}
function jigongSlowFactor(enemy){
  if(elapsed>=(enemy.jigongSlowUntil??0))return 1;
  return enemy===boss||enemy.mini ? .90 : .80;
}
function hitJigongSegment(shot,oldX,oldY,enemies){
  const dx=shot.x-oldX,dy=shot.y-oldY,travel=dx*dx+dy*dy;
  const left=Math.min(oldX,shot.x),right=Math.max(oldX,shot.x),top=Math.min(oldY,shot.y),bottom=Math.max(oldY,shot.y);
  const seen=shot.returning?shot.returnHits:shot.seen;
  for(const enemy of enemies){
    const r=enemy.r+shot.r;
    if(enemy.hp<=0||enemy.x<left-r||enemy.x>right+r||enemy.y<top-r||enemy.y>bottom+r||seen.has(enemy))continue;
    const px=enemy.x-oldX,py=enemy.y-oldY;
    const t=travel?clamp((px*dx+py*dy)/travel,0,1):0;
    if((px-dx*t)**2+(py-dy*t)**2>r*r)continue;
    seen.add(enemy);
    if(shot.returning){damage(enemy,shot.power*jigongReturnPower);continue;}
    const overlap=shot.hits.get(enemy)??0;
    // Piercing keeps hitting new targets; overlapping rays are weaker on the same target.
    if(overlap>=3)continue;
    shot.hits.set(enemy,overlap+1);damage(enemy,shot.power*(overlap?.35:1));
    if(shot.index===1&&shot.evolved&&enemy.hp>0){
      if(elapsed>=(enemy.jigongSlowReadyAt??0)){
        enemy.jigongSlowUntil=elapsed+jigongSlowTime;
        enemy.jigongSlowReadyAt=elapsed+jigongSlowInterval;
      }
      enemy.jigongWaterUntil=elapsed+jigongWaterTime;
      enemy.jigongWaterNextTick??=elapsed+jigongWaterInterval;
    }
  }
}
function advanceJigongShot(shot,dt,enemies){
  const remaining=shot.life-shot.age,step=Math.min(dt,remaining),finished=dt>=remaining;
  const oldX=shot.x,oldY=shot.y;
  shot.age=finished?shot.life:shot.age+step;
  if(shot.index===2){
    shot.angle=shot.phase+shot.age*3.25;
    const radius=18+shot.age*shot.speed;
    shot.x=shot.originX+Math.cos(shot.angle)*radius;shot.y=shot.originY+Math.sin(shot.angle)*radius;
  }else if(shot.returning&&finished){
    shot.x=shot.originX;shot.y=shot.originY;
  }else{
    shot.x+=Math.cos(shot.angle)*shot.speed*step;shot.y+=Math.sin(shot.angle)*shot.speed*step;
  }
  hitJigongSegment(shot,oldX,oldY,enemies);
  if(!finished)return true;
  if(shot.returnHits&&!shot.returning){
    shot.returning=true;shot.angle=shot.phase+Math.PI;
    shot.life=(18+shot.speed*shot.age)/shot.speed;shot.age=0;
    return dt>step?advanceJigongShot(shot,dt-step,enemies):true;
  }
  return false;
}
function tickJigongWater(enemy){
  while(enemy.hp>0&&enemy.jigongWaterNextTick<=enemy.jigongWaterUntil+1e-9&&elapsed+1e-9>=enemy.jigongWaterNextTick){
    applyHit(enemy,enemy.maxHp*jigongWaterDamage);
    enemy.jigongWaterNextTick+=jigongWaterInterval;
  }
  if(elapsed>=enemy.jigongWaterUntil)enemy.jigongWaterNextTick=undefined;
}
function advanceJigongWind(dt,enemies){
  for(const cast of jigongWindCasts){
    cast.pulseAt=cast.nextPulse<=cast.endsAt+1e-9&&elapsed+1e-9>=cast.nextPulse?cast.nextPulse:Infinity;
    if(cast.pulseAt!==Infinity)cast.nextPulse+=jigongWindInterval;
  }
  for(const enemy of enemies){
    if(enemy.hp<=0)continue;
    const range=(jigongWindRadius+enemy.r)**2;
    let nearest=null,nearestSq=range,pulseAt=Infinity,power=0;
    for(const cast of jigongWindCasts){
      const pulling=elapsed<cast.endsAt;
      const pulsing=cast.pulseAt<pulseAt&&cast.pulseAt+1e-9>=(enemy.jigongWindReadyAt??0);
      if(!pulling&&!pulsing)continue;
      for(const eye of cast.eyes){
        const gap=(eye.x-enemy.x)**2+(eye.y-enemy.y)**2;
        if(gap>range)continue;
        if(pulling&&gap<nearestSq){nearest=eye;nearestSq=gap;}
        if(pulsing){pulseAt=cast.pulseAt;power=cast.power;}
      }
    }
    // Overlapping eyes and overlapping casts share one hit interval per enemy.
    if(power>0){damage(enemy,power);enemy.jigongWindReadyAt=pulseAt+jigongWindInterval;}
    if(!nearest||nearestSq===0||enemy.hp<=0||enemy.stun>0)continue;
    const gap=Math.sqrt(nearestSq),resistance=(enemy===boss||enemy.mini) ? .25 : 1;
    const portion=Math.min(1,Math.max(jigongWindPullSpeed,enemy.speed*1.2)*resistance*dt/gap);
    enemy.x=clamp(enemy.x+(nearest.x-enemy.x)*portion,15,mapWidth-15);
    enemy.y=clamp(enemy.y+(nearest.y-enemy.y)*portion,15,mapHeight-15);
  }
  jigongWindCasts=jigongWindCasts.filter(cast=>elapsed<cast.endsAt||cast.nextPulse<=cast.endsAt+1e-9);
}
function stepJigongSkills(dt,target,enemies,canAttack){
  player.jigong.forEach((skill,index)=>{
    if(!player.skillLevels[index])return;
    skill.timer=Math.max(0,skill.timer-dt);
    if(skill.castAt!==null&&elapsed>=skill.castAt){if(canAttack)launchJigongVolley(index,skill);skill.castAt=null;}
    if(skill.timer>0||skill.castAt!==null||!target||distance(target,player)>425)return;
    poseForAttack(target);skill.castAt=elapsed+.10;skill.timer=skill.cooldown;
  });
  jigongShots=jigongShots.filter(shot=>advanceJigongShot(shot,dt,enemies));
  for(const enemy of enemies)if(enemy.jigongWaterNextTick!==undefined)tickJigongWater(enemy);
}
function updateSkills(dt,enemies,canAttack=true){
  const qi=player.qi;
  qi.timer=Math.max(0,qi.timer-dt);
  player.ringTimer-=dt;player.brickTimer-=dt;
  const jigong=player.character==='jigong';
  let target;
  if(canAttack&&(qi.timer===0||(player.rings&&player.ringTimer<=0)||(player.bricks&&player.brickTimer<=0)||
    (jigong&&player.jigong.some((skill,index)=>player.skillLevels[index]&&skill.timer<=dt)))){
    const targets=nearestTargets(enemies);
    target=targets[0];
    const aim=target?Math.atan2(target.y-player.y,target.x-player.x):player.heading;
    if(qi.timer===0&&target&&distance(target,player)<=qiRange){
      poseForAttack(target);
      for(const enemy of targets.slice(0,qi.targets)){
        if(distance(enemy,player)>qiRange)break;
        launchTargetedBolt(player,enemy,qiSpeed);
      }
      qi.timer=qi.cooldown;
    }
    if(player.rings&&player.ringTimer<=0&&target){
      poseForAttack(target);
      for(let i=0;i<player.rings;i++){
        const offset=i-(player.rings-1)/2;
        const angle=aim+(player.pattern===2?i*2*Math.PI/player.rings:offset*(player.pattern===1?.29:.037));
        const lag=player.pattern===0?i*.075:0;
        shots.push({x:player.x,y:player.y,angle,lag,life:1.2,fire:player.evolved[0]});
      }
      player.ringTimer=ringCooldown;
    }
    if(player.bricks&&player.brickTimer<=0&&target){
      poseForAttack(target);
      for(let i=0;i<player.bricks;i++){
        const enemy=targets[i%targets.length];
        const offset=targets.length<=i?12*(i%3-1):0;
        bricks.push({x:enemy.x+offset,y:enemy.y-offset,fromX:player.x,fromY:player.y,left:.4+i*.09,ingot:player.evolved[2]});
      }
      player.brickTimer=brickCooldown;
    }
  }
  if(jigong)stepJigongSkills(dt,target,enemies,canAttack);
  targetedBolts=targetedBolts.filter(bolt=>{
    bolt.life-=dt;
    if(bolt.life<=0||bolt.target.hp<=0)return false;
    const gap=distance(bolt,bolt.target),step=bolt.speed*dt;
    if(gap<=step+bolt.target.r){
      if(bolt.basePower===null)applyHit(bolt.target,Math.round(player.attack));
      else damage(bolt.target,bolt.basePower);
      return false;
    }
    const dx=bolt.target.x-bolt.x,dy=bolt.target.y-bolt.y;
    bolt.angle=Math.atan2(dy,dx);
    bolt.x+=dx*step/gap;bolt.y+=dy*step/gap;
    return true;
  });
  shots=shots.filter(shot=>{
    shot.lag-=dt;
    if(shot.lag>0){shot.x=player.x;shot.y=player.y;return true;}
    shot.life-=dt;
    if(shot.life<=0)return false;
    shot.x+=Math.cos(shot.angle)*415*dt;shot.y+=Math.sin(shot.angle)*415*dt;
    const hit=enemies.find(enemy=>enemy.hp>0&&distance(shot,enemy)<enemy.r+11);
    if(hit){
      const value=player.ringDamage*(shot.fire?1.5:1);
      damage(hit,value);
      if(shot.fire&&random()<ringExplosionChance)explodeRingHit(hit,value,enemies);
    }
    return !hit;
  });
  bricks=bricks.filter(brick=>{
    brick.left-=dt;
    if(brick.left>0)return true;
    sparks.push({x:brick.x,y:brick.y,life:.45,r:57});
    for(const enemy of enemies){
      if(enemy.hp<=0||distance(brick,enemy)>57+enemy.r)continue;
      damage(enemy,player.brickDamage);
      if(random()<.5)enemy.stun=3;
    }
    if(brick.ingot)ingots.push({x:brick.x,y:brick.y,life:10,nextShotAt:elapsed+ingotShotInterval});
    return false;
  });
}
function updateIngots(dt,enemies){
  ingots=ingots.filter(ingot=>{
    ingot.life-=dt;
    if(ingot.life<=0)return false;
    if(elapsed<ingot.nextShotAt)return true;
    let target=null,nearest=ingotRange;
    for(const enemy of enemies){
      if(enemy.hp<=0)continue;
      const gap=distance(ingot,enemy);
      if(gap<=nearest){target=enemy;nearest=gap;}
    }
    if(target){
      launchTargetedBolt(ingot,target,ingotShotSpeed,player.brickDamage*ingotShotDamage);
      ingot.nextShotAt+=ingotShotInterval;
    }else ingot.nextShotAt=elapsed+.16;
    return true;
  });
}
function wheelSweepsEnemy(enemy,start,sweep,hitRadius){
  const dx=enemy.x-player.x,dy=enemy.y-player.y;
  const gap=Math.hypot(dx,dy),reach=enemy.r+hitRadius;
  if(Math.abs(gap-wheelOrbitRadius)>=reach)return false;
  // Even spacing reduces all the wheel arcs to one repeating sector.
  const spacing=2*Math.PI/player.wheels;
  const relative=(Math.atan2(dy,dx)-start)%spacing;
  const offset=relative<0?relative+spacing:relative;
  if(offset<=sweep)return true;
  const angleGap=Math.min(offset-sweep,spacing-offset);
  return gap*gap+wheelOrbitRadius*wheelOrbitRadius-2*gap*wheelOrbitRadius*Math.cos(angleGap)<reach*reach;
}
reset();
return {frame,reset,updateSkills,updateIngots,advanceJigongWind,wheelSweepsEnemy,damage,poseForAttack,jigongSlowFactor,
  effects:()=>({targetedBolts,shots,bricks,ingots,jigongShots,jigongWindCasts})};
}
return {create};
})();
if(typeof module==='object')module.exports=NezhaCombat;
