import { useEffect, useRef, useState } from 'react';
import { GuestBindHint } from '~/components/GuestBindHint';
import { track } from '~/lib/track';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';
import { STICK_PLAIN } from '~/ritual/sticks-plain';
import { STICKS, type Stick } from '~/ritual/sticks';
import { yuelaoSampleHtml } from './engine/samples.js';
import { shareVerdict } from './engine/share.js';
import {
  liteCheck,
  liteCheckout,
  liteGenerate,
  litePlans,
  litePrice,
  liteReadingUrl,
  liteRedeem,
} from './lite-billing';
import { type OracleCategory, saveLitePending, takeLitePending } from './lite-pending';
import './lite-market.css';

// 月老殿・快速版（站長 2026-11-19 改版：「輕量模式的界面好醜、體驗也差」）。
// 和 3D 月老殿走同一條路：問 → 求籤（一小段搖籤）→ 判詞卡 → 白話 → 完整解籤（方案、付款、生成）。
// 付款、等待、次數包解鎖、生成的邏輯沿用原本的（lite-billing.ts、lite-pending.ts），只換流程與畫面。

/** 五種處境，和 3D 月老殿一樣；cat 是判詞與權益用的三類。 */
const SITS = [
  { key: 'single', cat: 'single' },
  { key: 'crush', cat: 'him' },
  { key: 'dating', cat: 'him' },
  { key: 'reunion', cat: 'reunion' },
  { key: 'married', cat: 'him' },
] as const;
type Sit = (typeof SITS)[number]['key'];
/** 常見問法對應的處境（與 3D 的 QUICK_SITS 一致）。 */
const QUICK_SITS: Sit[] = ['reunion', 'crush', 'single'];
type Phase = 'ask' | 'drawing' | 'result';
type PaymentStatus = 'idle' | 'checking' | 'none' | 'pending' | 'unlocked' | 'ready' | 'generating' | 'error';

type Words = {
  place: string;
  title: string;
  lead: string;
  placeholder: string;
  quickLabel: string;
  quick: [string, string, string];
  sitLabel: string;
  sits: [string, string, string, string, string];
  sitHint: string;
  sitNeeded: string;
  draw: string;
  drawing: string;
  reveal: string;
  asked: string;
  again: string;
  againNudge: string;
  threeD: string;
  home: string;
  mine: string;
  notes: string;
  share: string;
  saved: string;
  plainTitle: string;
  plainLabel: string;
  originLabel: string;
  loveLabel: string;
  signPage: string;
  sample: string;
  inlineNote: string;
  deepTitle: string;
  sticky: string;
  feedback: string;
  teaser: (q: string, line: string, sit: string) => string;
  sections: string[];
};

const WORDS: Record<string, Words> = {
  'zh-Hant': {
    place: '月下 · 月老殿',
    title: '心裡放著誰，先想清楚',
    lead: '寫下想問的事，選好你現在的處境，誠心求一支。求籤和判詞都免費。',
    placeholder: '例：我和他還有機會嗎',
    quickLabel: '常見問法',
    quick: ['我們還有機會嗎？', '我該主動聯繫嗎？', '近期怎樣遇見適合的人？'],
    sitLabel: '你現在的處境',
    sits: ['單身', '曖昧中', '交往中', '想復合', '已婚／談婚論嫁'],
    sitHint: '判詞會照你的處境寫。',
    sitNeeded: '先選你現在的處境，月老才知道怎麼回你。',
    draw: '求籤',
    drawing: '誠心默念你的問題……',
    reveal: '籤掉出來了',
    asked: '問',
    again: '再求一支',
    againNudge: '一事一籤。同一件事抽多了，心反而亂；先把這支讀完再說。',
    threeD: '進 3D 月老殿',
    home: '回首頁',
    mine: '我的解讀',
    notes: '籤詩解讀是文化體驗與自我整理，不保證感情結果。',
    share: '分享籤圖',
    saved: '籤圖存好了，可以傳給朋友。圖上不會有你寫的問題。',
    plainTitle: '這支籤在說什麼',
    plainLabel: '白話',
    originLabel: '原句本來在說什麼',
    loveLabel: '放在姻緣裡怎麼讀',
    signPage: '這支籤的完整介紹',
    sample: '先看一份範例',
    inlineNote: '七段只寫你問的這件事，寫好存在「我的」',
    deepTitle: '完整解籤',
    sticky: '解鎖完整解籤',
    feedback: '意見回饋',
    teaser: (q, line, sit) =>
      `${q ? `你問的是「${q}」。` : ''}上面的判詞是這支籤的大意；完整解籤會把「${line}」放進你「${sit}」的處境裡細說：這件事該往前、要等，還是放下；這幾天具體做什麼、別做什麼；對方那一邊可能在顧慮什麼。`,
    sections: [
      '這支籤對你這件事的定調',
      '原典給你的提示',
      '對著你的問題',
      '眼下該做與不該做',
      '對方那一邊',
      '三天內可以做的一步',
      '留給你的一句話',
    ],
  },
  'zh-Hans': {
    place: '月下 · 月老殿',
    title: '心里放着谁，先想清楚',
    lead: '写下想问的事，选好你现在的处境，诚心求一支。求签和判词都免费。',
    placeholder: '例：我和他还有机会吗',
    quickLabel: '常见问法',
    quick: ['我们还有机会吗？', '我该主动联系吗？', '近期怎样遇见合适的人？'],
    sitLabel: '你现在的处境',
    sits: ['单身', '暧昧中', '交往中', '想复合', '已婚／谈婚论嫁'],
    sitHint: '判词会照你的处境写。',
    sitNeeded: '先选你现在的处境，月老才知道怎么回你。',
    draw: '求签',
    drawing: '诚心默念你的问题……',
    reveal: '签掉出来了',
    asked: '问',
    again: '再求一支',
    againNudge: '一事一签。同一件事抽多了，心反而乱；先把这支读完再说。',
    threeD: '进 3D 月老殿',
    home: '回首页',
    mine: '我的解读',
    notes: '签诗解读是文化体验与自我整理，不保证感情结果。',
    share: '分享签图',
    saved: '签图保存好了，可以发给朋友。图上不会有你写的问题。',
    plainTitle: '这支签在说什么',
    plainLabel: '白话',
    originLabel: '原句本来在说什么',
    loveLabel: '放在姻缘里怎么读',
    signPage: '这支签的完整介绍',
    sample: '先看一份范例',
    inlineNote: '七段只写你问的这件事，写好存在「我的」',
    deepTitle: '完整解签',
    sticky: '解锁完整解签',
    feedback: '意见反馈',
    teaser: (q, line, sit) =>
      `${q ? `你问的是「${q}」。` : ''}上面的判词是这支签的大意；完整解签会把「${line}」放进你「${sit}」的处境里细说：这件事该往前、要等，还是放下；这几天具体做什么、别做什么；对方那一边可能在顾虑什么。`,
    sections: [
      '这支签对你这件事的定调',
      '原典给你的提示',
      '对着你的问题',
      '眼下该做与不该做',
      '对方那一边',
      '三天内可以做的一步',
      '留给你的一句话',
    ],
  },
  en: {
    place: 'YUEXIA · Yue Lao Hall',
    title: 'Hold that person in mind',
    lead: 'Write what you want to ask, choose where you stand, and draw a stick. Drawing and the verdict are free.',
    placeholder: 'e.g. Do we still have a chance?',
    quickLabel: 'Common questions',
    quick: [
      'Do we still have a chance?',
      'Should I reach out first?',
      'How can I meet someone right for me?',
    ],
    sitLabel: 'Where you stand',
    sits: ['Single', 'Something unclear', 'Dating', 'Want to get back together', 'Married / engaged'],
    sitHint: 'The verdict is written for your situation.',
    sitNeeded: 'Choose where you stand first, so Yue Lao knows how to answer.',
    draw: 'Draw a stick',
    drawing: 'Hold your question in mind…',
    reveal: 'A stick fell out',
    asked: 'You asked',
    again: 'Draw again',
    againNudge: 'One matter, one stick. Drawing again and again only clouds things; read this one first.',
    threeD: 'Open the 3D hall',
    home: 'Home',
    mine: 'My readings',
    notes: 'A cultural reflection activity, not a prediction of relationship outcomes.',
    share: 'Share as image',
    saved: 'Image saved. Your question is not on it.',
    plainTitle: 'What this stick says',
    plainLabel: 'In plain words',
    originLabel: 'Where the line comes from',
    loveLabel: 'Read for love',
    signPage: 'About this stick',
    sample: 'See a sample first',
    inlineNote: 'Seven sections about your exact question, saved in your account',
    deepTitle: 'Full reading',
    sticky: 'Unlock the full reading',
    feedback: 'Feedback',
    teaser: (q, line, sit) =>
      `${q ? `You asked: “${q}”. ` : ''}The verdict above is the gist. The full reading places “${line}” in your situation (${sit}) and goes further: move forward, wait, or let go; what to do and not do this week; and what the other person may be worried about.`,
    sections: [
      'Where this stands',
      'What the original line hints',
      'Your question',
      'Do and don’t, right now',
      'The other side',
      'One step within three days',
      'A line to keep',
    ],
  },
  ja: {
    place: '月下 · 月老殿',
    title: '心に浮かぶあの人を',
    lead: '聞きたいことを書き、今の状況を選んで、おみくじを一本。おみくじとお告げは無料です。',
    placeholder: '例：私たちにまだ可能性はある？',
    quickLabel: 'よくある質問',
    quick: ['この関係にまだ可能性はある？', '自分から連絡すべき？', '良い出会いのために何をすればいい？'],
    sitLabel: '今の状況',
    sits: ['シングル', '曖昧な関係', '交際中', '復縁したい', '既婚／結婚の話'],
    sitHint: 'お告げは状況に合わせて書かれます。',
    sitNeeded: 'まず今の状況を選んでください。',
    draw: 'おみくじを引く',
    drawing: '心の中で問いを念じて……',
    reveal: 'おみくじが出ました',
    asked: '質問',
    again: 'もう一度',
    againNudge: '一つのことに一本。何度も引くと迷いが増えます。まずこの一本を読みましょう。',
    threeD: '3D 月老殿へ',
    home: 'トップ',
    mine: '購入済み',
    notes: '文化体験と自己省察を目的とし、結果を保証するものではありません。',
    share: '画像で共有',
    saved: '画像を保存しました。質問は載っていません。',
    plainTitle: 'このおみくじの意味',
    plainLabel: 'やさしく言うと',
    originLabel: '原文の背景',
    loveLabel: '恋愛での読み方',
    signPage: 'このおみくじの詳細',
    sample: 'まず例を見る',
    inlineNote: 'あなたの質問だけを七つの章で。アカウントに保存',
    deepTitle: '詳しい解説',
    sticky: '詳しい解説を解放',
    feedback: 'ご意見',
    teaser: (q, line, sit) =>
      `${q ? `あなたの質問：「${q}」。` : ''}上のお告げは大意です。詳しい解説では「${line}」をあなたの状況（${sit}）に当てはめ、進むか待つか手放すか、この数日にすること・しないこと、相手の気がかりまで書きます。`,
    sections: [
      'このことへの結論',
      '原文からのヒント',
      'あなたの質問に',
      '今すること・しないこと',
      '相手の側',
      '三日以内の一歩',
      '最後のひとこと',
    ],
  },
};

const PAY: Record<
  string,
  {
    title: string;
    note: string;
    consent: string;
    buy: string;
    generate: string;
    view: string;
    checking: string;
    generating: string;
    pending: string;
    verify: string;
    owned: string;
    cancelled: string;
    failed: string;
    login: string;
    storage: string;
    pack: string;
    /** 方案選單：單次／次數包（{0} 換成數字或價格）。 */
    single: string;
    uses: string;
    per: string;
    popular: string;
    from: string;
    packNote: string;
    /** 付款鈕下方的一行：付款即同意條款（勾選同意改到生成解讀那一步）。 */
    agree: string;
    /** 追問月老的入口（付費解籤下面）。 */
    followup: string;
  }
> = {
  'zh-Hant': {
    title: '付費完整解籤',
    note: '完整解籤會結合你的問題，提供原典提示、現況分析、可以採取的行動等七段個人化解讀。單次港幣 HKD 付款；同一支籤與情境不重複收費。',
    consent: '我已閱讀條款和隱私說明，同意將自願輸入的問題提供給第三方自動化解讀服務，用於生成個人化解籤。',
    buy: '解鎖完整解籤',
    generate: '請月老寫我的完整解籤',
    view: '在帳戶查看完整解籤',
    checking: '正在核對有沒有已購權益…',
    generating: '正在寫完整解籤，請勿重複付款…',
    pending: '付款尚未確認，請勿重複付款。可稍後再核對或在帳戶查看紀錄。',
    verify: '重新確認付款／解鎖狀態',
    owned: '已解鎖，無需再次付款。',
    cancelled: '已取消付款，這支籤仍保留。',
    failed: '暫時無法核對或生成。若已付款，請先查看帳戶，勿重複付款。',
    login: '請先登入，回來後會接著這支籤。',
    storage: '瀏覽器未能保存求籤進度，為防付款後遺失記錄，請允許工作階段儲存。',
    pack: '已有問事包？去帳戶兌換',
    single: '單次',
    uses: '{0} 次',
    per: '每次 {0}',
    popular: '最多人選',
    from: '低至 {0} 一次',
    packNote: '次數包付完會先用一次解鎖這支籤，剩下的存在「我的」，次數不過期。',
    agree: '付款即表示同意服務條款與隱私說明。',
    followup: '還想問月老一句？',
  },
  'zh-Hans': {
    title: '付费完整解签',
    note: '完整解签结合你的问题，包含原典提示、现况分析、可采取的行动等七段个性化解读。单次港币 HKD 付款；同一支签与情境不会重复收费。',
    consent: '我已阅读条款和隐私说明，同意将自愿输入的问题提供给第三方自动化解读服务，用于生成个性化解签。',
    buy: '解锁完整解签',
    generate: '请月老写我的完整解签',
    view: '在账户查看完整解签',
    checking: '正在核对已购权益…',
    generating: '正在生成完整解签，请勿重复付款…',
    pending: '付款尚未确认，请勿重复付款。可稍后核对或在账户查看订单。',
    verify: '重新核对付款／解锁状态',
    owned: '已解锁，无需再次付款。',
    cancelled: '已取消付款，这支签仍然保留。',
    failed: '暂时无法核对或生成。若已付款，请先查看账户，不要重复付款。',
    login: '请先登录，回来后继续这支签。',
    storage: '浏览器无法保存求签进度。请允许会话存储，以免付款返回后丢失记录。',
    pack: '已有问事包？前往账户兑换',
    single: '单次',
    uses: '{0} 次',
    per: '每次 {0}',
    popular: '最多人选',
    from: '低至 {0} 一次',
    packNote: '次数包付完会先用一次解锁这支签，剩下的存在「我的」，次数不过期。',
    agree: '付款即表示同意服务条款与隐私说明。',
    followup: '还想问月老一句？',
  },
  en: {
    title: 'Optional paid in-depth reading',
    note: 'Actual charge is in HKD. The same stick/category is never charged twice after unlocking.',
    consent:
      'I have read the Terms and Privacy Policy, and agree that my optional question may be sent to a third-party automated reading service to generate a personalized interpretation.',
    buy: 'Unlock full reading',
    generate: 'Generate my full reading',
    view: 'View saved reading in my account',
    checking: 'Checking existing access…',
    generating: 'Generating your reading. Do not pay again…',
    pending: 'Payment has not yet been confirmed. Do not pay again; check later or view your account.',
    verify: 'Check payment and access again',
    owned: 'Already unlocked. No second payment is needed.',
    cancelled: 'Checkout cancelled. Your stick is still here.',
    failed: 'Cannot verify or generate right now. If you paid, check your account before buying again.',
    login: 'Sign in first, then return to this stick.',
    storage: 'Session storage is unavailable. Enable it to keep your reading across checkout.',
    pack: 'Already have a question pack? Redeem in your account',
    single: 'Single',
    uses: '{0} readings',
    per: '{0} each',
    popular: 'Most popular',
    from: 'From {0} each',
    packNote: 'A pack unlocks this stick first; the rest stay in your account and never expire.',
    agree: 'By paying you agree to the Terms and Privacy Policy.',
    followup: 'Ask Yue Lao one more question',
  },
  ja: {
    title: '有料の詳しい解説',
    note: '実際の請求通貨は香港ドル（HKD）です。同じおみくじと状況は二重請求しません。',
    consent:
      '利用規約とプライバシーポリシーを読み、任意で入力した質問を個別の解説生成のため第三者の自動解説サービスへ送信することに同意します。',
    buy: '詳しい解説を購入',
    generate: '詳しい解説を生成',
    view: '購入済みの解説を見る',
    checking: '権利を確認しています…',
    generating: '生成しています。再度支払わないでください…',
    pending: 'まだ決済が確認できません。再度支払わず、しばらく後で確認してください。',
    verify: '支払いを再確認',
    owned: '購入済みです。再購入は不要です。',
    cancelled: 'お支払いをキャンセルしました。',
    failed: '一時的に確認できません。購入済みの場合は再購入しないでください。',
    login: 'ログイン後、このおみくじに戻ります。',
    storage: '決済後に戻るため、セッション保存を有効にしてください。',
    pack: '回数パックはアカウントから利用',
    single: '1回',
    uses: '{0}回',
    per: '1回 {0}',
    popular: '人気',
    from: '1回 {0} から',
    packNote: 'パックは購入後まずこのおみくじに1回使い、残りはアカウントに保存されます（期限なし）。',
    agree: 'お支払いにより利用規約とプライバシーポリシーに同意したものとみなします。',
    followup: '月下老人にもう一つ聞く',
  },
};

export function LiteMarket() {
  const c = WORDS[getLocale()] ?? WORDS.en!;
  const payC = PAY[getLocale()] ?? PAY.en!;
  const [phase, setPhase] = useState<Phase>('ask');
  const [sit, setSit] = useState<Sit | null>(null);
  const [needSit, setNeedSit] = useState(false);
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<Stick | null>(null);
  const [draws, setDraws] = useState(0);
  const [shareNote, setShareNote] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [waitingForPayment, setWaitingForPayment] = useState(false);
  const [payment, setPayment] = useState<PaymentStatus>('idle');
  const [report, setReport] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [inlineVisible, setInlineVisible] = useState(true);
  const [plansVisible, setPlansVisible] = useState(false);
  const inlineRef = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const topRef = useRef<HTMLDivElement>(null);
  const offerRef = useRef<HTMLElement>(null);
  const plansRef = useRef<HTMLDivElement>(null);
  const sampleRef = useRef<HTMLDivElement>(null);
  const seenFor = useRef(0);
  // 範例是站內寫死的 HTML（engine/samples.js，和 3D 月老殿同一份），不含使用者輸入
  useEffect(() => {
    if (sampleRef.current && !sampleRef.current.firstChild)
      sampleRef.current.innerHTML = yuelaoSampleHtml().replace(
        '<details class="deep-sample">',
        '<details class="deep-sample" id="lm-sample">',
      );
  });
  const price = litePrice();
  const plans = litePlans();
  const [plan, setPlan] = useState('unlock_1');
  const [pendingPlan, setPendingPlan] = useState('unlock_1');
  const fill = (tpl: string, v: string) => tpl.replace('{0}', v);
  const fromPrice =
    plans.length > 1 ? plans.reduce((m, p) => (p.perUseAmount < m.perUseAmount ? p : m)).perUse : price;
  const category: OracleCategory = (SITS.find((x) => x.key === sit)?.cat ?? 'single') as OracleCategory;
  const sitWord = sit ? c.sits[SITS.findIndex((x) => x.key === sit)]! : '';
  const reduceMotion = () =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // biome-ignore lint/correctness/useExhaustiveDependencies: 只在載入時接回一次；文案依語言固定
  useEffect(() => {
    // 付款／登入回來（/market#yuelao）：從 sessionStorage 接回同一支籤，問題從不放進網址。
    const pending = takeLitePending();
    const url = new URL(window.location.href);
    const cancelled = url.searchParams.get('pay') === 'cancelled';
    if (cancelled) {
      url.searchParams.delete('pay');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
    if (pending) {
      const restored =
        SITS.find((x) => x.key === pending.sit) ?? SITS.find((x) => x.cat === pending.category);
      setSit(restored?.key ?? 'single');
      setQuestion(pending.question);
      if (pending.plan) setPendingPlan(pending.plan);
      setResult(STICKS[pending.stickId - 1] ?? null);
      setPhase('result');
      setWaitingForPayment(pending.why === 'pay' && !cancelled);
      if (cancelled) setMessage(payC.cancelled);
    }
    setHydrated(true);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh 只用來觸發重新核對
  useEffect(() => {
    if (!hydrated || !result || phase !== 'result') return;
    let cancelled = false;
    const id = result.id;
    const check = async () => {
      setPayment('checking');
      const attempts = waitingForPayment ? 35 : 1;
      for (let i = 0; i < attempts; i++) {
        const access = await liteCheck(id, category);
        if (cancelled) return;
        if (access.state === 'ready' || access.state === 'unlocked') {
          setPayment(access.state);
          setReport(access.state === 'ready' ? access.body : '');
          if (waitingForPayment) setWaitingForPayment(false);
          return;
        }
        if (access.state === 'error') {
          setPayment('error');
          return;
        }
        if (!waitingForPayment) {
          setPayment('none');
          return;
        }
        // 買的是次數包：包到了就先用一次解鎖這支籤（Stripe 通知到之前會回 none，繼續等）
        if (pendingPlan !== 'unlock_1' && (await liteRedeem(id, category)) === 'ok') continue;
        if (i < attempts - 1) await new Promise((r) => setTimeout(r, 2000));
      }
      if (!cancelled) setPayment('pending'); // Never offer a second charge after return.
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, [hydrated, result, category, refresh, waitingForPayment, pendingPlan, phase]);

  // 換畫面就回到頂端
  // biome-ignore lint/correctness/useExhaustiveDependencies: phase 一變就捲回頂端
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, [phase]);

  // 解鎖區塊在螢幕上：記 offer_seen；不在螢幕上（往上看判詞時）底部浮出解鎖鈕
  // biome-ignore lint/correctness/useExhaustiveDependencies: payment 一變（例如核對完才出現方案）就重新掛上觀察
  useEffect(() => {
    if (phase !== 'result' || !result) return;
    const target = offerRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const on = entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.2);
        if (on && seenFor.current !== result.id) {
          seenFor.current = result.id;
          track('offer_view', { product: 'unlock_1', lite: true });
          track('offer_seen', { product: 'unlock_1', lite: true, where: 'section' });
        }
      },
      { threshold: [0, 0.2] },
    );
    observer.observe(target);
    // 判詞下的金色鈕還在畫面上時，不另外浮出底部鈕
    const inline = inlineRef.current;
    const inlineObs = new IntersectionObserver((entries) =>
      setInlineVisible(entries.some((e) => e.isIntersecting)),
    );
    if (inline) inlineObs.observe(inline);
    // 方案與付款鈕在畫面上時，也不浮出底部鈕
    const plansEl = plansRef.current;
    const plansObs = new IntersectionObserver((entries) =>
      setPlansVisible(entries.some((e) => e.isIntersecting)),
    );
    if (plansEl) plansObs.observe(plansEl);
    return () => {
      observer.disconnect();
      inlineObs.disconnect();
      plansObs.disconnect();
    };
  }, [phase, result, payment]);

  const pickQuick = (i: number) => {
    setQuestion(c.quick[i]!);
    setSit(QUICK_SITS[i]!);
    setNeedSit(false);
    track('quick_question_click', { index: i, lite: true });
  };

  const draw = () => {
    if (busy || waitingForPayment) return;
    if (!sit) {
      setNeedSit(true);
      return;
    }
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    const stick = STICKS[bytes[0]! % STICKS.length]!;
    setResult(stick);
    setDraws((n) => n + 1);
    setShareNote('');
    setReport('');
    setConsent(false);
    setMessage('');
    setPlan('unlock_1');
    setPayment('checking');
    setRefresh((n) => n + 1);
    track('ritual_begin', { category, lite: true, hasQuestion: question.trim().length > 0 });
    // 一小段搖籤（減少動態效果時直接出籤）
    if (reduceMotion()) {
      setPhase('result');
    } else {
      setPhase('drawing');
      window.setTimeout(() => setPhase('result'), 2300);
    }
    track('reading_done', { category, lite: true, stickId: stick.id });
  };

  const askAgain = () => {
    if (draws >= 2) setMessage(c.againNudge);
    setPhase('ask');
    setResult(null);
    setPayment('idle');
    setWaitingForPayment(false);
  };

  async function buy() {
    if (!result || busy || inFlight.current || payment !== 'none' || !price) return;
    inFlight.current = true;
    setBusy(true);
    setMessage('');
    track('unlock_click', { product: 'unlock_1', lite: true });
    track('checkout_start', { product: plan, from: 'market', lite: true });
    try {
      const response = await liteCheckout(result.id, category, plan);
      if (response.state === 'login') {
        track('checkout_login_required', { product: plan, lite: true });
        if (!saveLitePending(result.id, category, question, 'login', plan, sit ?? undefined)) {
          setMessage(payC.storage);
          return;
        }
        window.location.assign(localizeHref('/login'));
      } else if (response.state === 'redirect') {
        track('checkout_session_created', { product: plan, lite: true });
        if (!saveLitePending(result.id, category, question, 'pay', plan, sit ?? undefined)) {
          setMessage(payC.storage);
          return;
        }
        window.location.assign(response.url);
      } else if (response.state === 'owned') {
        setPayment('checking');
        setRefresh((n) => n + 1);
      } else {
        track('checkout_api_failure', { product: plan, lite: true, reason: response.state });
        setMessage(payC.failed);
        setPayment('error');
      }
    } catch {
      track('checkout_api_failure', { product: plan, lite: true, reason: 'network' });
      setMessage(payC.failed);
      setPayment('error');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function generate() {
    if (!result || busy || inFlight.current || payment !== 'unlocked' || !consent) return;
    inFlight.current = true;
    setBusy(true);
    setPayment('generating');
    setMessage('');
    try {
      // 和 3D 一樣，把處境一起帶給月老
      const asked = `［${sitWord || c.sits[0]}］${question.trim()}`;
      const status = await liteGenerate(result.id, category, asked);
      if (status === 'error') {
        setPayment('unlocked'); // Keep purchased entitlement and retry option.
        setMessage(payC.failed);
        return;
      }
      for (let i = 0; i < 30; i++) {
        const access = await liteCheck(result.id, category);
        if (access.state === 'ready') {
          setReport(access.body);
          setPayment('ready');
          setQuestion('');
          track('deep_read', { product: 'unlock_1', lite: true });
          return;
        }
        if (access.state === 'error') break;
        if (i < 29) await new Promise((r) => setTimeout(r, 2500));
      }
      setPayment('unlocked');
      setMessage(payC.failed);
    } catch {
      setPayment('unlocked');
      setMessage(payC.failed);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const share = () => {
    if (!result) return;
    // 圖上只放籤與判詞，不放問的那句話（私事）
    void shareVerdict({
      id: result.id,
      no: result.no,
      grade: result.grade,
      poem: result.poem,
      source: result.source,
      verdict: result.verdict[category],
      cat: '',
    }).then((r: string) => {
      track('share_image', { kind: 'sign', result: r, stickId: result.id, lite: true });
      if (r === 'saved') setShareNote(c.saved);
    });
  };

  const toPlans = () => {
    (plansRef.current ?? offerRef.current)?.scrollIntoView({
      block: 'center',
      behavior: reduceMotion() ? 'auto' : 'smooth',
    });
  };

  const readingHref = result ? localizeHref(liteReadingUrl(result.id, category)) : '';
  const checking = payment === 'checking' || payment === 'generating';
  const canPurchase = payment === 'none';
  const canGenerate = payment === 'unlocked';
  const plain = result ? STICK_PLAIN[result.id] : undefined;
  const firstLine = result ? result.poem.split('\n')[0]!.replace(/[，。、；！？,.]+$/, '') : '';
  const chosen = plans.find((p) => p.id === plan);

  /** 解讀正文：【小標】那一行加粗、每段分開（伺服器回來的只當純文字）。 */
  const reportBlocks = report
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b, i) => {
      const head = b.match(/^【[^】]{1,12}】/);
      return (
        // biome-ignore lint/suspicious/noArrayIndexKey: 解讀段落順序固定
        <p key={i}>
          {head && <b>{head[0]}</b>}
          {head ? b.slice(head[0].length).replace(/^\n/, '') : b}
        </p>
      );
    });

  return (
    <main className="lm">
      <div className="lm__sky" ref={topRef}>
        <header className="lm__bar">
          <span className="lm__place">{c.place}</span>
          <a href={localizeHref('/market#yuelao')} className="lm__link">
            {c.threeD}
          </a>
        </header>

        {phase === 'ask' && (
          <section className="lm__ask" aria-labelledby="lm-title">
            <h1 id="lm-title">{c.title}</h1>
            <p className="lm__lead">{c.lead}</p>
            {message && (
              <p className="lm__nudge" role="status">
                {message}
              </p>
            )}
            <label htmlFor="lm-q" className="lm__label">
              {getLocale() === 'en'
                ? 'Your question'
                : getLocale() === 'ja'
                  ? '聞きたいこと'
                  : getLocale() === 'zh-Hans'
                    ? '想问的事'
                    : '想問的事'}
            </label>
            <div className="lm__qbox">
              <textarea
                id="lm-q"
                rows={2}
                maxLength={100}
                placeholder={c.placeholder}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
              <span className="lm__count">{question.length}/100</span>
            </div>
            <p className="lm__label lm__label--small">{c.quickLabel}</p>
            <div className="lm__chips">
              {c.quick.map((q, i) => (
                <button key={q} type="button" onClick={() => pickQuick(i)}>
                  {q}
                </button>
              ))}
            </div>
            <fieldset className="lm__sits" aria-describedby="lm-sit-hint">
              <legend className="lm__label">{c.sitLabel}</legend>
              <div className="lm__chips">
                {SITS.map((s, i) => (
                  <button
                    key={s.key}
                    type="button"
                    aria-pressed={sit === s.key}
                    onClick={() => {
                      setSit(s.key);
                      setNeedSit(false);
                    }}
                  >
                    {c.sits[i]}
                  </button>
                ))}
              </div>
              <p
                id="lm-sit-hint"
                className={needSit ? 'lm__hint is-warn' : 'lm__hint'}
                role={needSit ? 'alert' : undefined}
              >
                {needSit ? c.sitNeeded : c.sitHint}
              </p>
            </fieldset>
            <button className="lm__draw" type="button" onClick={draw} disabled={busy || waitingForPayment}>
              {c.draw}
            </button>
            <p className="lm__fine">{c.notes}</p>
          </section>
        )}

        {phase === 'drawing' && (
          <section className="lm__drawing" aria-live="polite">
            <svg className="lm__tube" viewBox="0 0 120 200" role="img" aria-label={c.drawing}>
              <g className="lm__sticks">
                {[28, 40, 52, 64, 76, 88].map((x, i) => (
                  <rect key={x} x={x} y={i % 2 ? 22 : 30} width="6" height="90" rx="2" fill="#d9b06a" />
                ))}
              </g>
              <rect className="lm__out" x="57" y="10" width="7" height="96" rx="2" fill="#f1d38c" />
              <path d="M18 70 h84 l-8 120 h-68 z" fill="#8c2219" stroke="#dcbb7c" strokeWidth="2" />
              <text x="60" y="140" textAnchor="middle" fontSize="22" fill="#f1d38c" fontFamily="serif">
                籤
              </text>
            </svg>
            <p>{c.drawing}</p>
          </section>
        )}

        {phase === 'result' && result && (
          <>
            <section className="lm__result" aria-labelledby="lm-no">
              {(question.trim() || sitWord) && (
                <p className="lm__asked">
                  {question.trim() ? `${c.asked}．${question.trim()}` : ''}
                  {sitWord && <span>{sitWord}</span>}
                </p>
              )}
              <article className="lm__card">
                <p className="lm__no" id="lm-no">
                  {result.no}
                </p>
                <h2 className="lm__grade">{result.grade}</h2>
                <p className="lm__poem">{result.poem}</p>
                {result.source && <p className="lm__src">{result.source}</p>}
                <i className="lm__rule" />
                <p className="lm__verdict">{result.verdict[category]}</p>
                <span className="lm__seal" aria-hidden="true">
                  月老
                  <br />
                  已批
                </span>
              </article>

              {canPurchase && (
                <div className="lm__inline" ref={inlineRef}>
                  <button type="button" className="lm__gold" onClick={toPlans}>
                    {`${c.sticky}　${plans.length > 1 ? fill(payC.from, fromPrice) : price}`}
                  </button>
                  <p>
                    {c.inlineNote}　
                    <button
                      type="button"
                      className="lm__textlink"
                      onClick={() => {
                        const d = document.getElementById('lm-sample') as HTMLDetailsElement | null;
                        if (d) {
                          d.open = true;
                          d.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' });
                          track('sample_open', { from: 'lite_inline' });
                        }
                      }}
                    >
                      {c.sample}
                    </button>
                  </p>
                </div>
              )}

              {plain && (
                <section className="lm__plain" aria-labelledby="lm-plain">
                  <h3 id="lm-plain">{c.plainTitle}</h3>
                  <dl>
                    <dt>{c.plainLabel}</dt>
                    <dd>{plain.plain}</dd>
                    <dt>{c.originLabel}</dt>
                    <dd>{plain.origin}</dd>
                    <dt>{c.loveLabel}</dt>
                    <dd>{plain.love}</dd>
                  </dl>
                  <a href={localizeHref(`/sign/${result.id}`)}>{c.signPage}</a>
                </section>
              )}
            </section>

            <section ref={offerRef} className="lm__deep" aria-labelledby="lm-deep">
              <h2 id="lm-deep">{c.deepTitle}</h2>
              {checking && <p role="status">{payment === 'generating' ? payC.generating : payC.checking}</p>}
              {payment === 'ready' && (
                <>
                  <div className="lm__report">{reportBlocks}</div>
                  <GuestBindHint />
                  <p className="lm__links">
                    <a href={readingHref}>{payC.view}</a>
                    <a href={`${readingHref}#followup`}>{payC.followup}</a>
                  </p>
                </>
              )}
              {canGenerate && (
                <>
                  <p>{payC.owned}</p>
                  <label className="lm__consent">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                    <span>
                      {payC.consent}{' '}
                      <a href={localizeHref('/terms')} target="_blank" rel="noopener noreferrer">
                        Terms
                      </a>
                      {' · '}
                      <a href={localizeHref('/privacy')} target="_blank" rel="noopener noreferrer">
                        Privacy
                      </a>
                    </span>
                  </label>
                  <button
                    className="lm__pay"
                    type="button"
                    disabled={!consent || busy}
                    onClick={() => void generate()}
                  >
                    {payC.generate}
                  </button>
                </>
              )}
              {canPurchase && (
                <>
                  <p className="lm__teaser">{c.teaser(question.trim(), firstLine, sitWord || c.sits[0])}</p>
                  <ol className="lm__sections">
                    {c.sections.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ol>
                  {plans.length > 1 && (
                    <div className="lm__plans" ref={plansRef} role="radiogroup" aria-label={c.deepTitle}>
                      {plans.map((p) => (
                        <label key={p.id} className={`lm__plan${plan === p.id ? ' is-on' : ''}`}>
                          <input
                            type="radio"
                            name="plan"
                            value={p.id}
                            checked={plan === p.id}
                            onChange={() => setPlan(p.id)}
                          />
                          <b>{p.uses === 1 ? payC.single : fill(payC.uses, String(p.uses))}</b>
                          <span>{p.price}</span>
                          <small>{p.uses > 1 ? fill(payC.per, p.perUse) : c.inlineNote.split('，')[0]}</small>
                          {p.popular && <em>{payC.popular}</em>}
                        </label>
                      ))}
                    </div>
                  )}
                  {plan !== 'unlock_1' && <p className="lm__fine">{payC.packNote}</p>}
                  <button
                    className="lm__pay"
                    type="button"
                    disabled={busy || !price}
                    onClick={() => void buy()}
                  >
                    {`${payC.buy} · ${chosen?.price ?? price}`}
                  </button>
                  <p className="lm__fine">
                    {payC.agree}{' '}
                    <a href={localizeHref('/terms')} target="_blank" rel="noopener noreferrer">
                      Terms
                    </a>
                    {' · '}
                    <a href={localizeHref('/privacy')} target="_blank" rel="noopener noreferrer">
                      Privacy
                    </a>
                  </p>
                  <div className="lm__sample" ref={sampleRef} />
                </>
              )}
              {(payment === 'pending' || payment === 'error') && (
                <>
                  <p role="status">{payment === 'pending' ? payC.pending : payC.failed}</p>
                  <button className="lm__ghost" type="button" onClick={() => setRefresh((n) => n + 1)}>
                    {payC.verify}
                  </button>
                </>
              )}
              {message && payment !== 'idle' && (
                <p role="alert" className="lm__warn">
                  {message}
                </p>
              )}
            </section>

            <section className="lm__after">
              <button type="button" className="lm__ghost" onClick={share}>
                {c.share}
              </button>
              <button
                type="button"
                className="lm__ghost"
                onClick={askAgain}
                disabled={busy || waitingForPayment}
              >
                {c.again}
              </button>
              {shareNote && <p role="status">{shareNote}</p>}
            </section>
          </>
        )}

        <nav className="lm__nav">
          <a href={localizeHref('/account')}>{c.mine}</a>
          <a href={localizeHref('/feedback?from=/market')}>{c.feedback}</a>
          <a href={localizeHref('/')}>{c.home}</a>
        </nav>
      </div>

      {phase === 'result' && canPurchase && !plansVisible && !inlineVisible && (
        <div className="lm__sticky">
          <button type="button" onClick={toPlans}>
            {`${c.sticky} · ${plans.length > 1 ? fill(payC.from, fromPrice) : price}`}
          </button>
        </div>
      )}
    </main>
  );
}
