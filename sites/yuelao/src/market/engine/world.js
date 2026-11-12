import * as THREE from 'three';
import { createMaterials, roofGeometry } from './mats.js';
import { canvasTex, rand, textPlane } from './util.js';

// 月下集市：山門外 → 牌樓 → 圓形廣場。廣場正中是許願池（池心一棵許願樹），正北是
// 大殿，東西兩側各三間鋪子圍成一圈、門都朝著池子。可以自由走動；可進的房間門口有提示。
const PLAZA_R = 26.5; // 廣場可走的半徑
const POND_R = 6;
const GATE_Z = 30;

export const ROOMS = [
  { id: 'yuelao', name: '月老殿', sub: '求籤問緣', open: true, tint: 0xffb060, cloth: '#7b161b' },
  { id: 'tarot', name: '塔羅館', sub: '三張牌陣', open: true, tint: 0xa98bff, cloth: '#2a1b55' },
  { id: 'hall', name: '大殿', sub: '多人同拜', open: true, tint: 0xffc070, cloth: '#5a1612' },
  { id: 'bazi', name: '算命攤', sub: '八字命盤', open: false },
  { id: 'sutra', name: '抄經閣', sub: '描紅抄經', open: false },
  { id: 'burn', name: '化寶爐', sub: '燒疏文', open: false },
  { id: 'rent', name: '旺鋪招租', sub: '虛位以待', open: false, note: '虛位以待' },
];

const FACE = { S: 0, E: Math.PI / 2, N: Math.PI, W: -Math.PI / 2 };

function latticeTex() {
  return canvasTex(128, 128, (g, w, h) => {
    // paper window lit from inside: warm in the middle, darker at the edges, fine wooden lattice
    const gr = g.createRadialGradient(w / 2, h * 0.6, 4, w / 2, h / 2, w * 0.75);
    gr.addColorStop(0, '#f2c070');
    gr.addColorStop(1, '#8a4e1c');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#150a05';
    g.lineWidth = 3;
    for (let i = 0; i <= 8; i++) {
      g.beginPath();
      g.moveTo((i * w) / 8, 0);
      g.lineTo((i * w) / 8, h);
      g.moveTo(0, (i * h) / 8);
      g.lineTo(w, (i * h) / 8);
      g.stroke();
    }
    g.lineWidth = 7;
    g.strokeRect(0, 0, w, h);
    g.strokeRect(w * 0.25, h * 0.25, w * 0.5, h * 0.5);
  });
}

export function createWorld(renderer, lowQuality) {
  const scene = new THREE.Scene();
  const _pm = new THREE.Matrix4();
  const _pv = new THREE.Vector3();
  const _pq = new THREE.Quaternion();
  const _pe = new THREE.Euler();
  const _ps = new THREE.Vector3();
  scene.fog = new THREE.FogExp2(0x090a14, 0.02); // 霧壓暗遠景，讓廣場邊緣融進夜色
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 500);
  camera.rotation.order = 'YXZ';
  const mat = createMaterials();
  const lattice = latticeTex();
  const lanternSpots = [];
  const labels = [];
  const flick = [];
  const shadow = (m, cast = true, recv = true) => {
    m.castShadow = cast && !lowQuality;
    m.receiveShadow = recv && !lowQuality;
    return m;
  };
  const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);

  // ---------- sky ----------
  const moonDir = new THREE.Vector3(-0.16, 0.4, -1).normalize();
  const sunDir = new THREE.Vector3(0.6, -0.5, -0.4).normalize();
  const keyDir = moonDir.clone(); // 主光此刻的方向：白天跟太陽，夜裡跟月亮
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(400, 32, 20),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uMoon: { value: moonDir },
        uSun: { value: sunDir },
        uDay: { value: 0 },
        uDusk: { value: 0 },
        uT: { value: 0 },
      },
      vertexShader:
        'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }',
      fragmentShader: `
        varying vec3 vD; uniform vec3 uMoon; uniform vec3 uSun; uniform float uDay; uniform float uDusk; uniform float uT;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.03; a*=0.5; } return s; }
        void main(){
          vec3 d = normalize(vD);
          float up = clamp(d.y, 0.0, 1.0);
          float night = 1.0 - uDay;
          vec3 nightCol = mix(vec3(0.085,0.075,0.16), vec3(0.012,0.016,0.045), pow(up, 0.55));
          vec3 dayCol = mix(vec3(0.78,0.86,0.95), vec3(0.22,0.47,0.84), pow(up, 0.6));
          vec3 col = mix(nightCol, dayCol, uDay);
          col += vec3(0.32,0.14,0.05) * pow(1.0 - up, 7.0) * 0.55 * night;       // 夜裡地平線上的燈火
          float sd = dot(d, uSun);
          col = mix(col, vec3(1.0,0.5,0.24), pow(1.0 - up, 2.2) * uDusk * (0.55 + 0.45 * pow(max(sd, 0.0), 2.0))); // 晨昏的霞
          float sunUp = smoothstep(-0.06, 0.04, uSun.y);
          col += vec3(1.0,0.86,0.62) * pow(max(sd,0.0), 90.0) * 0.5 * sunUp;      // 日暈
          col += vec3(1.0,0.96,0.86) * smoothstep(0.9989, 0.9994, sd) * 3.0 * sunUp; // 日輪
          float md = dot(d, uMoon);
          col += vec3(0.75,0.8,1.0) * pow(max(md,0.0), 22.0) * 0.26 * night;      // 月暈
          col += vec3(1.0,0.96,0.86) * smoothstep(0.9982, 0.9989, md) * night;    // 月輪
          vec2 sp = d.xz / (d.y + 0.25) * 90.0;
          float st = step(0.9965, h(floor(sp))) * (0.5 + 0.5 * sin(uT * 2.0 + h(floor(sp) + 3.1) * 40.0));
          col += vec3(0.8,0.85,1.0) * st * up * 0.9 * night * night;
          float cl = fbm(d.xz / (d.y + 0.35) * 2.2 + vec2(uT * 0.01, 0.0));
          vec3 cloudNight = vec3(0.16,0.16,0.26) + vec3(0.25,0.27,0.36) * pow(max(md,0.0), 6.0);
          vec3 cloudDay = mix(vec3(0.97,0.97,0.98), vec3(1.0,0.72,0.5), uDusk * 0.8);
          col = mix(col, mix(cloudNight, cloudDay, uDay), smoothstep(0.52, 0.95, cl) * 0.55 * smoothstep(0.02, 0.3, up));
          gl_FragColor = vec4(col, 1.0);
        }`,
    }),
  );
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);

  // image-based lighting so wet stone, lacquer and bronze pick up the lantern glow
  {
    const env = new THREE.Scene();
    env.background = new THREE.Color(0x06070f);
    for (let i = 0; i < 46; i++) {
      const s = new THREE.Mesh(
        new THREE.SphereGeometry(rand(0.5, 1.1), 10, 8),
        new THREE.MeshBasicMaterial({ color: i % 5 ? 0xff7a30 : 0xffc890 }),
      );
      const a = rand(6.28);
      s.position.set(Math.cos(a) * rand(7, 20), rand(1.5, 9), Math.sin(a) * rand(7, 20));
      env.add(s);
    }
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(5, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xc8d4ff }),
    );
    m.position.copy(moonDir).multiplyScalar(60);
    env.add(m);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.04).texture;
    scene.environmentIntensity = 0.55;
    pm.dispose();
  }

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(0x5a68a8, 0x1c100a, 0.55);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x9fb2ff, 1.25);
  moon.position.copy(moonDir).multiplyScalar(80);
  if (!lowQuality) {
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    const sc = moon.shadow.camera;
    sc.left = sc.bottom = -42;
    sc.right = sc.top = 42;
    sc.near = 10;
    sc.far = 220;
    moon.shadow.bias = -0.0006;
    moon.shadow.normalBias = 0.05;
  }
  scene.add(moon, moon.target);
  const warmLights = []; // 燈籠與爐火的點光：白天調暗
  const warm = (x, y, z, i = 34, d = 20, c = 0xff9040) => {
    const l = new THREE.PointLight(c, i, d, 1.6);
    l.position.set(x, y, z);
    l.userData.base = i;
    scene.add(l);
    warmLights.push(l);
    return l;
  };

  // ---------- ground ----------
  const ground = shadow(new THREE.Mesh(new THREE.PlaneGeometry(190, 190), mat.ground), false);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  scene.add(ground);

  // ---------- real reflections in the wet stone (desktop only: one extra half-size render per frame) ----------
  const reflRes = { value: new THREE.Vector2(1, 1) };
  let reflRT = null;
  const reflCam = new THREE.PerspectiveCamera();
  if (!lowQuality) {
    reflRT = new THREE.WebGLRenderTarget(640, 360, { type: THREE.HalfFloatType });
    mat.ground.onBeforeCompile = (sh) => {
      sh.uniforms.tRefl = { value: reflRT.texture };
      sh.uniforms.uRes = reflRes;
      sh.fragmentShader =
        'uniform sampler2D tRefl; uniform vec2 uRes;\n' +
        sh.fragmentShader.replace(
          '#include <opaque_fragment>',
          `{
            vec2 ruv = gl_FragCoord.xy / uRes; ruv.y = 1.0 - ruv.y; ruv += normal.xy * 0.03;
            float wetK = smoothstep(0.8, 0.22, roughnessFactor);
            float fres = 0.1 + 0.9 * pow(1.0 - clamp(dot(normal, geometryViewDir), 0.0, 1.0), 2.2);
            outgoingLight += texture2D(tRefl, clamp(ruv, 0.002, 0.998)).rgb * wetK * fres;
          }
          #include <opaque_fragment>`,
        );
    };
  }

  // ---------- market stalls (decoration; walkers go around them) ----------
  const stallCircles = [];
  function stall(x, z, rot, c1, c2) {
    const g = new THREE.Group();
    const cloth = canvasTex(64, 64, (c, w) => {
      for (let i = 0; i < 8; i++) {
        c.fillStyle = i % 2 ? c1 : c2;
        c.fillRect((i * w) / 8, 0, w / 8, w);
      }
    });
    g.add(shadow(box(2.4, 0.1, 1.2, mat.wood)).translateY(0.85));
    for (const [px, pz] of [
      [-1.15, -0.55],
      [1.15, -0.55],
      [-1.15, 0.55],
      [1.15, 0.55],
    ])
      g.add(
        shadow(box(0.08, 2.4, 0.08, mat.wood))
          .translateX(px)
          .translateY(1.2)
          .translateZ(pz),
      );
    const top = shadow(
      new THREE.Mesh(
        new THREE.PlaneGeometry(3, 2),
        new THREE.MeshStandardMaterial({ map: cloth, side: THREE.DoubleSide, roughness: 0.9 }),
      ),
    );
    top.rotation.x = -Math.PI / 2 + 0.22;
    top.position.set(0, 2.45, 0.1);
    g.add(top);
    for (let i = 0; i < 5; i++)
      g.add(
        shadow(box(0.3, 0.22, 0.3, i % 2 ? mat.red : mat.gold))
          .translateX(-0.9 + i * 0.45)
          .translateY(1.01)
          .translateZ(rand(-0.3, 0.3)),
      );
    g.add(
      shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.7, 12), mat.wood))
        .translateX(1.7)
        .translateY(0.35),
    );
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    scene.add(g);
    lanternSpots.push([
      new THREE.Vector3(x, 2.05, z).add(
        new THREE.Vector3(1.1, 0, 0.75).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot),
      ),
      0.8,
    ]);
    stallCircles.push([x, z, 1.9]);
  }
  stall(-7.5, 37, 0.5, '#8a1c14', '#e6dcc4');
  stall(7.5, 36, -0.6, '#24484a', '#e6dcc4');
  stall(-13, 20.5, 0.9, '#c9a25a', '#5a1612');
  stall(13, 20.5, -0.9, '#8a1c14', '#e6dcc4');
  stall(-12.5, -19, 2.4, '#24484a', '#e6dcc4');

  // ---------- a building ----------
  // (x, z) is the centre of the front face on the ground; `face` is the way the front looks.
  function house(o) {
    const {
      x,
      z,
      w = 8.2,
      d = 7,
      h = 3.6,
      face = 'S',
      rot = FACE[face],
      floors = 1,
      sign,
      banner,
      open = false,
      lit = true,
      tint = 0xffb060,
      cloth = '#5a1612',
      grand = false,
      y = 0,
    } = o;
    const g = new THREE.Group();
    const B = 0.3;
    g.add(
      shadow(box(w + 0.7, B, d + 1.6, mat.stone))
        .translateY(B / 2)
        .translateZ(-d / 2 + 0.45),
    );
    g.add(
      shadow(box(w, h, d, mat.plaster))
        .translateY(B + h / 2)
        .translateZ(-d / 2),
    );
    g.add(
      box(w - 0.3, h - 0.5, 0.14, mat.wood)
        .translateY(B + (h - 0.5) / 2)
        .translateZ(0.03),
    );
    const nCol = grand ? 6 : 4;
    for (let i = 0; i < nCol; i++) {
      const cx = -w / 2 + 0.25 + (i * (w - 0.5)) / (nCol - 1);
      const c = shadow(
        new THREE.Mesh(new THREE.CylinderGeometry(grand ? 0.24 : 0.16, grand ? 0.26 : 0.17, h, 14), mat.red),
      );
      c.position.set(cx, B + h / 2, 0.75);
      const base = box(grand ? 0.7 : 0.48, 0.22, grand ? 0.7 : 0.48, mat.stone);
      base.position.set(cx, B + 0.11, 0.75);
      g.add(c, base);
    }
    g.add(
      box(w + 0.3, 0.32, 0.3, mat.red)
        .translateY(B + h - 0.2)
        .translateZ(0.75),
    );
    g.add(
      box(w + 0.3, 0.14, 0.24, mat.gold)
        .translateY(B + h - 0.47)
        .translateZ(0.76),
    );

    let top = B + h;
    if (floors === 2) {
      const mid = shadow(new THREE.Mesh(roofGeometry(w + 2.4, d + 3, 0.95, 0.45), mat.tile));
      mid.position.set(0, top, -d / 2 + 0.3);
      g.add(mid);
      const uh = 2.5;
      g.add(
        shadow(box(w - 1.8, uh, d - 2, mat.plaster))
          .translateY(top + uh / 2 + 0.3)
          .translateZ(-d / 2),
      );
      for (const wx of [-(w - 1.8) / 4, (w - 1.8) / 4]) {
        const uw = new THREE.Mesh(
          new THREE.PlaneGeometry(1.5, 1.1),
          new THREE.MeshBasicMaterial({ map: lattice, color: lit ? 0xc89050 : 0x30241c }),
        );
        uw.position.set(wx, top + 1.5, -1 + 0.02);
        g.add(uw);
      }
      g.add(
        box(w - 1.6, 0.14, 0.2, mat.red)
          .translateY(top + 0.75)
          .translateZ(-0.95),
      );
      top += uh + 0.3;
    }
    const rise = grand ? 3 : 1.8;
    const roof = shadow(
      new THREE.Mesh(
        roofGeometry(
          (floors === 2 ? w - 1.8 : w) + 2.6,
          (floors === 2 ? d - 2 : d) + 3.2,
          rise,
          grand ? 1.1 : 0.6,
        ),
        mat.tile,
      ),
    );
    roof.position.set(0, top, -d / 2 + (floors === 2 ? 0 : 0.3));
    g.add(roof);
    const rl = (floors === 2 ? w - 1.8 : w) + 2.2;
    g.add(
      box(rl, 0.3, 0.34, mat.dark)
        .translateY(top + rise + 0.08)
        .translateZ(-d / 2 + (floors === 2 ? 0 : 0.3)),
    );
    for (const sx of [-1, 1])
      g.add(
        box(0.3, 0.6, 0.4, mat.dark)
          .translateX((sx * rl) / 2)
          .translateY(top + rise + 0.3)
          .translateZ(-d / 2 + (floors === 2 ? 0 : 0.3)),
      );

    // door and windows
    const dw = grand ? 3 : 2;
    const dh = grand ? 3.4 : 2.6;
    const door = new THREE.Mesh(
      new THREE.PlaneGeometry(dw, dh),
      open
        ? new THREE.MeshBasicMaterial({ color: tint })
        : new THREE.MeshBasicMaterial({ map: lattice, color: lit ? 0x9a6a38 : 0x241a14 }),
    );
    door.position.set(0, B + dh / 2, 0.11);
    g.add(door);
    g.add(
      box(dw + 0.36, 0.2, 0.2, mat.red)
        .translateY(B + dh + 0.1)
        .translateZ(0.12),
    );
    const wins = grand ? [-7.4, -4.2, 4.2, 7.4] : [-2.6, 2.6];
    for (const wx of wins) {
      if (Math.abs(wx) > w / 2 - 0.8) continue;
      const win = new THREE.Mesh(
        new THREE.PlaneGeometry(grand ? 2.2 : 1.6, grand ? 2 : 1.4),
        new THREE.MeshBasicMaterial({ map: lattice, color: lit ? (open ? 0xffffff : 0xb8905e) : 0x2a2018 }),
      );
      win.position.set(wx, B + (grand ? 2.2 : 1.85), 0.11);
      g.add(win);
    }
    if (sign) {
      const s = textPlane(sign, grand ? 1.05 : 0.66, {
        bg: '#130905',
        fg: open || grand ? '#f3d691' : lit ? '#c9a66b' : '#6b5a44',
        border: open || grand ? '#b88a3c' : '#5a4426',
        size: 150,
      });
      s.position.set(0, B + h - (grand ? 1.05 : 0.86), 0.95);
      g.add(s);
    }
    if (banner) {
      const b = textPlane(banner, grand ? 2.6 : 2, {
        vertical: true,
        bg: cloth,
        fg: open ? '#f6e4b6' : '#c9b48a',
        size: 110,
        weight: 700,
      });
      b.position.set(-w / 2 + 0.9, B + (grand ? 2.4 : 1.8), 0.98);
      g.add(b);
    }
    if (open) {
      const spill = new THREE.Mesh(
        new THREE.PlaneGeometry(4, 6),
        new THREE.MeshBasicMaterial({
          map: spillTex,
          color: tint,
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      spill.rotation.x = -Math.PI / 2;
      spill.position.set(0, 0.03, 3.4);
      g.add(spill);
    }
    g.position.set(x, y, z);
    g.rotation.y = rot;
    scene.add(g);

    const fx = Math.sin(rot);
    const fz = Math.cos(rot);
    const toWorld = (lx, ly, lz) =>
      new THREE.Vector3(lx, ly, lz)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), rot)
        .add(new THREE.Vector3(x, y, z));
    for (const lx of grand ? [-6, -2.2, 2.2, 6] : [-w / 2 + 1.3, w / 2 - 1.3])
      lanternSpots.push([toWorld(lx, B + h - 1.05, 1.35), lit || open ? 1 : 0.35]);
    if (open) warm(x + fx * 2.2, y + 2.4, z + fz * 2.2, 30, 13, tint);
    return {
      door: toWorld(0, B + 1.3, 0.2),
      stand: toWorld(0, 1.65, 3.4),
      label: toWorld(0, B + h + 0.5, 1.2),
      doorMesh: door,
      fx,
      fz,
    };
  }
  const spillTex = canvasTex(128, 128, (g, w) => {
    const gr = g.createRadialGradient(w / 2, 0, 0, w / 2, 0, w);
    gr.addColorStop(0, 'rgba(255,255,255,.95)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, w);
  });

  // ---------- 環形鋪面：東西各三間，門朝許願池 ----------
  const room = Object.fromEntries(ROOMS.map((r) => [r.id, r]));
  const shopCircles = [];
  const ring = [
    { x: -19, z: -13, sign: '塔羅館', banner: '三張牌陣', room: 'tarot', h: 4.1 },
    { x: -23, z: 0, sign: '抄經閣', banner: '籌備中', room: 'sutra', floors: 2, lit: false },
    { x: -19, z: 13, sign: '旺鋪招租', banner: '虛位以待', room: 'rent', lit: false },
    { x: 19, z: -13, sign: '月老殿', banner: '求籤問緣', room: 'yuelao', h: 4.1 },
    { x: 23, z: 0, sign: '算命攤', banner: '籌備中', room: 'bazi', floors: 2, lit: false },
    { x: 19, z: 13, sign: '茶館', banner: '清茶細點' },
  ];
  for (const s of ring) {
    const r = s.room ? room[s.room] : null;
    const len = Math.hypot(s.x, s.z);
    const res = house({
      ...s,
      rot: Math.atan2(-s.x, -s.z),
      open: !!r?.open,
      tint: r?.tint,
      cloth: r?.open ? r.cloth : s.x < 0 ? '#5a1612' : '#3a2a16',
    });
    if (r) Object.assign(r, res);
    // 屋身佔位：門面往後退半間進深
    shopCircles.push([s.x + (s.x / len) * 3.5, s.z + (s.z / len) * 3.5, 5.2]);
  }

  // ---------- 牌樓與山門外的圍牆 ----------
  {
    const g = new THREE.Group();
    for (const x of [-4.4, 4.4]) {
      g.add(
        shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.33, 6, 16), mat.red))
          .translateX(x)
          .translateY(3),
      );
      g.add(box(1, 0.8, 1, mat.stone).translateX(x).translateY(0.4));
    }
    g.add(
      box(10, 0.5, 0.5, mat.red).translateY(5.4),
      box(9.4, 0.3, 0.4, mat.red).translateY(4.5),
      box(9.4, 0.12, 0.44, mat.gold).translateY(4.28),
    );
    for (const [x, y, w] of [
      [0, 6.3, 7],
      [-4.1, 5.75, 4],
      [4.1, 5.75, 4],
    ]) {
      const r = shadow(new THREE.Mesh(roofGeometry(w, 3, 1.1, 0.5), mat.tile));
      r.position.set(x, y, 0);
      g.add(
        r,
        box(w - 0.6, 0.24, 0.3, mat.dark)
          .translateX(x)
          .translateY(y + 1.14),
        box(w * 0.7, y - 5.6, 0.34, mat.wood)
          .translateX(x)
          .translateY((y + 5.6) / 2),
      );
    }
    const sign = textPlane('月下集市', 0.8, { bg: '#120805', fg: '#f3d691', border: '#b88a3c', size: 160 });
    sign.position.set(0, 4.95, 0.3);
    g.add(sign);
    for (const sx of [-1, 1]) {
      g.add(
        shadow(box(26, 3.4, 0.6, mat.plaster))
          .translateX(sx * 18)
          .translateY(1.7),
      );
      const cap = new THREE.Mesh(roofGeometry(26.4, 1.5, 0.45, 0), mat.tile);
      cap.position.set(sx * 18, 3.4, 0);
      g.add(cap);
    }
    g.position.z = GATE_Z;
    scene.add(g);
    for (const x of [-3, -1, 1, 3]) lanternSpots.push([new THREE.Vector3(x, 3.75, GATE_Z + 0.15), 1.1]);
    warm(0, 3.4, GATE_Z + 3, 30, 18);
  }

  // ---------- 許願池：一圈石欄、一池靜水、池心的許願樹 ----------
  const talis = new THREE.Group();
  // 願望牌：一則公開的願望一塊牌，掛在樹冠下；自己的那塊是金色。點牌子可以看內容。
  const PLATES = 160;
  const plateSlots = []; // { id, mine, pos, ph, born }
  let plates;
  let plateStrings;
  {
    const g = new THREE.Group();
    g.add(
      shadow(
        new THREE.Mesh(new THREE.CylinderGeometry(POND_R, POND_R + 0.2, 0.45, 56), mat.stone),
      ).translateY(0.225),
    );
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(POND_R - 0.45, 56),
      new THREE.MeshStandardMaterial({
        color: 0x0a1626,
        roughness: 0.06,
        metalness: 0.7,
        envMapIntensity: 2.2,
      }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.47;
    g.add(water);
    // 池面的蓮花燈
    const lamp = new THREE.MeshBasicMaterial({ color: 0xffc070 });
    for (let i = 0; i < 16; i++) {
      const a = rand(6.28);
      const r = rand(3.3, POND_R - 0.9);
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), lamp);
      m.position.set(Math.cos(a) * r, 0.53, Math.sin(a) * r);
      m.scale.y = 0.6;
      g.add(m);
    }
    // 池邊一圈冷光：新國潮的那一點「賽博」只放在這裡和符紙上
    const glowRing = new THREE.Mesh(
      new THREE.RingGeometry(POND_R + 0.28, POND_R + 0.36, 96),
      new THREE.MeshBasicMaterial({ color: 0x4deeea, transparent: true, opacity: 0.85, toneMapped: false }),
    );
    glowRing.rotation.x = -Math.PI / 2;
    glowRing.position.y = 0.025;
    g.add(glowRing);

    // 池心小島與許願樹
    const tree = new THREE.Group();
    tree.add(
      shadow(new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.5, 0.9, 40), mat.stone)).translateY(0.45),
    );
    const bark = new THREE.MeshStandardMaterial({ color: 0x241710, roughness: 1 });
    tree.add(shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.95, 5, 12), bark)).translateY(3));
    const leaf = new THREE.MeshStandardMaterial({
      color: 0x2c3d24,
      roughness: 1,
      emissive: 0x1c1206,
      emissiveIntensity: 1,
      flatShading: true,
    });
    const canopy = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), leaf, 130);
    const ribbons = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.05, 0.55),
      new THREE.MeshBasicMaterial({ color: 0xa81e16, side: THREE.DoubleSide }),
      520,
    );
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < 130; i++) {
      const a = rand(6.28);
      const r = Math.sqrt(Math.random()) * 5.2;
      const y = 6.2 + rand(-0.9, 2.4) * (1 - r / 7) - r * 0.12;
      m4.compose(
        new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r),
        q.setFromEuler(new THREE.Euler(rand(3), rand(3), 0)),
        new THREE.Vector3(rand(0.8, 1.5), rand(0.5, 0.9), rand(0.8, 1.5)),
      );
      canopy.setMatrixAt(i, m4);
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.16, r + 1.5, 6), bark);
      br.position.set((Math.cos(a) * r) / 2, 5.2 + (y - 5.6) / 2, (Math.sin(a) * r) / 2);
      br.rotation.set(0, -a, -Math.PI / 2 + Math.atan2(y - 5, r + 0.01));
      if (i % 12 === 0) tree.add(br);
    }
    for (let i = 0; i < 520; i++) {
      const a = rand(6.28);
      const r = Math.sqrt(Math.random()) * 5;
      m4.compose(
        new THREE.Vector3(Math.cos(a) * r, rand(4.3, 5.5) - r * 0.1, Math.sin(a) * r),
        q.setFromEuler(new THREE.Euler(0, rand(3), rand(-0.12, 0.12))),
        new THREE.Vector3(1, rand(0.6, 1.5), 1),
      );
      ribbons.setMatrixAt(i, m4);
    }
    canopy.castShadow = !lowQuality;
    tree.add(canopy, ribbons);
    plates = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.46, 0.66, 0.05).translate(0, -0.33, 0),
      new THREE.MeshStandardMaterial({ roughness: 0.55, emissive: 0x3a0c06, emissiveIntensity: 0.6 }),
      PLATES,
    );
    plates.count = 0;
    plates.frustumCulled = false;
    // 點選用：牌子只在樹冠下這一圈，固定的包圍球就夠了，不必每幀重算
    plates.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 3.6, 0), 6.5);
    plateStrings = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.025, 0.7, 0.025).translate(0, 0.35, 0),
      new THREE.MeshBasicMaterial({ color: 0xc0281c }),
      PLATES,
    );
    plateStrings.count = 0;
    plateStrings.frustumCulled = false;
    tree.add(plates, plateStrings);
    tree.scale.setScalar(0.72);
    g.add(tree);
    scene.add(g);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * 6.28;
      lanternSpots.push([
        new THREE.Vector3(Math.cos(a) * rand(1.6, 3.2), rand(2.9, 3.6), Math.sin(a) * rand(1.6, 3.2)),
        0.7,
      ]);
    }
    warm(0, 3, 5, 36, 20);
    warm(0, 3, -5, 30, 20);
    labels.push({
      name: '許願池',
      sub: '繫一條紅線',
      pos: new THREE.Vector3(0, 2.4, POND_R + 0.8),
      open: true,
      plain: true,
      wish: true,
    });

    // 浮在池子上空的符紙，慢慢繞著樹轉
    for (let i = 0; i < 18; i++) {
      const t = textPlane('緣福安喜願'[i % 5], 0.62, {
        bg: '#1a0705',
        fg: '#ffcf6a',
        border: '#ffbe3b',
        size: 120,
      });
      t.material.side = THREE.DoubleSide;
      t.material.toneMapped = false;
      t.material.transparent = true;
      t.material.opacity = 0.9;
      const a = (i / 18) * 6.28 + rand(0.2);
      const r = rand(7.2, 9.5);
      t.position.set(Math.cos(a) * r, rand(3.4, 7), Math.sin(a) * r);
      t.rotation.y = -a + Math.PI / 2;
      t.userData.y = t.position.y;
      t.userData.ph = rand(6.28);
      talis.add(t);
    }
    scene.add(talis);
  }

  // 從樹頂拉向廣場四周的燈籠串，八根燈柱
  {
    const wireMat = new THREE.LineBasicMaterial({ color: 0x15100c });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      const ex = Math.cos(a) * 20.5;
      const ez = Math.sin(a) * 20.5;
      if (Math.abs(ex) > 16 && Math.abs(ez) < 17) continue; // 讓開鋪面
      scene.add(
        shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.2, 8), mat.wood))
          .translateX(ex)
          .translateY(2.6)
          .translateZ(ez),
      );
      const pts = [];
      for (let i = 0; i <= 20; i++) {
        const u = i / 20;
        pts.push(new THREE.Vector3(ex * u, 5.6 + (1 - u) * 0.3 - Math.sin(u * Math.PI) * 1.1, ez * u));
      }
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
      for (let i = 2; i <= 6; i++) {
        const u = i / 7;
        lanternSpots.push([
          new THREE.Vector3(ex * u, 5.15 + (1 - u) * 0.3 - Math.sin(u * Math.PI) * 1.1, ez * u),
          1,
        ]);
      }
      lanternSpots.push([new THREE.Vector3(ex, 4.7, ez), 1.1]);
    }
    warm(-11, 4.6, 9, 30, 22);
    warm(11, 4.6, 9, 30, 22);
    warm(-11, 4.6, -9, 26, 20);
    warm(11, 4.6, -9, 26, 20);
  }

  // ---------- 大殿（正北，石台上）、殿前銅爐、化寶爐 ----------
  const HALL_Z = -27;
  let beam;
  {
    const py = 1.1;
    scene.add(
      shadow(box(27, py, 17, mat.stone))
        .translateY(py / 2)
        .translateZ(HALL_Z - 6),
    );
    for (let i = 0; i < 4; i++)
      scene.add(
        shadow(box(9, py - i * 0.27, 0.45, mat.stone))
          .translateY((py - i * 0.27) / 2)
          .translateZ(HALL_Z + 2.7 + i * 0.45),
      );
    Object.assign(
      room.hall,
      house({
        x: 0,
        z: HALL_Z,
        y: py,
        w: 22,
        d: 11,
        h: 5.4,
        sign: '大殿',
        banner: '多人同拜',
        grand: true,
        lit: true,
        open: true,
        tint: room.hall.tint,
        cloth: '#5a1612',
      }),
    );
    // 門口的落腳點放在台階下（石台本身不能走）
    room.hall.stand = new THREE.Vector3(2.6, 1.65, HALL_Z + 5.7);
    warm(0, 5, HALL_Z + 5.5, 46, 26, 0xffa050);
    // 一束從斜上方打下來的暖光，只照殿門和銅爐：明暗對比都靠它
    beam = new THREE.SpotLight(0xffe2a0, 1400, 60, 0.3, 0.7, 1.6);
    beam.position.set(12, 26, -6);
    beam.target.position.set(0, 2.5, HALL_Z + 2);
    scene.add(beam, beam.target);

    const c = new THREE.Group();
    c.add(
      shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.6, 0.9, 24), mat.bronze)).translateY(1.25),
      new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.8, 16), mat.bronze).translateY(0.4),
    );
    for (let i = 0; i < 9; i++) {
      const st = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, 0.8, 5),
        new THREE.MeshBasicMaterial({ color: 0x8a6a48 }),
      );
      st.position.set(rand(-0.5, 0.5), 2.05, rand(-0.5, 0.5));
      c.add(st);
    }
    c.position.set(0, 0, -18.5);
    scene.add(c);
    flick.push(warm(0, 2.4, -18.5, 22, 9, 0xff4a1c));
  }
  const FURNACE = [10.5, -19.5];
  {
    const g = new THREE.Group();
    const brick = new THREE.MeshStandardMaterial({
      color: 0x6a2a20,
      roughness: 0.9,
      normalMap: mat.stone.normalMap,
    });
    g.add(shadow(new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 0.5, 6), mat.stone)).translateY(0.25));
    g.add(shadow(new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.45, 3.2, 6), brick)).translateY(2.1));
    g.add(shadow(new THREE.Mesh(new THREE.ConeGeometry(2, 1.3, 6), mat.tile)).translateY(4.35));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.6, 6), brick).translateY(5.4));
    const mouth = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.8),
      new THREE.MeshBasicMaterial({ color: 0xff7a20 }),
    );
    mouth.position.set(-1.27, 1.7, 0);
    mouth.rotation.y = -Math.PI / 2;
    g.add(mouth);
    g.position.set(FURNACE[0], 0, FURNACE[1]);
    g.rotation.y = Math.PI / 6;
    scene.add(g);
    flick.push(warm(FURNACE[0] - 1.8, 1.8, FURNACE[1], 30, 12, 0xff6a20));
    Object.assign(room.burn, {
      door: new THREE.Vector3(FURNACE[0] - 1.4, 1.6, FURNACE[1]),
      stand: new THREE.Vector3(FURNACE[0] - 4, 1.65, FURNACE[1] + 1),
      label: new THREE.Vector3(FURNACE[0], 6.6, FURNACE[1]),
    });
  }
  // 殿前一對石燈
  for (const sx of [-1, 1]) {
    const g = new THREE.Group();
    g.add(
      shadow(box(0.5, 1.5, 0.5, mat.stone)).translateY(0.75),
      box(0.9, 0.5, 0.9, new THREE.MeshBasicMaterial({ color: 0xffc070 })).translateY(1.75),
      shadow(new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.5, 4), mat.stone))
        .translateY(2.25)
        .rotateY(Math.PI / 4),
    );
    g.position.set(sx * 6, 0, -21);
    scene.add(g);
  }

  // ---------- lanterns (instanced) ----------
  let lanternGlow;
  {
    const n = lanternSpots.length;
    const map = canvasTex(64, 128, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#a82410');
      gr.addColorStop(0.45, '#ffb04a');
      gr.addColorStop(0.6, '#ff8a30');
      gr.addColorStop(1, '#9a1c0c');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(90,10,0,.5)';
      for (let x = 4; x < w; x += 8) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, h);
        g.stroke();
      }
    });
    const body = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.27, 16, 12),
      new THREE.MeshBasicMaterial({ map }),
      n,
    );
    const caps = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.7, 8),
      new THREE.MeshBasicMaterial({ color: 0x160b05 }),
      n,
    );
    const tass = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.012, 0.03, 0.32, 5),
      new THREE.MeshBasicMaterial({ color: 0xc8402a }),
      n,
    );
    const m4 = new THREE.Matrix4();
    const gp = [];
    const gc = [];
    const col = new THREE.Color();
    lanternSpots.forEach(([p, k], i) => {
      const s = k < 0.5 ? 0.9 : 0.85 + k * 0.15;
      m4.makeScale(s, s * 1.14, s).setPosition(p);
      body.setMatrixAt(i, m4);
      body.setColorAt(i, col.setScalar(k < 0.5 ? 0.25 : 1));
      m4.makeScale(s, s, s).setPosition(p);
      caps.setMatrixAt(i, m4);
      m4.setPosition(p.x, p.y - 0.5 * s, p.z);
      tass.setMatrixAt(i, m4);
      if (k >= 0.5) {
        gp.push(p.x, p.y, p.z);
        gc.push(1, 0.48, 0.19);
      }
    });
    scene.add(body, caps, tass);
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
    const glowMap = canvasTex(64, 64, (g, w) => {
      const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,255,255,.9)');
      gr.addColorStop(0.3, 'rgba(255,255,255,.3)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, w);
    });
    lanternGlow = new THREE.Points(
      gg,
      new THREE.PointsMaterial({
        map: glowMap,
        color: 0xff7a30,
        size: 2.4,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    scene.add(lanternGlow);
  }

  // ---------- embers drifting around the walker ----------
  const N = 320;
  const eg = new THREE.BufferGeometry();
  const ep = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    ep[i * 3] = rand(-16, 16);
    ep[i * 3 + 1] = rand(0, 8);
    ep[i * 3 + 2] = rand(-16, 16);
  }
  eg.setAttribute('position', new THREE.BufferAttribute(ep, 3));
  const embers = new THREE.Points(
    eg,
    new THREE.PointsMaterial({
      color: 0xffa24a,
      size: 0.07,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  embers.frustumCulled = false;
  scene.add(embers);

  // ---------- where you can walk ----------
  const rects = [
    [-11, 11, GATE_Z + 1.2, GATE_Z + 16], // 山門外
    [-3.9, 3.9, PLAZA_R - 1, GATE_Z + 2], // 穿過牌樓
  ];
  const circles = [
    [0, 0, POND_R + 0.7],
    [FURNACE[0], FURNACE[1], 2.5],
    [0, -18.5, 1.5],
    [-6, -21, 0.8],
    [6, -21, 0.8],
    ...shopCircles,
    ...stallCircles,
  ];
  const blocks = [[-14, 14, -60, HALL_Z + 4.6]]; // 大殿石台與台階
  function walkable(x, z) {
    const inPlaza = x * x + z * z < PLAZA_R * PLAZA_R;
    if (!inPlaza && !rects.some(([a, b, c, d]) => x >= a && x <= b && z >= c && z <= d)) return false;
    if (circles.some(([cx, cz, r]) => (x - cx) ** 2 + (z - cz) ** 2 < r * r)) return false;
    if (blocks.some(([a, b, c, d]) => x >= a && x <= b && z >= c && z <= d)) return false;
    return true;
  }

  // ---------- 天色：跟著時辰走 ----------
  // hour 是 0–24 的小數。白天主光跟太陽、夜裡跟月亮；晨昏各有一小時的霞。
  const hex3 = (hex) => new THREE.Color(hex);
  const SKY = {
    keyNight: hex3(0x9fb2ff),
    keyDay: hex3(0xfff0d8),
    keyDusk: hex3(0xffa864),
    hemiSkyNight: hex3(0x5a68a8),
    hemiSkyDay: hex3(0xc4dcff),
    hemiGroundNight: hex3(0x1c100a),
    hemiGroundDay: hex3(0x8f8272),
    fogNight: hex3(0x090a14),
    fogDay: hex3(0xbfd2e8),
    fogDusk: hex3(0x6a4250),
  };
  const smooth = (a, b, x) => {
    const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return k * k * (3 - 2 * k);
  };
  const state = { hour: 21, day: 0, dusk: 0, exposure: 1.05, bloom: 0.42 };
  function setHour(hour) {
    const h = ((hour % 24) + 24) % 24;
    const day = smooth(5.3, 7.3, h) * (1 - smooth(17.3, 19.3, h));
    const dusk = Math.exp(-(((h - 6.3) / 0.9) ** 2)) + Math.exp(-(((h - 18.3) / 0.9) ** 2));
    const night = 1 - day;
    Object.assign(state, { hour: h, day, dusk, exposure: 1.05 - day * 0.2, bloom: 0.42 - day * 0.26 });
    // 太陽 6 時東升、18 時西落；月亮反過來。兩者都略偏北，影子才不會正對著人。
    const a = ((h - 6) / 12) * Math.PI;
    sunDir.set(Math.cos(a) * 0.85, Math.sin(a), -0.38).normalize();
    moonDir.set(-Math.cos(a) * 0.5 - 0.16, Math.max(0.28, -Math.sin(a) * 0.75 + 0.1), -1).normalize();
    // 主光：誰在天上跟誰；貼近地平線時抬高一點，影子不至於拉得沒完
    keyDir.copy(day > 0.5 ? sunDir : moonDir);
    keyDir.y = Math.max(keyDir.y, 0.22);
    keyDir.normalize();
    const u = sky.material.uniforms;
    u.uDay.value = day;
    u.uDusk.value = Math.min(1, dusk);
    moon.color
      .copy(SKY.keyNight)
      .lerp(SKY.keyDay, day)
      .lerp(SKY.keyDusk, Math.min(1, dusk) * 0.6);
    moon.intensity = 1.25 + day * 2.1 - Math.min(1, dusk) * 0.6 * day;
    hemi.color.copy(SKY.hemiSkyNight).lerp(SKY.hemiSkyDay, day);
    hemi.groundColor.copy(SKY.hemiGroundNight).lerp(SKY.hemiGroundDay, day);
    hemi.intensity = 0.55 + day * 1.15;
    scene.fog.color
      .copy(SKY.fogNight)
      .lerp(SKY.fogDay, day)
      .lerp(SKY.fogDusk, Math.min(1, dusk) * 0.45);
    scene.fog.density = 0.02 - day * 0.011;
    scene.environmentIntensity = 0.55 + day * 0.35;
    // 燈火：夜裡全亮，白天只留一點
    const lamp = 0.12 + night * 0.88;
    for (const l of warmLights) l.intensity = l.userData.base * lamp;
    if (beam) beam.intensity = 1400 * night;
    if (lanternGlow) lanternGlow.material.opacity = 0.4 * (0.1 + night * 0.9);
    embers.material.opacity = 0.85 * night;
    state.lamp = lamp;
  }

  for (const r of ROOMS) labels.push({ ...r, pos: r.label, room: r });

  return {
    scene,
    camera,
    walkable,
    labels,
    rooms: ROOMS,
    doors: ROOMS.filter((r) => r.open).map((r) => {
      r.doorMesh.userData.room = r.id;
      return r.doorMesh;
    }),
    /** 進門後的落腳點、池子半徑：走位與路人用。 */
    spawn: [0, PLAZA_R - 3.5],
    start: [0, GATE_Z + 13],
    pondR: POND_R + 0.7,
    plazaR: PLAZA_R,
    area(x, z) {
      if (z > GATE_Z) return '山門外';
      if (Math.hypot(x, z) < POND_R + 5) return '許願池';
      return z < -14 ? '殿前' : '廣場';
    },
    /** Render the mirrored view the wet ground samples. Call once per frame before the main render. */
    reflect(cam) {
      if (!reflRT) return;
      renderer.getDrawingBufferSize(reflRes.value);
      reflCam.copy(cam, false);
      reflCam.position.y = -cam.position.y;
      reflCam.rotation.set(-cam.rotation.x, cam.rotation.y, 0);
      reflCam.updateMatrixWorld();
      const prev = renderer.getRenderTarget();
      const auto = renderer.shadowMap.autoUpdate;
      renderer.shadowMap.autoUpdate = false;
      ground.visible = false;
      renderer.setRenderTarget(reflRT);
      renderer.render(scene, reflCam);
      renderer.setRenderTarget(prev);
      ground.visible = true;
      renderer.shadowMap.autoUpdate = auto;
    },
    /** 點得到的願望牌（InstancedMesh；命中後用 wishAt(instanceId) 取願望 id）。 */
    wishPick: plates,
    wishAt: (i) => plateSlots[i]?.id ?? null,
    /**
     * 掛上願望牌。list 是 [{ id, mine }]，最新的在前；位置由 id 決定，同一則每次都掛在同一處。
     * fresh 是剛許下的那一則：從池面升上去。
     */
    setWishes(list, fresh) {
      const keep = new Map(plateSlots.map((p) => [p.id, p]));
      plateSlots.length = 0;
      for (const w of list.slice(0, PLATES)) {
        const old = keep.get(w.id);
        let h = 2166136261;
        for (let i = 0; i < w.id.length; i++) h = Math.imul(h ^ w.id.charCodeAt(i), 16777619);
        const u = (k) => ((h >>> (k * 5)) & 1023) / 1023;
        const a = u(0) * Math.PI * 2;
        const r = 1.8 + u(1) * 2.9;
        plateSlots.push({
          id: w.id,
          mine: !!w.mine,
          pos: new THREE.Vector3(Math.cos(a) * r, 3.7 + u(2) * 0.9 - r * 0.06, Math.sin(a) * r),
          yaw: -a + Math.PI / 2,
          ph: u(3) * 6.28,
          born: old ? old.born : w.id === fresh ? -1 : 0,
        });
      }
      const gold = new THREE.Color(0xe0b25a);
      const red = new THREE.Color(0xa8241a);
      for (let i = 0; i < plateSlots.length; i++) plates.setColorAt(i, plateSlots[i].mine ? gold : red);
      plates.count = plateStrings.count = plateSlots.length;
      if (plates.instanceColor) plates.instanceColor.needsUpdate = true;
    },
    /** 天色狀態（唯讀）：hour、day（0 夜–1 晝）、dusk、exposure、bloom。 */
    sky: state,
    setHour,
    update(dt, t, pos) {
      sky.material.uniforms.uT.value = t;
      sky.position.copy(pos);
      if (!lowQuality) {
        // keep the shadow frustum centred on the walker, snapped so shadows don't crawl
        const sx = Math.round(pos.x / 4) * 4;
        const sz = Math.round(pos.z / 4) * 4;
        moon.target.position.set(sx, 0, sz);
        moon.position.set(sx, 0, sz).addScaledVector(keyDir, 90);
      }
      for (const l of flick)
        l.intensity =
          l.userData.base * (state.lamp ?? 1) * (0.8 + Math.sin(t * 9) * 0.1 + Math.random() * 0.15);
      talis.rotation.y = t * 0.04;
      if (plateSlots.length) {
        for (let i = 0; i < plateSlots.length; i++) {
          const p = plateSlots[i];
          if (p.born < 0) p.born = t; // 剛許下：從這一刻開始升起
          const rise = p.born > 0 ? Math.min(1, (t - p.born) / 2.4) : 1;
          const k = 1 - (1 - rise) ** 3;
          _pv.copy(p.pos);
          _pv.y = -1.2 + (p.pos.y + 1.2) * k;
          _pe.set(0, p.yaw, Math.sin(t * 0.9 + p.ph) * 0.12 * (1 + (1 - k) * 2));
          _pm.compose(_pv, _pq.setFromEuler(_pe), _ps.setScalar(0.4 + 0.6 * k));
          plates.setMatrixAt(i, _pm);
          plateStrings.setMatrixAt(i, _pm);
        }
        plates.instanceMatrix.needsUpdate = true;
        plateStrings.instanceMatrix.needsUpdate = true;
      }
      for (const c of talis.children) c.position.y = c.userData.y + Math.sin(t * 0.7 + c.userData.ph) * 0.25;
      embers.position.set(pos.x, 0, pos.z);
      const p = eg.attributes.position.array;
      for (let i = 0; i < N; i++) {
        p[i * 3 + 1] += dt * (0.25 + (i % 5) * 0.07);
        p[i * 3] += Math.sin(t + i) * dt * 0.15;
        if (p[i * 3 + 1] > 8) p[i * 3 + 1] = 0;
      }
      eg.attributes.position.needsUpdate = true;
    },
  };
}
