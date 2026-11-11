import * as THREE from 'three';
import { createMaterials, roofGeometry } from './mats.js';
import { canvasTex, rand, textPlane } from './util.js';

// 月下集市的整片街區：山門外 → 牌樓 → 長街（兩側各五間鋪面）→ 廟前廣場（許願樹、
// 抄經閣、化寶爐）→ 大殿。可以自由走動；可進的房間門口有提示。
const STREET_X = 5.6; // building fronts on the main street
const LOT_Z = [10, 0.5, -9, -18.5, -28];

export const ROOMS = [
  { id: 'yuelao', name: '月老殿', sub: '求籤問緣', open: true, tint: 0xffb060, cloth: '#7b161b' },
  { id: 'tarot', name: '塔羅館', sub: '三張牌陣', open: true, tint: 0xa98bff, cloth: '#2a1b55' },
  { id: 'bazi', name: '算命攤', sub: '八字命盤', open: false },
  { id: 'sutra', name: '抄經閣', sub: '描紅抄經', open: false },
  { id: 'burn', name: '化寶爐', sub: '燒疏文', open: false },
  { id: 'hall', name: '大殿', sub: '點香拜拜', open: false },
];

const FACE = { S: 0, E: Math.PI / 2, N: Math.PI, W: -Math.PI / 2 };
const DIR = { S: [0, 1], E: [1, 0], N: [0, -1], W: [-1, 0] };

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
  scene.fog = new THREE.FogExp2(0x0b0c18, 0.017);
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
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(400, 32, 20),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { uMoon: { value: moonDir }, uT: { value: 0 } },
      vertexShader:
        'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }',
      fragmentShader: `
        varying vec3 vD; uniform vec3 uMoon; uniform float uT;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.03; a*=0.5; } return s; }
        void main(){
          vec3 d = normalize(vD);
          float up = clamp(d.y, 0.0, 1.0);
          vec3 col = mix(vec3(0.085,0.075,0.16), vec3(0.012,0.016,0.045), pow(up, 0.55));
          col += vec3(0.32,0.14,0.05) * pow(1.0 - up, 7.0) * 0.55;            // lantern glow on the horizon
          float md = dot(d, uMoon);
          col += vec3(0.75,0.8,1.0) * pow(max(md,0.0), 22.0) * 0.26;            // moon halo
          col += vec3(1.0,0.96,0.86) * smoothstep(0.9982, 0.9989, md) * 1.0;    // moon disc
          vec2 sp = d.xz / (d.y + 0.25) * 90.0;
          float st = step(0.9965, h(floor(sp))) * (0.5 + 0.5 * sin(uT * 2.0 + h(floor(sp) + 3.1) * 40.0));
          col += vec3(0.8,0.85,1.0) * st * up * 0.9;
          float cl = fbm(d.xz / (d.y + 0.35) * 2.2 + vec2(uT * 0.01, 0.0));
          col = mix(col, vec3(0.16,0.16,0.26) + vec3(0.25,0.27,0.36) * pow(max(md,0.0), 6.0), smoothstep(0.52, 0.95, cl) * 0.55 * smoothstep(0.02, 0.3, up));
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
  scene.add(new THREE.HemisphereLight(0x5a68a8, 0x1c100a, 0.55));
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
  const warm = (x, y, z, i = 34, d = 20, c = 0xff9040) => {
    const l = new THREE.PointLight(c, i, d, 1.6);
    l.position.set(x, y, z);
    scene.add(l);
    return l;
  };

  // ---------- ground ----------
  const ground = shadow(new THREE.Mesh(new THREE.PlaneGeometry(190, 190), mat.ground), false);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -20);
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
  stall(-7.5, 24, 0.5, '#8a1c14', '#e6dcc4');
  stall(7.5, 23, -0.6, '#24484a', '#e6dcc4');
  stall(-11.5, -37, 0.9, '#c9a25a', '#5a1612');
  stall(11.5, -37.5, -0.9, '#8a1c14', '#e6dcc4');
  stall(-11.5, -58.5, 2.2, '#24484a', '#e6dcc4');

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
    g.rotation.y = FACE[face];
    scene.add(g);

    const [fx, fz] = DIR[face];
    const toWorld = (lx, ly, lz) =>
      new THREE.Vector3(lx, ly, lz)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), FACE[face])
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

  // ---------- main street ----------
  const room = Object.fromEntries(ROOMS.map((r) => [r.id, r]));
  const left = [
    { sign: '茶館', banner: '清茶細點', floors: 2 },
    { sign: '月老殿', banner: '求籤問緣', room: 'yuelao', h: 4.1 },
    { sign: '香燭', banner: '香花金紙' },
    { sign: '糕餅', banner: '現蒸桂花糕', floors: 2 },
    { sign: '布莊', banner: '綾羅綢緞' },
  ];
  const right = [
    { sign: '酒肆', banner: '陳年花雕' },
    { sign: '燈籠', banner: '手紮花燈', floors: 2 },
    { sign: '塔羅館', banner: '三張牌陣', room: 'tarot', h: 4.1 },
    { sign: '藥鋪', banner: '安神定心', floors: 2 },
    { sign: '算命攤', banner: '籌備中', room: 'bazi', lit: false },
  ];
  const place = (list, side) =>
    list.forEach((s, i) => {
      const r = s.room ? room[s.room] : null;
      const res = house({
        ...s,
        x: side * STREET_X,
        z: LOT_Z[i],
        face: side < 0 ? 'E' : 'W',
        open: !!r?.open,
        tint: r?.tint,
        cloth: r?.open ? r.cloth : side < 0 ? '#5a1612' : '#3a2a16',
      });
      if (r) Object.assign(r, res);
    });
  place(left, -1);
  place(right, 1);
  for (const z of [10, -9, -28]) warm(0, 4.8, z, 34, 22);

  // lantern strings over the street
  const wireMat = new THREE.LineBasicMaterial({ color: 0x15100c });
  for (let z = 14; z > -33; z -= 4.75) {
    const pts = [];
    for (let i = 0; i <= 18; i++) {
      const u = i / 18;
      pts.push(new THREE.Vector3(-5 + u * 10, 6 - Math.sin(u * Math.PI) * 0.9, z));
    }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
    for (let i = 1; i <= 5; i++) {
      const u = i / 6;
      lanternSpots.push([new THREE.Vector3(-5 + u * 10, 5.55 - Math.sin(u * Math.PI) * 0.9, z), 1]);
    }
  }

  // ---------- gate (牌樓) and forecourt walls ----------
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
    g.position.z = 17;
    scene.add(g);
    for (const x of [-3, -1, 1, 3]) lanternSpots.push([new THREE.Vector3(x, 3.75, 17.15), 1.1]);
    warm(0, 3.4, 20, 30, 18);
  }

  // ---------- plaza ----------
  const PZ = -48;
  // wishing tree
  {
    const g = new THREE.Group();
    g.add(shadow(new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.5, 0.5, 40), mat.stone)).translateY(0.25));
    const bark = new THREE.MeshStandardMaterial({ color: 0x241710, roughness: 1 });
    g.add(shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.95, 5, 12), bark)).translateY(3));
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
      if (i % 12 === 0) g.add(br);
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
    g.add(canopy, ribbons);
    g.position.set(0, 0, PZ);
    scene.add(g);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * 6.28;
      lanternSpots.push([
        new THREE.Vector3(Math.cos(a) * rand(2, 4.4), rand(3.6, 4.6), PZ + Math.sin(a) * rand(2, 4.4)),
        0.7,
      ]);
    }
    warm(0, 3.2, PZ + 3.6, 40, 20);
    warm(0, 3.2, PZ - 3.6, 28, 18);
    labels.push({
      name: '許願樹',
      sub: '繫一條紅線',
      pos: new THREE.Vector3(0, 2.6, PZ + 3.6),
      open: false,
      plain: true,
    });
  }
  // 抄經閣 (left of the plaza), 大殿 (far end), 化寶爐 (right)
  Object.assign(
    room.sutra,
    house({
      x: -16,
      z: PZ,
      w: 13,
      d: 8,
      h: 3.8,
      face: 'E',
      floors: 2,
      sign: '抄經閣',
      banner: '籌備中',
      lit: false,
      cloth: '#1b1512',
    }),
  );
  {
    const py = 1.1;
    scene.add(
      shadow(box(27, py, 17, mat.stone))
        .translateY(py / 2)
        .translateZ(-70.5),
    );
    for (let i = 0; i < 4; i++)
      scene.add(
        shadow(box(9, py - i * 0.27, 0.45, mat.stone))
          .translateY((py - i * 0.27) / 2)
          .translateZ(-61.8 + i * 0.45),
      );
    Object.assign(
      room.hall,
      house({
        x: 0,
        z: -64.5,
        y: py,
        w: 22,
        d: 11,
        h: 5.4,
        face: 'S',
        sign: '大殿',
        banner: '籌備中',
        grand: true,
        lit: true,
        cloth: '#5a1612',
      }),
    );
    warm(0, 5, -59, 46, 26, 0xffa050);
    // bronze censer in front of the steps
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
    c.position.set(0, 0, -57);
    scene.add(c);
  }
  {
    // furnace: brick tower with a glowing mouth
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
    g.position.set(12, 0, PZ);
    g.rotation.y = Math.PI / 6;
    scene.add(g);
    flick.push(warm(10.2, 1.8, PZ, 30, 12, 0xff6a20));
    Object.assign(room.burn, {
      door: new THREE.Vector3(10.6, 1.6, PZ),
      stand: new THREE.Vector3(8, 1.65, PZ),
      label: new THREE.Vector3(12, 6.6, PZ),
    });
  }
  // plaza walls and lantern strings around it
  for (const sx of [-1, 1]) {
    for (const z of [-37.5, -58.5]) {
      scene.add(
        shadow(box(0.6, 3.4, 8, mat.plaster))
          .translateX(sx * 16.5)
          .translateY(1.7)
          .translateZ(z),
      );
    }
    if (sx > 0)
      scene.add(
        shadow(box(0.6, 3.4, 30, mat.plaster))
          .translateX(17.2)
          .translateY(1.7)
          .translateZ(PZ),
      );
    scene.add(
      shadow(box(6.5, 3.4, 0.6, mat.plaster))
        .translateX(sx * 13)
        .translateY(1.7)
        .translateZ(-33.6),
    );
    for (let z = -36; z >= -60; z -= 4) lanternSpots.push([new THREE.Vector3(sx * 14.6, 4.3, z), 0.9]);
    // stone lanterns
    for (const z of [-38, -58]) {
      const g = new THREE.Group();
      g.add(
        shadow(box(0.5, 1.5, 0.5, mat.stone)).translateY(0.75),
        box(0.9, 0.5, 0.9, new THREE.MeshBasicMaterial({ color: 0xffc070 })).translateY(1.75),
        shadow(new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.5, 4), mat.stone))
          .translateY(2.25)
          .rotateY(Math.PI / 4),
      );
      g.position.set(sx * 8, 0, z);
      scene.add(g);
    }
  }
  warm(-10, 3.6, PZ, 26, 18);

  // ---------- lanterns (instanced) ----------
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
    scene.add(
      new THREE.Points(
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
      ),
    );
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
    [-11, 11, 18.2, 34], // forecourt
    [-3.9, 3.9, 15.5, 19], // through the gate
    [-4.4, 4.4, -34.5, 16], // main street
    [-15.2, 15.2, -60.4, -34], // plaza
  ];
  const circles = [
    [0, PZ, 4.1],
    [12, PZ, 2.5],
    [0, -57, 1.5],
    [-8, -38, 0.8],
    [8, -38, 0.8],
    [-8, -58, 0.8],
    [8, -58, 0.8],
  ];
  circles.push(...stallCircles);
  const blocks = [[-15.2, -11, -53, -43]]; // 抄經閣 porch
  function walkable(x, z) {
    if (!rects.some(([a, b, c, d]) => x >= a && x <= b && z >= c && z <= d)) return false;
    if (circles.some(([cx, cz, r]) => (x - cx) ** 2 + (z - cz) ** 2 < r * r)) return false;
    if (blocks.some(([a, b, c, d]) => x >= a && x <= b && z >= c && z <= d)) return false;
    return true;
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
    area(z) {
      return z > 17 ? '山門外' : z > -34 ? '長街' : '廟前廣場';
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
    update(dt, t, pos) {
      sky.material.uniforms.uT.value = t;
      sky.position.copy(pos);
      if (!lowQuality) {
        // keep the shadow frustum centred on the walker, snapped so shadows don't crawl
        const sx = Math.round(pos.x / 4) * 4;
        const sz = Math.round(pos.z / 4) * 4;
        moon.target.position.set(sx, 0, sz);
        moon.position.set(sx, 0, sz).addScaledVector(moonDir, 90);
      }
      for (const l of flick) l.intensity = 30 * (0.8 + Math.sin(t * 9) * 0.1 + Math.random() * 0.15);
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
