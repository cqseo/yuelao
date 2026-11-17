import * as THREE from 'three';

/** 阿灯 / The Lantern Keeper — original stylized game character and scripted story.
 * Preview-only, no remote services or collection of visitor content.
 */
export function createKeeper(scene, visitor) {
  const state = { nearby: false, talking: false, chapter: 0, completed: false };
  try { state.completed = localStorage.getItem('yuexia-preview-keeper-chapter-1') === 'yes'; } catch {}
  const root = new THREE.Group();
  root.name = 'LanternKeeperADeng';
  root.position.set(-4.1, 0, -10.7);
  root.rotation.y = .35;
  scene.add(root);

  const cloth = new THREE.MeshStandardMaterial({ color: 0x5f3545, roughness: .88, side: THREE.DoubleSide });
  const cloth2 = new THREE.MeshStandardMaterial({ color: 0x343142, roughness: .84, side: THREE.DoubleSide });
  const silk = new THREE.MeshStandardMaterial({ color: 0x856177, roughness: .68, side: THREE.DoubleSide });
  const trim = new THREE.MeshStandardMaterial({ color: 0xbb9165, metalness: .33, roughness: .6 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xcba88e, roughness: .82 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x191820, roughness: .72 });
  const light = new THREE.MeshBasicMaterial({ color: 0xffd4a1, toneMapped: false });
  const lampShell = new THREE.MeshPhysicalMaterial({ color: 0xad4c40, emissive: 0xfc9555, emissiveIntensity: .48, roughness: .76, side: THREE.DoubleSide });

  function mesh(geometry, material, pos, parent = root) {
    const o = new THREE.Mesh(geometry, material);
    o.position.set(...pos); parent.add(o); return o;
  }
  function line(a,b,r,material,parent=root) {
    const from = new THREE.Vector3(...a),to=new THREE.Vector3(...b);
    const d=to.clone().sub(from);
    const m=mesh(new THREE.CylinderGeometry(r,r,d.length(),7), material, [0,0,0],parent);
    m.position.copy(from.clone().add(to).multiplyScalar(.5));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
    return m;
  }
  // The three cloth layers define a human silhouette rather than geometric body blocks.
  const robeProfile=[
    [0,.04],[.53,.04],[.65,.16],[.59,.55],[.46,1.04],
    [.37,1.42],[.27,1.52],[0,1.52]
  ].map(([r,y]) => new THREE.Vector2(r,y));
  mesh(new THREE.LatheGeometry(robeProfile,24),cloth,[0,0,0]);
  const overRobe=mesh(new THREE.CylinderGeometry(.36,.64,1.2,24,1,true),cloth2,[0,.83,0]);
  overRobe.rotation.z=.035;
  const inner=mesh(new THREE.ConeGeometry(.29,.97,20,1,true),silk,[0,1.12,.17]);
  inner.rotation.x=.075;
  // Falling narrow sashes, with muted gold edges.
  for(const side of [-1,1]){
    const sash=mesh(new THREE.PlaneGeometry(.09,1.08),trim,[side*.18,.91,.47]);
    sash.rotation.y=side*.16;
    mesh(new THREE.SphereGeometry(.08,10,9),skin,[side*.64,1.02,.2]);
    const sleeve=mesh(new THREE.CylinderGeometry(.18,.31,.62,14),cloth,[side*.47,1.3,.12]);
    sleeve.rotation.z=side*.64;
    const cuff=mesh(new THREE.CylinderGeometry(.25,.26,.08,14),silk,[side*.63,1.015,.13]);
    cuff.rotation.z=side*.63;
  }
  // Neck, face and close-fitting hair.
  mesh(new THREE.CylinderGeometry(.12,.15,.18,12),skin,[0,1.62,.05]);
  const face=mesh(new THREE.SphereGeometry(.235,24,18),skin,[0,1.82,.045]);
  face.scale.set(.95,1.26,.85);
  const rearHair=mesh(new THREE.SphereGeometry(.252,24,18),hair,[0,1.96,-.06]);
  rearHair.scale.set(1,1.12,1.02);
  const fringe=mesh(new THREE.SphereGeometry(.25,21,11,0,Math.PI*2,0,Math.PI*.45),hair,[0,1.93,.03]);
  fringe.rotation.z=.08;
  const bun=mesh(new THREE.SphereGeometry(.20,16,12),hair,[0,2.17,-.1]);
  bun.scale.set(1,.8,.8);
  const hairpin=line([-.26,2.19,-.14],[.30,2.18,-.13],.026,trim);
  mesh(new THREE.SphereGeometry(.047,9,8),trim,[.32,2.18,-.13]);
  // Faint facial line — deliberately subtle at mid-distance.
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x3c2b2e, roughness: 1 });
  for(const x of [-.096,.096]){
    const eye=mesh(new THREE.SphereGeometry(.017,8,6),eyeMaterial,[x,1.84,.255]);
    eye.scale.set(1,.7,.45);
  }
  // Lantern held in right hand, hanging from a gold loop.
  const lanternPivot=new THREE.Group();
  lanternPivot.position.set(.69,1.05,.25);
  root.add(lanternPivot);
  line([0,0,0],[0,-.22,0],.016,trim,lanternPivot);
  const paper=mesh(new THREE.SphereGeometry(.23,16,12),lampShell,[0,-.48,0],lanternPivot);
  paper.scale.set(.9,1.22,.9);
  for(const y of [-.79,-.18]){
    mesh(new THREE.CylinderGeometry(.24,.24,.065,12),trim,[0,y,0],lanternPivot);
  }
  const core=mesh(new THREE.SphereGeometry(.14,12,10),light,[0,-.48,0],lanternPivot);
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4;
    line([Math.cos(a)*.22,-.22,Math.sin(a)*.22],[Math.cos(a)*.22,-.75,Math.sin(a)*.22],.011,trim,lanternPivot);
  }
  line([0,-.84,0],[0,-1.04,0],.013,trim,lanternPivot);
  // Gold ambient lamp is kept local and low-cost.
  const point=new THREE.PointLight(0xffc081,3.4,7,2);
  point.position.set(.69,.65,.25);root.add(point);

  // Small grounded marker: a "moon ring" under the keeper, not a giant UI billboard.
  const marker=new THREE.Mesh(new THREE.RingGeometry(.72,.77,48),new THREE.MeshBasicMaterial({color:0xe6b886,transparent:true,opacity:.48,side:THREE.DoubleSide,depthWrite:false}));
  marker.rotation.x=-Math.PI/2;marker.position.set(-4.1,.043,-10.7);scene.add(marker);
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.77,32),new THREE.MeshBasicMaterial({color:0x0d121d,transparent:true,opacity:.18,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;shadow.position.set(-4.1,.035,-10.7);scene.add(shadow);

  const prompt=document.querySelector('#keeperPrompt');
  const dialog=document.querySelector('#keeperDialog');
  const close=document.querySelector('#keeperClose');
  const text=document.querySelector('#keeperText');
  const choices=document.querySelector('#keeperChoices');
  const chapter=document.querySelector('#keeperChapter');
  const progress=document.querySelector('#keeperProgress');

  const pages={
    opening:{step:'相遇',text:'今晚的月光很亮。旅人，你看见我手里的这盏灯了吗？它已经在灯火巷亮了很久。',options:[['它有什么故事？','memory'],['我想先逛一逛','close']]},
    memory:{step:'第一章 · 灯未眠',text:'很多年前，有位旅人在这里留下一盏灯，说等见到想见的人，就回来亲手熄灭它。可是，四季过去，那人一直没有回来。',options:[['这盏灯在等谁？','who'],['为什么一直点着？','why']]},
    who:{step:'第一章 · 灯未眠',text:'我不知道姓名，只记得留下灯的人说：“愿有人替我记住，曾经真心等待过。”这条街便多了一盏不愿熄灭的灯。',options:[['我愿意替你记住','promise'],['再听一遍故事','memory']]},
    why:{step:'第一章 · 灯未眠',text:'因为灯火不是占卜，也不是承诺。它只是告诉路过的人：有些心意，就算无人看见，也曾真实存在。',options:[['我愿意替你记住','promise'],['那位旅人后来呢？','who']]},
    promise:{step:'第一章 · 完成',text:'阿灯将一缕暖光放进你的掌心。“谢谢。今夜起，灯火巷也会记得有你来过。”你获得了一枚「心灯印记」。',options:[['收下心灯印记','complete']]},
    complete:{step:'灯火印记 · 已收藏',text:'你的心灯印记已经留在这台设备上。下次回来，阿灯会认出你。月下的故事，才刚刚开始。',options:[['回到灯火巷','close'],['重温第一章','memory']]},
  };

  function renderPage(name) {
    const info=pages[name]||pages.opening;
    state.chapter=name;chapter.textContent=info.step;text.textContent=info.text;
    choices.replaceChildren();
    for(const [label,next] of info.options){
      const button=document.createElement('button');button.type='button';button.textContent=label;
      button.addEventListener('click',()=>step(next));choices.appendChild(button);
    }
    progress.textContent=state.completed?'✦ 已获得心灯印记':'月下故事 · 第一章';
  }
  function step(next) {
    if(next==='close'){hide();return}
    if(next==='complete'){
      state.completed=true;
      try{localStorage.setItem('yuexia-preview-keeper-chapter-1','yes')}catch{}
    }
    renderPage(next);
  }
  function show(){
    if(!state.nearby) return;
    state.talking=true;dialog.hidden=false;prompt.hidden=true;
    renderPage(state.completed?'complete':'opening');
    document.querySelector('#keeperClose').focus();
  }
  function hide(){
    state.talking=false;dialog.hidden=true;prompt.hidden=!state.nearby;
  }
  prompt.addEventListener('click',show);
  close.addEventListener('click',hide);
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&state.talking){e.preventDefault();hide()}
    if((e.code==='KeyE'||(e.key==='Enter'&&e.target?.tagName!=='BUTTON'))&&!state.talking&&state.nearby){
      e.preventDefault();e.stopImmediatePropagation();show();
    }
  },true);
  const hint=document.querySelector('#keeperHint');
  return {
    state,position:root.position,
    update(t){
      lanternPivot.rotation.z=Math.sin(t*.85)*.07;
      root.rotation.y=.35+Math.sin(t*.42)*.035;
      marker.material.opacity=.38+Math.sin(t*1.3)*.1;
      const dx=visitor.position.x-root.position.x,dz=visitor.position.z-root.position.z;
      const near=(dx*dx+dz*dz)<43;
      if(near!==state.nearby){
        state.nearby=near;prompt.hidden=!near||state.talking;
        if(hint)hint.hidden=!near||state.talking;
      }
    },
    close:hide,
  };
}
