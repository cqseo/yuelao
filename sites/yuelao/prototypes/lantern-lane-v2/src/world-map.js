/**
 * Yuexia V2.4 navigation map. Actual world geometry is the only source of truth.
 * World axes: +X=East/right, +Z=North. View yaw=0 faces -Z (South).
 * Map modes: camera-up (default), north-up (whole district).
 */
export function createMinimap({player,getYaw,extent,layout}) {
  const canvas=document.querySelector('#worldMap');
  const container=document.querySelector('#mapPanel');
  const toggle=document.querySelector('#mapToggle');
  const modeButton=document.querySelector('#mapMode');
  if(!canvas||!container)return {update(){},redraw(){},setMode(){}};
  const ctx=canvas.getContext('2d',{alpha:true});
  const W=200,H=176;
  canvas.width=W;canvas.height=H;
  let mode='follow'; // Camera-forward is always on top on entry.
  let stamp=-Infinity;
  const destinations=[
    {x:0,z:55,label:'望月台'},
    {x:-33,z:-21,label:'竹影庭'},
    {x:33,z:-21,label:'星愿湖'},
    {x:0,z:-74,label:'旧梦驿'},
    {x:0,z:-8,label:'灯火巷'},
    {x:-4.1,z:-10.7,label:'阿灯'},
  ];
  function setMode(value) {
    mode=value==='north'?'north':'follow';
    modeButton.textContent=mode==='north'?'北朝上':'视角朝上';
    modeButton.setAttribute('aria-pressed',String(mode==='north'));
    modeButton.title=mode==='north'?'目前北方朝上，点击切为视角朝上':'目前视角朝上，点击切为北方朝上';
    draw();
  }
  modeButton?.addEventListener('click',()=>setMode(mode==='north'?'follow':'north'));
  toggle?.addEventListener('click',()=>{
    const collapsed=container.classList.toggle('map-collapsed');
    toggle.setAttribute('aria-expanded',String(!collapsed));
  });
  if(innerWidth<430) {
    container.classList.add('map-collapsed');
    toggle?.setAttribute('aria-expanded','false');
  }
  // The same transform is used for geometry, labels, camera view and the player.
  function projection(){
    const yaw=getYaw();
    const centerX=player.position.x,centerZ=player.position.z;
    const scale= mode==='follow'?1.58:Math.min(W/(extent.maxX-extent.minX+20),H/(extent.maxZ-extent.minZ+20));
    return (x,z)=>{
      if(mode==='north'){
        return {
          x:W/2+(x-(extent.minX+extent.maxX)/2)*scale,
          y:H/2-(z-(extent.minZ+extent.maxZ)/2)*scale,
        };
      }
      const dx=x-centerX,dz=z-centerZ;
      return {
        x:W/2+(dx*Math.cos(yaw)-dz*Math.sin(yaw))*scale,
        y:H/2+(dx*Math.sin(yaw)+dz*Math.cos(yaw))*scale,
      };
    };
  }
  function fillPolygon(p,coords,color,stroke=null) {
    ctx.beginPath();
    for(let i=0;i<coords.length;i++){
      const v=p(coords[i][0],coords[i][1]);
      if(i===0)ctx.moveTo(v.x,v.y);else ctx.lineTo(v.x,v.y);
    }
    ctx.closePath();
    ctx.fillStyle=color;ctx.fill();
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.7;ctx.stroke();}
  }
  function rect(p,{x,z,w,d},color){
    fillPolygon(p,[
      [x-w/2,z-d/2],[x+w/2,z-d/2],
      [x+w/2,z+d/2],[x-w/2,z+d/2],
    ],color,'rgba(230,210,176,.24)');
  }
  function disk(p,x,z,r,scale,color) {
    const v=p(x,z);
    ctx.beginPath();ctx.arc(v.x,v.y,r*scale,0,Math.PI*2);
    ctx.fillStyle=color;ctx.fill();
  }
  function angleOfCamera() {
    return mode==='follow' ? 0 : Math.PI+getYaw();
  }
  function paintArrow(px,py,yaw,color='#fff0cb',size=7){
    ctx.save();ctx.translate(px,py);ctx.rotate(-yaw);
    ctx.beginPath();
    ctx.moveTo(0,-size);ctx.lineTo(-size*.58,size*.72);ctx.lineTo(0,size*.28);
    ctx.lineTo(size*.58,size*.72);ctx.closePath();
    ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#263242';ctx.lineWidth=1.2;ctx.stroke();ctx.restore();
  }
  function draw() {
    const p=projection();
    const scale= mode==='follow'?1.58:Math.min(W/(extent.maxX-extent.minX+20),H/(extent.maxZ-extent.minZ+20));
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#192737';ctx.fillRect(0,0,W,H);
    ctx.save();ctx.strokeStyle='rgba(212,198,167,.045)';ctx.lineWidth=1;
    for(let i=0;i<W;i+=20){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,H);ctx.stroke();}
    for(let i=0;i<H;i+=20){ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(W,i);ctx.stroke();}
    ctx.restore();

    // Drawn directly from expansion.mapLayout AND the original central road geometry.
    const allRoads=[{x:0,z:-7.5,w:11.3,d:68},...layout.roads];
    for(const road of allRoads)rect(p,road,'rgba(143,126,107,.84)');
    for(const plaza of layout.plazas||[])disk(p,plaza.x,plaza.z,plaza.r,scale,'#857366');

    disk(p,50,-21,13.8,scale,'rgba(60,127,155,.8)');
    disk(p,15,-19,4.1,scale,'rgba(64,119,139,.75)');
    disk(p,-44,-21,8.5,scale,'rgba(61,99,79,.48)');

    const m=ctx.measureText('月下'); // force font ready; safe if custom fonts missing
    void m;
    ctx.font='9px serif';ctx.textAlign='center';ctx.textBaseline='middle';
    const labelBoxes=[];
    for(const d of destinations){
      const v=p(d.x,d.z);
      if(v.x<5||v.x>W-5||v.y<5||v.y>H-5)continue;
      disk(p,d.x,d.z,2.8,1,'#dfb17d');
      const width=ctx.measureText(d.label).width;
      const lx=Math.max(width/2+3,Math.min(W-width/2-3,v.x));
      const ly=Math.max(8,Math.min(H-8,v.y-11));
      const overlap=labelBoxes.some(b=>Math.abs(b.x-lx)<(b.w+width)/2+5&&Math.abs(b.y-ly)<12);
      if(!overlap){
        ctx.fillStyle='#f7e6d0';ctx.shadowColor='#030a10';ctx.shadowBlur=5;
        ctx.fillText(d.label,lx,ly);ctx.shadowBlur=0;
        labelBoxes.push({x:lx,y:ly,w:width});
      }
    }

    const cameraYaw=getYaw();
    // Always show camera forward with a small fan, avatar actual facing with opaque arrow.
    const playerPoint=p(player.position.x,player.position.z);
    const camAngle=angleOfCamera();
    ctx.save();ctx.translate(playerPoint.x,playerPoint.y);ctx.rotate(-camAngle);
    ctx.fillStyle='rgba(218,226,255,.15)';
    ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,19,-Math.PI*.7,-Math.PI*.3);ctx.closePath();ctx.fill();
    ctx.restore();
    paintArrow(playerPoint.x,playerPoint.y,mode==='follow'?player.rotation.y-cameraYaw:Math.PI+player.rotation.y);

    // Fixed compass in upper-right, rotated to world north even when map rotates with camera.
    const northAngle=mode==='follow'?Math.PI+cameraYaw:0;
    ctx.save();ctx.translate(W-17,19);ctx.rotate(northAngle);
    ctx.strokeStyle='#e7c391';ctx.lineWidth=1.25;
    ctx.beginPath();ctx.moveTo(0,7);ctx.lineTo(0,-8);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(-3,-3);ctx.lineTo(3,-3);ctx.closePath();
    ctx.fillStyle='#e7c391';ctx.fill();
    ctx.fillStyle='#f3d9ae';ctx.font='bold 9px serif';ctx.fillText('N',0,-14);
    ctx.restore();

    const legend=document.querySelector('#mapCaption');
    if(legend)legend.textContent=mode==='follow'?'前方在上 · 箭头是角色朝向':'北方在上 · 箭头是角色朝向';
  }
  setMode('follow');
  return {
    update(t){if(t-stamp>.12){stamp=t;draw();}},
    redraw:draw,setMode,
    get mode(){return mode},
    // Used by non-visual smoke tests to verify map/world coordinate agreement.
    project:(x,z)=>projection()(x,z),
  };
}
