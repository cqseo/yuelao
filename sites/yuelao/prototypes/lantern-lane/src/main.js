import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import './style.css';
import modelSources from '../model-sources.json';

const canvas = document.querySelector('#world');
const progress = document.querySelector('#load');
const loadCount = document.querySelector('#loadCount');
const tipText = document.querySelector('#tip-copy');
const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 850;
const state = { loaded: 0, failed: [], ready: false, quality: mobile, spots: 'gate', fps: 0 };
window.__YUEXIA_PREVIEW__ = state;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: mobile ? 'low-power' : 'high-performance' });
} catch (error) {
  document.querySelector('#fallback').hidden = false;
  throw error;
}
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.32;
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.3 : 1.8));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070c1d);
scene.fog = new THREE.FogExp2(0x11192a, .017);
const camera = new THREE.PerspectiveCamera(mobile ? 70 : 64, 1, .08, 230);
camera.rotation.order = 'YXZ';
camera.position.set(0, 2.25, 23.5);
let yaw = 0, pitch = -.035;
let target = null;
const clock = new THREE.Clock();
const move = { x: 0, z: 0 };
const keys = new Set();
const decorations = [];
const mats = {
  soil: new THREE.MeshStandardMaterial({ color: 0x111725, roughness: 1 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x323344, roughness: .93 }),
  darkStone: new THREE.MeshStandardMaterial({ color: 0x1b2434, roughness: .9 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x361d29, roughness: .82 }),
  red: new THREE.MeshStandardMaterial({ color: 0x692d36, roughness: .78 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xbb8953, roughness: .44, metalness: .48 }),
  warm: new THREE.MeshBasicMaterial({ color: 0xffd08a }),
  water: new THREE.MeshStandardMaterial({ color: 0x102a3f, roughness: .22, metalness: .42 }),
};
scene.add(new THREE.HemisphereLight(0xb6c3f9, 0x12090c, 1.45));
const moonlight = new THREE.DirectionalLight(0xa6b5f7, 1.8);
moonlight.position.set(-30, 42, -22);
scene.add(moonlight);
function addGlowLight(x, y, z, strength=6, radius=13) {
  const point = new THREE.PointLight(0xffae65, strength, radius, 2.1);
  point.position.set(x,y,z); scene.add(point); return point;
}
for (const [x,z] of [[-5,9],[5,9],[-7,-5],[7,-7],[-4,-17],[4,-19]]) addGlowLight(x,3,z, mobile ? 4.2 : 6,13);

function radialTexture() {
  const c=document.createElement('canvas');c.width=c.height=128;
  const g=c.getContext('2d');
  const r=g.createRadialGradient(64,64,1,64,64,64);
  r.addColorStop(0,'rgba(255,235,180,1)');
  r.addColorStop(.25,'rgba(255,208,139,.52)');
  r.addColorStop(1,'rgba(255,189,116,0)');
  g.fillStyle=r;g.fillRect(0,0,128,128);
  return new THREE.CanvasTexture(c);
}
const glowTexture=radialTexture();
function warmSprite(x,y,z,size=3,opacity=.43){
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,color:0xffb66e,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending}));
  sprite.position.set(x,y,z); sprite.scale.set(size,size,1); scene.add(sprite); return sprite;
}

function makeStoneTexture(){
  const c=document.createElement('canvas');c.width=c.height=512;
  const g=c.getContext('2d');g.fillStyle='#2a2833';g.fillRect(0,0,512,512);
  let s=1;const rand=()=>((s=(s*1664525+1013904223)>>>0)/4294967296);
  for(let i=0;i<720;i++){
    const x=rand()*512,y=rand()*512,r=rand()*3+.5;
    g.fillStyle='rgba(196,177,153,'+(rand()*.14)+')';g.fillRect(x,y,r*2,r);
  }
  for(let i=0;i<10;i++){
    const y=i*55+rand()*12;
    g.strokeStyle='rgba(11,13,21,.45)';g.lineWidth=4;g.beginPath();g.moveTo(0,y);g.lineTo(512,y+rand()*12);g.stroke();
  }
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2.1,8);
  t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,120),mats.soil);
ground.rotation.x=-Math.PI/2;ground.position.z=-12;scene.add(ground);
const path=new THREE.Mesh(new THREE.PlaneGeometry(11.2,56),new THREE.MeshStandardMaterial({map:makeStoneTexture(),roughness:.95,color:0xbeb3ae}));
path.rotation.x=-Math.PI/2;path.position.set(0,.024,-4);scene.add(path);
for(let side of [-1,1]){
  const curb=new THREE.Mesh(new THREE.BoxGeometry(.3,.24,56),mats.stone);
  curb.position.set(side*5.74,.09,-4);scene.add(curb);
}
const endSquare=new THREE.Mesh(new THREE.CylinderGeometry(9.6,9.6,.28,48),mats.darkStone);
endSquare.position.set(0,.08,-25);scene.add(endSquare);
const centralDisk=new THREE.Mesh(new THREE.CylinderGeometry(5.8,5.8,.12,48),mats.stone);
centralDisk.position.set(0,.19,-25);scene.add(centralDisk);

const moon=new THREE.Mesh(new THREE.SphereGeometry(4.4,36,36),new THREE.MeshBasicMaterial({color:0xf4e6c6}));
moon.position.set(-34,43,-110);scene.add(moon);
const moonAura=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,transparent:true,opacity:.12,color:0xd6dbff,depthWrite:false,blending:THREE.AdditiveBlending}));
moonAura.position.copy(moon.position);moonAura.scale.set(35,35,1);scene.add(moonAura);
let seed=4815;const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
const stars=new Float32Array(750*3);
for(let i=0;i<750;i++){stars[i*3]=(rnd()-.5)*220;stars[i*3+1]=13+rnd()*85;stars[i*3+2]=-120+rnd()*155;}
const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.BufferAttribute(stars,3));
const starPoints=new THREE.Points(starGeometry,new THREE.PointsMaterial({size:.25,color:0xffedca,transparent:true,opacity:.63,sizeAttenuation:true}));
scene.add(starPoints);
for(let i=0;i<14;i++){
  const hill=new THREE.Mesh(new THREE.IcosahedronGeometry(8+rnd()*12,1),new THREE.MeshStandardMaterial({color:i%2?0x0d1426:0x101c2e,roughness:1}));
  hill.position.set((i-7)*13,2+rnd()*4,-63-rnd()*14);
  hill.scale.set(1.55,.65,1);scene.add(hill);
}
function lantern(x,y,z,index) {
  const group=new THREE.Group();group.position.set(x,y,z);
  const shape=new THREE.Mesh(new THREE.CylinderGeometry(.27,.32,.58,10),mats.red);
  const core=new THREE.Mesh(new THREE.CylinderGeometry(.22,.25,.5,10),new THREE.MeshBasicMaterial({color:0xe28a55}));
  const capTop=new THREE.Mesh(new THREE.CylinderGeometry(.33,.33,.07,12),mats.gold);
  const capBottom=capTop.clone();capTop.position.y=.33;capBottom.position.y=-.33;
  const thread=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,.38,6),mats.gold);thread.position.y=.52;
  const tassel=new THREE.Mesh(new THREE.ConeGeometry(.085,.34,8),mats.gold);tassel.position.y=-.52;tassel.rotation.x=Math.PI;
  group.add(shape,core,capTop,capBottom,thread,tassel);
  scene.add(group);warmSprite(x,y,z,1.9,.28);
  decorations.push({group,index,y});return group;
}
function streetLamp(x,z,index){
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.055,.09,3.85,8),mats.wood);
  pole.position.set(x,1.9,z);scene.add(pole);
  const arm=new THREE.Mesh(new THREE.BoxGeometry(.9,.055,.055),mats.wood);arm.position.set(x+.43,3.76,z);scene.add(arm);
  lantern(x+.82,3.26,z,index);
}
for(let i=0;i<8;i++){
  const z=9-i*5.25;
  streetLamp(-6.55,z,i*2);streetLamp(5.75,z,i*2+1);
}
function banner(x,z,text){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=160;
  const c=canvas.getContext('2d');c.fillStyle='#48232d';c.fillRect(0,0,512,160);
  c.strokeStyle='#ca925b';c.lineWidth=8;c.strokeRect(8,8,496,144);
  c.fillStyle='#ffe4a5';c.textAlign='center';c.textBaseline='middle';c.font='600 74px serif';c.fillText(text,256,83);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(3.7,1.16),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));
  mesh.position.set(x,3.45,z);mesh.rotation.y=x<0?Math.PI/2:-Math.PI/2;scene.add(mesh);
}
banner(-5.85,-3.4,'茶香');banner(5.85,-9.1,'心灯');

function pavilion(x,z,scale=1){
  const group=new THREE.Group();group.position.set(x,0,z);group.scale.setScalar(scale);
  const base=new THREE.Mesh(new THREE.BoxGeometry(6.7,.28,6.2),mats.stone);base.position.y=.14;group.add(base);
  for(const a of [-2.7,2.7])for(const b of [-2.5,2.5]){
    const column=new THREE.Mesh(new THREE.CylinderGeometry(.18,.22,4.1,10),mats.red);column.position.set(a,2.1,b);group.add(column);
    const footing=new THREE.Mesh(new THREE.CylinderGeometry(.31,.31,.24,10),mats.gold);footing.position.set(a,.33,b);group.add(footing);
  }
  const beams=[[-2.8,0],[2.8,0]];
  for(const [xx] of beams){const beam=new THREE.Mesh(new THREE.BoxGeometry(.24,.24,6.1),mats.wood);beam.position.set(xx,4.12,0);group.add(beam)}
  const roof=new THREE.Mesh(new THREE.ConeGeometry(5.2,2,4,1),mats.darkStone);roof.rotation.y=Math.PI/4;roof.scale.y=.7;roof.position.y=4.9;group.add(roof);
  const trim=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,7.7,7),mats.gold);trim.rotation.z=Math.PI/2;trim.position.y=4.3;group.add(trim);
  scene.add(group);
  return group;
}
pavilion(-9.6,-7.2);pavilion(9.6,-10.3,.95);
pavilion(-9.2,-24.2,.85);
for(const [x,z] of [[-7.2,-3.4],[7.1,-6.2],[-7.4,-19.2],[7.5,-23.1]])warmSprite(x,3.7,z,5.5,.18);

const glowParticleGeometry=new THREE.BufferGeometry(),particles=[];
const gp=new Float32Array(95*3);for(let i=0;i<95;i++){
  const x=(rnd()-.5)*40,y=.5+rnd()*8,z=-32+rnd()*55;
  gp[i*3]=x;gp[i*3+1]=y;gp[i*3+2]=z;particles.push(y);
}
glowParticleGeometry.setAttribute('position',new THREE.BufferAttribute(gp,3));
const fireflies=new THREE.Points(glowParticleGeometry,new THREE.PointsMaterial({size:.14,color:0xf5c67b,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false}));
scene.add(fireflies);

const altarStand=new THREE.Mesh(new THREE.CylinderGeometry(1.8,2.1,.7,12),mats.wood);altarStand.position.set(0,.72,-25);scene.add(altarStand);
const altarLight=new THREE.Mesh(new THREE.SphereGeometry(.55,20,16),new THREE.MeshBasicMaterial({color:0xf9ba73}));altarLight.position.set(0,1.65,-25);scene.add(altarLight);
warmSprite(0,1.65,-25,6,.35);addGlowLight(0,2,-25,8,14);
const pond=new THREE.Mesh(new THREE.CircleGeometry(4.1,36),mats.water);
pond.rotation.x=-Math.PI/2;pond.position.set(10.4,.04,-17.7);scene.add(pond);
warmSprite(10.4,1.7,-17.7,5,.14);

const spots={
  gate:{x:0,z:21,yaw:0,pitch:-.03,text:'迎月牌坊：沿着灯笼路向前，新的故事就在前方。'},
  market:{x:0,z:-1,yaw:0,pitch:-.03,text:'灯火市集：茶摊、衣铺与一条可以慢慢走的街。'},
  garden:{x:6.6,z:-14.4,yaw:-.56,pitch:-.01,text:'竹影小径：听见水声，沿桥走向静谧的花园。'},
  altar:{x:0,z:-19,yaw:0,pitch:-.08,text:'月下祈愿：让温暖的心灯，照亮还未说出口的愿望。'},
};
for(const button of document.querySelectorAll('[data-spot]')){
  button.addEventListener('click',()=>{
    const id=button.dataset.spot,p=spots[id];if(!p)return;
    target={x:p.x,z:p.z,yaw:p.yaw,pitch:p.pitch};
    state.spots=id;tipText.textContent=p.text;
    document.querySelectorAll('[data-spot]').forEach(el=>el.classList.toggle('active',el===button));
  });
}
const quality=document.querySelector('#quality');
function setQuality(q){
  state.quality=q;
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,q?1.05:mobile?1.3:1.8));
  fireflies.visible=!q;
  quality.setAttribute('aria-pressed',String(q));
  quality.querySelector('span').textContent=q?'开':'关';
}
quality.addEventListener('click',()=>setQuality(!state.quality));
setQuality(state.quality);

const loader=new GLTFLoader();
const definitions=[
  {id:'arch',name:'ArchBanner',source:'lunar-year',where:[[0,0,10,7.4,0]]},
  {id:'roof',name:'RoomRoof',source:'lunar-year',where:[[-9.6,5,-7.2,7.0,0],[9.6,4.7,-10.3,6.6,0]]},
  {id:'wall',name:'RoomWall01',source:'lunar-year',where:[[-9.6,.2,-9.2,3.1,0],[9.6,.2,-12.4,3.1,0]]},
  {id:'column',name:'Column',source:'lunar-year',where:[[-12.2,.3,-4.7,3.9,0],[12.2,.3,-7.5,3.9,0]]},
  {id:'lamp1',name:'Lamp01',source:'lunar-year',where:[[-4.6,3.6,6.0,1.2,0],[4.6,3.6,6.0,1.2,0],[-4.7,3.6,-8.1,1.2,0]]},
  {id:'lamp2',name:'Lamp02',source:'lunar-year',where:[[4.7,3.6,-13.6,1.2,0],[-4.7,3.6,-18.5,1.2,0]]},
  {id:'outerlamp',name:'OutterLamp',source:'lunar-year',where:[[-6.1,0,-25,2.6,0],[6.1,0,-25,2.6,0]]},
  {id:'altar',name:'MainAltar',source:'lunar-year',where:[[0,.3,-26.6,5.1,0]]},
  {id:'booth',name:'Booth_Food01',source:'medieval-fair',where:[[-9.6,.3,-7.2,4.8,1.57]]},
  {id:'cart',name:'Cart',source:'medieval-fair',where:[[7.7,0,2.6,2.2,-.4]]},
  {id:'platform',name:'WoodPlatform',source:'medieval-fair',where:[[10.5,0,-18,5.5,0]]},
  {id:'sign',name:'SignPost',source:'medieval-fair',where:[[5.4,0,10.4,2.35,1.2]]},
  {id:'tree',name:'tree-oak',source:'nature-kit',where:[[-17,0,-4,8.5,0],[16.2,0,-19,8,0],[-15,0,-28,7.9,0]]},
  {id:'bamboo',name:'crops-bamboostageb',source:'nature-kit',where:[[9.7,0,-13,3.3,0],[10.6,0,-14.1,3.8,.8],[12.9,0,-14.8,3.6,0],[13.8,0,-16.5,3.7,1.1],[14,0,-19,3.4,0]]},
  {id:'rock',name:'rock-largea',source:'nature-kit',where:[[11.6,0,-21,1.9,0],[14.4,0,-17,2.3,1],[8.2,0,-22,1.8,.2],[-11.5,0,-18,2.4,.6]]},
  {id:'bridge',name:'bridge-wood',source:'nature-kit',where:[[10.7,.06,-16.9,4.8,0]]},
];
const ASSETS=new Map(modelSources.map(item=>[item.id,item]));
function loadOne(def){
  const info=ASSETS.get(def.id);
  const url=new URL('./models/'+info.filename,document.baseURI).href;
  return new Promise((resolve,reject)=>loader.load(url,gltf=>resolve(gltf.scene),undefined,reject))
    .then(template=>{
      const bbox=new THREE.Box3().setFromObject(template),dimensions=bbox.getSize(new THREE.Vector3());
      if(dimensions.lengthSq()<.00001)throw new Error('empty GLB');
      for(const [x,y,z,size,rotation] of def.where){
        const clone=template.clone(true),group=new THREE.Group();
        const d=dimensions.y > 0 ? dimensions.y:Math.max(dimensions.x,dimensions.z);
        const scale=size/d;clone.scale.multiplyScalar(scale);
        const bb=new THREE.Box3().setFromObject(clone);
        clone.position.set(-(bb.min.x+bb.max.x)/2,-bb.min.y,-(bb.min.z+bb.max.z)/2);
        group.add(clone);group.position.set(x,y,z);group.rotation.y=rotation;scene.add(group);
      }
    })
    .catch(err=>{
      state.failed.push(def.id);
      console.warn('Preview asset failed:',def.name,err.message||err);
    })
    .finally(()=>{
      state.loaded++;
      loadCount.textContent=state.loaded+' / '+definitions.length;
      if(state.loaded===definitions.length){
        state.ready=true;
        progress.innerHTML=state.failed.length?'已完成加载 · '+state.failed.length+' 个素材使用备用场景':'全部 '+definitions.length+' 组模型已加载';
      }
    });
}
Promise.all(definitions.map(loadOne));
function resize(){
  const w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||innerHeight;
  camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);
}
addEventListener('resize',resize,{passive:true});resize();
addEventListener('keydown',e=>{
  if(['KeyW','KeyA','KeyS','KeyD','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(e.code))e.preventDefault();
  keys.add(e.code);
});
addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('blur',()=>keys.clear());
let dragging=false,lastX=0,lastY=0,dragId=null;
canvas.addEventListener('pointerdown',e=>{dragging=true;dragId=e.pointerId;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);target=null});
canvas.addEventListener('pointermove',e=>{
  if(!dragging||e.pointerId!==dragId)return;
  const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;
  yaw-=dx*.00335;pitch=Math.max(-.6,Math.min(.55,pitch-dy*.0028));
});
function stopDrag(e){if(e.pointerId===dragId){dragging=false;dragId=null}}
canvas.addEventListener('pointerup',stopDrag);canvas.addEventListener('pointercancel',stopDrag);
const joystick=document.querySelector('#joystick'),stick=document.querySelector('#stick');
let joystickId=null;
function joystickUpdate(e){
  const r=joystick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
  const dx=e.clientX-cx,dy=e.clientY-cy,rad=r.width*.32;
  const mag=Math.max(1,Math.hypot(dx,dy)/rad);
  move.x=dx/mag/rad;move.z=-dy/mag/rad;
  stick.style.transform='translate('+(move.x*rad)+'px,'+(-move.z*rad)+'px)';
}
joystick.addEventListener('pointerdown',e=>{joystickId=e.pointerId;joystick.setPointerCapture(e.pointerId);joystickUpdate(e)});
joystick.addEventListener('pointermove',e=>{if(e.pointerId===joystickId)joystickUpdate(e)});
function resetJoystick(){joystickId=null;move.x=move.z=0;stick.style.transform='translate(0,0)'}
joystick.addEventListener('pointerup',resetJoystick);joystick.addEventListener('pointercancel',resetJoystick);
canvas.addEventListener('wheel',e=>{
  e.preventDefault();target=null;
  const speed=Math.sign(e.deltaY)*.8;
  camera.position.x-=Math.sin(yaw)*speed;
  camera.position.z-=Math.cos(yaw)*speed;
},{passive:false});
let frameTimes=0,frameCount=0;
function animate(){
  const dt=Math.min(.055,clock.getDelta());
  const speed=(keys.has('ShiftLeft')||keys.has('ShiftRight')?7.2:4.2)*dt;
  if(keys.has('ArrowLeft'))yaw+=dt*1.25;
  if(keys.has('ArrowRight'))yaw-=dt*1.25;
  const forward=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0)+move.z;
  const strafe=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+move.x;
  if(Math.abs(forward)+Math.abs(strafe)>.025){
    target=null;
    const norm=Math.max(1,Math.hypot(forward,strafe));
    camera.position.x+=((-Math.sin(yaw)*forward+Math.cos(yaw)*strafe)/norm)*speed;
    camera.position.z+=((-Math.cos(yaw)*forward-Math.sin(yaw)*strafe)/norm)*speed;
  }else if(target){
    const ease=Math.min(1,dt*1.6);
    camera.position.x+=(target.x-camera.position.x)*ease;
    camera.position.z+=(target.z-camera.position.z)*ease;
    let dif=(target.yaw-yaw+Math.PI)%(2*Math.PI);if(dif<0)dif+=2*Math.PI;dif-=Math.PI;
    yaw+=dif*ease;pitch+=(target.pitch-pitch)*ease;
    if(Math.hypot(target.x-camera.position.x,target.z-camera.position.z)<.12)target=null;
  }
  camera.position.x=Math.max(-19,Math.min(19,camera.position.x));
  camera.position.z=Math.max(-36,Math.min(26,camera.position.z));
  camera.position.y=2.25;
  camera.rotation.set(pitch,yaw,0,'YXZ');
  const t=clock.elapsedTime;
  for(const item of decorations)item.group.rotation.z=Math.sin(t*1.15+item.index*.77)*.045;
  if(fireflies.visible){const positions=glowParticleGeometry.attributes.position;
    for(let i=0;i<particles.length;i++)positions.array[i*3+1]=particles[i]+Math.sin(t*.75+i)*.17;
    positions.needsUpdate=true;
  }
  renderer.render(scene,camera);
  frameTimes+=dt;frameCount++;
  if(frameTimes>1.3){state.fps=Math.round(frameCount/frameTimes);frameCount=0;frameTimes=0}
  requestAnimationFrame(animate);
}
animate();
