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
