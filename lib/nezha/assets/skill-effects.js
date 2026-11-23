const NezhaSkillArt=(()=>{
  const cellWidth=704,cellHeight=560;
  const animated=(file,count,frameMs,anchorX,anchorY,coreWidth,icon)=>({
    file,count,frameMs,anchorX,anchorY,coreWidth,icon,
    x:0,y:0,w:cellWidth,h:cellHeight
  });
  const still=(x,y,w,h)=>({
    file:'items',count:1,frameMs:1,anchorX:w/2,anchorY:h/2,coreWidth:w,
    x,y,w,h,icon:[x,y,w,h]
  });
  const thumbnail=file=>({file:'icon-'+file,count:1,frameMs:1,anchorX:627,anchorY:627,coreWidth:1254,
    x:0,y:0,w:1254,h:1254,icon:[0,0,1254,1254]});
  // Keep the supplied frame timing and anchors; stills are regions of the original item sheet.
  const sprites={
    wheel:animated('wheel',3,75,352,280,204,[244,174,214,212]),
    flamingWheel:animated('flaming-wheel',8,55,352,280,176,[240,94,222,283]),
    samadhi:animated('samadhi',3,65,210,280,135,[144,161,274,229]),
    water:animated('water',3,65,210,280,135),
    slipper:animated('slipper',8,55,352,280,315,[260,119,188,324]),
    brick:still(925,101,370,269),
    ingot:still(1368,121,370,244),
    qiankun:thumbnail('qiankun'),
    fan:thumbnail('fan'),
    gourd:thumbnail('gourd')
  };
  const images=new Map(),listeners=new Set();
  function source(file){
    if(!images.has(file)){
      const image=new Image();
      image.decoding='async';
      image.onload=()=>{for(const listener of listeners)listener();};
      image.src='/games/nezha/skill-'+(file.startsWith('icon-')?file:'fx-'+file)+'.png';
      images.set(file,image);
    }
    const image=images.get(file);
    return image.complete&&image.naturalWidth>0?image:null;
  }
  function paint(ctx,key,x,y,coreWidth,time=0,angle=0){
    const sprite=sprites[key];
    if(!sprite)return false;
    const frames=Math.floor(Math.max(0,time)*1000/sprite.frameMs+1e-7);
    return paintFrame(ctx,sprite,x,y,coreWidth,frames%sprite.count,angle);
  }
  function paintFrame(ctx,sprite,x,y,coreWidth,frame,angle=0){
    const image=source(sprite.file);
    if(!image)return false;
    const {w,h,anchorX,anchorY}=sprite,scale=coreWidth/sprite.coreWidth;
    ctx.save();
    ctx.translate(x,y);
    if(angle)ctx.rotate(angle);
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(image,sprite.x+frame*w,sprite.y,w,h,-anchorX*scale,-anchorY*scale,w*scale,h*scale);
    ctx.restore();
    return true;
  }
  function paintWheel(ctx,point,scale){
    const flaming=scale>1,sprite=flaming?sprites.flamingWheel:sprites.wheel;
    const orbit=(point.orbitAngle??0)/(2*Math.PI);
    // Frame 0 flames upward: the tail opposes a wheel moving down on the right side.
    const discTurns=4,spokes=3;
    const step=flaming?Math.round(orbit*sprite.count):Math.floor(orbit*discTurns*spokes*sprite.count+1e-7);
    const frame=((step%sprite.count)+sprite.count)%sprite.count;
    return paintFrame(ctx,sprite,point.x,point.y,44*scale,frame);
  }
  function paintIcon(canvas,key){
    const sprite=sprites[key];
    if(!sprite?.icon)return false;
    const image=source(sprite.file);
    if(!image)return false;
    const ctx=canvas.getContext('2d');
    const [x,y,w,h]=sprite.icon;
    const scale=Math.min(canvas.width/w,canvas.height/h);
    const width=Math.round(w*scale),height=Math.round(h*scale);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(image,x,y,w,h,Math.round((canvas.width-width)/2),Math.round((canvas.height-height)/2),width,height);
    return true;
  }
  function iconFor(player,index){
    if(player.character==='jigong')return ['slipper','gourd','fan'][index];
    if(index===0)return player.evolved[0]?'samadhi':'qiankun';
    if(index===1)return player.evolved[1]?'flamingWheel':'wheel';
    return player.evolved[2]?'ingot':'brick';
  }
  function preload(){for(const {file} of Object.values(sprites))source(file);}
  return {paint,paintWheel,paintIcon,iconFor,preload,onReady:listener=>listeners.add(listener)};
})();
