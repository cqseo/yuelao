import * as THREE from 'three';

/**
 * Stable third-person follow rig, independent from player movement.
 * Aimed at the upper torso; angle and zoom clamped to prevent vertigo.
 * Collision blockers approximate solid buildings by authored bounding boxes.
 */
export function createFollowCamera(camera,player,{mobile=false}={}) {
  const state={yaw:-.03,pitch:.35,zoom:mobile?5.4:6.0,desiredZoom:mobile?5.4:6.0,clipped:false,mode:'third-person'};
  const target=new THREE.Vector3(),desired=new THREE.Vector3();
  const ray=new THREE.Ray(),tmpNear=new THREE.Vector3();
  // x,z are building centers; w,d are ground-world bounding rectangles, height is approximate.
  const buildings=[
    [-10,-.5,6.5,8.7,7.6],[10,-1.5,6.5,8.7,8.7],
    [-10,-14.5,6.5,8.7,9],[10,-14,6.5,8.7,7.6],
    [-10,-26.5,6.5,8.7,7.6],[10,-26,6.5,8.7,7.6],
    [0,-39,15,10,11],[0,25.3,13,3.5,6],
    [-17,56,7.8,10.5,7],[43,-52,8.1,11.3,7],
    [-46,-43,7.7,10.8,7],[0,-88,13.3,8.8,9],[18,57,6.1,8.4,7],
  ];
  const blockers=buildings.map(([x,z,w,d,h])=>new THREE.Box3(
    new THREE.Vector3(x-w/2,-.2,z-d/2),new THREE.Vector3(x+w/2,h,z+d/2)
  ));
  const actual=new THREE.Vector3();
  let initial=true;

  function setOrientation(yaw,pitch=.35) {
    state.yaw=yaw;
    state.pitch=THREE.MathUtils.clamp(pitch,.14,.64);
  }
  function rotate(dx,dy) {
    state.yaw=THREE.MathUtils.euclideanModulo(state.yaw-dx,Math.PI*2);
    state.pitch=THREE.MathUtils.clamp(state.pitch+dy,.14,.64);
  }
  function zoom(delta) {
    state.desiredZoom=THREE.MathUtils.clamp(state.desiredZoom+delta,3.65,7.65);
  }
  function update(dt,{snap=false}={}) {
    state.zoom+=(state.desiredZoom-state.zoom)*Math.min(1,dt*7);
    if(snap)state.zoom=state.desiredZoom;
    target.set(player.position.x,1.55,player.position.z);
    // Shoulder camera remains behind the character and above their head.
    const horizontal=Math.cos(state.pitch)*state.zoom;
    desired.set(
      target.x+Math.sin(state.yaw)*horizontal,
      target.y+Math.sin(state.pitch)*state.zoom,
      target.z+Math.cos(state.yaw)*horizontal
    );
    const lookRay=desired.clone().sub(target);
    const length=lookRay.length();
    ray.set(target,lookRay.normalize());
    let nearest=length;
    for(const obstacle of blockers) {
      const hit=ray.intersectBox(obstacle,tmpNear);
      if(hit) {
        const d=target.distanceTo(hit);
        if(d<nearest&&d>.48)nearest=Math.max(1.55,d-.38);
      }
    }
    state.clipped=nearest<length-.2;
    if(state.clipped)desired.copy(target).addScaledVector(ray.direction,nearest);
    if(initial||snap){
      camera.position.copy(desired);
      initial=false;
    }else{
      // Gentle positional smoothing that is independent from framerate.
      const t=1-Math.exp(-dt*11);
      camera.position.lerp(desired,t);
    }
    camera.lookAt(target);
    actual.copy(camera.position);
  }
  function snap(){update(1/60,{snap:true})}
  return {state,update,setOrientation,rotate,zoom,snap, get heading(){return state.yaw}};
}
