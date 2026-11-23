let socialPlayerId=null;
let socialFeatures={};
let socialVersion='0.1123';
let socialState={unread:0,invitations:0,party:null};
let refreshSocialState=null,refreshWhisperTab=null,refreshSocialFriends=null;
let selectedWhisper=null,chatChannel='lobby',whisperDraft='';

function configureSocialAccount(account){
  socialPlayerId=account.playerId??null;
  socialFeatures=account.release?.features??{};
  socialVersion=account.release?.version??'0.1123';
}
function gameReleaseVersion(){return socialVersion;}
function socialElement(tag,content,className){
  const node=document.createElement(tag);
  if(content)node.textContent=content;
  if(className)node.className=className;
  return node;
}
function socialButton(label,click){
  const button=socialElement('button',label);
  button.type='button';button.onclick=click;
  return button;
}
function socialFeedback(){
  const feedback=socialElement('p',null,'social-status');feedback.setAttribute('role','status');
  return feedback;
}
function socialTab(id){return document.querySelector('[data-lobby-tab="'+id+'"]');}
function lobbySocialViews(){
  return [
    ...(socialFeatures.friends?[['friends','好友',mountFriends]]:[]),
    ...(socialFeatures.profile?[['account','帳號資訊',mountAccountInfo]]:[])
  ];
}
function socialAction(label,path,data,feedback,success,done){
  return socialButton(label,async event=>{
    const button=event.currentTarget;
    button.disabled=true;feedback.textContent='';
    try{
      await accountRequest('social/'+path,data);
      feedback.textContent=success??'';
      done?.();
      await refreshSocialState?.();
    }catch(error){feedback.textContent=error.message;}
    finally{button.disabled=false;}
  });
}
function socialPoll(signal,refresh){
  let timer;
  async function loop(){
    if(!document.hidden)await refresh();
    if(!signal.aborted)timer=setTimeout(loop,5000);
  }
  signal.addEventListener('abort',()=>clearTimeout(timer),{once:true});
  void loop();
}
function socialDialog(title){
  const dialog=socialElement('dialog',null,'update-log social-dialog');
  const header=socialElement('header');
  const heading=socialElement('h2',title);
  heading.id='active-social-title';
  dialog.setAttribute('aria-labelledby',heading.id);
  header.append(heading,socialButton('關閉',()=>dialog.close()));
  dialog.append(header);
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  document.body.append(dialog);
  return dialog;
}
function contactButton(player,label){
  const available=socialPlayerId&&player.id&&player.id!==socialPlayerId&&
    (socialFeatures.friends||socialFeatures.whispers||socialFeatures.parties);
  if(!available)return socialElement('strong',label??player.nickname);
  const show=()=>openPlayerActions(player);
  const button=socialButton(label??player.nickname,show);
  button.className='player-action';button.setAttribute('aria-haspopup','dialog');
  button.oncontextmenu=event=>{event.preventDefault();show();};
  return button;
}
function openPlayerActions(player){
  if(document.querySelector('.social-dialog[open]'))return;
  const dialog=socialDialog(player.nickname),actions=socialElement('div',null,'actions'),feedback=socialFeedback();
  if(socialFeatures.whispers)actions.append(socialButton('密語',()=>{dialog.close();beginWhisper(player);}));
  if(socialFeatures.friends){
    actions.append(socialAction('加好友','friends',{action:'request',targetId:player.id},feedback,'好友邀請已送出。',()=>refreshSocialFriends?.()));
    actions.append(socialAction('封鎖玩家','friends',{action:'block',targetId:player.id},feedback,'已封鎖這位玩家。',()=>refreshSocialFriends?.()));
  }
  if(socialFeatures.parties)actions.append(socialAction('邀請組隊','party',{action:'invite',targetId:player.id},feedback,'組隊邀請已送出。'));
  dialog.append(actions,feedback);dialog.showModal();
}
function beginWhisper(player){
  selectedWhisper=player;chatChannel='whispers';
  socialTab('chat')?.click();
  refreshWhisperTab?.();
}
function parseWhisperCommand(message){
  if(!/^\/w(?:\s|$)/i.test(message))return null;
  const match=/^\/w\s+(?:"([^"]+)"|([^\s"]+))\s+(.+)$/is.exec(message);
  if(!match)throw new Error('密語格式：/w "玩家暱稱" 訊息');
  return {targetNickname:match[1]??match[2],message:match[3].trim()};
}
function whisperReportButton(messageId){
  const button=socialButton('檢舉',()=>{
    if(document.querySelector('dialog[open]'))return;
    const dialog=socialDialog('檢舉這則密語');
    const form=socialElement('form',null,'actions'),label=socialElement('label','檢舉原因','social-field');
    const reason=socialElement('select'),feedback=socialFeedback();
    for(const [key,title] of [['harassment','騷擾或辱罵'],['spam','洗版或可疑廣告'],['other','其他']]){
      const option=socialElement('option',title);option.value=key;reason.append(option);
    }
    const send=socialElement('button','送出檢舉');send.type='submit';
    label.append(reason);
    form.append(socialElement('p','只會將這一則密語交由 GM 處理。'),label,send,feedback);
    dialog.append(form);dialog.showModal();
    form.onsubmit=async event=>{
      event.preventDefault();send.disabled=true;
      try{
        await accountRequest('social/whispers',{action:'report',messageId,reason:reason.value});
        button.disabled=true;setText(button,'已檢舉');dialog.close();
      }catch(error){feedback.textContent=error.message;}
      finally{send.disabled=false;}
    };
  });
  button.className='whisper-report';
  return button;
}
function mountAccountInfo(container){
  lobbyHeading(container,'帳號資訊');
  const form=socialElement('form',null,'lobby-form');
  const label=socialElement('label','顯示暱稱','social-field');
  const input=socialElement('input');
  input.name='nickname';input.required=true;input.minLength=2;input.maxLength=16;
  input.autocomplete='nickname';input.value=document.querySelector('#nickname').textContent;
  label.append(input);
  const save=socialElement('button','儲存暱稱');save.type='submit';
  const feedback=socialFeedback();
  form.append(label,save);container.append(form,feedback);
  form.onsubmit=async event=>{
    event.preventDefault();
    save.disabled=true;feedback.textContent='';
    try{
      const result=await accountRequest('social/profile',{nickname:input.value.trim()});
      updateLobbyAccount(result);
      input.value=result.nickname;
      feedback.textContent='暱稱已更新。';
    }catch(error){feedback.textContent=error.message;}
    finally{save.disabled=false;}
  };
}
function mountFriends(container,signal){
  lobbyHeading(container,'好友名冊');
  const feedback=socialFeedback(),list=socialElement('div');
  const form=socialElement('form',null,'lobby-form'),field=socialElement('input');
  field.required=true;field.maxLength=16;field.placeholder='玩家暱稱';field.setAttribute('aria-label','玩家暱稱');
  const add=socialElement('button','送出好友邀請');add.type='submit';
  form.append(field,add);container.append(form,feedback,list);
  let revision=0,rendered='';
  async function refresh(){
    const version=++revision;
    try{
      const result=await accountRequest('social/friends',null,signal);
      if(signal.aborted||version!==revision||JSON.stringify(result)===rendered)return;
      rendered=JSON.stringify(result);
      list.replaceChildren();
      for(const [title,people] of [
        ['收到的邀請',result.friends.filter(p=>p.status==='received')],
        ['已送出的邀請',result.friends.filter(p=>p.status==='sent')],
        ['好友',result.friends.filter(p=>p.status==='friend')],
        ['封鎖名單',result.blocked]
      ]){
        list.append(socialElement('h3',title));
        if(!people.length){list.append(socialElement('p','無','social-release'));continue;}
        const items=socialElement('ul',null,'social-list');
        for(const p of people){
          const row=socialElement('li');
          row.append(title==='封鎖名單'?socialElement('strong',p.nickname):contactButton(p));
          const actions=socialElement('div',null,'social-actions');
          const friend=(label,action)=>socialAction(label,'friends',{action,targetId:p.id},feedback,'已更新好友名冊。',refresh);
          if(p.status==='received')actions.append(friend('接受','accept'),friend('拒絕','remove'));
          else if(p.status==='sent')actions.append(friend('取消','remove'));
          else if(p.status==='friend'){
            if(socialFeatures.whispers)actions.append(socialButton('密語',()=>beginWhisper(p)));
            if(socialFeatures.parties)actions.append(socialAction('邀請組隊','party',{action:'invite',targetId:p.id},feedback,'組隊邀請已送出。'));
            actions.append(friend('移除','remove'));
          }else actions.append(friend('解除封鎖','unblock'));
          row.append(actions);items.append(row);
        }
        list.append(items);
      }
    }catch(error){if(!signal.aborted&&version===revision)feedback.textContent=error.message;}
  }
  form.onsubmit=async event=>{
    event.preventDefault();
    add.disabled=true;feedback.textContent='';
    try{
      await accountRequest('social/friends',{action:'request',targetNickname:field.value.trim()},signal);
      field.value='';feedback.textContent='好友邀請已送出。';
      await refresh();
    }catch(error){if(!signal.aborted)feedback.textContent=error.message;}
    finally{add.disabled=false;}
  };
  refreshSocialFriends=refresh;
  signal.addEventListener('abort',()=>{if(refreshSocialFriends===refresh)refreshSocialFriends=null;},{once:true});
  socialPoll(signal,refresh);
}
function mountSocialRail(panels,rail,signal){
  if(!Object.values(socialFeatures).some(Boolean)||!socialPlayerId)return;
  let revision=0,rendered='',seenInvite='',inviteDialog;
  function showPartyInvite(party){
    if(!party||party.joinedAt||party.guest.id!==socialPlayerId||seenInvite===party.id||document.querySelector('dialog[open]'))return;
    seenInvite=party.id;
    inviteDialog=socialDialog('組隊邀請');
    const message=socialElement('p',party.leader.nickname+' 邀請你一起組隊。'),reply=socialFeedback();
    const controls=socialElement('div',null,'social-actions');
    const close=()=>inviteDialog?.close();
    controls.append(
      socialAction('接受','party',{action:'accept',partyId:party.id},reply,'',close),
      socialAction('拒絕','party',{action:'leave',partyId:party.id},reply,'',close));
    inviteDialog.append(message,controls,reply);inviteDialog.showModal();
  }
  function renderParty(party){
    const snapshot=JSON.stringify(party);
    if(snapshot===rendered)return;
    rendered=snapshot;
    rail.hidden=!party;panels.classList.toggle('with-party',Boolean(party));
    rail.replaceChildren();
    if(!party){inviteDialog?.close();return;}
    const mine=party.leader.id===socialPlayerId;
    const feedback=socialFeedback();
    rail.append(socialElement('h2','雙人隊伍'));
    const members=socialElement('div',null,'party-members');
    for(const [member,status] of [[party.leader,party.leaderReady?'已準備':'隊長'],[party.guest,
      !party.joinedAt?'待接受':party.guestReady?'已準備':'未準備']]){
      const row=socialElement('div',null,'party-member');
      const labels=socialElement('div');
      labels.append(socialElement('strong',member.nickname),
        socialElement('small',member.id===party.leader.id&&party.joinedAt?'隊長・'+(party.leaderReady?'已準備':'未準備'):status));
      row.append(createHeroPortrait(member.selectedCharacter==='jigong'?'jigong':'nezha'),labels);
      members.append(row);
    }
    const partyAction=(label,action,extra={})=>socialAction(label,'party',{action,partyId:party.id,...extra},feedback);
    rail.append(members,feedback);
    const actions=socialElement('div',null,'social-actions');
    if(party.joinedAt){
      inviteDialog?.close();
      const ready=mine?party.leaderReady:party.guestReady;
      actions.append(partyAction(ready?'取消準備':'準備','ready',{ready:!ready}),partyAction('離開','leave'));
      const bothReady=party.leaderReady&&party.guestReady;
      const status=bothReady?'兩人皆已準備':'等待隊友準備';
      rail.append(socialElement('p',status+(socialFeatures.battle?'':'・合作戰鬥尚未開放')));
      if(socialFeatures.battle&&bothReady){
        actions.prepend(socialButton('進入雙人戰鬥',()=>{location.href='/games/nezha/battle';}));
      }
    }else if(mine){
      rail.append(socialElement('p','等待對方確認'));
      actions.append(partyAction('取消邀請','leave'));
    }else{
      actions.append(partyAction('接受','accept'),partyAction('拒絕','leave'));
    }
    rail.append(actions);
  }
  async function refresh(){
    const current=++revision;
    try{
      const state=await accountRequest('social/state',null,signal);
      if(signal.aborted||current!==revision)return;
      updateUnread(state.unread);
      const friends=socialTab('friends');
      if(friends)setText(friends,state.invitations?'好友 ('+state.invitations+')':'好友');
      socialState=state;
      renderParty(state.party);
      showPartyInvite(state.party);
      refreshLobbyPlay();
    }catch{ /* Leave the last visible state intact while offline. */ }
  }
  refreshSocialState=refresh;
  signal.addEventListener('abort',()=>{
    inviteDialog?.close();
    if(refreshSocialState===refresh)refreshSocialState=null;
  },{once:true});
  if(socialFeatures.friends||socialFeatures.whispers||socialFeatures.parties)socialPoll(signal,refresh);
}
function updateUnread(unread){
  socialState.unread=unread;
  const chat=socialTab('chat');
  if(chat)setText(chat,unread?'聊天室 ('+Math.min(99,unread)+')':'聊天室');
  const tab=document.querySelector('#social-whisper-channel');
  if(tab)setText(tab,unread?'密語 ('+Math.min(99,unread)+')':'密語');
}
