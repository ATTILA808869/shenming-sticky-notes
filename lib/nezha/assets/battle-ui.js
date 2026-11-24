const NezhaUi=(()=>{
  const xpNumber=new Intl.NumberFormat('zh-TW');
  const formatTime=value=>Math.floor(value/60)+':'+String(Math.floor(value)%60).padStart(2,'0');
  function setText(node,value){
    const text=String(value);
    if(node.textContent!==text)node.textContent=text;
  }
  function setProgress(node,value,max=1){
    if(node.max!==max)node.max=max;
    const next=Math.min(max,Math.max(0,value));
    if(node.value!==next||!node.hasAttribute('value'))node.value=next;
  }
  function mountHud(doc,rules){
    const byId=id=>doc.getElementById(id);
    const health=byId('health'),attack=byId('attack'),defense=byId('defense'),moveSpeed=byId('moveSpeed');
    const clock=byId('clock'),level=byId('level'),wave=byId('wave'),score=byId('score'),xp=byId('xp'),gear=byId('gear');
    const bossbar=byId('bossbar'),bossname=byId('bossname'),bossHP=byId('bossHP');
    const spend=byId('spendXP');
    const [qiSlot,...skillSlots]=[...doc.querySelectorAll('.skill')].map((node,index)=>{
      const title=node.querySelector('strong');
      const slot={name:title,status:node.querySelector('small'),bar:node.querySelector('progress')};
      if(!index)return slot;
      const icon=doc.createElement('canvas'),name=doc.createElement('span');
      icon.className='skill-icon';icon.width=icon.height=40;icon.hidden=true;
      icon.setAttribute('aria-hidden','true');title.classList.add('skill-title');
      title.append(icon,name);
      return {...slot,name,icon,paintedIcon:null};
    });
    function skills(p){
      setText(qiSlot.name,'氣功普攻');
      setText(qiSlot.status,'強化 '+p.qi.rank+' · '+Math.max(0,p.qi.timer).toFixed(2)+' 秒');
      setProgress(qiSlot.bar,1-p.qi.timer/p.qi.cooldown);
      const jigong=p.character==='jigong';
      const limits=jigong?p.jigong.map(skill=>skill.cooldown):[rules.ringCooldown,rules.wheelCooldown,rules.brickCooldown];
      const remaining=jigong?p.jigong.map(skill=>skill.timer):[p.ringTimer,p.wheelTimer,p.brickTimer];
      const open=rules.hasSlot(p);
      skillSlots.forEach((slot,i)=>{
        const {name,status,bar,icon}=slot;
        const title=rules.activeName(p,i),rank=p.skillLevels[i],cooldown=Math.max(0,remaining[i]);
        const iconKey=NezhaSkillArt.iconFor(p,i);
        if(iconKey!==slot.paintedIcon){
          icon.hidden=!iconKey||!NezhaSkillArt.paintIcon(icon,iconKey);
          slot.paintedIcon=icon.hidden?null:iconKey;
        }
        setText(name,(i+1)+' '+title);
        if(bar.getAttribute('aria-label')!==title+'冷卻')bar.setAttribute('aria-label',title+'冷卻');
        setText(status,rank?'Lv.'+rank+' · CD '+cooldown.toFixed(1)+' 秒':open?'尚未解鎖':'需絕世寶典');
        setProgress(bar,rank?1-cooldown/limits[i]:0);
      });
      setText(gear,rules.gearNames.map((name,i)=>name+' Lv.'+p.gear[i]).join('　'));
    }
    return {spend,render({player:p,time=0,floor=0,floorKills=0,waveIndex=0,boss=null,kills=0,needed,ready=0,bossCast=''}) {
      if(!p)return;
      skills(p);
      setText(health,Math.ceil(p.hp)+'/'+p.maxHp);
      setText(attack,Math.round(p.attack*100)/100);
      setText(defense,Math.round(p.defense*100)/100);
      setText(moveSpeed,p.speed+'/'+rules.maxMoveSpeed);
      setText(clock,floor?'無限塔 '+floor+' 層':formatTime(time)+(boss?' 暫停':' / '+formatTime(rules.storyDuration)));
      setText(level,'等級 '+p.level);
      let message='',warning=false;
      if(floor)message=boss?(bossCast||'守關魔王出現'):'本層擊退 '+Math.min(floorKills,rules.towerGoal)+' / '+rules.towerGoal;
      else if(!boss){
        const entry=rules.storyWaves[waveIndex],until=entry?entry.at-time:Infinity;
        if(until>0&&until<=4){warning=true;message='怪潮預警・'+Math.ceil(until)+' 秒';}
        else if(entry&&until<=0)message=entry.name+'・'+Math.max(0,Math.ceil(entry.duration+until))+' 秒';
      }
      wave.hidden=!message;wave.classList.toggle('wave-warning',warning);setText(wave,message);
      bossbar.hidden=!boss;
      if(boss){
        setText(bossname,boss.name+(boss.pressure>0?' · 強化 '+Math.round(boss.pressure*100)+'%':''));
        setProgress(bossHP,boss.hp,boss.maxHp);
      }
      setText(score,'擊退 '+kills+' · XP '+xpNumber.format(p.xp)+' / '+xpNumber.format(needed));
      spend.disabled=!ready;
      setText(spend,ready?'升級 ×'+(ready>99?'99+':ready):'升級');
      setProgress(xp,p.xp,needed);
    }};
  }

  function mountTowerLoot(doc){
    const overlay=doc.createElement('div');overlay.className='tower-loot';overlay.hidden=true;
    const label=doc.createElement('span');label.setAttribute('role','status');
    const numeral=doc.createElement('strong');numeral.setAttribute('aria-hidden','true');
    overlay.append(label,numeral);doc.querySelector('.field').append(overlay);
    let last=-1;
    return state=>{
      overlay.hidden=!state;
      if(!state){last=-1;return;}
      const {seconds,tome}=state;
      setText(label,tome?'絕世寶典已掉落，請靠近拾取':'本層通過・拾取戰利品');
      if(seconds===last)return;
      last=seconds;
      numeral.hidden=!seconds;
      if(seconds){
        numeral.textContent=String(seconds);
        numeral.classList.remove('tower-digit-enter');
        void numeral.offsetWidth;
        numeral.classList.add('tower-digit-enter');
      }
    };
  }
  function mountReleaseNotice(doc){
    const valid=/^[a-f0-9]{16}$/;
    const revision=doc.querySelector('meta[name="nezha-revision"]')?.content;
    if(!valid.test(revision??''))return;
    const notice=doc.createElement('p');notice.className='nezha-release-notice';
    notice.setAttribute('role','status');notice.hidden=true;
    doc.querySelector('main > header').after(notice);
    let pending=false;
    async function check(){
      if(pending||doc.hidden||!notice.hidden)return;
      pending=true;
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),8000);
      try{
        const response=await fetch('/games/nezha/api/revision',{cache:'no-store',credentials:'omit',signal:controller.signal});
        if(!response.ok)return;
        const latest=(await response.json())?.revision;
        if(typeof latest!=='string'||!valid.test(latest)||latest===revision)return;
        notice.hidden=false;
        notice.textContent='已有最新版，請在本局結束後重新整理頁面。';
        clearInterval(timer);
        doc.removeEventListener('visibilitychange',check);
      }catch{/* A temporary connection problem should not interrupt the game. */}
      finally{pending=false;clearTimeout(timeout);}
    }
    const timer=setInterval(check,60000);
    doc.addEventListener('visibilitychange',check);
    void check();
  }
const updateHistory=[
  {date:'2026-11-24',title:'絕世寶典掉落率調整',changes:[
    ['絕世寶典','單人與雙人模式的無限塔守關魔王，寶典掉落率由 5% 提高到 15%。寶典仍須靠近拾取，才會解鎖本局第三個法寶欄。']
  ]},
  {date:'2026-11-24',title:'布告欄輪播調整',changes:[
    ['切換橫幅','自動輪播每 5 秒換圖。提前載入相鄰橫幅，切換時保留上一張直到新圖可以顯示。']
  ]},
  {date:'2026-11-24',title:'大廳導覽與布告欄改版',changes:[
    ['大廳導覽','調整聊天室與排行榜的順序，廟埕布告欄移至獨立分頁。點擊橫幅仍會另開分頁。'],
    ['帳號資訊','右上角可開啟帳號視窗並修改顯示暱稱，不需切換大廳分頁。']
  ]},
  {date:'2026-11-23',title:'無限塔戰利品與塔王招式',changes:[
    ['絕世寶典','擊倒每層守關魔王有 5% 機率掉落寶典。寶典會落在戰場，必須靠近拾取才能解鎖本局第三個法寶欄。'],
    ['樓層倒數','通過一層後停戰 5 秒，可自由移動與拾取戰利品；若寶典尚未被撿起，倒數結束後仍會等待。'],
    ['塔王與結算','塔王新增龍王衝鋒、破空氣功及像素預警特效。通過至少一層後，可從 ESC 選單結算並儲存排行榜紀錄。'],
    ['版本提醒','偵測到新版時，遊戲會提醒玩家在本局結束後重新整理頁面，不會自動中斷對局。']
  ]},
  {date:'2026-11-23',title:'廟埕布告欄與絕世寶典調整',changes:[
    ['廟埕布告欄','大廳新增活動公告與廣告輪播。點選橫幅會另開分頁，保留目前的遊戲畫面。'],
    ['絕世寶典','單人與雙人模式中，無限塔每層守關魔王的寶典掉落機率由 0.5% 提高至 5%。取得後可解鎖本局的第三個法寶欄。'],
    ['法寶美術','乾坤圈、清新扇與葫蘆寶換上新版縮圖。移除新版法寶底下殘留的舊圖形、光圈和尾跡；魔王預警及技能數值不變。']
  ]},
  {date:'2026-11-23',title:'三太子與濟公法寶像素特效更新',changes:[
    ['三太子','風火輪、火焰風火輪和三昧真火改用新版像素動畫；火焰尾跡會跟著每顆輪子的繞行方向。金磚與無敵元寶換上新圖。'],
    ['濟公禪師','開道鞋換上旋轉拖鞋動畫；葫蘆寶與甘露乾坤葫改用會跟隨飛行方向的像素水彈。'],
    ['單人與雙人','共用新版特效與技能圖示，傷害、命中範圍和冷卻不變。']
  ]},
  {date:'2026-11-23',title:'雙人介面與戰利品同步',changes:[
    ['戰鬥介面','雙人沿用單人的血量、能力、魔王、經驗、法寶冷卻和強化介面，並保留隊友狀態與救援進度。'],
    ['共用戰利品','兩人共享經驗值；補血道具為兩位存活玩家各回復 10% 最大血量。磁鐵吸取全場掉落物，炸彈的擊殺與特效會同步給隊伍。'],
    ['滿版戰場','雙方共享完整地圖，但各自使用獨立視角。隊友離開畫面會顯示方向，兩人都倒地後自動回到大廳。']
  ]},
  {date:'2026-11-23',title:'雙人主線、共用無限塔排行與救援',changes:[
    ['雙人闖關','兩位玩家從 8 分鐘主線出發，在第 2、5、8 分鐘挑戰魔王。擊退龍王後進入無限塔，每層擊退 1,000 隻怪物後挑戰守關魔王。'],
    ['強化與怪物','雙人共用單人的怪物種類、氣功、法寶及進化規則。雙方共享拾取的經驗值，但各自選擇強化；小魔王仍提供神刀、神甲、神馬和大魂丹四選一。'],
    ['救援','一方倒地後，隊友在救援範圍內停留 3 秒，可使倒地玩家恢復 30% 最大生命。離開範圍會中斷，兩人都倒地才結束。'],
    ['無限塔魔王與榜單','單人與雙人塔王都新增天火隕落、玄冰環陣、裂地雷擊與八方震波，施放前會標出範圍。雙人通過塔層的成績會更新至原有的個人前 100 名排行榜，只覆蓋更高的通關紀錄。']
  ]},
  {date:'2026-11-23',title:'重大更新001・版本 0.112301',changes:[
    ['帳號與好友','可在大廳修改暱稱，並送出、接受好友邀請；改名不會影響好友或遊戲進度。'],
    ['密語頻道','點選玩家名稱或在電腦按右鍵可開啟互動選單。密語在獨立頻道接收，並顯示未讀提醒。'],
    ['玩家檢舉','收到不當密語時，可單獨檢舉該則訊息。GM 不會因此取得其他私人對話。'],
    ['排行榜留言','前 100 名玩家可隨時設定或修改自己的留言，最多 80 字，不需要提升名次。'],
    ['雙人隊伍大廳','可邀請隊友、接受或拒絕邀請，並查看雙方角色與準備狀態。合作試玩開放時，兩人準備後即可進入同一場戰鬥。']
  ]},
  {date:'2026-11-23',title:'無限塔起點與高等升級調整',changes:[
    ['無限塔起點','通過第 1 層後，帳號會記錄起點資格。新局可照常從廟埕開始，或直接從無限塔第 1 層開始。塔起點角色為 Lv.50，入場前可選 50 次升級配點及 25 次小魔王戰利品。'],
    ['強化道具','神刀與神甲不設強化上限。神馬在移速到達 100 後停止強化。大魂丹的最大血量上限改為 1,000，到頂後每次選擇改為回復 60% 最大血量。'],
    ['升級面板','修正無限塔累積足夠經驗值卻未自動升級，以及高等時升級選項用盡的問題。技能與氣功普攻仍維持 Lv.25 上限。']
  ]},
  {date:'2026-11-23',title:'濟公禪師進化法寶再強化',changes:[
    ['開道鞋・八方神行鞋','拖鞋外觀與命中半徑調整為原版的 2 倍，進化後的來回飛行皆適用。'],
    ['伏魔回風扇','施放時在濟公周圍留下 10 個環形颶風眼，會吸引附近敵人，對大小魔王的拉力較弱。風眼持續 6 秒，每 0.5 秒造成清新扇基礎傷害的 60%；重疊不疊傷。'],
    ['甘露乾坤葫','水花保留原有減速，並讓目標持續 10 秒、每秒損失 3% 最大血量。再次命中會刷新持續時間，傷害不疊加。']
  ]},
  {date:'2026-11-23',title:'濟公禪師法寶傷害調整',changes:[
    ['開道鞋・八方神行鞋','基礎傷害由 14 提高至 22，每次傷害強化由＋4 提高至＋6。拖鞋外觀與命中半徑放大 50%，折返傷害仍為強化後傷害的 40%。'],
    ['葫蘆寶・甘露乾坤葫','基礎傷害由 18 提高至 24，每次傷害強化由＋5 提高至＋7。減速效果與間隔不變。'],
    ['清新扇・伏魔回風扇','基礎傷害由 15 提高至 21，每次傷害強化由＋4 提高至＋6。風眼仍按清新扇傷害的 25% 計算，重疊不疊傷。'],
    ['平衡','怪物血量成長、法寶冷卻和數量上限不變；三太子不受影響。']
  ]},
  {date:'2026-11-22',title:'濟公禪師法寶進化',changes:[
    ['八方神行鞋','開道鞋 10 級並取得神馬後進化。鞋子飛出後沿原路折返，回程造成 40% 傷害；同一波每隻怪最多承受一次折返命中。'],
    ['甘露乾坤葫','葫蘆寶 10 級並取得大魂丹後進化。水花讓一般怪物減速 20%，魔王減速 10%，持續 1.2 秒；同一目標每 2 秒最多觸發一次。'],
    ['伏魔回風扇','清新扇 10 級並取得神刀後進化。每次施放最多留下 3 個風眼，持續 1.5 秒、每 0.5 秒造成 25% 傷害，重疊不疊傷。'],
    ['平衡','三種法寶的數量上限與冷卻下限不變，三太子的進化效果也不變。']
  ]},
  {date:'2026-11-22',title:'大廳與排行榜管理更新',changes:[
    ['大廳聊天','管理員可移除違規訊息或限制發言。禁言不影響閱讀聊天或遊玩，到期後可再次發送訊息。'],
    ['排行榜','管理員可移除不當留言，玩家的排名、通過樓層與成績不受影響。'],
    ['角色資格','帳號的角色資格更新後，重新開啟大廳「角色」即可同步。已開始的對局不會換角。']
  ]},
  {date:'2026-11-22',title:'濟公禪師加入廟埕',changes:[
    ['新角色','擊敗主線超級龍王並進入無限塔第 1 層，即可解鎖濟公禪師。到大廳「角色」選擇下一局的出戰角色；暫停中的對局不會換角。'],
    ['開道鞋','向八方射出貫穿鞋子，最多 20 隻。'],
    ['葫蘆寶','從前、後、左、右射出貫穿水花，最多 16 個方位。'],
    ['清新扇','扇出迴旋向外的龍捲風，最多 25 道。'],
    ['戰鬥強化','濟公保留氣功普攻。法寶可強化傷害、數量或方位，並縮短冷卻時間。'],
    ['遊戲介面','角色未解鎖時會以剪影顯示。右上方新增更新日誌；在遊戲中開啟時，本局會暫停。']
  ]},
  {date:'2026-11-22',title:'玩家大廳改版',changes:[
    ['大廳','登入後可直接查看無限塔排行榜、聊天或查看角色。遊戲中回大廳不會清除對局進度。'],
    ['行動裝置','廟埕支援雙指縮放，角色腳下新增即時血量條。三太子縮放時保留高解析度像素細節。']
  ]}
];
  function mountUpdateLog(doc,beforeOpen){
    const dialog=doc.getElementById('update-log'),entries=doc.getElementById('update-entries');
    for(const entry of updateHistory){
      const section=doc.createElement('section');
      const title=doc.createElement('h3');title.textContent=entry.title;
      const date=doc.createElement('time');date.dateTime=entry.date;date.textContent=entry.date.replaceAll('-','/');
      const list=doc.createElement('ul');
      for(const [label,detail] of entry.changes){
        const item=doc.createElement('li'),heading=doc.createElement('strong');heading.textContent=label+'：';
        item.append(heading,detail);list.append(item);
      }
      section.append(title,date,list);entries.append(section);
    }
    doc.getElementById('updates').onclick=()=>{
      beforeOpen?.();
      if(!dialog.open)dialog.showModal();
    };
    return dialog;
  }
  return {mountHud,mountTowerLoot,mountReleaseNotice,mountUpdateLog,setText};
})();
