import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BuildingGenerator } from './BuildingGenerator.js';
import './style.css';
import { addStreetDetails } from './details.js';
import { createKeeper } from './keeper.js';
import { addWaterShimmer } from './water.js';
import './keeper.css';

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
renderer.toneMappingExposure=1.36;
renderer.setPixelRatio(Math.min(devicePixelRatio||1,innerWidth<800?1:1.45));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();
scene.background=new THREE.Color('#213a57');
scene.fog=new THREE.FogExp2('#1f3045',.012);
const camera=new THREE.PerspectiveCamera(64,1,.1,220);
camera.rotation.order='YXZ';camera.position.set(.1,1.9,19);
let yaw=-.035,pitch=-.04;
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
const hills=new THREE.Group();scene.add(hills);
for(let i=0;i<18;i++){const h=6+rand()*15;const mesh=new THREE.Mesh(new THREE.ConeGeometry(10+rand()*18,h,5),new THREE.MeshStandardMaterial({color:i%2?0x162c3c:0x243849,roughness:1}));mesh.position.set((i-9)*17,-1,-67+rand()*12);mesh.rotation.y=rand();hills.add(mesh)}

const texLoader=new THREE.TextureLoader();
const loadedTextures={};
function pbr(id,mult=[1,1]){
 const urls=['diff','normal','rough'].map(k=>'./tex/'+id+'_'+k+'.jpg');
 return Promise.all(urls.map(async(u,idx)=>{try{const t=await texLoader.loadAsync(u);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(mult[0],mult[1]);if(idx===0)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;state.texturesLoaded++;return t;}catch(e){state.textureFailures.push(u);return null}})).then(([map,normalMap,roughnessMap])=>({map,normalMap,roughnessMap}));
}
const [roofMaps,stoneMaps,woodMaps]=await Promise.all([
 pbr('grey_roof_tiles',[1.8,1.3]),pbr('grey_stone_path',[2.2,8]),pbr('wood_floor_worn',[1.3,1.3])
]);
const arch=new BuildingGenerator();
const materials=arch.materials;
Object.assign(materials.roof,{...roofMaps,color:new THREE.Color('#b3bbc7'),roughness:.83,metalness:0});
materials.roof.needsUpdate=true;
Object.assign(materials.stone,{...stoneMaps,color:new THREE.Color('#c5c5c3'),roughness:.85});
materials.stone.needsUpdate=true;
Object.assign(materials.darkWood,{...woodMaps,color:new THREE.Color('#95715c'),roughness:.82});
materials.darkWood.needsUpdate=true;
materials.wall.color.set('#c7c4bc');
materials.wood.color.set('#963e36');
materials.lattice.emissive=new THREE.Color('#df9d5b');materials.lattice.emissiveIntensity=.38;
const sidewalkMat=new THREE.MeshStandardMaterial({...stoneMaps,color:0xc9c4bd,roughness:.65,metalness:.04});
const darkStone=new THREE.MeshStandardMaterial({color:0x50525b,roughness:.83});
const bronze=new THREE.MeshStandardMaterial({color:0xbca078,metalness:.64,roughness:.44});
const wood=new THREE.MeshStandardMaterial({...woodMaps,color:0x9c7760,roughness:.75});
const silk=new THREE.MeshPhysicalMaterial({color:0x9c3035,roughness:.62,metalness:.08,side:THREE.DoubleSide});
const lightMat=new THREE.MeshBasicMaterial({color:0xffd49d,toneMapped:false});
const stoneGround=new THREE.Mesh(new THREE.PlaneGeometry(140,150),new THREE.MeshStandardMaterial({color:0x4c5961,roughness:1}));
stoneGround.rotation.x=-Math.PI/2;stoneGround.position.set(0,-.24,-12);stoneGround.receiveShadow=true;scene.add(stoneGround);
const pavement=new THREE.Mesh(new THREE.PlaneGeometry(11.3,68),sidewalkMat);
pavement.rotation.x=-Math.PI/2;pavement.position.set(0,.015,-7.5);pavement.receiveShadow=true;scene.add(pavement);
for(const side of [-1,1]){const kerb=new THREE.Mesh(new THREE.BoxGeometry(.35,.16,68),darkStone);kerb.position.set(side*5.82,.04,-7.5);kerb.castShadow=true;scene.add(kerb)}
function makeBuilding(name,pos,type='xieshan',width=8.5,depth=6.2,stories=1,rotation=0){
 const b=arch.createBuilding({id:name,position:new THREE.Vector3(...pos),type,width,depth,stories,wallHeight:stories>1?3.35:3.6,roofHeight:2.7,eavesOverhang:1.55,rotationY:rotation});b.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});scene.add(b);state.buildings++;return b;
}
for(const [name,x,z,rot,two] of [
 ['tea',-10,-.5,Math.PI/2,false],['silk',10,-1.5,-Math.PI/2,true],
 ['book',-10,-14.5,Math.PI/2,true],['fate',10,-14,-Math.PI/2,false],
 ['garden',-10,-26.5,Math.PI/2,false],['courtyard',10,-26,-Math.PI/2,false],
])makeBuilding(name,[x,0,z],'xieshan',8.7,6.5,two?2:1,rot);
makeBuilding('temple',[0,0,-39],'xieshan',15,10,2,0);
const gate=makeBuilding('gate',[0,0,25.3],'pavilion',13,3.5,1,0);
const gatePosts=[-6,6].map(x=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(.55,3.7,.56),materials.wood);mesh.position.set(x,2,24);mesh.castShadow=true;scene.add(mesh);return mesh});
function calligraphy(text){
 const c=document.createElement('canvas');c.width=640;c.height=176;const g=c.getContext('2d');g.fillStyle='#612b2c';g.fillRect(0,0,640,176);g.lineWidth=9;g.strokeStyle='#c09c61';g.strokeRect(9,9,622,158);g.fillStyle='#f1d4a5';g.textAlign='center';g.textBaseline='middle';g.font='600 90px "Noto Serif SC", serif';g.fillText(text,320,90);
 const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;
 return new THREE.Mesh(new THREE.PlaneGeometry(3.9,1.07),new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide}));
}
const sign=calligraphy('月 下');sign.position.set(0,4.85,25.9);scene.add(sign);
for(const [label,x,z,rot] of [['茶肆',-5.9,-.5,Math.PI/2],['红笺',5.9,-1.5,-Math.PI/2],['书屋',-5.9,-14.5,Math.PI/2],['姻缘',5.9,-14,-Math.PI/2]]){
 const plank=calligraphy(label);plank.scale.set(.45,.8,1);plank.position.set(x,3,z);plank.rotation.y=rot;scene.add(plank);
}
const swingLanterns=[];
function lantern(x,y,z,scale=1) {
 const root=new THREE.Group();root.position.set(x,y,z);root.scale.setScalar(scale);
 const inner=new THREE.Mesh(new THREE.CylinderGeometry(.3,.36,.69,16),lightMat);
 const outer=new THREE.Mesh(new THREE.CylinderGeometry(.33,.38,.74,16,1,true),new THREE.MeshPhysicalMaterial({color:'#bf3c38',transmission:.24,transparent:true,opacity:.85,roughness:.5,side:THREE.DoubleSide}));
 const top=new THREE.Mesh(new THREE.CylinderGeometry(.4,.4,.075,20),bronze),bot=top.clone();top.position.y=.41;bot.position.y=-.41;
 root.add(inner,outer,top,bot);
 for(let i=0;i<8;i++){const x=Math.sin(i*Math.PI/4)*.33,z=Math.cos(i*Math.PI/4)*.33;
 const rib=new THREE.Mesh(new THREE.CylinderGeometry(.011,.011,.72,6),bronze);rib.position.set(x,0,z);root.add(rib)}
 const tassel=new THREE.Mesh(new THREE.ConeGeometry(.06,.3,8),bronze);tassel.rotation.x=Math.PI;tassel.position.y=-.59;root.add(tassel);scene.add(root);
 swingLanterns.push({root,offset:rand()*6.28,initialY:y});
 softGlow(x,y,z,2.9*scale,.45);return root;
}
const lanternLights=[];
function hang(x,z,h=3.55,scale=1){
 const stem=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.8,8),bronze);stem.position.set(x,h+.8,z);scene.add(stem);
 lantern(x,h,z,scale);
 const light=new THREE.PointLight(0xffb06a,innerWidth<800?5:7,11,2);light.position.set(x,h,z);scene.add(light);lanternLights.push(light);
}
for(const z of [17,9,.5,-8,-17,-26,-35])for(const side of [-1,1])hang(side*5.55,z,3.6,z===9?1.12:.92);
for(const z of [11,-11,-29]){
 const top=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,11.2,8),materials.darkWood);top.rotation.z=Math.PI/2;top.position.set(0,5.8,z);scene.add(top);
 for(const x of [-3.8,-1.6,1.6,3.8])hang(x,z,4.8,.7);
}
function wishingTree(x,z){
 const tree=new THREE.Group();tree.position.set(x,0,z);scene.add(tree);
 const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.3,.47,5.7,12),materials.darkWood);trunk.position.y=2.85;trunk.castShadow=true;tree.add(trunk);
 for(let i=0;i<35;i++){
  const ang=rand()*Math.PI*2,rad=1+rand()*3.4,y=3.4+rand()*3.8;
  const twig=new THREE.Mesh(new THREE.CylinderGeometry(.028,.07,1.5+rand(),6),materials.darkWood);
  twig.position.set(Math.cos(ang)*rad*.35,y,Math.sin(ang)*rad*.35);twig.rotation.z=(rand()-.5)*1.6;tree.add(twig);
  const bloom=new THREE.Sprite(new THREE.SpriteMaterial({map:glTex,color:i%4?0xf6b7bb:0xffe8cf,transparent:true,opacity:.44,depthWrite:false}));
  bloom.position.set(Math.cos(ang)*rad,y,Math.sin(ang)*rad);bloom.scale.set(.8+rand()*1.4,.8+rand()*1.4,1);tree.add(bloom);
 }
}
wishingTree(15,-31);
const water=new THREE.Mesh(new THREE.PlaneGeometry(12,17),new THREE.MeshPhysicalMaterial({color:0x315674,metalness:.72,roughness:.24,transparent:true,opacity:.93,clearcoat:.85,clearcoatRoughness:.16}));
water.rotation.x=-Math.PI/2;water.position.set(15,-.14,-19);scene.add(water);
const waterShimmer=addWaterShimmer(scene);
const shore=new THREE.Mesh(new THREE.BoxGeometry(.32,.45,18),darkStone);shore.position.set(9.4,.03,-19);scene.add(shore);
for(const z of [-11,-16,-21,-26]){const deco=new THREE.Mesh(new THREE.BoxGeometry(3,.12,.2),bronze);deco.position.set(12,.2,z);scene.add(deco)}
const detailing=new URLSearchParams(location.search).has('noDetail') ? {shopCount:0,floweringTrees:0,wetPatches:0,tick(){}} : addStreetDetails(scene,{low:innerWidth<850});
state.architecture={
  shopfronts:detailing.shopCount,
  floweringTrees:detailing.floweringTrees,
  wetStonePatches:detailing.wetPatches,
};
const keeper=createKeeper(scene,camera);
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
const clock=new THREE.Clock(),keys=new Set(),joystick={x:0,z:0};let dragId=null,lastX=0,lastY=0,target=null;
const places={
 gate:[.1,19,-.03,-.02,'巷口 · 回望月光下的迎月牌坊'],
 market:[.3,2,-.05,-.03,'灯火 · 青瓦、红墙与石板路上的温暖光影'],
 pond:[4,-18,-.28,-.025,'水岸 · 临水听月，风轻轻穿过廊檐'],
 temple:[.2,-30,-.04,-.03,'祈愿 · 走到灯火尽头，听见心里的回答'],
 keeper:[-3.6,-6.0,-.06,-.035,'守灯人 · 靠近阿灯，按 E 或点击交谈'],
};
document.querySelectorAll('[data-spot]').forEach(button=>button.addEventListener('click',()=>{
 const id=button.dataset.spot,p=places[id];state.location=id;target={x:p[0],z:p[1],yaw:p[2],pitch:p[3]};
 document.querySelector('#tip').textContent=p[4];
 document.querySelectorAll('[data-spot]').forEach(x=>x.classList.toggle('selected',x===button));
}));
document.addEventListener('keydown',e=>{keys.add(e.code);if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code))e.preventDefault()});
document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>keys.clear());
canvas.addEventListener('pointerdown',e=>{dragId=e.pointerId;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(dragId);target=null});
canvas.addEventListener('pointermove',e=>{if(dragId!==e.pointerId)return;yaw-=(e.clientX-lastX)*.003;pitch=Math.max(-.46,Math.min(.44,pitch-(e.clientY-lastY)*.0024));lastX=e.clientX;lastY=e.clientY});
canvas.addEventListener('pointerup',e=>{if(dragId===e.pointerId)dragId=null});canvas.addEventListener('pointercancel',()=>{dragId=null});
const stickZone=document.querySelector('#joystick'),nub=document.querySelector('#nub');let joyId=null;
function joyUpdate(e){const r=stickZone.getBoundingClientRect(),rad=r.width*.29,dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),ratio=Math.max(1,Math.hypot(dx,dy)/rad);joystick.x=dx/rad/ratio;joystick.z=-dy/rad/ratio;nub.style.transform='translate('+joystick.x*rad+'px,'+-joystick.z*rad+'px)'}
stickZone.addEventListener('pointerdown',e=>{joyId=e.pointerId;stickZone.setPointerCapture(joyId);joyUpdate(e)});
stickZone.addEventListener('pointermove',e=>{if(joyId===e.pointerId)joyUpdate(e)});
function joyOff(){joystick.x=joystick.z=0;joyId=null;nub.style.transform='translate(0,0)'}
stickZone.addEventListener('pointerup',joyOff);stickZone.addEventListener('pointercancel',joyOff);
let low=innerWidth<850;
const button=document.querySelector('#toggleQuality');
function setLow(v){low=v;waterShimmer.setLow(v);renderer.setPixelRatio(Math.min(devicePixelRatio||1,v?1:1.55));renderer.shadowMap.enabled=!v;fireflies.visible=!v;if(v){composer?.dispose();composer=null} else if(!composer){composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.4,.6,.88))}resize();button.querySelector('b').textContent=v?'开':'关'}
button.addEventListener('click',()=>setLow(!low));
setLow(low);
let frames=0;
function loop(){
 const delta=Math.min(.045,clock.getDelta()),t=clock.elapsedTime;
 const speed=delta*(keys.has('ShiftLeft')?7.4:4.25);
 if(keys.has('ArrowLeft'))yaw+=delta*1.55;if(keys.has('ArrowRight'))yaw-=delta*1.55;
 const f=keeper.state.talking?0:(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)+joystick.z;
 const s=keeper.state.talking?0:(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+joystick.x;
 if(Math.abs(f)+Math.abs(s)>.03){
  target=null;const n=Math.max(1,Math.hypot(f,s));
  camera.position.x+=(-Math.sin(yaw)*f+Math.cos(yaw)*s)/n*speed;
  camera.position.z+=(-Math.cos(yaw)*f-Math.sin(yaw)*s)/n*speed;
 } else if(target){
  const ease=1-Math.exp(-delta*2);
  camera.position.x+=(target.x-camera.position.x)*ease;camera.position.z+=(target.z-camera.position.z)*ease;
  yaw+=(target.yaw-yaw)*ease;pitch+=(target.pitch-pitch)*ease;
  if(Math.hypot(target.x-camera.position.x,target.z-camera.position.z)<.15)target=null;
 }
 camera.position.x=Math.min(6,Math.max(-6,camera.position.x));camera.position.z=Math.min(28,Math.max(-34,camera.position.z));camera.position.y=1.9;
 camera.rotation.set(pitch,yaw,0);
 detailing.tick(t);
 waterShimmer.update(t);
 keeper.update(t);
 swingLanterns.forEach(({root,offset,initialY})=>{root.rotation.z=Math.sin(t*.8+offset)*.018;root.position.y=initialY+Math.sin(t*.7+offset)*.015});
 if(fireflies.visible){const a=geo.attributes.position;for(let i=0;i<particles.length;i++)a.array[i*3+1]=particles[i]+Math.sin(t*.6+i)*.18;a.needsUpdate=true}
 // Keep a small active pool of warm lights around the visitor to avoid 26 full-scene point lights.
 if(frames%14===0){
   const active=new Set(lanternLights
     .map((light,i)=>({i,dist:light.position.distanceToSquared(camera.position)}))
     .sort((a,b)=>a.dist-b.dist)
     .slice(0,low?5:8).map(x=>x.i));
   lanternLights.forEach((light,i)=>{light.visible=active.has(i)});
 }
 lanternLights.forEach((lamp,i)=>{
   if(lamp.visible)lamp.intensity=(low?4.3:6.6)*(1+.07*Math.sin(t*2.2+i*1.31));
 });
 state.activeLanternLights=lanternLights.filter(x=>x.visible).length;
 if(composer)composer.render();else renderer.render(scene,camera);
 state.renderedFrames=++frames;
 requestAnimationFrame(loop);
}
state.ready=true;
document.querySelector('#loadText').textContent=state.textureFailures.length?'材质备用模式 · 已准备漫游':'宋式建筑与 PBR 材质加载完成';
loop();
