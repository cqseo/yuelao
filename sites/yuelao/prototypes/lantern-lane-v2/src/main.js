import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import './style.css';

import { createKeeper } from './keeper.js';
import { addWaterShimmer } from './water.js';
import { createExpandedDistricts } from './world-expansion.js';
import { createTeaInterior } from './interior.js';
import { createMinimap } from './world-map.js';
import { createAraTraveler } from './ara-traveler.js';
import { createFollowCamera } from './orbit-camera.js';
import './world-map.css';
import './keeper.css';
import './third-person.css';
import './district-v26.css';

// Isolated moonlit architecture test. BuildingGenerator © zhulin025, MIT 2026.
// Poly Haven 1K PBR textures: CC0. Full provenance recorded in README.md.
const canvas=document.querySelector('#canvas');
const state={ready:false,buildings:0,texturesLoaded:0,textureFailures:[],renderedFrames:0,quality:'auto',location:'gate'};
window.__YUEXIA_V2__=state;
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}
catch(e){document.querySelector('#fallback').hidden=false;throw e;}
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.29;
renderer.setPixelRatio(Math.min(devicePixelRatio||1,innerWidth<800?1:1.45));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();
scene.background=new THREE.Color('#14253a');
scene.fog=new THREE.FogExp2('#1a3042',.005);
const camera=new THREE.PerspectiveCamera(innerWidth<850?60:58,1,.1,330);
camera.rotation.order='YXZ';
const bg=new THREE.HemisphereLight(0xcbdaf3,0x3e3036,1.78);scene.add(bg);
const moonlight=new THREE.DirectionalLight(0xc7d8ff,2.5);moonlight.position.set(-22,35,-35);moonlight.castShadow=true;moonlight.shadow.mapSize.set(2048,2048);
moonlight.shadow.camera.left=-40;moonlight.shadow.camera.right=40;moonlight.shadow.camera.top=35;moonlight.shadow.camera.bottom=-35;moonlight.shadow.camera.near=2;moonlight.shadow.camera.far=110;moonlight.shadow.bias=-.0006;scene.add(moonlight);
const warmBase=new THREE.DirectionalLight(0xe49b71,.9);warmBase.position.set(15,9,10);scene.add(warmBase);
function emissive(rgb,intensity=1){return new THREE.MeshBasicMaterial({color:rgb,toneMapped:false})}
const sky=new THREE.Mesh(new THREE.SphereGeometry(170,60,36),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{uTop:{value:new THREE.Color('#0c1830')},uMid:{value:new THREE.Color('#2a455f')},uLow:{value:new THREE.Color('#74747d')}},vertexShader:'varying vec3 vP; void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform vec3 uTop;uniform vec3 uMid;uniform vec3 uLow;varying vec3 vP;void main(){float h=normalize(vP).y;vec3 c=mix(uLow,uMid,smoothstep(-0.06,0.22,h));c=mix(c,uTop,smoothstep(0.16,0.7,h));gl_FragColor=vec4(c,1.0);}' }));
scene.add(sky);
const moon=new THREE.Mesh(new THREE.SphereGeometry(4.35,40,40),emissive(0xfff6df));
moon.position.set(-28,48,-95);scene.add(moon);
function glowTexture(color0='#fff9d9',color1='rgba(255,245,212,0)'){
  const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');const g=ctx.createRadialGradient(128,128,6,128,128,128);g.addColorStop(0,color0);g.addColorStop(.21,'rgba(255,218,158,.34)');g.addColorStop(1,color1);ctx.fillStyle=g;ctx.fillRect(0,0,256,256);return new THREE.CanvasTexture(c);
}
const glTex=glowTexture();
function softGlow(x,y,z,size=4,opacity=.3,color=0xffd18b){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glTex,color,transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false}));s.position.set(x,y,z);s.scale.set(size,size,1);scene.add(s);return s;}
softGlow(-28,48,-95,28,.22,0xd0dffe);
const starData=[],rand=(()=>{let z=794381;return ()=>((z=(z*1664525+1013904223)>>>0)/4294967296)})();
for(let i=0;i<430;i++){const y=18+rand()*85;starData.push((rand()-.5)*205,y,-20-rand()*130)}
const starsGeo=new THREE.BufferGeometry();starsGeo.setAttribute('position',new THREE.Float32BufferAttribute(starData,3));scene.add(new THREE.Points(starsGeo,new THREE.PointsMaterial({color:0xdce8fa,size:.35,transparent:true,opacity:.72,sizeAttenuation:true})));
const texLoader=new THREE.TextureLoader();
const loadedTextures={};
function pbr(id,mult=[1,1]){
 const urls=['diff','normal','rough'].map(k=>'./tex/'+id+'_'+k+'.jpg');
 return Promise.all(urls.map(async(u,idx)=>{try{const t=await texLoader.loadAsync(u);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(mult[0],mult[1]);if(idx===0)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;state.texturesLoaded++;return t;}catch(e){state.textureFailures.push(u);return null}})).then(([map,normalMap,roughnessMap])=>({map,normalMap,roughnessMap}));
}
const [roofMaps,stoneMaps,woodMaps]=await Promise.all([
 pbr('grey_roof_tiles',[1.8,1.3]),pbr('grey_stone_path',[2.2,8]),pbr('wood_floor_worn',[1.3,1.3])
]);
const sidewalkMat=new THREE.MeshStandardMaterial({...stoneMaps,color:0xc9c4bd,roughness:.65,metalness:.04});
const stoneGround=new THREE.Mesh(
  new THREE.PlaneGeometry(280,300),
  new THREE.MeshStandardMaterial({color:0x33424a,roughness:1})
);
stoneGround.rotation.x=-Math.PI/2;
stoneGround.position.set(0,-.26,-14);
stoneGround.receiveShadow=true;
scene.add(stoneGround);
const lanternLights=[];
const expansion=createExpandedDistricts(scene,{
  pathMaterial:sidewalkMat,lanternLights,low:innerWidth<850
});
state.buildings=expansion.stats.buildings;
state.world=expansion.stats;
state.explorationBounds=expansion.extent;
const room=createTeaInterior(scene,{door:expansion.door,low:innerWidth<850});
state.room=room.stats;
state.routeValidation={
  mainRoad:expansion.canWalk(0,0),
  teaDoor:expansion.canWalk(-7.4,-5),
  northPlaza:expansion.canWalk(0,53),
  westPlaza:expansion.canWalk(-31,-21),
  eastPlaza:expansion.canWalk(31,-21),
  southPlaza:expansion.canWalk(0,-74),
  offRoadBlocked:!expansion.canWalk(20,0),
  buildingBlocked:!expansion.canWalk(13,6),
  hallBlocked:!expansion.canWalk(0,-43.5),
  lakeBlocked:!expansion.canWalk(50,-21),
  interiorCounterBlocked:!room.canMove(3.2,-131.25),
  interiorPathFree:room.canMove(0,-128),
};
if(Object.values(state.routeValidation).some(v=>!v))
  console.warn('Yuexia route validation failed:',state.routeValidation);

const waterShimmer=addWaterShimmer(scene);
const detailing={tick(){}};
const swingLanterns=[];
state.architecture={shopfronts:expansion.stats.buildings,floweringTrees:3};
const traveler=await createAraTraveler(scene,{low:innerWidth<850,onStatus:(data)=>{state.avatar=data}});
traveler.position.set(.1,0,13.5);
traveler.setHeading(-.03);
const cameraRig=createFollowCamera(camera,traveler,{mobile:innerWidth<850});
cameraRig.setOrientation(-.03,.35);
cameraRig.snap();

const keeper=createKeeper(scene,traveler);
state.viewMode='third-person';
state.avatarType=state.avatar?.status==='loaded'?'Ara rigged traveler':'legacy fallback';
state.worldAxes={north:'+Z',south:'-Z',east:'+X',west:'-X'};
state.keeper=keeper.state;
state.effects={waterShimmer:true,lanternLightCulling:true};
const particles=[],pPositions=new Float32Array(100*3);
for(let i=0;i<100;i++){const x=(rand()-.5)*45,y=1+rand()*9,z=-40+rand()*75;particles.push(y);pPositions.set([x,y,z],i*3)}
const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pPositions,3));
const fireflies=new THREE.Points(geo,new THREE.PointsMaterial({color:0xf8c992,size:.17,transparent:true,opacity:.74,depthWrite:false,blending:THREE.AdditiveBlending}));scene.add(fireflies);
let composer=null;
if(innerWidth>850){
 composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
 const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.45,.65,.9);
 composer.addPass(bloom);
}
function resize(){const w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||innerHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);composer?.setSize(w,h);}
addEventListener('resize',resize,{passive:true});resize();

const clock=new THREE.Clock();
const keys=new Set();
const joystick={x:0,z:0};
const places={
  gate:[0,13.5,-.03,'巷口 · 从迎月牌坊走进灯火巷'],
  market:[0,1,-.03,'灯火巷 · 路灯与两侧店铺都有清晰边界'],
  tea:[-7.4,-5,Math.PI/2,'听月茶馆 · 靠近茶馆门口，点击「进入」或按 E'],
  pond:[31,-21,-.03,'星愿湖 · 沿东侧石板路看水面'],
  temple:[0,-31,-.02,'月老殿 · 正门前，绕两侧道路可以去南区'],
  keeper:[-3.6,-7.8,-.04,'守灯人 · 靠近阿灯，按 E 对话'],
  north:[0,53,-.03,'望月台 · 北方的广场'],
  grove:[-31,-21,-.03,'竹影庭 · 西侧步道'],
  station:[0,-74,-.02,'旧梦驿 · 南侧广场'],
};
const minimap=createMinimap({
  player:traveler.group,
  getYaw:()=>cameraRig.heading,
  extent:expansion.extent,
  layout:expansion.mapLayout,
});
state.mapMode=minimap.mode;
const statusNode=document.querySelector('#tip');
const activeButtons=document.querySelectorAll('[data-spot]');
function navigateTo(id,button=null) {
  const p=places[id];if(!p)return;
  if(keeper.state.talking)keeper.close();
  if(room.inside)room.leave(traveler,cameraRig);
  traveler.position.set(p[0],0,p[1]);
  traveler.setHeading(p[2]);
  state.player={x:p[0],z:p[1],facing:p[2]};
  cameraRig.setOrientation(p[2],.35);
  cameraRig.snap();
  room.update(traveler);
  state.location=id;
  state.navigationMode='instant';
  keeper.update(clock.elapsedTime);
  minimap.redraw();
  if(statusNode)statusNode.textContent=p[3];
  activeButtons.forEach(el=>el.classList.toggle('selected',el===button));
}
activeButtons.forEach(button=>button.addEventListener('click',()=>navigateTo(button.dataset.spot,button)));
const roomPrompt=document.querySelector('#roomPrompt');
const roomExit=document.querySelector('#roomExit');
const roomState=()=>{state.roomMode=room.inside?'interior':'street';document.querySelector('#mapPanel').hidden=room.inside;};
function enterTea(){
  if(!room.nearEntrance||room.inside||keeper.state.talking)return;
  room.enter(traveler,cameraRig);roomState();room.update(traveler);
  state.location='tea-room';state.interaction='tea:entered';
  if(statusNode)statusNode.textContent='听月茶馆 · 探索室内茶桌、书架与灯火';
}
function leaveTea(){
  if(!room.inside)return;
  room.leave(traveler,cameraRig);roomState();room.update(traveler);
  state.location='market';state.interaction='tea:exited';
  if(statusNode)statusNode.textContent='已返回灯火巷 · 继续沿路探索';
}
roomPrompt.addEventListener('click',enterTea);
roomExit.addEventListener('click',leaveTea);
document.addEventListener('keydown',e=>{
  if(e.code!=='KeyE'||isTyping(e.target)||e.repeat)return;
  if(room.inside){e.preventDefault();leaveTea();}
  else if(room.nearEntrance){e.preventDefault();enterTea();}
},true);
room.update(traveler);
roomState();


// User control is relative to the orbit camera, NOT to the mini map.
function isTyping(target) {
  return target instanceof Element && !!target.closest('input,textarea,select,[contenteditable="true"]');
}
document.addEventListener('keydown',e=>{
  if(isTyping(e.target))return;
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code))e.preventDefault();
  keys.add(e.code);
});
document.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();moveStop();dragId=null});

let dragId=null,lastX=0,lastY=0;
canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  dragId=e.pointerId;
  lastX=e.clientX;lastY=e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
  if(dragId!==e.pointerId)return;
  const dx=e.clientX-lastX,dy=e.clientY-lastY;
  lastX=e.clientX;lastY=e.clientY;
  // Slow, clamped camera orbit so trackpad and mobile swipe remain comfortable.
  cameraRig.rotate(dx*.0022,-dy*.00155);
});
const endDrag=e=>{if(e.pointerId===dragId)dragId=null;};
canvas.addEventListener('pointerup',endDrag);
canvas.addEventListener('pointercancel',endDrag);
canvas.addEventListener('wheel',e=>{
  e.preventDefault();
  cameraRig.zoom(Math.sign(e.deltaY)*.5);
},{passive:false});

const stickZone=document.querySelector('#joystick'),nub=document.querySelector('#nub');
let joyId=null;
function joystickUpdate(e){
  const r=stickZone.getBoundingClientRect();
  const rad=r.width*.29,dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2);
  const ratio=Math.max(1,Math.hypot(dx,dy)/rad);
  joystick.x=dx/rad/ratio;joystick.z=-dy/rad/ratio;
  nub.style.transform='translate('+joystick.x*rad+'px,'+-joystick.z*rad+'px)';
}
function moveStop(){
  joystick.x=joystick.z=0;joyId=null;
  if(nub)nub.style.transform='translate(0,0)';
}
stickZone.addEventListener('pointerdown',e=>{
  joyId=e.pointerId;stickZone.setPointerCapture(joyId);joystickUpdate(e);
});
stickZone.addEventListener('pointermove',e=>{if(joyId===e.pointerId)joystickUpdate(e)});
stickZone.addEventListener('pointerup',moveStop);
stickZone.addEventListener('pointercancel',moveStop);
document.querySelectorAll('[data-camera-zoom]').forEach(btn=>btn.addEventListener('click',()=>{
  cameraRig.zoom(btn.dataset.cameraZoom==='in'?-.7:.7);
}));
document.querySelector('#resetCamera')?.addEventListener('click',()=>{
  cameraRig.setOrientation(traveler.heading,.35);
  cameraRig.snap();
});

let low=innerWidth<850;
const button=document.querySelector('#toggleQuality');
function setLow(v){
  low=v;waterShimmer.setLow(v);
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,v?1:1.55));
  renderer.shadowMap.enabled=!v;fireflies.visible=!v;
  if(v){composer?.dispose();composer=null;}
  else if(!composer){
    composer=new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene,camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.4,.6,.88));
  }
  resize();
  button.querySelector('b').textContent=v?'开':'关';
}
button.addEventListener('click',()=>setLow(!low));
setLow(low);

let frames=0,perfSamples=0,perfTotal=0,autoEvaluated=false;
state.positionTracking=true;
function loop(){
  const rawDelta=clock.getDelta(),delta=Math.min(.05,rawDelta),t=clock.elapsedTime;
  if(!autoEvaluated&&!low&&frames>5&&document.visibilityState==='visible'){
    perfSamples++;perfTotal+=rawDelta;
    if(perfSamples>=16){
      autoEvaluated=true;
      if(perfTotal/perfSamples>.068){
        setLow(true);state.autoQualityFallback=true;
        button.querySelector('b').textContent='自动优化';
      }
    }
  }
  const step=Math.min(.13,rawDelta);
  // Arrow keys only orbit; WASD / mobile joystick move avatar in camera-forward direction.
  if(!keeper.state.talking){
    if(keys.has('ArrowLeft'))cameraRig.rotate(-delta*1.2,0);
    if(keys.has('ArrowRight'))cameraRig.rotate(delta*1.2,0);
  }
  const forward=keeper.state.talking?0:(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)+joystick.z;
  const strafe=keeper.state.talking?0:(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+joystick.x;
  const speed=(keys.has('ShiftLeft')||keys.has('ShiftRight')?4.35:2.75)*step;
  let actualDx=0,actualDz=0;
  if(Math.abs(forward)+Math.abs(strafe)>.04&&!keeper.state.talking){
    const yaw=cameraRig.heading;
    const norm=Math.max(1,Math.hypot(forward,strafe));
    const dx=(-Math.sin(yaw)*forward+Math.cos(yaw)*strafe)/norm*speed;
    const dz=(-Math.cos(yaw)*forward-Math.sin(yaw)*strafe)/norm*speed;
    const beforeX=traveler.position.x,beforeZ=traveler.position.z;
    const check=room.inside?room.canMove:expansion.canWalk;
    const nextX=THREE.MathUtils.clamp(beforeX+dx,room.inside?-5:expansion.extent.minX,room.inside?5:expansion.extent.maxX);
    const nextZ=THREE.MathUtils.clamp(beforeZ+dz,room.inside?-134.3:expansion.extent.minZ,room.inside?-126:expansion.extent.maxZ);
    if(check(nextX,nextZ)){
      traveler.position.set(nextX,0,nextZ);
    }else if(check(nextX,beforeZ)){
      traveler.position.set(nextX,0,beforeZ);
    }else if(check(beforeX,nextZ)){
      traveler.position.set(beforeX,0,nextZ);
    }else{
      state.collisionBlocked=(state.collisionBlocked||0)+1;
    }
    actualDx=traveler.position.x-beforeX;
    actualDz=traveler.position.z-beforeZ;
  }
  traveler.tick(t,step,actualDx,actualDz,Math.hypot(actualDx,actualDz)>.00001);
  if(traveler.currentAction)state.avatarAction=traveler.currentAction;
  // Camera is independent from player animation: steady look-at without head-bob.
  cameraRig.update(step);
  expansion.update(t);
  minimap.update(t);
  waterShimmer.update(t);
  keeper.update(t);
  room.update(traveler);
  state.roomMode=room.inside?'interior':'street';
  swingLanterns.forEach(({root,offset,initialY})=>{
    root.rotation.z=Math.sin(t*.8+offset)*.018;
    root.position.y=initialY+Math.sin(t*.7+offset)*.015;
  });
  if(fireflies.visible){
    const a=geo.attributes.position;
    for(let i=0;i<particles.length;i++)a.array[i*3+1]=particles[i]+Math.sin(t*.6+i)*.18;
    a.needsUpdate=true;
  }
  if(frames%14===0){
    const active=new Set(lanternLights
      .map((light,i)=>({i,dist:light.position.distanceToSquared(traveler.position)}))
      .sort((a,b)=>a.dist-b.dist)
      .slice(0,low?5:8).map(x=>x.i));
    lanternLights.forEach((light,i)=>{light.visible=active.has(i)});
  }
  lanternLights.forEach((lamp,i)=>{
    if(lamp.visible)lamp.intensity=(low?4.3:6.6)*(1+.07*Math.sin(t*2.2+i*1.31));
  });
  state.activeLanternLights=lanternLights.filter(x=>x.visible).length;
  state.player={
    x:+traveler.position.x.toFixed(2),z:+traveler.position.z.toFixed(2),
    facing:+traveler.heading.toFixed(3),
  };
  state.camera={
    yaw:+cameraRig.heading.toFixed(3),
    pitch:+cameraRig.state.pitch.toFixed(3),
    distance:+cameraRig.state.zoom.toFixed(2),
    collision:cameraRig.state.clipped,
  };
  state.mapMode=minimap.mode;
  if(composer)composer.render();else renderer.render(scene,camera);
  state.renderedFrames=++frames;
  requestAnimationFrame(loop);
}
state.ready=true;
document.querySelector('#loadText').textContent=state.avatar?.status==='loaded'?'Ara 真人骨骼模型 · 已就绪':state.avatar?.status==='fallback'?'人物模型载入失败 · 已使用旧占位':'正在加载古风旅人…';
loop();
