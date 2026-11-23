const NezhaRules=(()=>{
  const baseStats={hp:100,attack:25,defense:25,speed:45};
  const maxHealth=1000,maxMoveSpeed=100,maxUpgradeLevel=25;
  const attackGainPerLevel=2,defenseGainPerLevel=1,milestoneLevels=10,milestoneStatFactor=1.05;
  const swordAttackGain=4,armorDefenseGain=9,normalSkillLimit=2,favoriteRouteFactor=1.30;
  const baseQi={cooldown:1.05,targets:1};
  const qiAttackGain=3,qiRange=360,qiSpeed=680,qiMinCooldown=.35,qiMaxTargets=5;
  const maxWheels=8,wheelOrbitRadius=96,wheelHitRadius=23,wheelEvolutionScale=Math.SQRT2,wheelKnockbackCooldown=.5;
  const ringCooldown=.78,ringExplosionChance=.30,ringExplosionDamage=.45,ringExplosionLife=.4;
  const brickCooldown=5,wheelCooldown=.28,ingotRange=230,ingotShotInterval=1,ingotShotDamage=.45,ingotShotSpeed=560;
  const jigongReturnPower=.4,jigongSlowTime=1.2,jigongSlowInterval=2,jigongWaterTime=10,jigongWaterInterval=1,jigongWaterDamage=.03;
  const jigongWindRadius=42,jigongWindRingRadius=124,jigongWindEyes=10,jigongWindTime=6,jigongWindInterval=.5,jigongWindPower=.60,jigongWindPullSpeed=180;
  const skillNames=['乾坤圈','超級風火輪','超級金磚'],evolvedNames=['三昧真火','火焰風火輪','無敵元寶'];
  const jigongEvolvedNames=['八方神行鞋','甘露乾坤葫','伏魔回風扇'];
  const unlockLabels=['乾坤圈・選擇發射型態','超級風火輪・繞身旋轉','超級金磚・範圍攻擊與暈眩'];
  const gearNames=['大魂丹','神甲','神馬','神刀'],evolutionGear=[3,2,1],jigongEvolutionGear=[2,0,3];
  const patterns=['集中','扇形','八方'];
  const bossStages=[
    {at:120,name:'超級大幽靈',xp:500,hp:210,attack:22,speed:70,r:35,color:'#e9d8ff',interval:3.5},
    {at:300,name:'重甲幽靈',xp:500,hp:465,attack:32,speed:59,r:42,color:'#b8b0ee',interval:2.8},
    {at:480,name:'超級龍王',xp:1000,hp:870,attack:42,speed:87,r:49,color:'#61d9a5',interval:2.7}
  ];
  const storyDuration=480,towerGoal=1000,towerBaselineFloor=4,towerFloorGrowth=1.15,towerHealthBoost=1.35,towerDamageBoost=1.12;
  const storyWaves=[
    {at:80,duration:25,count:60,name:'幽靈來襲',kinds:['shade','shade','shade','runner','shade']},
    {at:210,duration:25,count:85,name:'疾風夾擊',kinds:['runner','runner','shade','runner','runner'],split:true},
    {at:375,duration:30,count:110,name:'重甲壓陣',kinds:['guard','guard','shade','guard','guard','caster','guard','shade','guard','shade']}
  ];
  const towerGuardians=[
    {name:'獄火龍王',color:'#ff8665',speed:95,interval:2.65},
    {name:'雷鳴龍王',color:'#b4a5ff',speed:114,interval:2.5},
    {name:'玄冰龍王',color:'#80dbe7',speed:83,interval:2.85}
  ];
  const towerPatterns=[
    ['meteor','ring','line','cross'],
    ['line','cross','ring','meteor'],
    ['ring','meteor','cross','line']
  ];
  function towerCast(floor,cast,boss,target){
    const pattern=towerPatterns[(floor-1)%3][cast%4],marks=[];
    const mark=(x,y,r)=>marks.push({x,y,r});
    let name,duration,power;
    if(pattern==='meteor'){
      name='天火隕落';duration=1.55;power=1.15;
      mark(target.x,target.y,122);
      for(let i=0;i<3;i++){
        const a=(i/3+cast/8)*Math.PI*2;
        mark(target.x+Math.cos(a)*185,target.y+Math.sin(a)*185,68);
      }
    }else if(pattern==='ring'){
      name='玄冰環陣';duration=1.7;power=.92;
      for(let i=0;i<10;i++){
        const a=i*Math.PI/5;
        mark(boss.x+Math.cos(a)*195,boss.y+Math.sin(a)*195,74);
      }
    }else if(pattern==='line'){
      name='裂地雷擊';duration=1.4;power=1.05;
      const a=Math.atan2(target.y-boss.y,target.x-boss.x);
      for(let i=1;i<=7;i++)mark(boss.x+Math.cos(a)*i*62,boss.y+Math.sin(a)*i*62,51);
    }else{
      name='八方震波';duration=1.55;power=.95;
      const offset=Math.floor(cast/4)%2*Math.PI/4;
      mark(boss.x,boss.y,82);
      for(let i=0;i<4;i++)for(let j=1;j<=3;j++){
        const a=offset+i*Math.PI/2;
        mark(boss.x+Math.cos(a)*j*85,boss.y+Math.sin(a)*j*85,53);
      }
    }
    return {name,duration,power,marks};
  }
  function enemyXP(seconds,towerFloor,mini){
    const timeXP=n=>{const minutes=Math.floor(n/60);return 1+minutes+Math.floor(minutes/3);};
    let base=timeXP(seconds);
    if(towerFloor)base+=20-timeXP(storyDuration)+Math.min(towerFloor,towerBaselineFloor)*2;
    else if(seconds>=300){
      const progress=Math.min(1,(seconds-300)/150),start=timeXP(300);
      base=Math.max(base,start+Math.floor((20-start)*progress));
    }
    return base*(mini?3:1);
  }
  const miniTypes=[
    {name:'赤焰幽靈',color:'#fb8577',hp:75,attack:12,speed:107,r:24},
    {name:'鐵甲幽靈',color:'#9ca9ea',hp:125,attack:17,speed:68,r:28},
    {name:'疾風幽靈',color:'#92ded0',hp:65,attack:10,speed:131,r:21}
  ];
  const mobKinds={
    shade:{hp:1,attack:1,speed:1,radius:13},
    runner:{hp:.64,attack:.7,speed:1.38,radius:11},
    guard:{hp:1.7,attack:1,speed:.72,radius:16},
    healer:{hp:.85,attack:.58,speed:.8,radius:13},
    caster:{hp:.95,attack:.74,speed:.82,radius:13}
  };
  const rangedAttacks={
    shade:{range:255,windup:.8,recovery:4.9,speed:180,radius:5,power:.60},
    runner:{range:220,windup:.62,recovery:4.5,speed:230,radius:4,power:.55},
    guard:{range:280,windup:1,recovery:5.6,speed:158,radius:8,power:.72},
    healer:{range:255,windup:.85,recovery:6.2,speed:177,radius:5,power:.58},
    caster:{range:280,windup:1.15,recovery:6,radius:30,power:.85,seal:true},
    mini:{range:320,windup:.88,recovery:3.7,speed:222,radius:8,power:.78}
  };
  const jigongSpecs=[
    {name:'開道鞋',label:'開道鞋・八方貫穿',count:8,step:2,max:20,power:22,gain:6,balancePower:14,balanceGain:4,cooldown:3.2,min:1.15,speed:390,life:1.15,r:16},
    {name:'葫蘆寶',label:'葫蘆寶・環射水花',count:4,step:4,max:16,power:24,gain:7,balancePower:18,balanceGain:5,cooldown:4,min:1.35,speed:345,life:1.10,r:11},
    {name:'清新扇',label:'清新扇・迴旋龍捲風',count:3,step:2,max:25,power:21,gain:6,balancePower:15,balanceGain:4,cooldown:5.2,min:1.65,speed:205,life:1.55,r:13}
  ];
  const jigongNames=jigongSpecs.map(spec=>spec.name);
  const forJigong=(p,a,b)=>p.character==='jigong'?b:a;
  const activeSkills=p=>forJigong(p,skillNames,jigongNames);
  const activeGear=p=>forJigong(p,evolutionGear,jigongEvolutionGear);
  const activeName=(p,i)=>p.evolved[i]?forJigong(p,evolvedNames,jigongEvolvedNames)[i]:activeSkills(p)[i];
  const hasSlot=p=>p.skillLevels.filter(Boolean).length<(p.skillTome?3:normalSkillLimit);
  function createCharacter(character){
    return {character,...baseStats,maxHp:baseStats.hp,qi:{...baseQi,rank:1,timer:0},xp:0,level:1,
      rings:0,ringDamage:baseStats.attack,pattern:0,wheels:0,wheelDamage:15,wheelSpeed:2.5,wheelAngle:0,wheelTimer:0,
      bricks:0,ringTimer:0,brickTimer:5,brickDamage:42,skillLevels:[0,0,0],skillRoutes:[null,null,null],skillTome:false,
      evolved:[false,false,false],gear:[0,0,0,0],jigong:jigongSpecs.map(s=>({count:s.count,damageUpgrades:0,cooldown:s.cooldown,timer:0,castAt:null}))};
  }
  function applyEvolutions(p){
    p.evolved=p.skillLevels.map((level,i)=>level>=10&&p.gear[activeGear(p)[i]]>0);
  }
  function gainLevel(p){
    p.level++;p.attack+=attackGainPerLevel;p.defense+=defenseGainPerLevel;
    if(p.level%milestoneLevels===0){p.attack*=milestoneStatFactor;p.defense*=milestoneStatFactor;}
  }
  function regularLevelXP(target){
    if(target<=20)return 5+10*(target-2);
    if(target<=40)return 195+13*(target-21);
    if(target>=50)return 599;
    return Math.round(599+(target-50)*(158/9));
  }
  function levelCost(target,tower=false){
    const base=target===21?795:target===41?2855:regularLevelXP(target);
    if(!tower)return base;
    if(target>=50)return 1800;
    return Math.round(base*1.15+(1800-599*1.15)*Math.max(0,target-41)/9);
  }
  function gearChoices(p){
    const hp=Math.min(28+4*p.gear[0],maxHealth-p.maxHp),speed=Math.min(4,maxMoveSpeed-p.speed);
    const gear=(i,label,apply)=>({label:gearNames[i]+(apply?' Lv.'+(p.gear[i]+1):'')+'・'+label,apply:apply?()=>{
      p.gear[i]++;apply();applyEvolutions(p);
    }:null});
    return [
      gear(3,'攻擊力＋'+swordAttackGain,()=>{p.attack+=swordAttackGain;}),
      gear(2,speed>0?'移動速度＋'+speed:'移速已達 '+maxMoveSpeed,speed>0?()=>{p.speed+=speed;}:null),
      gear(1,'防禦力＋'+armorDefenseGain,()=>{p.defense+=armorDefenseGain;}),
      gear(0,hp>0?'最大與目前血量＋'+hp:'回復 60% 最大血量',()=>{
        p.maxHp+=Math.max(0,hp);p.hp=Math.min(p.maxHp,p.hp+(hp>0?hp:p.maxHp*.6));
      })
    ];
  }
  function skillRoutes(p,i){
    const route=(key,label,apply,available)=>({key,label,apply,available});
    if(p.character==='jigong'){
      const spec=jigongSpecs[i],s=p.jigong[i];
      return [
        route('damage','傷害＋'+spec.gain,()=>{s.damageUpgrades++;}),
        route('count',(i===1?'發射方位':'數量')+'＋'+spec.step,()=>{s.count=Math.min(spec.max,s.count+spec.step);},()=>s.count<spec.max),
        route('cooldown','冷卻時間－10%',()=>{s.cooldown=Math.max(spec.min,Math.round(s.cooldown*.9*100)/100);},()=>s.cooldown>spec.min)
      ];
    }
    if(i===0)return [
      route('count','發射數量＋1',()=>{p.rings++;},()=>p.rings<8),
      route('damage','傷害＋7',()=>{p.ringDamage+=7;})
    ];
    if(i===1)return [
      route('count','數量＋1',()=>{p.wheels++;},()=>p.wheels<maxWheels),
      route('damage','傷害＋6',()=>{p.wheelDamage+=6;}),
      route('speed','旋轉速度＋20%',()=>{p.wheelSpeed*=1.2;})
    ];
    return [route('count','投擲數量＋1',()=>{p.bricks++;},()=>p.bricks<5),route('damage','傷害＋8',()=>{p.brickDamage+=8;})];
  }
  function learnSkill(p,i,pattern,key){
    if(!hasSlot(p)||p.skillLevels[i]||!skillRoutes(p,i).some(r=>r.key===key))return false;
    if(p.character!=='jigong'){
      if(i===0){p.rings=1;p.pattern=pattern;}
      else if(i===1)p.wheels=1;
      else p.bricks=1;
    }
    p.skillLevels[i]=1;p.skillRoutes[i]=key;return true;
  }
  function roll(choices,random){
    const favorite=choices.find(c=>c.favorite);
    if(choices.length===1)return choices[0];
    if(!favorite)return choices[Math.floor(random()*choices.length)];
    if(random()<favoriteRouteFactor/choices.length)return favorite;
    const other=choices.filter(c=>c!==favorite);
    return other[Math.floor(random()*other.length)];
  }
  function levelChoices(p,random=Math.random){
    const options=gearChoices(p);
    for(let i=0;i<3;i++){
      const level=p.skillLevels[i];
      if(!level){
        if(hasSlot(p))options.push({label:forJigong(p,unlockLabels[i],jigongSpecs[i].label),learn:i});
        continue;
      }
      const name=activeName(p,i);
      if(level>=maxUpgradeLevel){options.push({label:name+'・已達上限'});continue;}
      const req=activeGear(p)[i];
      const detail=(level===9||(p.character==='jigong'&&level>9))&&!p.evolved[i]&&!p.gear[req]?'・進化需'+gearNames[req]:'';
      options.push(roll(skillRoutes(p,i).filter(r=>!r.available||r.available()).map(r=>({
        label:name+' Lv.'+(level+1)+'・'+r.label+detail,favorite:r.key===p.skillRoutes[i],
        apply:()=>{r.apply();p.skillLevels[i]++;applyEvolutions(p);}
      })),random));
    }
    const qi=p.qi,qiOptions=[];
    if(qi.rank<maxUpgradeLevel){
      const add=(label,apply)=>qiOptions.push({label:'基礎氣功強化 '+(qi.rank+1)+'・'+label,apply:()=>{apply();qi.rank++;}});
      if(qi.cooldown>qiMinCooldown){
        const next=Math.max(qiMinCooldown,Math.round(qi.cooldown*.9*100)/100);
        add('攻速提升・間隔 '+next.toFixed(2)+' 秒',()=>{qi.cooldown=next;});
      }
      if(qi.targets<qiMaxTargets)add('目標數＋1',()=>{qi.targets++;});
      add('人物攻擊力＋'+qiAttackGain,()=>{p.attack+=qiAttackGain;});
      options.push(roll(qiOptions,random));
    }else options.push({label:'基礎氣功・已達上限'});
    return options;
  }
  function enemyKind(phase,roll){
    if(phase>=280&&roll<.05)return 'caster';
    if(phase>=165&&roll<.11)return 'healer';
    if(phase>=85&&roll<.23)return 'guard';
    if(phase>=45&&roll<.40)return 'runner';
    return 'shade';
  }
  const levelGrowth=(rate,level)=>1+rate*(level-1)**1.2;
  function enemyBalance(p,time,miniAttackScaling){
    const levelBonus=(p.level-1)*.5;
    const referenceAttack=baseStats.attack+levelBonus+p.gear[3]*swordAttackGain;
    const referenceDefense=baseStats.defense+levelBonus+p.gear[1]*armorDefenseGain;
    const durability=(p.maxHp/baseStats.hp)*(100+referenceDefense)/(100+baseStats.defense);
    const ring=p.ringDamage*(p.evolved[0]?1.5:1);
    let skillGrowth=Math.max(1,p.rings?ring/baseStats.attack:1,p.wheels?p.wheelDamage/15:1,p.bricks?p.brickDamage/42:1);
    let burst=p.rings*ring+p.wheels*p.wheelDamage+p.bricks*p.brickDamage;
    if(p.character==='jigong')p.jigong.forEach((skill,i)=>{
      if(!p.skillLevels[i])return;
      const spec=jigongSpecs[i],power=spec.balancePower+skill.damageUpgrades*spec.balanceGain;
      skillGrowth=Math.max(skillGrowth,power/spec.balancePower);burst+=Math.min(3,skill.count)*power;
    });
    return {time,attackGrowth:referenceAttack/baseStats.attack*skillGrowth,durability:durability**.65,
      level:Math.min(p.level,50),burst:burst*referenceAttack/baseStats.attack,miniAttackScaling};
  }
  function mobStats(kind,balance,wave=false,healthScale=1,attackScale=1){
    const {time,attackGrowth,level}=balance,t=mobKinds[kind],mid=Math.max(0,time-120),end=Math.max(0,time-300);
    const hp=Math.round((23+time*.112+mid*.025+end*.055)*(wave?.73:1)*attackGrowth**(wave?.35:.65)*
      levelGrowth(wave?.030:.042,level)*healthScale*t.hp);
    return {kind,hp,maxHp:hp,attack:(8+time*.037+mid*.008+end*.014)*(wave?.48:1)*t.attack*attackScale,
      speed:(67+time*.10+end*.04)*t.speed,r:t.radius};
  }
  function miniStats(type,balance,healthScale=1,attackScale=1){
    const growth=balance.miniAttackScaling?balance.attackGrowth**.75:1;
    const hp=Math.round((type.hp+balance.time*.24)*1.15*levelGrowth(.034,balance.level)*growth*healthScale);
    return {...type,mini:true,hp,maxHp:hp,attack:(type.attack+balance.time*.022)*attackScale};
  }
  function bossHealth(hp,balance,floor=0,healthScale=1){
    return Math.round(Math.max(hp*1.2*balance.attackGrowth**.65,balance.burst*(4+Math.log2(1+floor)*.4))*
      levelGrowth(.023,balance.level)*healthScale);
  }
  const hitValue=(value,defense)=>Math.max(1,Math.round(value*100/(100+defense)));
  return {baseStats,maxHealth,maxMoveSpeed,maxUpgradeLevel,attackGainPerLevel,defenseGainPerLevel,milestoneLevels,
    milestoneStatFactor,swordAttackGain,armorDefenseGain,normalSkillLimit,favoriteRouteFactor,baseQi,qiRange,qiSpeed,
    maxWheels,wheelOrbitRadius,wheelHitRadius,wheelEvolutionScale,wheelKnockbackCooldown,ringCooldown,ringExplosionChance,
    ringExplosionDamage,ringExplosionLife,brickCooldown,wheelCooldown,ingotRange,ingotShotInterval,ingotShotDamage,ingotShotSpeed,
    jigongReturnPower,jigongSlowTime,jigongSlowInterval,jigongWaterTime,jigongWaterInterval,jigongWaterDamage,jigongWindRadius,
    jigongWindRingRadius,jigongWindEyes,jigongWindTime,jigongWindInterval,jigongWindPower,jigongWindPullSpeed,
    bossStages,storyDuration,storyWaves,towerGoal,towerBaselineFloor,towerFloorGrowth,towerHealthBoost,towerDamageBoost,towerGuardians,towerCast,
    enemyXP,miniTypes,mobKinds,rangedAttacks,skillNames,jigongSpecs,patterns,gearNames,createCharacter,activeSkills,activeName,hasSlot,
    applyEvolutions,gainLevel,regularLevelXP,levelCost,gearChoices,skillRoutes,learnSkill,levelChoices,enemyKind,enemyBalance,
    mobStats,miniStats,bossHealth,hitValue};
})();
if(typeof module==='object')module.exports=NezhaRules;
