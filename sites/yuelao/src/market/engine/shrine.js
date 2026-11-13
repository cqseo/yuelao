import * as THREE from 'three';
import { roofGeometry } from './mats.js';
import { canvasTex, glow, rand, textPlane } from './util.js';

// 可以直接走進去的月老殿（參考心安宮）：正面不設門牆，三面牆加屋頂，和廣場在同一個場景。
// 殿內有花鳥屏風、坐著的月老像、供桌（燭台、供果、香爐、籤筒）、三個蒲團和紅線架。
// 走到供桌前出現「求籤」，走上蒲團出現「跪拜」。
// 尺寸都用殿的本地座標：正面開口在 z = 0，往後 z 是負的。
const W = 9.6;
const D = 8.4;
const H = 4.6;
const B = 0.3; // 台基高

/** 屏風：深紅漆底、金色滿月、祥雲、兩側梅花與牡丹、金框。全用 canvas 畫，不載圖。 */
function screenTex() {
  return canvasTex(1024, 640, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#5a0d12');
    bg.addColorStop(1, '#3a070b');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    // 漆面細紋
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(255,${rand(60, 120) | 0},${rand(40, 80) | 0},${rand(0.02, 0.05)})`;
      g.fillRect(rand(w), rand(h), rand(2, 30), 1);
    }
    // 滿月
    const mx = w / 2;
    const my = h * 0.34;
    const mr = h * 0.2;
    const moon = g.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr);
    moon.addColorStop(0, '#fff3cf');
    moon.addColorStop(0.7, '#f1d38c');
    moon.addColorStop(1, '#d9ae5c');
    g.fillStyle = moon;
    g.beginPath();
    g.arc(mx, my, mr, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 0.18;
    g.fillStyle = '#fff6dc';
    g.beginPath();
    g.arc(mx, my, mr * 1.35, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    // 祥雲：一串串圓弧，金邊青底
    const cloud = (cx, cy, s, flip) => {
      g.save();
      g.translate(cx, cy);
      g.scale(flip ? -s : s, s);
      g.lineWidth = 4 / s;
      g.strokeStyle = '#e8c477';
      g.fillStyle = '#2f6b6a';
      g.beginPath();
      g.moveTo(-60, 10);
      g.arc(-35, 0, 25, Math.PI, Math.PI * 1.9);
      g.arc(0, -8, 30, Math.PI * 1.1, Math.PI * 1.95);
      g.arc(35, 2, 24, Math.PI * 1.2, Math.PI * 2.05);
      g.quadraticCurveTo(70, 20, 40, 22);
      g.lineTo(-50, 22);
      g.closePath();
      g.fill();
      g.stroke();
      // 卷雲尾巴
      g.beginPath();
      g.arc(-10, 8, 10, 0, Math.PI * 1.6);
      g.stroke();
      g.restore();
    };
    cloud(w * 0.33, h * 0.42, 1.4, false);
    cloud(w * 0.68, h * 0.5, 1.2, true);
    cloud(w * 0.42, h * 0.2, 0.9, true);
    cloud(w * 0.6, h * 0.16, 0.8, false);
    cloud(w * 0.5, h * 0.62, 1.1, false);
    // 枝幹與花
    const branch = (x0, y0, x1, y1, bend) => {
      g.strokeStyle = '#2a1a12';
      g.lineCap = 'round';
      g.lineWidth = 9;
      g.beginPath();
      g.moveTo(x0, y0);
      g.quadraticCurveTo((x0 + x1) / 2 + bend, (y0 + y1) / 2, x1, y1);
      g.stroke();
      g.lineWidth = 4;
      for (let i = 0; i < 5; i++) {
        const t = 0.2 + i * 0.15;
        const bx = x0 + (x1 - x0) * t + bend * Math.sin(t * Math.PI) * 0.5;
        const by = y0 + (y1 - y0) * t;
        g.beginPath();
        g.moveTo(bx, by);
        g.lineTo(bx + rand(-50, 50), by - rand(20, 60));
        g.stroke();
      }
    };
    const flower = (x, y, r, petals, c1, c2) => {
      for (let i = 0; i < petals; i++) {
        const a = (i / petals) * Math.PI * 2;
        const gr = g.createRadialGradient(
          x,
          y,
          r * 0.1,
          x + Math.cos(a) * r * 0.6,
          y + Math.sin(a) * r * 0.6,
          r * 0.7,
        );
        gr.addColorStop(0, c2);
        gr.addColorStop(1, c1);
        g.fillStyle = gr;
        g.beginPath();
        g.ellipse(
          x + Math.cos(a) * r * 0.55,
          y + Math.sin(a) * r * 0.55,
          r * 0.55,
          r * 0.38,
          a,
          0,
          Math.PI * 2,
        );
        g.fill();
      }
      g.fillStyle = '#f2c94c';
      g.beginPath();
      g.arc(x, y, r * 0.22, 0, Math.PI * 2);
      g.fill();
    };
    for (const side of [0, 1]) {
      const x0 = side ? w - 20 : 20;
      const dir = side ? -1 : 1;
      branch(x0, h - 30, x0 + dir * 230, h * 0.25, dir * 90);
      branch(x0, h * 0.7, x0 + dir * 160, h * 0.05, dir * -60);
      for (let i = 0; i < 9; i++) {
        const fx = x0 + dir * rand(30, 250);
        const fy = rand(h * 0.1, h * 0.9);
        if (i % 3 === 0)
          flower(fx, fy, rand(26, 36), 9, '#c8425a', '#f7c1c8'); // 牡丹
        else flower(fx, fy, rand(12, 18), 5, '#f3d9e0', '#ffffff'); // 梅花
      }
      // 蝴蝶
      for (let i = 0; i < 2; i++) {
        const bx = x0 + dir * rand(120, 280);
        const by = rand(h * 0.15, h * 0.6);
        g.fillStyle = '#e8c477';
        for (const s of [-1, 1]) {
          g.beginPath();
          g.ellipse(bx + s * 10, by - 4, 11, 7, s * 0.6, 0, Math.PI * 2);
          g.ellipse(bx + s * 8, by + 7, 7, 5, -s * 0.5, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    // 金框與三扇屏風的分隔
    g.strokeStyle = '#d4a650';
    g.lineWidth = 16;
    g.strokeRect(8, 8, w - 16, h - 16);
    g.lineWidth = 6;
    for (const fx of [w / 3, (w * 2) / 3]) {
      g.beginPath();
      g.moveTo(fx, 8);
      g.lineTo(fx, h - 8);
      g.stroke();
    }
  });
}

/**
 * 坐像：紅袍、白鬚、壽星帽，左手拄杖、右手牽一縷紅線。比例刻意 Q 一點，和訪客的角色同一種語言。
 */
function statue(mat) {
  const g = new THREE.Group();
  const robe = new THREE.MeshStandardMaterial({ color: 0xb3221a, roughness: 0.55 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xe0b45a, metalness: 0.6, roughness: 0.35 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xf0cdb0, roughness: 0.6 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf6f3ec, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1210, roughness: 0.5 });
  const sh = (m) => {
    m.castShadow = true;
    return m;
  };
  // 座椅
  g.add(sh(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 1.2), mat.wood)).translateY(0.35));
  g.add(
    sh(new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.6, 0.18), mat.wood))
      .translateY(1.2)
      .translateZ(-0.6),
  );
  // 下擺（坐姿：膝蓋往前）
  const lap = sh(new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.42, 0.95), robe));
  lap.position.set(0, 0.88, 0.2);
  g.add(lap);
  const hem = sh(
    new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.75, 20, 1, false, -Math.PI / 2, Math.PI), robe),
  );
  hem.rotation.y = 0;
  hem.position.set(0, 0.42, 0.55);
  hem.scale.z = 0.6;
  g.add(hem);
  // 身體
  const torso = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 0.95, 20), robe));
  torso.position.set(0, 1.5, -0.05);
  g.add(torso);
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 20), trim);
  belt.position.set(0, 1.12, -0.05);
  g.add(belt);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 8, 20), trim);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 1.95, -0.05);
  g.add(collar);
  // 胸前團壽紋
  const medal = new THREE.Mesh(new THREE.CircleGeometry(0.17, 24), trim);
  medal.position.set(0, 1.55, 0.37);
  g.add(medal);
  // 手臂與手
  for (const s of [-1, 1]) {
    const arm = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.75, 12), robe));
    arm.position.set(s * 0.55, 1.5, 0.12);
    arm.rotation.x = -0.9;
    arm.rotation.z = s * 0.25;
    g.add(arm);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 6, 16), trim);
    cuff.position.set(s * 0.6, 1.3, 0.42);
    cuff.rotation.x = 0.7;
    g.add(cuff);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), skin);
    hand.position.set(s * 0.62, 1.28, 0.52);
    g.add(hand);
  }
  // 頭：臉、長眉、白鬚、壽星帽
  const head = new THREE.Group();
  head.position.set(0, 2.38, 0);
  head.add(sh(new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 18), skin)));
  const beard = sh(new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.95, 18), white));
  beard.rotation.x = Math.PI;
  beard.position.set(0, -0.5, 0.2);
  head.add(beard);
  const mous = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.05, 8, 16, Math.PI), white);
  mous.position.set(0, -0.12, 0.36);
  mous.rotation.z = Math.PI;
  head.add(mous);
  for (const s of [-1, 1]) {
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.22, 4, 8), white);
    brow.position.set(s * 0.15, 0.1, 0.35);
    brow.rotation.z = s * -1.9;
    head.add(brow);
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 4, 10, Math.PI), dark);
    eye.position.set(s * 0.14, 0.02, 0.38);
    head.add(eye);
    const cheek = new THREE.Mesh(
      new THREE.CircleGeometry(0.06, 12),
      new THREE.MeshBasicMaterial({ color: 0xf0a090, transparent: true, opacity: 0.5 }),
    );
    cheek.position.set(s * 0.2, -0.08, 0.34);
    cheek.rotation.y = s * 0.5;
    head.add(cheek);
  }
  const hat = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 0.28, 20), robe));
  hat.position.y = 0.38;
  const hatTop = sh(
    new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), robe),
  );
  hatTop.position.y = 0.5;
  const hatBand = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.04, 6, 20), trim);
  hatBand.rotation.x = Math.PI / 2;
  hatBand.position.y = 0.27;
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), trim);
  bead.position.set(0, 0.42, 0.36);
  head.add(hat, hatTop, hatBand, bead);
  g.add(head);
  // 拐杖（左手）與葫蘆
  const staff = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 3.1, 8), dark));
  staff.position.set(-0.85, 1.55, 0.55);
  staff.rotation.z = 0.08;
  g.add(staff);
  const gourd = new THREE.Group();
  gourd.add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), trim));
  gourd.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), trim).translateY(0.18));
  gourd.position.set(-0.98, 2.7, 0.55);
  g.add(gourd);
  // 右手牽著的紅線
  const pts = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    pts.push(
      new THREE.Vector3(0.62 + t * 0.9, 1.28 - Math.sin(t * Math.PI) * 0.25 - t * 0.6, 0.52 + t * 0.5),
    );
  }
  const thread = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.012, 5),
    new THREE.MeshBasicMaterial({ color: 0xff2a2a, toneMapped: false }),
  );
  g.add(thread);
  return g;
}

/**
 * @param {{ scene: THREE.Scene, mat: any, x: number, z: number, rot: number,
 *   shadow: (m: THREE.Object3D, cast?: boolean, recv?: boolean) => THREE.Object3D,
 *   warm: (x:number,y:number,z:number,i?:number,d?:number,c?:number) => void }} o
 */
export function createShrine({ scene, mat, x, z, rot, shadow, warm }) {
  const g = new THREE.Group();
  const box = (w, h, d, m) => shadow(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m));
  // 台基與殿內地坪
  g.add(
    box(W + 1.2, B, D + 2, mat.stone)
      .translateY(B / 2)
      .translateZ(-D / 2 + 0.6),
  );
  const floorM = new THREE.MeshStandardMaterial({ color: 0xd8cdb8, roughness: 0.85, map: mat.stone.map });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.4, D - 0.3), floorM);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, B + 0.005, -D / 2);
  floor.receiveShadow = true;
  g.add(floor);
  // 前面兩級台階
  for (let i = 0; i < 2; i++)
    g.add(
      box(4.4, B / 2, 0.45, mat.stone)
        .translateY(B / 4 + (i * B) / 2)
        .translateZ(1.3 - i * 0.45),
    );
  // 三面牆（內外都是粉牆，牆裙是木）
  const wallM = mat.plaster;
  g.add(
    box(W, H, 0.3, wallM)
      .translateY(B + H / 2)
      .translateZ(-D),
  );
  for (const s of [-1, 1]) {
    g.add(
      box(0.3, H, D, wallM)
        .translateX((s * W) / 2)
        .translateY(B + H / 2)
        .translateZ(-D / 2),
    );
    g.add(
      box(0.05, 0.9, D - 0.4, mat.wood)
        .translateX(s * (W / 2 - 0.18))
        .translateY(B + 0.45)
        .translateZ(-D / 2),
    );
  }
  // 柱子：正面四根、轉角兩根
  for (const cx of [-W / 2 + 0.3, -1.7, 1.7, W / 2 - 0.3]) {
    const c = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, H, 16), mat.red));
    c.position.set(cx, B + H / 2, 0.15);
    g.add(c);
    g.add(
      box(0.55, 0.24, 0.55, mat.stone)
        .translateX(cx)
        .translateY(B + 0.12)
        .translateZ(0.15),
    );
  }
  // 額枋與雀替
  g.add(
    box(W + 0.4, 0.4, 0.34, mat.red)
      .translateY(B + H - 0.2)
      .translateZ(0.15),
  );
  g.add(
    box(W + 0.4, 0.16, 0.36, mat.gold)
      .translateY(B + H - 0.48)
      .translateZ(0.15),
  );
  // 屋頂
  const roof = shadow(new THREE.Mesh(roofGeometry(W + 2.6, D + 3, 2, 0.65), mat.tile));
  roof.position.set(0, B + H, -D / 2 + 0.3);
  g.add(roof);
  g.add(
    box(W + 2.2, 0.3, 0.34, mat.dark)
      .translateY(B + H + 2.08)
      .translateZ(-D / 2 + 0.3),
  );
  // 天花：深色木頂，免得從底下看到屋頂內側
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(W, D),
    new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.9 }),
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, B + H - 0.02, -D / 2);
  g.add(ceil);
  for (let i = 1; i < 4; i++)
    g.add(
      box(W - 0.4, 0.22, 0.22, mat.wood)
        .translateY(B + H - 0.15)
        .translateZ(-(i * D) / 4),
    );
  // 匾額
  const plaque = textPlane('月老殿', 1.15, { bg: '#130905', fg: '#f3d691', border: '#b88a3c', size: 150 });
  plaque.position.set(0, B + H - 0.95, 0.36);
  g.add(plaque);
  // 正面兩根柱子上的對聯（朝外）
  for (const [cx, txt] of [
    [-W / 2 + 0.3, '願天下有情人'],
    [W / 2 - 0.3, '都成了眷屬'],
  ]) {
    // 對聯貼在最外側兩根柱子上，別擋住看進殿裡的視線
    const c = textPlane(txt, 2.3, { vertical: true, bg: '#7b161b', fg: '#f6e4b6', size: 100, weight: 700 });
    c.position.set(cx, B + 2.0, 0.4);
    g.add(c);
  }

  // ---------- 殿內 ----------
  const zBack = -D + 0.15;
  // 屏風
  const scr = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 4),
    new THREE.MeshStandardMaterial({ map: screenTex(), roughness: 0.5 }),
  );
  scr.position.set(0, B + 2.25, zBack + 0.05);
  g.add(scr);
  g.add(
    box(6.7, 0.18, 0.12, mat.gold)
      .translateY(B + 4.3)
      .translateZ(zBack + 0.08),
  );
  // 兩側直聯
  for (const [cx, txt] of [
    [-3.75, '良緣天成'],
    [3.75, '和合美滿'],
  ]) {
    const c = textPlane(txt, 2.2, {
      vertical: true,
      bg: '#5a0d12',
      fg: '#f3d691',
      border: '#b88a3c',
      size: 110,
      weight: 700,
    });
    c.position.set(cx, B + 2.3, zBack + 0.06);
    g.add(c);
  }
  // 神台與坐像
  g.add(
    box(3.4, 0.9, 1.7, mat.red)
      .translateY(B + 0.45)
      .translateZ(zBack + 1.05),
  );
  g.add(
    box(3.6, 0.1, 1.9, mat.gold)
      .translateY(B + 0.92)
      .translateZ(zBack + 1.05),
  );
  const god = statue(mat);
  god.position.set(0, B + 0.97, zBack + 1.1);
  god.scale.setScalar(1.05);
  g.add(god);
  // 供桌
  const tz = zBack + 2.75;
  g.add(
    box(3.8, 0.12, 1.1, mat.wood)
      .translateY(B + 1.0)
      .translateZ(tz),
  );
  g.add(
    box(3.6, 0.85, 1.0, mat.red)
      .translateY(B + 0.5)
      .translateZ(tz),
  );
  // 桌圍：紅底金字
  const apron = textPlane('有求必應', 0.55, { bg: '#8a1a1a', fg: '#f3d691', size: 110, weight: 700 });
  apron.position.set(0, B + 0.55, tz + 0.52);
  g.add(apron);
  // 燭台（燭火會微微亮）
  const flames = [];
  for (const s of [-1, 1]) {
    g.add(
      box(0.12, 0.35, 0.12, mat.gold)
        .translateX(s * 1.45)
        .translateY(B + 1.24)
        .translateZ(tz),
    );
    const candle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.32, 10),
      new THREE.MeshStandardMaterial({ color: 0xc21f1a }),
    );
    candle.position.set(s * 1.45, B + 1.57, tz);
    g.add(candle);
    const f = glow(0xffb050, 0.45, 0.95);
    f.position.set(s * 1.45, B + 1.82, tz);
    g.add(f);
    flames.push(f);
  }
  // 供果
  const fruitM = new THREE.MeshStandardMaterial({ color: 0xe0802a, roughness: 0.5 });
  for (const s of [-1, 1]) {
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.22, 0.05, 18),
      new THREE.MeshStandardMaterial({ color: 0xf2efe6 }),
    );
    plate.position.set(s * 0.8, B + 1.09, tz);
    g.add(plate);
    for (const [ox, oy, oz] of [
      [-0.09, 0, -0.06],
      [0.09, 0, -0.06],
      [0, 0, 0.09],
      [0, 0.13, 0],
    ]) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), fruitM);
      f.position.set(s * 0.8 + ox, B + 1.2 + oy, tz + oz);
      g.add(f);
    }
  }
  // 小香爐
  const bowl = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.2, 18), mat.bronze));
  bowl.position.set(0, B + 1.16, tz);
  g.add(bowl);
  for (const ox of [-0.06, 0, 0.06]) {
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.45, 5),
      new THREE.MeshBasicMaterial({ color: 0x8a6a48 }),
    );
    stick.position.set(ox, B + 1.45, tz);
    g.add(stick);
    const tip = glow(0xff5a20, 0.08, 1);
    tip.position.set(ox, B + 1.68, tz);
    g.add(tip);
  }
  // 籤筒
  const tube = shadow(
    new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.12, 0.38, 14),
      new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.6 }),
    ),
  );
  tube.position.set(1.15, B + 1.25, tz + 0.25);
  g.add(tube);
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, 0.42, 0.006),
      new THREE.MeshStandardMaterial({ color: 0xd9b26a }),
    );
    s.position.set(1.15 + rand(-0.07, 0.07), B + 1.5, tz + 0.25 + rand(-0.07, 0.07));
    s.rotation.set(rand(-0.15, 0.15), rand(3), rand(-0.15, 0.15));
    g.add(s);
  }
  // 蒲團（三個）
  const cushionM = new THREE.MeshStandardMaterial({ color: 0x8a1f24, roughness: 0.85 });
  const cz = tz + 1.75;
  const cushionsLocal = [-1.4, 0, 1.4].map((cx) => {
    const p = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.14, 24), cushionM));
    p.position.set(cx, B + 0.07, cz);
    g.add(p);
    return [cx, cz];
  });
  // 紅線架：一排掛著的紅線與小木牌
  const rack = new THREE.Group();
  rack.add(box(0.1, 2, 0.1, mat.wood).translateX(-0.9).translateY(1));
  rack.add(box(0.1, 2, 0.1, mat.wood).translateX(0.9).translateY(1));
  rack.add(box(2.1, 0.1, 0.12, mat.wood).translateY(2));
  const tagM = new THREE.MeshStandardMaterial({ color: 0xb02a22, roughness: 0.6 });
  for (let i = 0; i < 6; i++) {
    const tx = -0.75 + i * 0.3;
    const len = rand(0.4, 0.7);
    const th = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, len, 4),
      new THREE.MeshBasicMaterial({ color: 0xff2a2a }),
    );
    th.position.set(tx, 2 - len / 2, 0);
    rack.add(
      th,
      new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.26, 0.03), tagM).translateX(tx).translateY(2 - len - 0.13),
    );
  }
  rack.position.set(W / 2 - 1.3, B, -D + 4.2);
  rack.rotation.y = -Math.PI / 2;
  g.add(rack);

  g.position.set(x, 0, z);
  g.rotation.y = rot;
  scene.add(g);

  const toWorld = (lx, ly, lz) =>
    new THREE.Vector3(lx, ly, lz)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), rot)
      .add(new THREE.Vector3(x, 0, z));
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  /** 世界座標轉成殿的本地座標。 */
  const toLocal = (wx, wz) => {
    const dx = wx - x;
    const dz = wz - z;
    return [dx * cos - dz * sin, dx * sin + dz * cos];
  };
  // 擋住不能走的地方（本地座標的方塊）：三面牆、神台＋供桌、紅線架
  const blocks = [
    [-W / 2 - 0.4, W / 2 + 0.4, -D - 0.6, -D + 0.3],
    [-W / 2 - 0.4, -W / 2 + 0.35, -D, 0.3],
    [W / 2 - 0.35, W / 2 + 0.4, -D, 0.3],
    [-2.05, 2.05, -D, tz + 0.7],
    [W / 2 - 1.6, W / 2 - 0.3, -D + 3, -D + 5.4],
  ];
  // 殿內要亮：一盞大的暖光照全殿，一盞打在神像臉上
  // 不交給 warm()：那些燈白天會調暗，殿內白天也要亮
  for (const [lx, ly, lz, i, d, c] of [
    [0, 3.6, -D / 2 + 1, 60, 14, 0xffd8b0],
    [0, 3.2, tz + 1.6, 26, 7, 0xffe6c8],
  ]) {
    const l = new THREE.PointLight(c, i, d, 1.6);
    l.position.copy(toWorld(lx, ly, lz));
    scene.add(l);
  }
  void warm;

  let t = 0;
  return {
    /** 殿內不能走的地方。 */
    inside(wx, wz) {
      const [lx, lz] = toLocal(wx, wz);
      return lx > -W / 2 - 0.5 && lx < W / 2 + 0.5 && lz > -D - 0.7 && lz < 1.6;
    },
    blocked(wx, wz) {
      const [lx, lz] = toLocal(wx, wz);
      return blocks.some(([a, b, c, d]) => lx >= a && lx <= b && lz >= c && lz <= d);
    },
    /** 供桌前站的位置（「求籤」）、面向的神像、匾額標籤的位置。 */
    stand: toWorld(0, 1.65, cz - 0.85),
    /** 殿門口外面一點：走進殿要先到這裡，免得穿牆。 */
    entry: toWorld(0, 0, 3),
    door: toWorld(0, 1.8, zBack + 1.1),
    label: toWorld(0, B + H + 0.6, 0.4),
    /** 三個蒲團（世界座標）與面向。 */
    cushions: cushionsLocal.map(([cx, cz2]) => toWorld(cx, 0, cz2)),
    faceTo: toWorld(0, 0, zBack),
    /** 點神像也能求籤。 */
    pick: god,
    fx: sin,
    fz: cos,
    update(dt) {
      t += dt;
      for (const [i, f] of flames.entries())
        f.scale.setScalar(0.42 + Math.sin(t * 9 + i * 2) * 0.04 + Math.sin(t * 23 + i) * 0.02);
    },
  };
}
