import * as THREE from 'three';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { roofGeometry } from './mats.js';
import { canvasTex, glow, rand, textPlane } from './util.js';

// 可以直接走進去的月老殿（參考心安宮）：正面不設門牆，三面牆加屋頂，和廣場在同一個場景。
// 殿內有花鳥屏風、坐著的月老像、供桌（燭台、供果、香爐、籤筒）、三個蒲團和紅線架。
// 走到供桌前出現「求籤」，走上蒲團出現「跪拜」。
// 尺寸都用殿的本地座標：正面開口在 z = 0，往後 z 是負的。
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
function statue(mat, gold = false) {
  const g = new THREE.Group();
  // 大殿的是鎏金像，月老殿的是彩繪紅袍
  const robe = gold
    ? new THREE.MeshStandardMaterial({ color: 0xd2a246, metalness: 0.85, roughness: 0.32 })
    : new THREE.MeshStandardMaterial({ color: 0xb3221a, roughness: 0.55 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xe0b45a, metalness: 0.6, roughness: 0.35 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe2b48e, roughness: 0.65 });
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
  // 白鬚從嘴下才開始、上窄下長：原本 0.34 粗的圓錐從鼻下蓋到下巴，遠看像戴口罩
  const beard = sh(new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.95, 18), white));
  beard.rotation.x = Math.PI;
  beard.scale.z = 0.7;
  beard.position.set(0, -0.66, 0.26);
  head.add(beard);
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.016, 6, 12, Math.PI), dark);
  mouth.position.set(0, -0.2, 0.37);
  mouth.rotation.z = Math.PI;
  head.add(mouth);
  const mous = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.04, 8, 16, Math.PI), white);
  mous.position.set(0, -0.12, 0.37);
  mous.rotation.z = Math.PI;
  head.add(mous);
  for (const s of [-1, 1]) {
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.22, 4, 8), white);
    brow.position.set(s * 0.15, 0.12, 0.37);
    brow.rotation.z = s * -1.9;
    head.add(brow);
    // 笑瞇瞇的眼睛：一道往下彎的弧
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.018, 6, 12, Math.PI), dark);
    eye.position.set(s * 0.14, 0.0, 0.392);
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

/** 塔羅館的掛毯：深紫星空、月相一排、黃道環、金邊。 */
function tarotTapestry() {
  return canvasTex(1024, 640, (g, w, h) => {
    const bg = g.createRadialGradient(w / 2, h * 0.45, 20, w / 2, h / 2, w * 0.7);
    bg.addColorStop(0, '#3a2470');
    bg.addColorStop(1, '#140b2c');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 420; i++) {
      g.fillStyle = `rgba(255,${rand(220, 255) | 0},${rand(180, 240) | 0},${rand(0.3, 0.95)})`;
      const r = rand(0.6, 2.2);
      g.beginPath();
      g.arc(rand(w), rand(h), r, 0, Math.PI * 2);
      g.fill();
    }
    // 黃道環
    g.strokeStyle = 'rgba(232,201,122,.75)';
    g.lineWidth = 3;
    for (const r of [h * 0.3, h * 0.36]) {
      g.beginPath();
      g.arc(w / 2, h * 0.47, r, 0, Math.PI * 2);
      g.stroke();
    }
    g.font = '28px serif';
    g.fillStyle = '#e8c97a';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const signs = '♈♉♊♋♌♍♎♏♐♑♒♓';
    [...signs].forEach((c, i) => {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      g.fillText(c, w / 2 + Math.cos(a) * h * 0.33, h * 0.47 + Math.sin(a) * h * 0.33);
    });
    // 中間一隻眼與太陽光
    g.fillStyle = '#e8c97a';
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      g.beginPath();
      g.moveTo(w / 2 + Math.cos(a) * 50, h * 0.47 + Math.sin(a) * 50);
      g.lineTo(w / 2 + Math.cos(a + 0.06) * 95, h * 0.47 + Math.sin(a + 0.06) * 95);
      g.lineTo(w / 2 + Math.cos(a + 0.12) * 50, h * 0.47 + Math.sin(a + 0.12) * 50);
      g.fill();
    }
    g.beginPath();
    g.arc(w / 2, h * 0.47, 46, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#2a1650';
    g.beginPath();
    g.ellipse(w / 2, h * 0.47, 30, 16, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#e8c97a';
    g.beginPath();
    g.arc(w / 2, h * 0.47, 9, 0, Math.PI * 2);
    g.fill();
    // 上緣一排月相
    for (let i = 0; i < 7; i++) {
      const mx = w * 0.2 + i * w * 0.1;
      const my = h * 0.09;
      g.fillStyle = '#f3e3b0';
      g.beginPath();
      g.arc(mx, my, 16, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#1d0f3c';
      g.beginPath();
      g.arc(mx + (i - 3) * 6, my, 16, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = '#d4a650';
    g.lineWidth = 14;
    g.strokeRect(7, 7, w - 14, h - 14);
  });
}

/** 塔羅館：星空掛毯、紫布圓桌、三張蓋著的牌、水晶球、燭台、牌架。 */
function furnishTarot({ g, mat, box, shadow, B, W, zBack }) {
  const tap = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 4),
    new THREE.MeshStandardMaterial({ map: tarotTapestry(), roughness: 0.7 }),
  );
  tap.position.set(0, B + 2.3, zBack + 0.05);
  g.add(tap);
  // 兩側紫色帷幔
  const drapeM = new THREE.MeshStandardMaterial({ color: 0x3b1f6e, roughness: 0.8, side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.75, 4.2, 12, 1, true, 0, Math.PI), drapeM);
    d.position.set(s * (W / 2 - 0.9), B + 2.1, zBack + 0.5);
    d.rotation.y = Math.PI;
    g.add(d);
  }
  const tz = zBack + 2.6;
  const table = new THREE.Group();
  table.add(
    shadow(
      new THREE.Mesh(
        new THREE.CylinderGeometry(1.15, 1.25, 0.9, 32),
        new THREE.MeshStandardMaterial({ color: 0x2a1650, roughness: 0.85 }),
      ),
    ).translateY(0.45),
  );
  table.add(
    new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 0.04, 32),
      new THREE.MeshStandardMaterial({ color: 0xd4a650, metalness: 0.7, roughness: 0.35 }),
    ).translateY(0.92),
  );
  // 三張蓋著的牌
  const back = canvasTex(128, 200, (c, w, h) => {
    c.fillStyle = '#24124a';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#e8c97a';
    c.lineWidth = 6;
    c.strokeRect(8, 8, w - 16, h - 16);
    c.fillStyle = '#e8c97a';
    c.beginPath();
    c.arc(w / 2, h / 2, 22, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#24124a';
    c.beginPath();
    c.arc(w / 2 + 9, h / 2 - 4, 20, 0, Math.PI * 2);
    c.fill();
  });
  for (const cx of [-0.42, 0, 0.42]) {
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.008, 0.48), [
      mat.gold,
      mat.gold,
      new THREE.MeshStandardMaterial({ map: back, roughness: 0.5 }),
      mat.gold,
      mat.gold,
      mat.gold,
    ]);
    card.position.set(cx, 0.95, 0.35);
    card.rotation.y = cx * -0.3;
    table.add(card);
  }
  // 水晶球
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 24, 18),
    new THREE.MeshStandardMaterial({
      color: 0xbfa8ff,
      emissive: 0x6a48d8,
      emissiveIntensity: 0.6,
      roughness: 0.05,
      transparent: true,
      opacity: 0.85,
    }),
  );
  ball.position.set(0, 1.18, -0.35);
  table.add(
    ball,
    new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.12, 16), mat.gold)
      .translateY(0.98)
      .translateZ(-0.35),
  );
  const orb = glow(0x9f7bff, 1.2, 0.5);
  orb.position.set(0, 1.18, -0.35);
  table.add(orb);
  const flames = [];
  for (const s of [-1, 1]) {
    table.add(
      new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 0.3, 10),
        new THREE.MeshStandardMaterial({ color: 0xf2ead8 }),
      )
        .translateX(s * 0.8)
        .translateY(1.08)
        .translateZ(-0.2),
    );
    const f = glow(0xffb050, 0.4, 0.95);
    f.position.set(s * 0.8, 1.32, -0.2);
    table.add(f);
    flames.push(f);
  }
  table.position.set(0, B, tz - 0.6);
  table.traverse((n) => {
    n.userData.room = 'tarot';
  });
  g.add(table);
  // 坐墊兩個
  const seatM = new THREE.MeshStandardMaterial({ color: 0x4b2a88, roughness: 0.85 });
  g.add(
    shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.44, 0.16, 24), seatM))
      .translateY(B + 0.08)
      .translateZ(zBack + 0.9),
  );
  void box;
  return { god: table, tz, cz: tz + 1.75, cushionsLocal: [], flames };
}

/** 抄經閣：心經直幅、矮書案（宣紙、毛筆、硯台、燭台）、兩側書架、坐墊。 */
function furnishSutra({ g, mat, box, shadow, B, W, zBack }) {
  // 心經（玄奘譯，公版）直幅
  const lines = ['觀自在菩薩', '行深般若波羅蜜多時', '照見五蘊皆空', '度一切苦厄', '心無罣礙', '無有恐怖'];
  lines.forEach((t, i) => {
    const p = textPlane(t, 3.0, { vertical: true, bg: '#efe4c8', fg: '#2a1a10', size: 96, weight: 600 });
    p.position.set(1.9 - i * 0.62, B + 2.4, zBack + 0.06);
    g.add(p);
  });
  g.add(
    box(4.4, 0.12, 0.1, mat.wood)
      .translateY(B + 4.0)
      .translateZ(zBack + 0.08),
  );
  g.add(
    box(4.4, 0.12, 0.1, mat.wood)
      .translateY(B + 0.85)
      .translateZ(zBack + 0.08),
  );
  // 兩側書架
  const bookM = [0x7b161b, 0x24484a, 0x3b2414, 0xc9a25a, 0x2b3a5c].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }),
  );
  for (const s of [-1, 1]) {
    const shelf = new THREE.Group();
    shelf.add(box(0.4, 3.2, 1.8, mat.wood).translateY(1.6));
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 7; k++) {
        const bk = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.55, 0.16), bookM[(r * 7 + k) % bookM.length]);
        bk.position.set(0.25, 0.55 + r * 0.75, -0.75 + k * 0.24);
        shelf.add(bk);
      }
    shelf.position.set(s * (W / 2 - 0.55), B, zBack + 2.2);
    shelf.rotation.y = s > 0 ? Math.PI : 0;
    g.add(shelf);
  }
  const tz = zBack + 2.4;
  const desk = new THREE.Group();
  desk.add(shadow(box(2.6, 0.12, 1.1, mat.wood)).translateY(0.55));
  for (const [dx, dz] of [
    [-1.15, -0.45],
    [1.15, -0.45],
    [-1.15, 0.45],
    [1.15, 0.45],
  ])
    desk.add(box(0.1, 0.5, 0.1, mat.wood).translateX(dx).translateY(0.25).translateZ(dz));
  const paper = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.6),
    new THREE.MeshStandardMaterial({ color: 0xf6efdc, roughness: 0.9 }),
  );
  paper.rotation.x = -Math.PI / 2;
  paper.position.set(0, 0.62, 0.05);
  const ink = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.05, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: 0.3 }),
  );
  ink.position.set(0.8, 0.64, -0.1);
  const brush = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.018, 0.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x8a5a2a }),
  );
  brush.rotation.z = Math.PI / 2;
  brush.position.set(0.55, 0.64, 0.25);
  desk.add(paper, ink, brush);
  const flames = [];
  for (const s of [-1, 1]) {
    desk.add(
      new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.24, 10),
        new THREE.MeshStandardMaterial({ color: 0xc21f1a }),
      )
        .translateX(s * 1.05)
        .translateY(0.73)
        .translateZ(-0.3),
    );
    const f = glow(0xffb050, 0.35, 0.95);
    f.position.set(s * 1.05, 0.92, -0.3);
    desk.add(f);
    flames.push(f);
  }
  desk.position.set(0, B, tz - 0.6);
  desk.traverse((n) => {
    n.userData.room = 'sutra';
  });
  g.add(desk);
  g.add(
    shadow(
      new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.44, 0.14, 24),
        new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.85 }),
      ),
    )
      .translateY(B + 0.07)
      .translateZ(tz + 0.4),
  );
  return { god: desk, tz, cz: tz + 1.75, cushionsLocal: [], flames };
}

/**
 * @param {{ scene: THREE.Scene, mat: any, x: number, z: number, rot: number,
 *   shadow: (m: THREE.Object3D, cast?: boolean, recv?: boolean) => THREE.Object3D,
 *   warm: (x:number,y:number,z:number,i?:number,d?:number,c?:number) => void }} o
 */
export function createShrine(o) {
  const { scene, mat, x, z, rot, shadow, warm } = o;
  const W = o.w ?? 9.6;
  const D = o.d ?? 8.4;
  const H = o.h ?? 4.6;
  const plaqueText = o.plaque ?? '月老殿';
  const outer = o.outer ?? ['願天下有情人', '都成了眷屬'];
  const inner = o.inner ?? ['良緣天成', '和合美滿'];
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
  const plaque = textPlane(plaqueText, o.plaqueSize ?? 1.15, {
    bg: '#130905',
    fg: '#f3d691',
    border: '#b88a3c',
    size: 150,
  });
  plaque.position.set(0, B + H - 0.95, 0.36);
  g.add(plaque);
  // 正面兩根柱子上的對聯（朝外）
  for (const [cx, txt] of [
    [-W / 2 + 0.3, outer[0]],
    [W / 2 - 0.3, outer[1]],
  ]) {
    // 對聯貼在最外側兩根柱子上，別擋住看進殿裡的視線
    const c = textPlane(txt, 2.3, { vertical: true, bg: '#7b161b', fg: '#f6e4b6', size: 100, weight: 700 });
    c.position.set(cx, B + 2.0, 0.4);
    g.add(c);
  }

  // ---------- 殿內 ----------
  const zBack = -D + 0.15;
  /** 月老殿／大殿：屏風、神台與坐像、供桌、蒲團、紅線架。 */
  function furnishAltar() {
    // 屏風
    // 屏風比例 1.6:1（AI 生成的屏風圖就是這個比例）；殿大屏風跟著大，但不頂到天花
    const sh2 = Math.min(H - 0.9, 4.7);
    const sw = Math.min(W - 3.2, sh2 * 1.6);
    const sh = sw / 1.6;
    const scr = new THREE.Mesh(
      new THREE.PlaneGeometry(sw, sh),
      new THREE.MeshStandardMaterial({ map: screenTex(), roughness: 0.5 }),
    );
    scr.position.set(0, B + 0.3 + sh / 2, zBack + 0.05);
    g.add(scr);
    // 有 AI 畫好的屏風圖就換上；載不到就留著 canvas 畫的
    if (o.screen)
      new THREE.TextureLoader().load(o.screen, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        scr.material.map = tex;
        scr.material.needsUpdate = true;
      });
    g.add(
      box(sw + 0.3, 0.18, 0.12, mat.gold)
        .translateY(B + 0.4 + sh)
        .translateZ(zBack + 0.08),
    );
    // 兩側直聯
    for (const [cx, txt] of [
      [-(sw / 2 + 0.55), inner[0]],
      [sw / 2 + 0.55, inner[1]],
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
    const god = statue(mat, !!o.gold);
    god.position.set(0, B + 0.97, zBack + 1.1);
    god.scale.setScalar(o.statueScale ?? 1.05);
    // 有 AI 生成的神像模型（GLB）就換上：量好高度、底部貼齊神台、置中；載不到就留著拼出來的像
    if (o.model)
      new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(o.model, (gltf) => {
        const m = gltf.scene;
        m.rotation.y = o.modelRotY ?? 0; // 模型原本面向哪邊不一定，轉到朝殿門
        m.updateMatrixWorld(true);
        const bb = new THREE.Box3().setFromObject(m);
        const size = bb.getSize(new THREE.Vector3());
        const k = 2.9 / (size.y || 1);
        m.scale.setScalar(k);
        const c = bb.getCenter(new THREE.Vector3());
        m.position.set(-c.x * k, -bb.min.y * k, -c.z * k);
        m.traverse((n) => {
          n.userData.room = god.userData.room;
          if (!n.isMesh) return;
          n.castShadow = true;
          // 大殿的是鎏金像：同一個模型，表面改成金屬金（保留原本的貼圖明暗）
          if (o.gold && n.material) {
            n.material = n.material.clone();
            n.material.color = new THREE.Color(0xffcf6a);
            n.material.metalness = 0.75;
            n.material.roughness = 0.35;
          }
        });
        while (god.children.length) god.remove(god.children[0]);
        god.add(m);
      });
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
    const apron = textPlane(o.apron ?? '有求必應', 0.55, {
      bg: '#8a1a1a',
      fg: '#f3d691',
      size: 110,
      weight: 700,
    });
    apron.position.set(0, B + 0.55, tz + 0.52);
    g.add(apron);
    // 燭台（燭火會微微亮）
    const joss = []; // 香爐裡的三炷香（只有預設的殿有）
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
    // 小香爐（三炷香：靜心上香時會慢慢燒短，見 burn()）
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
      joss.push({ stick, tip, bottom: B + 1.45 - 0.225 });
    }
    // 籤筒
    const tube = shadow(
      new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.12, 0.38, 14),
        new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.6 }),
      ),
    );
    tube.position.set(1.15, B + 1.25, tz + 0.25);
    if (o.tube !== false) g.add(tube);
    for (let i = 0; i < (o.tube === false ? 0 : 9); i++) {
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
        new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.26, 0.03), tagM)
          .translateX(tx)
          .translateY(2 - len - 0.13),
      );
    }
    rack.position.set(W / 2 - 1.3, B, -D + 4.2);
    rack.rotation.y = -Math.PI / 2;
    if (o.rack !== false) g.add(rack);
    return { god, tz, cz, cushionsLocal, flames, joss };
  }
  const furnish = o.kind === 'tarot' ? furnishTarot : o.kind === 'sutra' ? furnishSutra : furnishAltar;
  const {
    god,
    tz,
    cz,
    cushionsLocal,
    flames,
    joss = [],
  } = furnish({ g, mat, box, shadow, B, W, D, H, zBack, o });

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
    ...(o.kind ? [] : [[W / 2 - 1.6, W / 2 - 0.3, -D + 3, -D + 5.4]]),
  ];
  // 殿內要亮：一盞大的暖光照全殿，一盞打在神像臉上
  // 不交給 warm()：那些燈白天會調暗，殿內白天也要亮
  for (const [lx, ly, lz, i, d, c] of [
    [0, 3.6, -D / 2 + 1, 34, 14, 0xffd8b0],
    [0, 3.2, tz + 1.6, 12, 7, 0xffe6c8],
  ]) {
    const l = new THREE.PointLight(c, i, d, 1.6);
    l.position.copy(toWorld(lx, ly, lz));
    scene.add(l);
  }
  void warm;

  let t = 0;
  // 上香：供桌小香爐升起一陣煙（白色光點往上飄、散開）
  const smokes = [];
  // 靜心上香：香在 total 秒內燒到剩四分之一，期間一直冒煙；燒完兩秒後換上新的
  // style：plain 清香（白煙）／lotus 九品金蓮香（金煙、金色花瓣從上方飄落）／aurora 七彩極光香（煙色慢慢換）
  let burning = null; // { left, total, puff, rest, style, petal }
  const petals = [];
  const petalAt = toWorld(0, B + 4.2, tz + 1.2);
  const setJoss = (k) => {
    for (const j of joss) {
      const h = 0.45 * (1 - 0.75 * k);
      j.stick.scale.y = h / 0.45;
      j.stick.position.y = j.bottom + h / 2;
      j.tip.position.y = j.bottom + h + 0.005;
    }
  };
  const smokeColor = () => {
    if (burning?.style === 'lotus') return 0xffd27a;
    if (burning?.style === 'aurora') return new THREE.Color().setHSL((t * 0.08) % 1, 0.8, 0.7).getHex();
    return 0xf2ece0;
  };
  const dropPetal = () => {
    const p = glow(Math.random() < 0.5 ? 0xffd27a : 0xffb0c0, 0.16, 0.9);
    p.position.set(petalAt.x + rand(-1.6, 1.6), petalAt.y + rand(0, 0.6), petalAt.z + rand(-1, 1));
    scene.add(p);
    petals.push({ p, age: 0, sway: rand(6.28), vx: rand(-0.15, 0.15) });
  };
  const puff = () => {
    const s2 = glow(smokeColor(), 0.3, 0.5);
    s2.position.copy(smokeAt);
    scene.add(s2);
    smokes.push({ s: s2, age: 0 });
  };
  const smokeAt = toWorld(0, B + 1.7, tz);
  return {
    /** 殿內不能走的地方。 */
    /** 台基上的高度（站在殿裡就是台基高）；不在台基上回 null。蒲團上再高一點。 */
    floorY(wx, wz, kneeling) {
      const [lx, lz] = toLocal(wx, wz);
      if (lx < -W / 2 - 0.6 || lx > W / 2 + 0.6 || lz < -D - 0.4 || lz > 1.6) return null;
      // 前面的兩級台階：一半高
      let y = lz > 0.6 ? B / 2 : B;
      if (kneeling)
        for (const [cx, cz2] of cushionsLocal) if (Math.hypot(lx - cx, lz - cz2) < 0.5) y = B + 0.14;
      return y;
    },
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
    /** 在供桌前上香：冒一陣煙。 */
    offer() {
      for (let i = 0; i < 8; i++) {
        const s = glow(0xf2ece0, 0.3, 0.5);
        s.position.copy(smokeAt);
        scene.add(s);
        smokes.push({ s, age: -i * 0.25 });
      }
    },
    /** 靜心上香：香慢慢燒 sec 秒。回傳 stop()，提早結束時呼叫。 */
    burn(sec, style = 'plain') {
      burning = { left: sec, total: sec, puff: 0, rest: 0, style, petal: 0 };
      return () => {
        if (burning) burning.left = Math.min(burning.left, 0);
      };
    },
    /** 靜心中換一種香（只換樣子）。 */
    burnStyle(style) {
      if (burning) burning.style = style;
    },
    /** 供桌前（上香、求籤時站的地方）。 */
    altarFront: toWorld(0, 0, tz + 1.0),
    update(dt) {
      t += dt;
      if (burning) {
        if (burning.left > 0) {
          burning.left -= dt;
          setJoss(1 - Math.max(0, burning.left) / burning.total);
          burning.puff -= dt;
          if (burning.puff <= 0) {
            puff();
            burning.puff = 0.4;
          }
          if (burning.style === 'lotus') {
            burning.petal -= dt;
            if (burning.petal <= 0) {
              dropPetal();
              burning.petal = 0.18;
            }
          }
        } else {
          burning.rest += dt;
          if (burning.rest > 2) {
            setJoss(0);
            burning = null;
          }
        }
      }
      for (let i = petals.length - 1; i >= 0; i--) {
        const q = petals[i];
        q.age += dt;
        q.p.position.y -= dt * 0.6;
        q.p.position.x += Math.sin(q.age * 2 + q.sway) * dt * 0.3 + q.vx * dt;
        q.p.material.opacity = Math.max(0, 0.9 * (1 - q.age / 6));
        if (q.age > 6 || q.p.position.y < B) {
          scene.remove(q.p);
          petals.splice(i, 1);
        }
      }
      for (let i = smokes.length - 1; i >= 0; i--) {
        const m = smokes[i];
        m.age += dt;
        if (m.age < 0) {
          m.s.visible = false;
          continue;
        }
        m.s.visible = true;
        m.s.position.y = smokeAt.y + m.age * 0.55;
        m.s.position.x = smokeAt.x + Math.sin(m.age * 2 + i) * 0.12 * m.age;
        m.s.scale.setScalar(0.3 + m.age * 0.25);
        m.s.material.opacity = Math.max(0, 0.5 * (1 - m.age / 3.5));
        if (m.age > 3.5) {
          scene.remove(m.s);
          smokes.splice(i, 1);
        }
      }
      for (const [i, f] of flames.entries())
        f.scale.setScalar(0.42 + Math.sin(t * 9 + i * 2) * 0.04 + Math.sin(t * 23 + i) * 0.02);
    },
  };
}
