import * as THREE from 'three';

/** Lightweight moon / lantern reflection over the existing water plane. */
export function addWaterShimmer(scene) {
  const uniforms = {uTime:{value:0},uStrength:{value:1}};
  const material = new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms,
    vertexShader:`
      varying vec2 vUv;
      void main(){
        vUv=uv;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }
    `,
    fragmentShader:`
      precision mediump float;
      varying vec2 vUv;
      uniform float uTime;
      uniform float uStrength;
      float band(float x,float center,float width){
        float t=(x-center)/width;
        return exp(-t*t);
      }
      void main(){
        vec2 uv=vUv;
        float sw=sin(uv.y*76.0+sin(uv.x*14.0+uTime*.38)*1.8-uTime*.75);
        float fine=sin(uv.y*159.0+uv.x*8.0+uTime*1.3);
        float warpedX=uv.x+sw*.036+fine*.014;
        float moon=band(warpedX,.59,.09)*smoothstep(.07,.33,uv.y);
        float lampA=band(warpedX,.21,.055)*smoothstep(.1,.48,uv.y);
        float lampB=band(warpedX,.86,.075)*smoothstep(.08,.38,uv.y);
        float ripple=.5+.5*sw;
        float shimmer=pow(max(0.0,ripple),5.0)*(0.65+0.35*fine);
        vec3 blue=vec3(.15,.27,.38);
        vec3 silver=vec3(.63,.76,.87);
        vec3 amber=vec3(.91,.50,.24);
        vec3 color=blue*.5+silver*moon*shimmer*.85+amber*(lampA+lampB)*shimmer*.8;
        float alpha=clamp(.07+moon*.29+lampA*.2+lampB*.2,0.0,.62)*uStrength;
        gl_FragColor=vec4(color,alpha);
      }
    `,
  });
  const wave=new THREE.Mesh(new THREE.PlaneGeometry(12,17),material);
  wave.rotation.x=-Math.PI/2;wave.position.set(15,-.128,-19);wave.renderOrder=2;
  scene.add(wave);
  return {
    update(t){uniforms.uTime.value=t},
    setLow(low){uniforms.uStrength.value=low?.72:1},
  };
}
