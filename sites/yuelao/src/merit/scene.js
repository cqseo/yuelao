// 功德台的 3D 供桌（2026-11-21 重做）：殿內一角、供桌、紅布、燭火、香爐冒煙，
// 桌上紅墊子放一個木魚；換到念珠模式時，木魚退下、一串念珠浮在供桌前。
// 只負責畫面與「敲到了」的手感（木槌、震動、光、金粉）；計數、聲音、文字都在頁面。
import * as THREE from 'three';
import { canvasTex, glow, lantern } from '../market/engine/util.js';

const rnd = (a, b) => a + Math.random() * (b - a);

/** 從灰階高度圖算法線圖：木紋、魚鱗雕刻、絨布都靠它吃光。 */
function normalMap(size, draw, strength = 2.2, repeat = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, size, size);
  draw(g, size);
  const src = g.getImageData(0, 0, size, size).data;
  const out = document.createElement('canvas');
  out.width = out.height = size;
  const og = out.getContext('2d');
  const img = og.createImageData(size, size);
  const h = (x, y) => src[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * strength;
      const dy = (h(x, y + 1) - h(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      img.data[i] = (-dx / l) * 127 + 128;
      img.data[i + 1] = (dy / l) * 127 + 128;
      img.data[i + 2] = (1 / l) * 127 + 128;
      img.data[i + 3] = 255;
    }
  og.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(out);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  return t;
}

/** 上了漆的老木頭：暖色、細紋、幾處深色年輪。 */
function lacqueredWood(base, light, rings = 70) {
  return canvasTex(512, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, light);
    gr.addColorStop(0.5, base);
    gr.addColorStop(1, light);
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < rings; i++) {
      g.strokeStyle = `rgba(${Math.random() < 0.6 ? '40,14,4' : '255,200,140'},${rnd(0.04, 0.14)})`;
      g.lineWidth = rnd(0.6, 2.4);
      const y = Math.random() * h;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x / rnd(30, 80) + i) * rnd(2, 7));
      g.stroke();
    }
  });
}

export function createMeritScene(canvas, opts = {}) {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.75 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e0705);
  scene.fog = new THREE.Fog(0x0e0705, 6, 14);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
  const camBase = new THREE.Vector3(0, 1.55, 4.3);
  const look = new THREE.Vector3(0, 0.72, 0);

  // ---------- 光 ----------
  scene.add(new THREE.HemisphereLight(0xffd9a8, 0x1a0805, 0.35));
  const key = new THREE.SpotLight(0xffc98a, 38, 12, 0.6, 0.55, 1.6);
  key.position.set(1.6, 3.6, 2.6);
  key.target.position.set(0, 0.6, 0.1);
  key.castShadow = true;
  key.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
  key.shadow.bias = -0.0004;
  key.shadow.radius = 4;
  scene.add(key, key.target);
  const rim = new THREE.PointLight(0xff6a2a, 6, 6, 1.6);
  rim.position.set(-2, 1.8, -1.2);
  scene.add(rim);
  const flash = new THREE.PointLight(0xffd27a, 0, 3, 2);
  flash.position.set(0, 1.3, 0.9);
  scene.add(flash);

  // ---------- 殿內：後牆木板、兩根紅柱、燈籠 ----------
  const wallTex = canvasTex(
    512,
    512,
    (g, w, h) => {
      g.fillStyle = '#2a120a';
      g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 64) {
        g.fillStyle = `rgba(${rnd(30, 60)},${rnd(10, 20)},6,0.6)`;
        g.fillRect(x + 2, 0, 60, h);
        g.fillStyle = 'rgba(0,0,0,.55)';
        g.fillRect(x, 0, 2, h);
      }
      // 窗櫺的格子，隱約
      g.strokeStyle = 'rgba(200,120,60,.12)';
      g.lineWidth = 3;
      for (let y = 40; y < h; y += 56) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y);
        g.stroke();
      }
    },
    [3, 1.4],
  );
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 6),
    new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.85 }),
  );
  wall.position.set(0, 2, -2.6);
  wall.receiveShadow = true;
  scene.add(wall);
  const redLacquer = new THREE.MeshPhysicalMaterial({
    color: 0x8c1a10,
    roughness: 0.32,
    clearcoat: 0.8,
    clearcoatRoughness: 0.25,
  });
  for (const x of [-2.4, 2.4]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 6, 32), redLacquer);
    pillar.position.set(x, 2, -1.7);
    scene.add(pillar);
  }
  const lanterns = [];
  for (const [x, y, z] of [
    [-1.55, 2.05, -1.6],
    [1.55, 2.05, -1.6],
  ]) {
    const l = lantern(1.05);
    l.position.set(x, y, z);
    scene.add(l);
    lanterns.push(l);
    const pl = new THREE.PointLight(0xff7a30, 2.2, 4, 2);
    pl.position.set(x, y - 0.1, z + 0.2);
    scene.add(pl);
  }

  // ---------- 供桌與桌前紅布 ----------
  const tableWood = lacqueredWood('#3a1a0c', '#5a2a12');
  const tableMat = new THREE.MeshPhysicalMaterial({
    map: tableWood,
    roughness: 0.38,
    clearcoat: 0.5,
    clearcoatRoughness: 0.35,
  });
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.1, 1.7), tableMat);
  top.position.set(0, 0.4, 0);
  top.receiveShadow = true;
  scene.add(top);
  const clothTex = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#7d1610';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,120,90'},${rnd(0.02, 0.07)})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 1);
    }
    g.strokeStyle = '#d8a94a';
    g.lineWidth = 6;
    g.strokeRect(18, 14, w - 36, h - 40);
    g.lineWidth = 2;
    g.strokeRect(30, 26, w - 60, h - 64);
    g.fillStyle = '#e7bf63';
    g.font = '700 96px "Noto Serif TC", serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    // 流蘇
    for (let x = 22; x < w - 18; x += 14) {
      g.fillStyle = '#d8a94a';
      g.fillRect(x, h - 24, 3, 22);
    }
  });
  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 0.95),
    new THREE.MeshStandardMaterial({ map: clothTex, roughness: 0.9 }),
  );
  cloth.position.set(0, -0.08, 0.86);
  scene.add(cloth);
  const apron = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.9, 0.06), tableMat);
  apron.position.set(0, -0.06, 0.82);
  scene.add(apron);

  // ---------- 燭台：燭火會晃 ----------
  const candles = [];
  for (const x of [-1.25, 1.25]) {
    const grp = new THREE.Group();
    const holder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.14, 0.08, 24),
      new THREE.MeshStandardMaterial({ color: 0xb08440, metalness: 0.8, roughness: 0.35 }),
    );
    holder.position.y = 0.04;
    const wax = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.06, 0.5, 20),
      new THREE.MeshStandardMaterial({ color: 0xb3150c, roughness: 0.6, emissive: 0x2a0402 }),
    );
    wax.position.y = 0.33;
    wax.castShadow = true;
    const fl = glow(0xffb040, 0.32, 1);
    fl.position.y = 0.66;
    const fl2 = glow(0xff6a10, 0.9, 0.35);
    fl2.position.y = 0.66;
    const light = new THREE.PointLight(0xffa040, 3.2, 3.2, 2);
    light.position.y = 0.72;
    grp.add(holder, wax, fl, fl2, light);
    grp.position.set(x, 0.45, -0.35);
    scene.add(grp);
    candles.push({ fl, fl2, light, ph: Math.random() * 9 });
  }

  // ---------- 香爐與煙 ----------
  const bronze = new THREE.MeshStandardMaterial({ color: 0x6e5126, metalness: 0.85, roughness: 0.4 });
  const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.22, 32), bronze);
  burner.position.set(-0.62, 0.56, -0.55);
  burner.castShadow = true;
  scene.add(burner);
  const sticks = [];
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.42, 6),
      new THREE.MeshStandardMaterial({ color: 0xa0522d }),
    );
    s.position.set(-0.62 + (i - 1) * 0.04, 0.84, -0.55);
    s.rotation.z = (i - 1) * 0.06;
    scene.add(s);
    const ember = glow(0xff4010, 0.05, 1);
    ember.position.set(-0.62 + (i - 1) * 0.053, 1.05, -0.55);
    scene.add(ember);
    sticks.push(ember);
  }
  const smokeMap = canvasTex(64, 64, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, w);
  });
  const smoke = [];
  for (let i = 0; i < 26; i++) {
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: smokeMap,
        color: 0xd9c8b0,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      }),
    );
    sp.userData.t = Math.random() * 6;
    scene.add(sp);
    smoke.push(sp);
  }

  // ---------- 紅墊與木魚 ----------
  const velvet = normalMap(
    256,
    (g, s) => {
      for (let i = 0; i < 9000; i++) {
        const v = rnd(90, 170);
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(Math.random() * s, Math.random() * s, 1, 2);
      }
    },
    1.2,
    [4, 4],
  );
  const cushionMat = new THREE.MeshPhysicalMaterial({
    color: 0x9a1a12,
    roughness: 0.85,
    sheen: 1,
    sheenColor: new THREE.Color(0xff6a50),
    sheenRoughness: 0.5,
    normalMap: velvet,
  });
  const cushionProfile = [];
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI;
    cushionProfile.push(new THREE.Vector2(0.62 + Math.sin(a) * 0.08, -Math.cos(a) * 0.08));
  }
  cushionProfile.unshift(new THREE.Vector2(0, -0.08));
  cushionProfile.push(new THREE.Vector2(0, 0.08));
  const cushion = new THREE.Mesh(new THREE.LatheGeometry(cushionProfile, 64), cushionMat);
  cushion.scale.set(1, 1, 0.82);
  cushion.position.set(0, 0.53, 0.2);
  cushion.castShadow = true;
  cushion.receiveShadow = true;
  scene.add(cushion);
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8a94a, metalness: 0.9, roughness: 0.3 });
  const trim = new THREE.Mesh(new THREE.TorusGeometry(0.69, 0.018, 10, 80), gold);
  trim.rotation.x = Math.PI / 2;
  trim.scale.set(1, 0.82, 1);
  trim.position.set(0, 0.53, 0.2);
  scene.add(trim);

  // 木魚：壓扁的球、前方一道深口、頂上雙魚頭握把、身上魚鱗雕紋
  const fishWood = lacqueredWood('#7a3412', '#b8692a', 50);
  fishWood.wrapS = fishWood.wrapT = THREE.RepeatWrapping;
  fishWood.repeat.set(2, 1);
  const scales = normalMap(
    512,
    (g, s) => {
      // 魚鱗：一排排半圓
      const r = 26;
      for (let row = 0; row * r * 0.9 < s + r; row++)
        for (let col = -1; col * r * 2 < s + r * 2; col++) {
          const x = col * r * 2 + (row % 2 ? r : 0);
          const y = row * r * 0.9;
          const gr = g.createRadialGradient(x, y, r * 0.2, x, y, r);
          gr.addColorStop(0, '#9a9a9a');
          gr.addColorStop(0.85, '#8a8a8a');
          gr.addColorStop(1, '#3a3a3a');
          g.fillStyle = gr;
          g.beginPath();
          g.arc(x, y, r, 0, Math.PI);
          g.fill();
        }
    },
    3,
    [3, 2],
  );
  const fishMat = new THREE.MeshPhysicalMaterial({
    map: fishWood,
    normalMap: scales,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.42,
    clearcoat: 0.7,
    clearcoatRoughness: 0.3,
  });
  const fish = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 96, 64), fishMat);
  body.scale.set(1.12, 0.86, 1);
  body.castShadow = true;
  fish.add(body);
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x1a0904, roughness: 0.9 });
  // 魚口：沿著木魚表面、只在正面的一道上揚深槽（兩頭往上翹），上下各一道木唇
  const EA = 0.56;
  const EB = 0.43;
  const EC = 0.5;
  const onShell = (phi, y, inset) => {
    const r = Math.sqrt(Math.max(0, 1 - (y / EB) ** 2));
    return new THREE.Vector3(EA * r * Math.sin(phi) * inset, y, EC * r * Math.cos(phi) * inset);
  };
  const smile = (dy, inset) => {
    const pts = [];
    for (let k = 0; k <= 24; k++) {
      const phi = -0.95 + (k / 24) * 1.9;
      pts.push(onShell(phi, -0.17 + 0.2 * (phi / 0.95) ** 2 + dy, inset));
    }
    return new THREE.CatmullRomCurve3(pts);
  };
  const mouth = new THREE.Mesh(new THREE.TubeGeometry(smile(0, 0.99), 80, 0.036, 16, false), darkWood);
  const lipUp = new THREE.Mesh(new THREE.TubeGeometry(smile(0.04, 1.0), 80, 0.014, 10, false), fishMat);
  const lipDown = new THREE.Mesh(new THREE.TubeGeometry(smile(-0.04, 1.0), 80, 0.014, 10, false), fishMat);
  // 兩頭收成圓點，不是剪斷的管子
  const ends = [-0.95, 0.95].map((phi) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.036, 16, 12), darkWood);
    m.position.copy(onShell(phi, -0.17 + 0.2, 0.99));
    return m;
  });
  // 魚眼：嘴角上方一對淺淺的雕刻圓圈，一看就知道是「魚」
  const eyes = [-0.62, 0.62].map((phi) => {
    const e = new THREE.Group();
    const ringE = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 10, 32), darkWood);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), fishMat);
    e.add(ringE, ball);
    const at = onShell(phi, 0.13, 0.995);
    e.position.copy(at);
    e.lookAt(at.clone().multiplyScalar(2));
    return e;
  });
  fish.add(mouth, lipUp, lipDown, ...ends, ...eyes);
  fish.position.set(0, 0.97, 0.2);
  scene.add(fish);

  // 木槌：軸心在握柄尾端，平時抬起，敲的時候落下
  // 第一人稱的手（2026-11-21 站長：點螢幕就像自己的手握著槌子敲下去）：
  // 平時手藏在畫面下方；一點，右手握著木槌從右下方伸進來、往木魚正面敲一下，
  // 碰到的那一刻才出聲、噴金粉；連續點就一直舉在畫面裡，停手一會兒才收回去。
  const STRIKE = new THREE.Vector3(0.04, 1.18, 0.68);
  const GRIP = new THREE.Vector3(0.3, 0.72, 2.0);
  const malletPivot = new THREE.Group();
  malletPivot.position.copy(GRIP);
  malletPivot.lookAt(STRIKE);
  const swing = new THREE.Group();
  malletPivot.add(swing);
  const reach = GRIP.distanceTo(STRIKE);
  const malletWood = new THREE.MeshPhysicalMaterial({
    map: lacqueredWood('#c89a5a', '#e2bd84', 30),
    roughness: 0.45,
    clearcoat: 0.4,
  });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.03, reach + 0.1, 16), malletWood);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = (reach + 0.1) / 2 - 0.12;
  shaft.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 32, 24), malletWood);
  head.scale.set(1.35, 1, 1);
  head.position.z = reach - 0.04;
  head.castShadow = true;
  swing.add(shaft, head);
  // 手：膚色、有一點皮膚的柔光；握拳包住槌柄，手背朝上、指節朝前
  const skin = new THREE.MeshPhysicalMaterial({
    color: 0xe2a882,
    roughness: 0.55,
    sheen: 0.6,
    sheenColor: new THREE.Color(0xffc8a8),
    sheenRoughness: 0.6,
    clearcoat: 0.08,
  });
  const hand = new THREE.Group();
  const back = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.1, 8, 20), skin);
  back.rotation.z = Math.PI / 2;
  back.scale.set(1, 1, 0.82);
  back.position.set(0, 0.045, -0.02);
  hand.add(back);
  // 四根手指：一排指節，彎過槌柄前方
  for (let k = 0; k < 4; k++) {
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.034, 0.05, 6, 14), skin);
    f.position.set(-0.075 + k * 0.05, -0.012 + Math.abs(k - 1.5) * 0.006, 0.055);
    f.rotation.x = 0.35;
    hand.add(f);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), skin);
    tip.position.set(-0.075 + k * 0.05, -0.05, 0.02);
    hand.add(tip);
  }
  // 大拇指：從左邊壓在槌柄上
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.08, 6, 14), skin);
  thumb.rotation.set(Math.PI / 2 - 0.25, 0, 0.5);
  thumb.position.set(-0.09, 0.03, 0.05);
  hand.add(thumb);
  // 手腕與袖子：往鏡頭這邊伸出畫面
  const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.068, 0.22, 20), skin);
  wrist.rotation.x = Math.PI / 2;
  wrist.position.set(0.01, 0.02, -0.17);
  hand.add(wrist);
  const robe = new THREE.MeshStandardMaterial({ color: 0x5a1410, roughness: 0.9, normalMap: velvet });
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 1.1, 24, 1, true), robe);
  sleeve.rotation.x = Math.PI / 2;
  sleeve.position.set(0.02, 0.02, -0.82);
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.016, 10, 40), gold);
  cuff.position.set(0.02, 0.02, -0.28);
  hand.add(sleeve, cuff);
  for (const m of [back, thumb, wrist, sleeve]) m.castShadow = true;
  // 第一人稱：手離鏡頭近，看起來大一點
  hand.scale.setScalar(1.55);
  swing.add(hand);
  scene.add(malletPivot);
  // 姿勢：0＝收在畫面下方、1＝舉起、2＝敲到木魚
  const RAISE = -0.3;
  let pose = 0;
  const applyPose = (p) => {
    const hide = Math.max(0, 1 - p);
    const k = Math.max(0, p - 1);
    swing.rotation.x = RAISE * (1 - k) + 0.5 * hide;
    swing.position.set(0.6 * hide, -2.2 * hide, -0.4 * hide);
  };
  applyPose(0);

  // 真實的手（照片去背，public/merit/hand.webp，604×484）：疊在畫面最前面，
  // 槌頭對準木魚上的 STRIKE 投影點；手肘當軸心上下揮。3D 的手與木槌就不畫了。
  const handEl = opts.handEl || null;
  const HAND = { w: 604, head: [76, 82], pivot: [560, 330], base: 22 };
  const proj = new THREE.Vector3();
  function placeHand(p) {
    const cw = canvas.clientWidth || innerWidth;
    const ch = canvas.clientHeight || innerHeight;
    proj.copy(STRIKE).project(camera);
    const sx = ((proj.x + 1) / 2) * cw;
    const sy = ((1 - proj.y) / 2) * ch;
    const W = Math.max(340, Math.min(640, cw * 1.02));
    const k = W / HAND.w;
    const hide = Math.max(0, 1 - p);
    const hit = Math.max(0, p - 1);
    const swingDeg = 16 * (1 - hit) + 26 * hide;
    const tx = W * 0.55 * hide;
    const ty = W * 0.8 * hide;
    const [hx, hy] = HAND.head;
    const [px, py] = HAND.pivot;
    handEl.style.transform = `translate(${sx + tx}px,${sy + ty}px) rotate(${HAND.base}deg) scale(${k}) translate(${-hx}px,${-hy}px) translate(${px}px,${py}px) rotate(${swingDeg}deg) translate(${-px}px,${-py}px)`;
    handEl.style.visibility = mode === 'muyu' && hide < 0.999 ? 'visible' : 'hidden';
  }

  // ---------- 念珠 ----------
  const beadsGrp = new THREE.Group();
  const N = 27;
  const R = 0.5;
  const beadMat = new THREE.MeshPhysicalMaterial({
    map: lacqueredWood('#3a1208', '#6a2a12', 30),
    roughness: 0.28,
    clearcoat: 1,
    clearcoatRoughness: 0.15,
  });
  const beadGeo = new THREE.SphereGeometry(0.062, 32, 24);
  const beadMeshes = [];
  const ring = new THREE.Group();
  for (let i = 0; i < N; i++) {
    const m = new THREE.Mesh(beadGeo, beadMat);
    const a = (i / N) * Math.PI * 2;
    m.position.set(Math.sin(a) * R, -Math.cos(a) * R, 0);
    m.castShadow = true;
    ring.add(m);
    beadMeshes.push(m);
  }
  // 母珠與流蘇固定在最上方
  const guru = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 32, 24),
    new THREE.MeshPhysicalMaterial({ color: 0xc89a3a, metalness: 0.4, roughness: 0.25, clearcoat: 1 }),
  );
  guru.position.set(0, -R - 0.06, 0);
  const tassel = new THREE.Mesh(
    new THREE.ConeGeometry(0.06, 0.28, 16),
    new THREE.MeshStandardMaterial({ color: 0xb3150c, roughness: 0.9 }),
  );
  tassel.position.set(0, -R - 0.28, 0);
  tassel.rotation.z = 0;
  const cord = new THREE.Mesh(
    new THREE.TorusGeometry(R, 0.006, 6, 120),
    new THREE.MeshStandardMaterial({ color: 0x8a1a10 }),
  );
  beadsGrp.add(cord, ring, guru, tassel);
  const hi = glow(0xffd27a, 0.32, 0.0);
  hi.position.set(0, R, 0.05);
  beadsGrp.add(hi);
  beadsGrp.position.set(0, 1.12, 0.35);
  beadsGrp.rotation.x = -0.12;
  beadsGrp.visible = false;
  scene.add(beadsGrp);

  // ---------- 金粉與漣漪 ----------
  const motes = [];
  const moteMap = canvasTex(32, 32, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,240,200,1)');
    gr.addColorStop(0.4, 'rgba(255,200,90,.6)');
    gr.addColorStop(1, 'rgba(255,180,60,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, w);
  });
  function burst(at, n, power = 1) {
    for (let i = 0; i < n; i++) {
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: moteMap,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      sp.position.copy(at);
      sp.scale.setScalar(rnd(0.03, 0.07) * (power > 1 ? 1.4 : 1));
      const a = Math.random() * Math.PI * 2;
      const up = rnd(0.6, 1.6) * power;
      sp.userData = {
        v: new THREE.Vector3(Math.cos(a) * rnd(0.2, 0.7) * power, up, Math.sin(a) * rnd(0.1, 0.5)),
        life: 0,
        max: rnd(0.7, 1.4) * (power > 1 ? 1.6 : 1),
      };
      scene.add(sp);
      motes.push(sp);
    }
  }
  const ripples = [];
  const rippleMat = new THREE.MeshBasicMaterial({
    color: 0xffd27a,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  function ripple(y, size = 1) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.53, 64), rippleMat.clone());
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, y, 0.2);
    m.userData = { life: 0, size };
    scene.add(m);
    ripples.push(m);
  }
  // 大里程碑：一道光柱
  const pillarMat = new THREE.MeshBasicMaterial({
    color: 0xffd27a,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const pillarBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.7, 4, 32, 1, true), pillarMat);
  pillarBeam.position.set(0, 2.6, 0.2);
  scene.add(pillarBeam);
  let beamT = 0;

  // ---------- 動畫狀態 ----------
  let mode = 'muyu';
  let strikeT = -1; // 0..1 敲擊進度；<0 沒在敲
  let squash = 0;
  let shake = 0;
  let beadTurn = 0;
  let beadTarget = 0;
  let hiPulse = 0;
  const hitPoint = STRIKE.clone();

  let pending = []; // 還沒敲到的力道（連點時排隊，一下一下敲）
  let lastTap = -10;
  let strikeFrom = 0;
  /** 槌子真的碰到木魚：這時才震、閃光、噴金粉，並通知頁面出聲。 */
  function impact(power) {
    squash = 1;
    shake = 0.6 * power;
    flash.intensity = 7 * power;
    burst(hitPoint, power > 1 ? 40 : 10, power);
    ripple(0.6, power);
    opts.onImpact?.(power);
  }
  function hit(power = 1) {
    if (mode !== 'muyu') return;
    lastTap = clock.elapsedTime;
    if (strikeT < 0) {
      strikeT = 0;
      strikeFrom = pose;
      curPower = power;
    } else pending.push(power);
  }
  let curPower = 1;
  let held = null;
  function bead(round = false) {
    if (mode !== 'beads') return;
    beadTarget += (Math.PI * 2) / N;
    hiPulse = 1;
    burst(new THREE.Vector3(0, 1.12 + R, 0.45), round ? 36 : 4, round ? 1.8 : 0.5);
    if (round) {
      beamT = 1;
      flash.intensity = 10;
    }
  }
  function celebrate() {
    beamT = 1;
    flash.intensity = 12;
    burst(new THREE.Vector3(0, 1.2, 0.3), 60, 2);
    shake = 1;
  }
  function setMode(m) {
    mode = m;
    const showFish = m === 'muyu';
    fish.visible = showFish;
    malletPivot.visible = showFish && !opts.handEl;
    cushion.visible = m !== 'beads';
    trim.visible = m !== 'beads';
    beadsGrp.visible = m === 'beads';
    // 擲筊、桌布：鏡頭拉遠一點，讓前景的面板有空間
    dim = m === 'jiao' || m === 'wallpaper' ? 1 : 0;
  }
  let dim = 0;
  let dimNow = 0;

  // ---------- 尺寸 ----------
  function resize() {
    const w = canvas.clientWidth || innerWidth;
    const h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // 直立手機：鏡頭往後拉，木魚不會被切到
    camera.fov = w / h < 0.75 ? 46 : 34;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // ---------- 主迴圈 ----------
  const clock = new THREE.Clock();
  let raf = 0;
  let alive = true;
  function frame() {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    // 手：一下敲擊 0.26 秒。前 0.09 秒從現在的位置加速落到木魚上（碰到就出聲），
    // 之後彈回舉起。連點時一下接一下；停手 0.9 秒才收回畫面下方。
    if (strikeT >= 0) {
      const before = strikeT;
      strikeT += dt / 0.26;
      const HIT = 0.35;
      if (strikeT < HIT) {
        const k = strikeT / HIT;
        pose = strikeFrom + (2 - strikeFrom) * k * k;
      } else {
        if (before < HIT) impact(curPower);
        const k = Math.min(1, (strikeT - HIT) / (1 - HIT));
        pose = 2 - Math.sin((k * Math.PI) / 2);
      }
      if (strikeT >= 1) {
        strikeT = -1;
        pose = 1;
        if (pending.length) {
          curPower = pending.shift();
          strikeT = 0;
          strikeFrom = pose;
        }
      }
    } else if (t - lastTap > 0.9) pose = Math.max(0, pose - dt * 3);
    else pose = 1 + Math.sin(t * 2) * 0.02;
    if (pending.length > 3) pending = pending.slice(-3);
    applyPose(held ?? pose);
    if (handEl) placeHand(held ?? pose);
    squash = Math.max(0, squash - dt * 9);
    const s = 1 - Math.sin(squash * Math.PI) * 0.035;
    fish.scale.set(1 + (1 - s) * 0.6, s, 1 + (1 - s) * 0.6);
    flash.intensity *= Math.exp(-dt * 9);

    beadTurn += (beadTarget - beadTurn) * Math.min(1, dt * 14);
    ring.rotation.z = beadTurn;
    hiPulse = Math.max(0, hiPulse - dt * 2.5);
    hi.material.opacity = 0.25 + hiPulse * 0.75;
    beadsGrp.position.y = 1.12 + Math.sin(t * 0.9) * 0.012;

    for (const c of candles) {
      const f = 0.85 + Math.sin(t * 11 + c.ph) * 0.06 + Math.sin(t * 23 + c.ph * 2) * 0.05;
      c.fl.scale.setScalar(0.3 * f);
      c.fl2.material.opacity = 0.3 * f;
      c.light.intensity = 3 * f;
    }
    for (const l of lanterns) l.rotation.z = Math.sin(t * 0.7 + l.userData.phase) * 0.03;
    for (const e of sticks) e.material.opacity = 0.7 + Math.sin(t * 3 + e.position.x * 40) * 0.3;
    for (const sp of smoke) {
      sp.userData.t += dt;
      const u = (sp.userData.t % 6) / 6;
      sp.position.set(
        -0.62 + Math.sin(u * 7 + sp.id) * 0.08 * u * 3,
        1.08 + u * 1.9,
        -0.55 + Math.cos(u * 5 + sp.id) * 0.05,
      );
      sp.scale.setScalar(0.08 + u * 0.55);
      sp.material.opacity = Math.sin(u * Math.PI) * 0.16;
    }

    for (let i = motes.length - 1; i >= 0; i--) {
      const m = motes[i];
      const d = m.userData;
      d.life += dt;
      d.v.y -= dt * 0.9;
      m.position.addScaledVector(d.v, dt);
      m.material.opacity = Math.max(0, 1 - d.life / d.max);
      if (d.life >= d.max) {
        scene.remove(m);
        m.material.dispose();
        motes.splice(i, 1);
      }
    }
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.userData.life += dt;
      const k = r.userData.life / 0.7;
      r.scale.setScalar(1 + k * 1.2 * r.userData.size);
      r.material.opacity = 0.6 * (1 - k);
      if (k >= 1) {
        scene.remove(r);
        r.geometry.dispose();
        r.material.dispose();
        ripples.splice(i, 1);
      }
    }
    beamT = Math.max(0, beamT - dt * 0.7);
    pillarMat.opacity = Math.sin(beamT * Math.PI) * 0.22;
    pillarBeam.rotation.y += dt * 0.4;

    dimNow += (dim - dimNow) * Math.min(1, dt * 5);
    shake *= Math.exp(-dt * 14);
    camera.position.set(
      camBase.x + (Math.random() - 0.5) * shake * 0.03,
      camBase.y + dimNow * 0.35 + (Math.random() - 0.5) * shake * 0.03,
      camBase.z + dimNow * 0.9,
    );
    camera.lookAt(look.x, look.y + dimNow * 0.1, look.z);
    renderer.render(scene, camera);
  }
  frame();
  opts.onReady?.();

  return {
    hit,
    bead,
    /** 測試截圖用：把手停在某個姿勢（0 收起、1 舉起、2 敲到）。 */
    holdPose(p) {
      held = p;
    },
    celebrate,
    setMode,
    dispose() {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
    },
  };
}
