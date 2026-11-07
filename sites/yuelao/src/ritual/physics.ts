// 搖籤 / 掉籤 / 擲筊物理引擎（自搖籤原型 1:1 移植，巡演模式已刪）。
//
// 架構：命令式引擎 + React 只管屏切換以外的狀態。引擎直接寫 DOM
// （transform、提示文案、杯面），物理量放 ref/state，不經 React state；
// React state 只管大類選擇、判詞卡內容（onVerdict 回調）、按鈕顯隱。
// 儀式鐵律見 DESIGN.md —— 搖前不露籤、落定即凍結、笑筊兩凸陰筊兩平。

import { clack, knock, thud, vibrate, warmAudio } from './audio';
import { STICKS, type Stick } from './sticks';

export type RitualCat = 'him' | 'single' | 'reunion';
export type JiaoOutcome = 'sheng' | 'xiao' | 'yin';

/** 引擎會寫進 DOM 的全部文案（由 Ritual.tsx 從 Paraglide 消息組裝，隨語言走）。 */
export interface RitualStrings {
  shakeTitle: string;
  shakeSubInit: string;
  shakeHint0: string;
  shakeHint1: string;
  shakeHint2: string;
  shakeHint3: string;
  shakeHintStuck: string;
  shakeHintDropped: string;
  shakeSub0: string;
  shakeSub0Press: string;
  shakeSub1: string;
  shakeSub2: string;
  shakeSub3: string;
  shakeSubStuck: string;
  shakeSubStuckPress: string;
  energy0: string;
  energy: (pct: number) => string;
  energyPress: (pct: number, sec: number) => string;
  jiaoWaiting: string;
  jiaoFlying: string;
  jiaoShengName: string;
  jiaoShengText: string;
  jiaoXiaoName: string;
  jiaoXiaoText: string;
  jiaoYinName: string;
  jiaoYinText: string;
  sensorOff: string;
  sensorDenied: string;
  sensorNoDevice: string;
  sensorNoPerm: string;
  sensorOnToast: string;
}

export interface RitualImages {
  /** 筊杯平面圖（直線金線那面）。 */
  cupFlat: string;
  /** 筊杯凸面圖（弧線金線那面）。 */
  cupConvex: string;
}

export interface RitualEngineOptions {
  strings: RitualStrings;
  images: RitualImages;
  /** 當前選中的大類（React state 的鏡像，開搖時讀）。 */
  getCat: () => RitualCat | null;
  /** 聖筊後顯示判詞卡：React 據此渲染卡片並記一筆 localStorage。 */
  onVerdict: (stick: Stick, cat: RitualCat) => void;
}

type MotionPerm = 'unknown' | 'granted' | 'denied' | 'na';

interface RitualState {
  cat: RitualCat | null;
  stick: Stick | null;
  energy: number;
  drive: number;
  rise: number;
  inst: number;
  instEff: number;
  instPeak: number;
  stuck: boolean;
  stuckReleased: boolean;
  stuckAt: number;
  stuckT: number;
  stuckPressMs: number;
  hintTier: number;
  pressBoostUntil: number;
  shaking: boolean;
  pressHold: boolean;
  lastMag: number | null;
  tubeRot: number;
  tubeX: number;
  tubeY: number;
  tubeVelRot: number;
  tubeVelX: number;
  tubeVelY: number;
  shakeAmp: number;
  shakePh: number;
  rafId: number;
  _pt: number;
  _egShown: number;
  lastStrongVibT: number;
  lastClackT: number;
  jiaoBusy: boolean;
  jiaoDone: boolean;
  _jiaoPeak: number;
  _jiaoSched: boolean;
  motionPerm: MotionPerm;
  motionSeen: boolean;
  tiltG: number;
  tiltB: number;
  drawnIdx: number[];
  fallToken: number;
  _fallWatchdog: ReturnType<typeof setTimeout> | undefined;
  threwOnce: boolean;
  _ppShown: number;
  _ppHold: boolean;
}

/** 筊杯元素上由引擎維護的落點姿態（重擲從落點起步，不許瞬移回中心）。 */
interface CupEl extends HTMLElement {
  _face?: boolean;
  _shownFace?: boolean;
  _restX?: number;
  _restAngRad?: number;
  _restZ?: number;
}

const SHAKE_THRESHOLD = 4.2;

function springStep(cur: number, vel: number, target: number, dt: number): [number, number] {
  const acc = 420 * (target - cur) - 34 * vel;
  vel += acc * dt;
  cur += vel * dt;
  return [cur, vel];
}

export class RitualEngine {
  private root: HTMLElement;
  private strings: RitualStrings;
  private images: RitualImages;
  private getCat: () => RitualCat | null;
  private onVerdict: (stick: Stick, cat: RitualCat) => void;
  private state: RitualState;
  private lastThrowT = 0;
  private lastJiaoMag: number | null = null;
  private parQueued = false;
  private disposed = false;
  private listeners: Array<() => void> = [];

  constructor(root: HTMLElement, options: RitualEngineOptions) {
    this.root = root;
    this.strings = options.strings;
    this.images = options.images;
    this.getCat = options.getCat;
    this.onVerdict = options.onVerdict;
    this.state = {
      cat: null,
      stick: null,
      energy: 0,
      drive: 0,
      rise: 0,
      inst: 0,
      instEff: 0,
      instPeak: 0,
      stuck: false,
      stuckReleased: false,
      stuckAt: Infinity,
      stuckT: 0,
      stuckPressMs: 0,
      hintTier: 0,
      pressBoostUntil: 0,
      shaking: false,
      pressHold: false,
      lastMag: null,
      tubeRot: 0,
      tubeX: 0,
      tubeY: 0,
      tubeVelRot: 0,
      tubeVelX: 0,
      tubeVelY: 0,
      shakeAmp: 0,
      shakePh: 0,
      rafId: 0,
      _pt: 0,
      _egShown: -1,
      lastStrongVibT: 0,
      lastClackT: 0,
      jiaoBusy: false,
      jiaoDone: false,
      _jiaoPeak: 0,
      _jiaoSched: false,
      motionPerm: 'unknown',
      motionSeen: false,
      tiltG: 0,
      tiltB: 45,
      drawnIdx: [],
      fallToken: 0,
      _fallWatchdog: undefined,
      threwOnce: false,
      _ppShown: -1,
      _ppHold: false,
    };
    // 驗收探針：讀取能量狀態（非巡演模式）。
    (window as unknown as { __yqState?: RitualState }).__yqState = this.state;
  }

  private $(id: string): HTMLElement {
    const el = this.root.querySelector<HTMLElement>(`#${id}`);
    if (!el) throw new Error(`ritual element missing: #${id}`);
    return el;
  }

  private on(
    target: Window | Document | HTMLElement,
    type: string,
    handler: (e: never) => void,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, handler as EventListener, options);
    this.listeners.push(() => target.removeEventListener(type, handler as EventListener, options));
  }

  mount(): void {
    // 全頁禁止文字選取/拖曳選取（限儀式頁內）：手勢（尤其擲筊上滑）永遠不該拖出藍色選區。
    this.on(this.root, 'selectstart', (e: Event) => e.preventDefault());
    this.on(this.root, 'dragstart', (e: Event) => e.preventDefault());

    this.on(this.$('to-prep'), 'click', () => this.show('scr-prep'));
    this.on(this.$('back-home'), 'click', () => this.show('scr-home'));
    this.on(this.$('start-shake'), 'click', () => this.startShake());
    this.on(this.$('throw-jiao'), 'click', () => this.throwJiao());
    this.on(this.$('to-verdict'), 'click', () => this.showVerdict());
    this.on(this.$('jiao-restart'), 'click', () => this.goHome());
    this.on(this.$('jiao-alt'), 'click', () => this.show('scr-home'));
    this.on(this.$('again-btn'), 'click', () => this.show('scr-home'));
    // Toast 點按立即消失（CSS 須給它 pointer-events: auto）。
    this.on(this.$('toast'), 'click', () => this.hideToast());
    this.on(this.$('sensor-btn'), 'click', () => this.requestSensor());

    const pb = this.$('press-btn');
    this.on(pb, 'pointerdown', (e: PointerEvent) => this.pressOn(e));
    this.on(window, 'pointerup', () => this.pressOff());
    this.on(window, 'pointercancel', () => this.pressOff());
    this.on(pb, 'contextmenu', (e: Event) => e.preventDefault());

    // 擲筊上滑甩動兜底。
    const arena = this.$('jiao-arena');
    let sy0: number | null = null;
    let st0 = 0;
    const pd = (y: number): void => {
      sy0 = y;
      st0 = performance.now();
    };
    const pm = (y: number): void => {
      if (sy0 === null) return;
      const dy = Math.max(-10, Math.min(14, (y - sy0) * 0.22));
      this.setCupSink(dy);
    };
    const pu = (y: number): void => {
      if (sy0 === null) return;
      const dy = y - sy0;
      const dt = Math.max(1, performance.now() - st0);
      sy0 = null;
      const v = -dy / dt; // 上甩速度 px/ms
      if (dy < -40 && v > 0.3) this.throwJiao(Math.max(0.25, Math.min(1, (v - 0.3) / 1.5)));
      else this.setCupSink(0);
    };
    this.on(arena, 'pointerdown', (e: PointerEvent) => pd(e.clientY));
    this.on(arena, 'pointermove', (e: PointerEvent) => pm(e.clientY));
    this.on(arena, 'pointerup', (e: PointerEvent) => pu(e.clientY));
    this.on(arena, 'pointercancel', () => {
      sy0 = null;
      this.setCupSink(0);
    });
    this.on(
      arena,
      'touchstart',
      (e: TouchEvent) => {
        const t = e.touches[0];
        if (t) pd(t.clientY);
      },
      { passive: true },
    );
    // 手勢進行中攔下瀏覽器的捲動/選取接管：上滑只屬於擲筊。
    this.on(
      arena,
      'touchmove',
      (e: TouchEvent) => {
        if (sy0 !== null) {
          e.preventDefault();
          const t = e.touches[0];
          if (t) pm(t.clientY);
        }
      },
      { passive: false },
    );
    this.on(arena, 'touchend', (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (t) pu(t.clientY);
    });
  }

  unmount(): void {
    this.disposed = true;
    this.state.shaking = false;
    cancelAnimationFrame(this.state.rafId);
    clearTimeout(this.state._fallWatchdog);
    this.state.fallToken += 1;
    for (const remove of this.listeners) remove();
    this.listeners = [];
    window.removeEventListener('devicemotion', this.onMotionBound);
    window.removeEventListener('devicemotion', this.onJiaoMotionBound);
    window.removeEventListener('deviceorientation', this.onOrientBound);
  }

  private show(id: string): void {
    // Toast 屬於當下那一刻：切屏時清掉，不許殘留到下一屏、蓋住下一屏的按鈕。
    this.hideToast();
    for (const s of this.root.querySelectorAll('.screen')) s.classList.remove('active');
    this.$(id).classList.add('active');
    window.scrollTo(0, 0);
    // 切頁時清掉任何殘留的文字選取，避免藍色選區跨頁不消失。
    if (window.getSelection) {
      const sel = window.getSelection();
      if (sel?.removeAllRanges) sel.removeAllRanges();
    }
  }

  /** 底部短提示（分享流程也用它）：3 秒自動消失、點按立即消失、切屏時清掉。 */
  toast(msg: string): void {
    const t = this.$('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.hideToast(), 3000);
  }

  private hideToast(): void {
    clearTimeout(this.toastTimer);
    this.toastTimer = undefined;
    this.$('toast').classList.remove('show');
  }

  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  /* ============ 搖籤輸入 ============
     輸入①：devicemotion——加速度變化量超過 SHAKE_THRESHOLD 才映射為
     瞬時強度 inst，靜置與微小手抖完全不貢獻。
     輸入②：長按按住期間 instEff 下限 0.62，鬆開即回到只衰減。
     能量只來自這兩個真實輸入的持續積分；無輸入時 inst 在約 200ms
     內衰減歸零、能量只扣不加——靜置永遠出不了籤。 */
  private onMotionBound = (e: DeviceMotionEvent): void => this.onMotion(e);
  private onJiaoMotionBound = (e: DeviceMotionEvent): void => this.onJiaoMotion(e);
  private onOrientBound = (e: DeviceOrientationEvent): void => this.onOrient(e);

  private onMotion(e: DeviceMotionEvent): void {
    const state = this.state;
    if (!state.shaking) return;
    const a = e.accelerationIncludingGravity;
    if (!a || a.x === null || a.y === null || a.z === null) return;
    const mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
    state.motionSeen = true;
    if (state.lastMag !== null) {
      const d = Math.abs(mag - state.lastMag);
      if (d > SHAKE_THRESHOLD) {
        const mapped = Math.min(1, (d - SHAKE_THRESHOLD) / 24);
        state.inst = Math.max(state.inst, mapped);
        state.instPeak = Math.max(state.instPeak, mapped);
        state.shakeAmp = Math.min(1.5, state.shakeAmp + mapped * 1.1);
        if (mapped > 0.62) {
          const now = performance.now();
          if (now - state.lastStrongVibT > 150) {
            state.lastStrongVibT = now;
            vibrate(Math.round(10 + mapped * 10));
          }
        }
        // stuck 的頂出判定統一在 tick 內做（鎖定 450ms 後，任一
        // >0.55 的新峰值即頂出，沒有隱藏的布防條件），這裡只記峰值。
      }
    }
    state.lastMag = mag;
  }

  /** 陰筊「明天再來」是結束：回網站首頁，不是回選類頁。 */
  private goHome(): void {
    window.location.assign('/');
  }

  private startShake(): void {
    warmAudio();
    let begun = false;
    const begin = (): void => {
      if (begun) return;
      begun = true;
      window.addEventListener('devicemotion', this.onMotionBound);
      window.addEventListener('devicemotion', this.onJiaoMotionBound);
      if (window.DeviceOrientationEvent) window.addEventListener('deviceorientation', this.onOrientBound);
      this.startShakePhase();
    };
    const perms: Array<Promise<unknown>> = [];
    const motionReq = (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> })
      .requestPermission;
    if (typeof DeviceMotionEvent !== 'undefined' && typeof motionReq === 'function') {
      perms.push(
        motionReq()
          .then((r: string) => {
            this.state.motionPerm = r === 'granted' ? 'granted' : 'denied';
          })
          .catch(() => {
            this.state.motionPerm = 'denied';
          }),
      );
    } else {
      this.state.motionPerm = 'na';
    }
    const orientReq = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
      .requestPermission;
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof orientReq === 'function') {
      perms.push(orientReq().catch(() => undefined));
    }
    if (perms.length) Promise.all(perms).then(begin).catch(begin);
    else begin();
  }

  private startShakePhase(): void {
    const state = this.state;
    const cat = this.getCat();
    if (!cat) return;
    state.cat = cat;
    // 新一輪：作廢上一輪可能還活著的掉籤迴圈與切屏計時——
    // 上一支落定的籤在被本輪重置前，誰都不許再動它。
    state.fallToken += 1;
    clearTimeout(state._fallWatchdog);
    this.show('scr-shake');
    state.energy = 0;
    state.drive = 0;
    state.rise = 0;
    state.inst = 0;
    state.instEff = 0;
    state.instPeak = 0;
    state.stuck = false;
    state.stuckReleased = false;
    state.stuckT = 0;
    state.stuckPressMs = 0;
    state.hintTier = 0;
    state.pressBoostUntil = 0;
    // 本輪卡點：約 65% 的輪次在 energy 85–92 之間安排一次卡籤，
    // 其餘輪次 stuckAt = Infinity，整輪順順頂出——不再每抽必卡。
    state.stuckAt = Math.random() < 0.65 ? 85 + Math.random() * 7 : Infinity;
    // 本輪的籤在開搖時就定下——但只是內部狀態：主籤全程無字，
    // 籤號要等掉籤落定後才揭示。同一會話內不重複出籤：抽過的籤先
    // 排除，100 支全抽過才重置。
    if (state.drawnIdx.length >= STICKS.length) state.drawnIdx = [];
    const pool: number[] = [];
    for (let di = 0; di < STICKS.length; di++) if (!state.drawnIdx.includes(di)) pool.push(di);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    // pool 按構造非空（drawnIdx 滿 100 即重置），守衛只為滿足型別檢查。
    if (pick === undefined) return;
    state.drawnIdx.push(pick);
    state.stick = STICKS[pick] ?? null;
    const fsNum = this.$('fs-num');
    fsNum.textContent = '';
    // 還原落定幀寫入的橫排反補（下一支籤從豎排預設開始）。
    fsNum.style.writingMode = '';
    fsNum.style.width = '';
    fsNum.style.whiteSpace = '';
    fsNum.style.transform = '';
    state._ppShown = -1;
    state._ppHold = false;
    this.$('pp-fill').style.width = '0%';
    this.$('pp-text').textContent = this.strings.energy0;
    state.lastMag = null;
    state.tubeRot = 0;
    state.tubeX = 0;
    state.tubeY = 0;
    state.tubeVelRot = 0;
    state.tubeVelX = 0;
    state.tubeVelY = 0;
    state.shakeAmp = 0;
    state.shakePh = 0;
    state.lastStrongVibT = 0;
    state.pressHold = false;
    state.shaking = true;
    state._pt = performance.now();
    state._egShown = -1;
    this.$('scr-shake').style.setProperty('--eg', '0');
    this.$('scr-shake').style.setProperty('--drv', '0');
    const hero = this.$('hero-stick');
    hero.style.transform = 'rotate(-2deg) translateY(46px)';
    hero.style.opacity = '0';
    this.$('falling-stick').classList.remove('show');
    this.$('falling-stick').style.transform = '';
    this.$('land-shadow').classList.remove('show');
    this.$('puff1').classList.remove('show');
    this.$('puff2').classList.remove('show');
    this.$('stage').classList.remove('climax');
    this.$('shake-hint').textContent = this.strings.shakeTitle;
    this.$('shake-sub').textContent = this.strings.shakeSubInit;
    cancelAnimationFrame(state.rafId);
    state.rafId = requestAnimationFrame((now) => this.tick(now));
  }

  /* ============ 搖籤主循環 ============
     ① 筒身姿態：傾斜部分 target 完全由 DeviceOrientation 當幀值決定
        （gamma→傾斜/橫移、beta−45→縱移），二階彈簧積分 k=420、c=34
        （ζ≈0.83）；搖動部分由感應脈衝注入的耦合振盪疊加。
     ② 籤群抖動與竹籤聲：振幅/密度/音量全部綁 inst（tau=90ms 衰減）。
     ③ 主籤升起：dE/dt = instEff×52 − 8（instEff>0.18 時），否則 −13/s。
     ④ 臨界頓挫：卡點 stuckAt 只在本輪有安排時存在（85–92、約 65%
        輪次），energy 到達即觸發 stuck 一次，封頂 stuckAt+3、籤尖探出
        後回沉到 stuckAt−4 小幅顫動卡住。釋放沒有任何隱藏條件：
        鎖定 450ms 後，用戶只要繼續用力——真搖出現任一 mapped>0.55
        的新峰值，或長按在卡住期間連續按住累積 600ms——即頂出。 */
  private tick(now: number): void {
    const state = this.state;
    if (!state.shaking || this.disposed) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - state._pt) / 1000));
    state._pt = now;

    // inst 指數衰減：tau=90ms，停搖約 200ms 內聲與抖同步衰減到近零。
    state.inst *= Math.exp(-dt / 0.09);
    if (state.inst < 0.005) state.inst = 0;
    let pressInst = 0;
    if (state.pressHold) pressInst = now < state.pressBoostUntil ? 0.95 : 0.62;
    const instEff = Math.max(state.inst, pressInst);
    state.instEff = instEff;
    state.drive = instEff;

    // 能量：持續強度的時間積分，速率即時隨 instEff 變化。
    const stuckGate = state.stuck && !state.stuckReleased;
    if (instEff > 0.18) state.energy += (instEff * 52 - 8) * dt;
    else state.energy -= 13 * dt;
    if (stuckGate) state.energy = Math.min(state.energy, state.stuckAt + 3);
    state.energy = Math.max(0, Math.min(100, state.energy));

    // 臨界頓挫觸發：本輪有卡點才觸發，一輪最多一次。
    if (!state.stuck && state.energy >= state.stuckAt) {
      state.stuck = true;
      state.stuckT = now;
      state.energy = state.stuckAt;
      state.instPeak = 0;
      state.stuckPressMs = 0;
      knock(0.18);
      vibrate(30);
    }
    // 頂出條件（用戶看得見的規則：卡住後繼續用力就出）。
    if (state.stuck && !state.stuckReleased) {
      if (state.pressHold) state.stuckPressMs += dt * 1000;
      else state.stuckPressMs = 0;
      if (now - state.stuckT >= 450 && (state.instPeak > 0.55 || state.stuckPressMs >= 600)) {
        state.stuckReleased = true;
        if (state.pressHold) state.pressBoostUntil = now + 450;
        knock(0.22);
        vibrate(24);
      }
    }

    // 主籤升起：rise 先經過 0.94 倍 + 正弦脈衝整形，導數週期性放慢/
    // 加快，形成「升—頓—升」；左右擺與旋轉共用筒身 shakePh。
    // stuck 時目標仍回沉到 84 附近卡住顫動。
    let riseTarget = state.energy;
    if (stuckGate) riseTarget = state.stuckAt - 4 + Math.sin((now - state.stuckT) * 0.03) * 1.4;
    const risePulse = Math.sin(Math.max(0, Math.min(100, riseTarget)) * 0.22);
    const riseShownTarget = riseTarget * 0.94 + risePulse * 3.1 * (instEff > 0.18 ? 1 : 0.3);
    state.rise += (riseShownTarget - state.rise) * Math.min(1, dt * 7.5);
    const hero = this.$('hero-stick');
    const heroPhase = state.shakePh - 0.65;
    const heroSway = Math.sin(heroPhase) * (1.6 + instEff * 4.4);
    const heroBob = Math.cos(heroPhase) * instEff * 2.4;
    const heroLean = 5.2 * Math.exp(-(((state.rise - 74) / 15) ** 2));
    const tremorRot = Math.sin(heroPhase) * (1.4 + instEff * 3.1) + state.tubeVelRot * 0.008;
    const jitY = (Math.random() - 0.5) * instEff * 1.6;
    const jitX = (Math.random() - 0.5) * instEff * 1.2;
    // 外露封頂：升起位移不超過籤身高度的 55%。
    const heroH = hero.offsetHeight || 180;
    const upPx = Math.min(state.rise * 0.46, heroH * 0.55);
    // 主籤出場時機：開搖前完全不露——透明、且沉回籤群裡 46px；
    // 搖動累積出 rise 後才自群中浮現（rise 3→15 之間淡入並升起）。
    const heroVis = Math.max(0, Math.min(1, (state.rise - 3) / 12));
    hero.style.opacity = heroVis.toFixed(2);
    const sinkPx = (1 - heroVis) * 46;
    hero.style.transform = `translate(${(heroSway + jitX).toFixed(1)}px,${(-upPx + heroBob + jitY + sinkPx).toFixed(1)}px) rotate(${(-2 + tremorRot + heroLean).toFixed(2)}deg)`;

    // 簽筒姿態 = 傾斜彈簧（跟手）＋ 搖動耦合振盪（跟搖）。
    if (state.pressHold) state.shakeAmp = Math.max(state.shakeAmp, 0.72 + pressInst * 0.48);
    state.shakeAmp *= Math.exp(-dt / 0.16);
    if (state.shakeAmp < 0.004) state.shakeAmp = 0;
    state.shakePh += dt * (17 + instEff * 9);
    const shRot = Math.sin(state.shakePh) * state.shakeAmp * 7.2;
    const shBob = -Math.abs(Math.cos(state.shakePh)) * state.shakeAmp * 5.6;
    const shSway = Math.cos(state.shakePh * 0.9) * state.shakeAmp * 4.6;
    const g = Math.max(-38, Math.min(38, state.tiltG || 0));
    const b = Math.max(-34, Math.min(34, (state.tiltB || 45) - 45));
    const tRot = g * 0.55;
    const tX = g * 0.5;
    const tY = b * 0.28;
    const s1 = springStep(state.tubeRot, state.tubeVelRot, tRot, dt);
    state.tubeRot = s1[0];
    state.tubeVelRot = s1[1];
    const s2 = springStep(state.tubeX, state.tubeVelX, tX, dt);
    state.tubeX = s2[0];
    state.tubeVelX = s2[1];
    const s3 = springStep(state.tubeY, state.tubeVelY, tY, dt);
    state.tubeY = s3[0];
    state.tubeVelY = s3[1];
    this.$('tube-wobble').style.transform =
      `rotate(${(state.tubeRot + shRot).toFixed(2)}deg) translate(${(state.tubeX + shSway).toFixed(1)}px,${(state.tubeY + shBob).toFixed(1)}px)`;
    const shScale = 1 - Math.abs(state.tubeRot + shRot) * 0.006;
    this.$('tube-shadow').style.transform =
      `translateX(calc(-50% + ${(state.tubeX + shSway) * 1.4}px)) scaleX(${shScale})`;
    this.$('tube-shadow').style.opacity = String(0.85 + instEff * 0.15);

    // 環境亮度：隨能量變亮（取代進度條）。
    const eg = state.energy / 100;
    if (Math.abs(eg - state._egShown) > 0.01) {
      state._egShown = eg;
      this.$('scr-shake').style.setProperty('--eg', eg.toFixed(3));
    }
    this.$('scr-shake').style.setProperty('--drv', instEff.toFixed(3));

    // 竹籤聲：間隔 = 235 − instEff×180 ms（55–235ms），音量隨 instEff。
    if (instEff > 0.1 && now - state.lastClackT > 235 - instEff * 180) {
      clack(0.15 + instEff * 0.9);
      state.lastClackT = now;
      if (Math.random() < instEff * 0.35) {
        const v = 0.3 + instEff * 0.5;
        setTimeout(() => clack(v), 45);
      }
    }

    // 高潮收緊。
    this.$('stage').classList.toggle('climax', state.energy > 80);

    // 進度條：隨 energy 即時走；長按時另以長按升速估算剩餘秒數。
    const ppPct = Math.round(state.energy);
    if (ppPct !== state._ppShown || state.pressHold !== state._ppHold) {
      state._ppShown = ppPct;
      state._ppHold = state.pressHold;
      this.$('pp-fill').style.width = `${ppPct}%`;
      this.$('pp-text').textContent = state.pressHold
        ? this.strings.energyPress(ppPct, Math.max(1, Math.ceil((100 - state.energy) / 24)))
        : ppPct > 0
          ? this.strings.energy(ppPct)
          : this.strings.energy0;
    }

    // 提示文案：檔位只進不退；卡籤期間文案固定，不隨能量跳動。
    const hint = this.$('shake-hint');
    const sub = this.$('shake-sub');
    const tierNow = state.energy < 22 ? 0 : state.energy < 55 ? 1 : state.energy < 82 ? 2 : 3;
    if (tierNow > state.hintTier) state.hintTier = tierNow;
    if (stuckGate) {
      hint.textContent = this.strings.shakeHintStuck;
      sub.textContent = state.pressHold ? this.strings.shakeSubStuckPress : this.strings.shakeSubStuck;
    } else if (state.hintTier === 0) {
      hint.textContent = this.strings.shakeHint0;
      sub.textContent = state.pressHold ? this.strings.shakeSub0Press : this.strings.shakeSub0;
    } else if (state.hintTier === 1) {
      hint.textContent = this.strings.shakeHint1;
      sub.textContent = this.strings.shakeSub1;
    } else if (state.hintTier === 2) {
      hint.textContent = this.strings.shakeHint2;
      sub.textContent = this.strings.shakeSub2;
    } else {
      hint.textContent = this.strings.shakeHint3;
      sub.textContent = this.strings.shakeSub3;
    }

    if (state.energy >= 100) {
      this.dropStick();
      return;
    }
    state.rafId = requestAnimationFrame((n) => this.tick(n));
  }

  private dropStick(): void {
    const state = this.state;
    state.shaking = false;
    cancelAnimationFrame(state.rafId);
    // state.stick 已在 startShakePhase 定下。此刻不揭示籤號：
    // 飛出的籤同樣無字，等 flyStick 落定後才把籤號寫上落地的籤。
    this.$('hero-stick').style.opacity = '0';
    const fs = this.$('falling-stick');
    fs.classList.remove('show');
    void fs.offsetWidth;
    fs.classList.add('show');
    clack(0.8);
    vibrate(30);
    this.$('shake-hint').textContent = this.strings.shakeHintDropped;
    this.$('shake-sub').textContent = '';
    this.flyStick(fs);
    // 切屏不再用固定 2000ms 計時：由 flyStick 在真正凍結的那一幀
    // 清掉本看門狗、並排定 1.5s 後切屏。這裡的 6s 看門狗只是異常
    // 兜底——萬一物理迴圈沒能收尾，先作廢它的後續幀，再切屏。
    clearTimeout(state._fallWatchdog);
    state._fallWatchdog = setTimeout(() => {
      state.fallToken += 1;
      this.showStickScreen();
    }, 6000);
  }

  /* ============ 掉籤物理 ============
     初速與轉速由出籤瞬間的搖動峰值 P 參數化：P 取 instPeak（整段搖籤
     的最強一擊，含臨界頂出那一下），長按頂出則以 0.8 計。g = 2600 px/s²。
     落定即終點（與筊杯同一條鐵律），且是「第一次觸地」就定格：
     橫躺終角（76–94°）在下降末段（距觸地 <0.4s）就由飛行迴圈收斂
     到位；第一次觸地的那一幀，位置與角度一次寫死、迴圈立即結束——
     沒有反彈、沒有 settle、沒有壓扁動畫，落影也在同一幀一次到位。
     橫躺的落點範圍在起飛前就先算好（landMax），飛行中的水平夾限
     直接用它——落地後不許再橫向滑行去「找位置」。 */
  private flyStick(fs: HTMLElement): void {
    const state = this.state;
    const zone = fs.parentElement;
    if (!zone) return;
    const zoneH = zone.offsetHeight;
    const zoneW = zone.offsetWidth;
    const zoneRect = zone.getBoundingClientRect();
    const imgH = fs.offsetHeight || 315;
    const floorY = zoneH - 34 - imgH / 2 + 8;
    let maxX = Math.max(60, zoneW / 2 - 46);
    const landMax = Math.max(30, zoneW / 2 - imgH / 2 + 16);
    if (maxX > landMax) maxX = landMax;
    let P = state.instPeak;
    if (state.pressHold || performance.now() < state.pressBoostUntil + 600) P = Math.max(P, 0.8);
    P = Math.max(0.35, Math.min(1, P));
    const dir = Math.random() < 0.5 ? -1 : 1;
    let x = 0;
    let y = 26;
    let vx = dir * (60 + Math.random() * 130) * (0.6 + P * 0.7);
    let vy = -(880 + P * 620) * (0.9 + Math.random() * 0.25);
    // 峰高封頂：籤頂全程不得越出可視區。
    const peakCap = Math.max(70, zoneRect.top - 24);
    if (Math.abs(vy) ** 2 / (2 * 2600) > peakCap) vy = -Math.sqrt(2 * 2600 * peakCap);
    let ang = -4;
    const om = dir * (5 + Math.random() * 6) * (0.7 + P * 0.6);
    const targetAng = dir * (76 + Math.random() * 18);
    state.fallToken = (state.fallToken || 0) + 1;
    const fallToken = state.fallToken;
    const shadow = this.$('land-shadow');
    const p1 = this.$('puff1');
    const p2 = this.$('puff2');
    shadow.classList.remove('show');
    p1.classList.remove('show');
    p2.classList.remove('show');
    let last: number | null = null;
    const frame = (now: number): void => {
      if (fallToken !== state.fallToken) return; // 已被新一輪或兜底作廢
      if (last === null) last = now;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      vy += 2600 * dt;
      x += vx * dt;
      y += vy * dt;
      ang += om * dt * 57.3;
      if (x > maxX) {
        x = maxX;
        vx = -Math.abs(vx) * 0.5;
      }
      if (x < -maxX) {
        x = -maxX;
        vx = Math.abs(vx) * 0.5;
      }
      // 下降末段把角度收斂到橫躺終角：躺平這件事在空中做完。
      if (vy > 0) {
        const remain = (floorY - y) / Math.max(vy, 1);
        if (remain < 0.4) {
          const targetEq = targetAng + 360 * Math.round((ang - targetAng) / 360);
          ang += (targetEq - ang) * Math.min(1, dt * 14);
        }
      }
      if (y >= floorY && vy > 0) {
        // 第一次觸地＝定格：位置與角度在這一幀一次寫死，迴圈到此
        // 結束、不再排幀。落定這一刻才揭示籤號；切屏由這一幀排定
        // （凍結後 1.5s）。之後誰都不許再寫這支籤的 transform。
        const finalEq = targetAng + 360 * Math.round((ang - targetAng) / 360);
        fs.style.transform = `translate(calc(-50% + ${x.toFixed(1)}px),${floorY.toFixed(1)}px) rotate(${finalEq.toFixed(1)}deg)`;
        thud();
        vibrate([70, 50, 90]);
        shadow.style.left = `calc(50% + ${(x - 44).toFixed(0)}px)`;
        shadow.classList.add('show');
        if (state.stick) {
          // 籤號字就寫在籤上、跟著籤身走：CSS 預設 writing-mode
          // vertical-rl，字沿著竹籤直排、從籤頭（頂部）往籤尾讀，
          // 跟真廟裡的籤一樣。落定這一刻只寫字，不改排版——前面
          // 幾輪試過橫排（先反旋回水平、再順籤身、再從籤頭起排），
          // 字是正了，讀起來卻不是「從頂部到底部」的順序。
          this.$('fs-num').textContent = state.stick.no;
        }
        if (state.stick) {
          this.$('shake-sub').textContent = `${state.stick.no} · ${state.stick.grade}`;
        }
        clearTimeout(state._fallWatchdog);
        setTimeout(() => {
          this.showStickScreen();
        }, 1500);
        return;
      }
      fs.style.transform = `translate(calc(-50% + ${x.toFixed(1)}px),${y.toFixed(1)}px) rotate(${ang.toFixed(1)}deg)`;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /* 長按蓄力（單手 / 桌面）：按住才計入；鬆開即停計、能量回落。 */
  private pressOn(e: PointerEvent): void {
    e.preventDefault();
    if (!this.state.shaking) return;
    this.state.pressHold = true;
    this.$('press-btn').classList.add('pressing');
    warmAudio();
  }

  private pressOff(): void {
    this.state.pressHold = false;
    this.$('press-btn').classList.remove('pressing');
  }

  /* ============ 擲筊 ============
     一對同形半月杯：杯體是去背實物圖（cup-flat 平面朝上、cup-convex
     凸面朝上）。競技場不再另鋪供桌照片——杯子直接落在本屏同一幅
     廟會夜景裡，只靠杯底一團羽化地面光暈承托。
     觸發：手機上拋脈衝（devicemotion）／手指上滑甩動／點按按鈕（兜底）。
     動效：蓄勢下沉 → 拋起翻面 → 落地壓縮回彈＋二段小跳。 */
  private paintCup(cupEl: CupEl, convex: boolean): void {
    const inner = cupEl.querySelector('.cup-inner');
    if (!inner) return;
    let img = inner.querySelector('img');
    if (!img) {
      img = document.createElement('img');
      img.alt = '';
      inner.appendChild(img);
    }
    const src = convex ? this.images.cupConvex : this.images.cupFlat;
    if (img.getAttribute('src') !== src) img.src = src;
    img.style.transform = cupEl.id === 'cup-b' ? 'scaleX(-1)' : '';
    // 杯面標記跟著杯一起翻：同一道金色嵌線，平面是直線、凸面是弧線。
    let mark = inner.querySelector('.cup-mark');
    if (!mark) {
      mark = document.createElement('span');
      inner.appendChild(mark);
    }
    mark.className = `cup-mark ${convex ? 'convex' : 'flat'}`;
  }

  private setCup(cupEl: CupEl, convex: boolean): void {
    cupEl._face = convex;
    cupEl._shownFace = convex;
    cupEl._restX = 0;
    cupEl._restAngRad = 0;
    cupEl._restZ = 0;
    this.paintCup(cupEl, convex);
    const inner = cupEl.querySelector<HTMLElement>('.cup-inner');
    if (inner) inner.style.transform = '';
    const sh = cupEl.querySelector<HTMLElement>('.cup-shadow');
    if (sh) {
      sh.style.transform = 'translateX(-50%)';
      sh.style.opacity = '';
    }
  }

  private showStickScreen(): void {
    const state = this.state;
    const s = state.stick;
    if (!s) return;
    this.$('stick-no').textContent = s.no;
    this.$('stick-grade').textContent = s.grade;
    this.$('stick-poem').textContent = s.poem;
    this.$('jiao-result').innerHTML = `<div class="r-desc">${this.strings.jiaoWaiting}</div>`;
    this.$('throw-jiao').style.display = '';
    this.$('to-verdict').style.display = 'none';
    this.$('jiao-restart').style.display = 'none';
    this.$('jiao-alt').style.display = 'none';
    state.jiaoDone = false;
    state.jiaoBusy = false;
    this.setCup(this.$('cup-a') as CupEl, false);
    this.setCup(this.$('cup-b') as CupEl, true);
    this.updateSensorNote();
    this.show('scr-stick');
  }

  private landFX(cupEl: CupEl, vol: number): void {
    knock(0.1 + 0.22 * vol);
    clack(0.25 + 0.55 * vol);
    vibrate(vol > 0.7 ? 26 : 12);
    // 落地壓扁不再用 WAAPI 另起一條動畫搶外層 transform——壓扁改由
    // flyCup 在 settle 相位逐幀以阻尼振盪寫進同一個 transform。
    const dust = cupEl.querySelector('.cup-dust');
    if (dust) {
      dust.classList.remove('show');
      void (dust as HTMLElement).offsetWidth;
      dust.classList.add('show');
    }
    // 桌面微震只在重觸桌（vol > 0.65）那一下，輕落不震桌。
    if (vol > 0.65) {
      const arena = this.$('jiao-arena');
      arena.classList.remove('land');
      void arena.offsetWidth;
      arena.classList.add('land');
    }
  }

  /* ============ 擲筊剛體模擬（逐幀物理，禁止罐頭動畫） ============
     ① prep 蓄勢（130ms + 各自錯峰 delay）：y 以 ease-in 下蹲到 +7px。
     ② fly 拋物線：g = 2400 px/s²，vy0 由目標峰高反推；水平 vx =
        targetX×0.82 / 首落時間——大部分橫移在空中攤完。
     ③ 翻滾：總轉角先按最終杯面定死（同面＝整數圈、異面＝整數圈+半圈），
        ω = 總轉角 / 預估全程；換面只在相對轉角 cos 變號時換圖。
     ④ 落地：反彈係數 0.35、最多彈 2 次；隨後 settle 0.5s——壓扁與搖晃
        都走阻尼振盪逐幀寫進同一個 transform，幅度自己衰減到零。
     ⑤ 落地即終點（沒有歸位段）：settle 內 X 向只做「搖平」——殘餘翻角
        以指數阻尼收向離落點最近的同面相位，Z 只在落點角附近小幅搖晃
        後停在落點角，x 滑到摩擦耗盡為止。落點姿態寫回 _restX /
        _restAngRad / _restZ，重擲才從這個姿態起步。
     兩杯全程錯開：prep 錯峰 90–160ms、峰高差 ±8px、ω 與落點各自獨立
     隨機，先後落地、各自收尾。兩杯都 done 之後再隔 170ms 才由
     throwJiao 呼叫 finishThrow 淡入結果文案。 */
  private setCupSink(px: number): void {
    for (const id of ['cup-a', 'cup-b']) {
      const el = this.$(id);
      el.style.transform = px ? `translateY(${px}px) scaleY(${(1 - px * 0.006).toFixed(3)})` : '';
    }
  }

  private flyCup(
    cupEl: CupEl,
    finalConvex: boolean,
    delay: number,
    strength: number,
    done: () => void,
  ): void {
    const inner = cupEl.querySelector<HTMLElement>('.cup-inner');
    const shadow = cupEl.querySelector<HTMLElement>('.cup-shadow');
    if (!inner || !shadow) return;
    const startFace = cupEl._face || false;
    const S = Math.max(0.15, Math.min(1, strength + (Math.random() - 0.5) * 0.16));
    const side = cupEl.id === 'cup-a' ? -1 : 1;
    const targetX = side * (30 + Math.random() * 16 + S * 6);
    const G = 2400;
    const peak = Math.max(48, Math.min(145, 54 + S * 86 + (Math.random() * 16 - 8)));
    const vy0 = Math.sqrt(2 * G * peak);
    const tFirst = (2 * vy0) / G;
    // 從上一輪的落點姿態起步（重擲不許先瞬移回中心再飛）。
    const startX = cupEl._restX || 0;
    const startAng = cupEl._restAngRad || 0;
    const startZ = cupEl._restZ || 0;
    // settle 段會對 vx 做滑行摩擦衰減，故用 let（原型 var）。
    let vx = ((targetX - startX) * 0.82) / tFirst;
    // 總轉角對齊最終杯面：同面整數圈、異面整數圈＋半圈。
    const dir = Math.random() < 0.5 ? -1 : 1;
    const turns = 1.0 + S * 0.7 + Math.random() * 0.3;
    const totalAng =
      finalConvex === startFace
        ? Math.PI * 2 * Math.max(1, Math.round(turns))
        : Math.PI * 2 * (Math.floor(turns) + 0.5);
    let omega = (dir * totalAng) / (tFirst * 1.42);
    const prepDur = 130 + delay;
    const startT = performance.now();
    let last: number | null = null;
    let phase: 'prep' | 'fly' | 'settle' = 'prep';
    let x = startX;
    let y = 0;
    let vy = -vy0;
    let ang = startAng;
    let bounces = 0;
    let elapsed = 0;
    let settleT = 0;
    let settleAng = 0;
    let czLand = 0;
    let impact0 = 0;
    let faceAng = 0;

    const render = (cx: number, cy: number, cang: number, cz: number, squash: number): void => {
      // 換面按相對起步角的轉量判：轉到側面（相對角 ±90°）才換圖。
      const faceNow = Math.cos(cang - startAng) >= 0 ? startFace : !startFace;
      if (faceNow !== cupEl._shownFace) {
        cupEl._shownFace = faceNow;
        this.paintCup(cupEl, faceNow);
      }
      const h = -cy;
      const sq = squash || 0;
      inner.style.transform = `translate(${cx.toFixed(1)}px,${cy.toFixed(1)}px) rotateZ(${cz.toFixed(2)}deg) scale(${(1 + sq * 0.05).toFixed(3)},${(1 - sq * 0.09).toFixed(3)}) perspective(700px) rotateX(${((cang * 180) / Math.PI).toFixed(1)}deg)`;
      shadow.style.transform = `translateX(calc(-50% + ${cx.toFixed(1)}px)) scale(${(1 - Math.min(0.38, h / 620)).toFixed(3)})`;
      shadow.style.opacity = String(0.92 - Math.min(0.45, h / 560));
    };

    const frame = (now: number): void => {
      if (this.disposed) return;
      if (last === null) last = now;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      if (phase === 'prep') {
        const p = Math.min(1, (now - startT) / prepDur);
        const dip = 7 * p * p; // ease-in 下蹲蓄勢
        render(startX, dip, startAng, startZ + (side * -1.2 - startZ) * p, p * 0.4);
        if (p >= 1) {
          phase = 'fly';
          y = dip;
        }
        requestAnimationFrame(frame);
        return;
      }
      if (phase === 'fly') {
        elapsed += dt;
        vy += G * dt;
        y += vy * dt;
        x += vx * dt;
        ang += omega * dt;
        const blend = 1 - Math.exp(-elapsed * 4);
        const cz = startZ * (1 - blend) + Math.sin(elapsed * 3.2 + side) * 2.5 * blend;
        if (y >= 0 && vy > 0) {
          y = 0;
          const impact = vy;
          this.landFX(cupEl, Math.min(1, impact / 1250));
          bounces++;
          if (bounces >= 2 || impact < 260) {
            phase = 'settle';
            settleT = 0;
            settleAng = ang;
            czLand = cz;
            impact0 = impact;
            // 搖平的目標＝離落點角最近的同面相位，杯子只在落點原地躺平，不遷移。
            const twoPi = Math.PI * 2;
            faceAng =
              finalConvex === startFace
                ? startAng + Math.round((settleAng - startAng) / twoPi) * twoPi
                : startAng + Math.round((settleAng - startAng - Math.PI) / twoPi) * twoPi + Math.PI;
            vy = 0;
          } else {
            vy = -impact * 0.35; // 反彈係數 0.35
            omega *= 0.45;
          }
        }
        render(x, y, ang, cz, 0);
      } else {
        // settle：壓扁＋搖晃的阻尼振盪，自己衰減到零；結束即凍結在落點。
        settleT += dt;
        x += vx * dt;
        vx -= Math.sign(vx) * Math.min(Math.abs(vx), 900 * dt); // 滑行摩擦
        const amp = Math.min(1, impact0 / 900);
        const sq = Math.exp(-7 * settleT) * Math.cos(settleT * 24) * amp;
        const cz2 = czLand + Math.sin(settleT * 17) * Math.exp(-6.5 * settleT) * 2.0 * amp;
        const angNow = settleAng + (faceAng - settleAng) * (1 - Math.exp(-6 * settleT));
        render(x, 0, angNow, cz2, sq);
        if (settleT >= 0.55) {
          cupEl._face = finalConvex;
          cupEl._shownFace = finalConvex;
          // 落點姿態原樣存下：杯子就停在這裡，下輪 prep 從這裡起步。
          cupEl._restX = x;
          cupEl._restZ = czLand;
          cupEl._restAngRad = ((faceAng % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          this.paintCup(cupEl, finalConvex);
          const finalAngDeg = ((((faceAng * 180) / Math.PI) % 360) + 360) % 360;
          inner.style.transform = `translate(${x.toFixed(1)}px,0px) rotateZ(${czLand.toFixed(2)}deg) perspective(700px) rotateX(${finalAngDeg.toFixed(1)}deg)`;
          shadow.style.transform = `translateX(calc(-50% + ${x.toFixed(1)}px))`;
          shadow.style.opacity = '';
          done();
          return;
        }
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /* strength：0–1 拋擲強度，由觸發路徑在脫手瞬間捕獲——拋擲感應取
     脈衝峰值、上滑取釋放速度、點按取中檔隨機 0.45–0.70。
     蓄勢：呼叫前手勢已讓杯跟隨下沉，這裡先把下沉量走過渡滑回，再由
     flyCup 的 prep 相位逐幀下蹲蓄勢後脫手——全程沒有一幀是跳的。 */
  private throwJiao(strength?: number): void {
    const state = this.state;
    if (state.jiaoBusy || state.jiaoDone) return;
    const now = performance.now();
    if (now - this.lastThrowT < 700) return;
    this.lastThrowT = now;
    const S =
      typeof strength === 'number' ? Math.max(0.15, Math.min(1, strength)) : 0.45 + Math.random() * 0.25;
    state.jiaoBusy = true;
    warmAudio();
    vibrate(24);
    const r = Math.random();
    const outcome: JiaoOutcome = r < 0.5 ? 'sheng' : r < 0.8 ? 'xiao' : 'yin';
    // 杯面定義（false＝平面、true＝凸面）：聖筊一平一凸、笑筊兩凸、
    // 陰筊兩平——與 finishThrow 文案、頁面圖例同一套。
    let faces: [boolean, boolean] =
      outcome === 'sheng' ? [false, true] : outcome === 'xiao' ? [true, true] : [false, false];
    if (Math.random() < 0.5) faces = [faces[1], faces[0]];
    // 觸發當下就給反饋，不讓用戶等落定才知道有沒有擲成功。
    this.$('jiao-result').innerHTML = `<div class="r-desc">${this.strings.jiaoFlying}</div>`;
    this.$('to-verdict').style.display = 'none';
    this.$('jiao-restart').style.display = 'none';
    this.$('jiao-alt').style.display = 'none';
    // 手勢跟隨的下沉量走過渡滑回（.releasing），不再一幀跳回。
    for (const id of ['cup-a', 'cup-b']) this.$(id).classList.add('releasing');
    this.setCupSink(0);
    setTimeout(() => {
      for (const id of ['cup-a', 'cup-b']) this.$(id).classList.remove('releasing');
    }, 260);
    let landed = 0;
    const onLand = (): void => {
      landed++;
      // 兩杯都落穩後再停 170ms 才淡入結果——杯子沒停穩，文案不出現。
      if (landed === 2) {
        setTimeout(() => {
          state.jiaoBusy = false;
          this.finishThrow(outcome);
        }, 170);
      }
    };
    this.flyCup(this.$('cup-a') as CupEl, faces[0], 0, S, onLand);
    this.flyCup(this.$('cup-b') as CupEl, faces[1], 90 + Math.random() * 70, S, onLand);
  }

  private finishThrow(outcome: JiaoOutcome): void {
    const state = this.state;
    const res = this.$('jiao-result');
    // 擲成功了：感應提示（含「被拒絕」那行）立即清除，不再掛著。
    state.threwOnce = true;
    this.$('sensor-note').style.display = 'none';
    if (outcome === 'sheng') {
      state.jiaoDone = true;
      res.innerHTML = `<div class="r-name r-sheng">${this.strings.jiaoShengName}</div><div class="r-desc">${this.strings.jiaoShengText}</div>`;
      vibrate([40, 40, 40]);
      this.$('throw-jiao').style.display = 'none';
      this.$('to-verdict').style.display = '';
    } else if (outcome === 'xiao') {
      res.innerHTML = `<div class="r-name r-xiao">${this.strings.jiaoXiaoName}</div><div class="r-desc">${this.strings.jiaoXiaoText}</div>`;
      vibrate(20);
    } else {
      state.jiaoDone = true;
      res.innerHTML = `<div class="r-name r-yin">${this.strings.jiaoYinName}</div><div class="r-desc">${this.strings.jiaoYinText}</div>`;
      vibrate([90, 60, 90]);
      this.$('throw-jiao').style.display = 'none';
      // 陰筊是「時候未到」：主按鈕只負責收尾回首頁，不催立即重搖；
      // 想換個問題再搖，走下方小字連結。
      this.$('jiao-restart').style.display = '';
      this.$('jiao-alt').style.display = 'block';
    }
  }

  /* 拋擲感應：向上脈衝先進入 90ms 峰值捕獲窗——期間杯隨手跟隨下沉 8px，
     窗結束以峰值映射強度脫手：S = clamp((peak − 8) / 26, 0.25, 1)。 */
  private onJiaoMotion(e: DeviceMotionEvent): void {
    const state = this.state;
    const a = e.accelerationIncludingGravity;
    if (!a || a.x === null || a.y === null || a.z === null) return;
    state.motionSeen = true;
    if (!this.$('scr-stick').classList.contains('active')) {
      this.lastJiaoMag = null;
      return;
    }
    const m = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
    if (this.lastJiaoMag !== null) {
      const d = m - this.lastJiaoMag;
      if (d > 9) {
        state._jiaoPeak = Math.max(state._jiaoPeak, d);
        if (!state._jiaoSched) {
          state._jiaoSched = true;
          this.setCupSink(8);
          setTimeout(() => {
            state._jiaoSched = false;
            const S = Math.max(0.25, Math.min(1, (state._jiaoPeak - 8) / 26));
            state._jiaoPeak = 0;
            this.throwJiao(S);
          }, 90);
        }
      }
    }
    this.lastJiaoMag = m;
  }

  /* 傾斜視差：首頁與搖籤頁夜景跟手；擲筊頁杯組隨傾斜微移。 */
  private onOrient(e: DeviceOrientationEvent): void {
    if (e.gamma === null || e.beta === null) return;
    this.state.tiltG = e.gamma;
    this.state.tiltB = e.beta;
    if (this.parQueued) return;
    this.parQueued = true;
    requestAnimationFrame(() => {
      this.parQueued = false;
      this.applyParallax();
    });
  }

  private applyParallax(): void {
    const state = this.state;
    const gx = Math.max(-28, Math.min(28, state.tiltG || 0)) / 28;
    const gy = Math.max(-28, Math.min(28, (state.tiltB || 45) - 45)) / 28;
    if (this.$('scr-stick').classList.contains('active')) {
      this.$('jiao-cups').style.transform = `translate(${(gx * 7).toFixed(1)}px,${(gy * 4).toFixed(1)}px)`;
    }
    if (this.$('scr-shake').classList.contains('active')) {
      const bg = this.$('bg-shake');
      bg.style.transform = `translate(${(gx * -10).toFixed(1)}px,${(gy * -7).toFixed(1)}px) scale(1.06)`;
    }
    if (this.$('scr-home').classList.contains('active')) {
      const bg = this.$('bg-home');
      bg.style.transform = `translate(${(gx * -8).toFixed(1)}px,${(gy * -5).toFixed(1)}px) scale(1.05)`;
    }
  }

  /* 感應狀態提示：未授權／無感應時明說，不靜默假裝可用。 */
  private updateSensorNote(): void {
    const state = this.state;
    const note = this.$('sensor-note');
    const txt = this.$('sensor-note-text');
    const btn = this.$('sensor-btn');
    // 已經成功擲出過：提示功成身退，不再顯示（含被拒絕那行）。
    if (state.threwOnce) {
      note.style.display = 'none';
      return;
    }
    if (state.motionPerm === 'granted' || state.motionSeen) {
      note.style.display = 'none';
      return;
    }
    const hasReq =
      typeof DeviceMotionEvent !== 'undefined' &&
      typeof (DeviceMotionEvent as unknown as { requestPermission?: unknown }).requestPermission ===
        'function';
    note.style.display = 'flex';
    if (state.motionPerm === 'denied') {
      txt.textContent = this.strings.sensorDenied;
      btn.style.display = '';
    } else if (typeof DeviceMotionEvent === 'undefined') {
      txt.textContent = this.strings.sensorNoDevice;
      btn.style.display = 'none';
    } else if (!hasReq) {
      txt.textContent = this.strings.sensorNoPerm;
      btn.style.display = 'none';
    } else {
      txt.textContent = this.strings.sensorOff;
      btn.style.display = '';
    }
  }

  private requestSensor(): void {
    const motionReq = (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> })
      .requestPermission;
    if (typeof DeviceMotionEvent !== 'undefined' && typeof motionReq === 'function') {
      motionReq()
        .then((r: string) => {
          this.state.motionPerm = r === 'granted' ? 'granted' : 'denied';
          this.updateSensorNote();
          if (r === 'granted') this.toast(this.strings.sensorOnToast);
        })
        .catch(() => {
          this.state.motionPerm = 'denied';
          this.updateSensorNote();
        });
    }
    const orientReq = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
      .requestPermission;
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof orientReq === 'function') {
      orientReq().catch(() => undefined);
    }
  }

  /* ============ 判詞卡 ============ */
  private showVerdict(): void {
    const state = this.state;
    const s = state.stick;
    const cat = state.cat;
    if (!s || !cat) return;
    this.onVerdict(s, cat);
    this.show('scr-verdict');
    vibrate(35);
  }
}
