import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const state={loaded:false,errors:[],modelStats:null,frames:0};
window.__ARA_VIEWER__=state;
const scene=new THREE.Scene();
scene.background=new THREE.Color('#26384c');
scene.fog=new THREE.FogExp2('#26384c',.05);
const camera=new THREE.PerspectiveCamera(40,1,.1,100);
camera.position.set(0,1.44,4.8);
const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('#avatarCanvas'),antialias:true,powerPreference:'low-power'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.4));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.65;
scene.add(new THREE.HemisphereLight(0xf6f3ee,0x6a6e8a,2.7));
const light=new THREE.DirectionalLight(0xffe6c5,3.1);light.position.set(-2,6,4);scene.add(light);
const rim=new THREE.DirectionalLight(0x9bc0ff,2.7);rim.position.set(3,4,-5);scene.add(rim);
const floor=new THREE.Mesh(new THREE.CircleGeometry(2.2,64),new THREE.MeshStandardMaterial({color:0x484a54,roughness:.7}));
floor.rotation.x=-Math.PI/2;floor.position.y=-.016;scene.add(floor);
const circles=new THREE.GridHelper(4.2,12,0xb39e7c,0x6e757e);circles.position.y=.005;scene.add(circles);

let visual=null,mixer=null,actions=new Map(),current='Idle',yaw=.23,autoRotate=false;
const status=document.querySelector('#status');
const loader=new GLTFLoader();
try{
 const gltf=await loader.loadAsync('./models/yuexia-ara-wanderer.glb');
 visual=gltf.scene;scene.add(visual);
 visual.rotation.y=.18;
 visual.traverse(o=>{if(o.isMesh){o.frustumCulled=false;const arr=Array.isArray(o.material)?o.material:[o.material];arr.forEach(m=>{if(m)m.side=THREE.DoubleSide})}});
 visual.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(visual);
 const height=box.max.y-box.min.y;
 const scale=1.85/height;visual.scale.multiplyScalar(scale);visual.position.y=-box.min.y*scale;
 mixer=new THREE.AnimationMixer(visual);
 for(const clip of gltf.animations){
  const action=mixer.clipAction(clip);action.setLoop(THREE.LoopRepeat,Infinity);actions.set(clip.name,action);
 }
 actions.get('Idle')?.play();
 state.modelStats={names:gltf.animations.map(x=>x.name),height,tris:gltf.scene.children.length,box:[box.min.toArray(),box.max.toArray()]};
 state.loaded=true;status.innerHTML='<strong>Ara 3D Gen</strong> · 真实人体/骨骼模型已加载 · '+gltf.animations.length+' 组动画';
}catch(e){state.errors.push(String(e));status.textContent='加载失败：'+String(e)}
document.querySelectorAll('[data-anim]').forEach(b=>b.addEventListener('click',()=>{
 const name=b.dataset.anim;if(!actions.has(name))return;const next=actions.get(name),prev=actions.get(current);
 if(prev&&prev!==next){next.reset().play().crossFadeFrom(prev,.25,true)}else next.play();current=name;
}));
let drag=null,lastX=0;
const canvas=renderer.domElement;
canvas.addEventListener('pointerdown',e=>{drag=e.pointerId;lastX=e.clientX;canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{if(drag===e.pointerId){yaw+=(e.clientX-lastX)*.006;lastX=e.clientX}});
canvas.addEventListener('pointerup',()=>drag=null);
canvas.addEventListener('wheel',e=>{e.preventDefault();camera.position.z=Math.max(2.9,Math.min(7,camera.position.z+Math.sign(e.deltaY)*.3));},{passive:false});
function resize(){const w=innerWidth,h=innerHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)}resize();addEventListener('resize',resize);
const clock=new THREE.Clock();
function loop(){const dt=Math.min(.06,clock.getDelta());if(mixer)mixer.update(dt);if(visual)visual.rotation.y=yaw;camera.lookAt(0,1.03,0);renderer.render(scene,camera);state.frames++;requestAnimationFrame(loop)}loop();
