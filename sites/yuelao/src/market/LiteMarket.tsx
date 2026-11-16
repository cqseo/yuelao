import { useEffect, useRef, useState } from 'react';
import { track } from '~/lib/track';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';
import { STICKS, type Stick } from '~/ritual/sticks';
import { liteCheck, liteCheckout, liteGenerate, litePrice, liteReadingUrl } from './lite-billing';
import { saveLitePending, takeLitePending } from './lite-pending';
import './lite-market.css';

type Situation = 'him' | 'single' | 'reunion';
type PaymentStatus = 'idle' | 'checking' | 'none' | 'pending' | 'unlocked' | 'ready' | 'generating' | 'error';
const WORDS: Record<string, {
  title: string; intro: string; question: string; choices: [string, string, string]; draw: string;
  again: string; reading: string; retry: string; home: string; label: string; notes: string;
}> = {
  'zh-Hant': {
    title: '月老殿 · 輕量模式',
    intro: '這台裝置未能啟動 3D。你仍可在集市裡免費求籤，或改用支援 3D 的裝置享受完整儀式。',
    question: '心裡想問什麼？（可留空）', choices: ['曖昧／問他', '單身／脫單', '想復合'],
    draw: '免費求一支籤', again: '再求一支', reading: '閱讀完整免費判詞', retry: '重試 3D 集市', home: '返回首頁',
    label: '你現在的情況', notes: '數位籤詩是文化體驗與自我整理，不保證感情結果。輕量模式不使用 3D 動畫。',
  },
  'zh-Hans': {
    title: '月老殿 · 轻量模式',
    intro: '这台设备未能启动 3D。你仍可以在集市里免费求签，或使用支持 3D 的设备体验完整仪式。',
    question: '你想问什么？（可留空）', choices: ['暧昧／问他', '单身／脱单', '想复合'],
    draw: '免费求一支签', again: '再求一支', reading: '查看完整免费判词', retry: '重试 3D 集市', home: '返回首页',
    label: '你目前的情况', notes: '数字签诗仅供文化体验与自我整理，不保证感情结果。轻量模式不使用 3D 动画。',
  },
  en: {
    title: 'Yuelao Hall · Lightweight mode',
    intro: '3D could not start on this device. You can still draw a free stick within the market page.',
    question: 'What is on your mind? (optional)', choices: ['A person I like', 'Finding love', 'Reconciliation'],
    draw: 'Draw a free stick', again: 'Draw again', reading: 'Read full free interpretation', retry: 'Retry 3D market', home: 'Back to home',
    label: 'Your situation', notes: 'A cultural reflection activity, not a prediction of relationship outcomes.',
  },
  ja: {
    title: '月老殿 · 軽量モード',
    intro: 'この端末では3Dを開始できませんでした。同じ市場ページで無料のおみくじを引けます。',
    question: '何について考えていますか？（任意）', choices: ['気になる人', '出会い', '復縁'],
    draw: '無料で引く', again: 'もう一度', reading: '無料の解説を読む', retry: '3D市場を再試行', home: 'トップに戻る',
    label: '現在の状況', notes: '文化体験と自己省察を目的とし、結果を保証するものではありません。',
  },
};

const SITUATIONS: Situation[] = ['him', 'single', 'reunion'];
const PAY: Record<string, {
  title: string; note: string; consent: string; buy: string; generate: string; view: string;
  checking: string; generating: string; pending: string; verify: string; owned: string;
  cancelled: string; failed: string; login: string; storage: string; pack: string;
}> = {
  'zh-Hant': {
    title: '付費完整解籤', note: '單次港幣 HKD 付款。已解鎖同一支籤與情境時，不再重複收費。',
    consent: '我已閱讀條款和隱私說明，同意將自願輸入的問題交由第三方 AI 生成個人化解籤。',
    buy: '解鎖完整解籤', generate: '請月老寫我的完整解籤', view: '在帳戶查看完整解籤',
    checking: '正在核對有沒有已購權益…', generating: '正在寫完整解籤，請勿重複付款…',
    pending: '付款尚未確認，請勿重複付款。可稍後再核對或在帳戶查看紀錄。',
    verify: '重新確認付款／解鎖狀態', owned: '已解鎖，無需再次付款。',
    cancelled: '已取消付款，這支籤仍保留。', failed: '暫時無法核對或生成。若已付款，請先查看帳戶，勿重複付款。',
    login: '請先登入，回來後會接著這支籤。', storage: '瀏覽器未能保存求籤進度，為防付款後遺失記錄，請允許工作階段儲存。',
    pack: '已有問事包？去帳戶兌換',
  },
  'zh-Hans': {
    title: '付费完整解签', note: '单次港币 HKD 付款。已解锁同一支签与情境不会重复收费。',
    consent: '我已阅读条款和隐私说明，同意将自愿输入的问题提供给第三方 AI 生成个性化解签。',
    buy: '解锁完整解签', generate: '请月老写我的完整解签', view: '在账户查看完整解签',
    checking: '正在核对已购权益…', generating: '正在生成完整解签，请勿重复付款…',
    pending: '付款尚未确认，请勿重复付款。可稍后核对或在账户查看订单。',
    verify: '重新核对付款／解锁状态', owned: '已解锁，无需再次付款。',
    cancelled: '已取消付款，这支签仍然保留。', failed: '暂时无法核对或生成。若已付款，请先查看账户，不要重复付款。',
    login: '请先登录，回来后继续这支签。', storage: '浏览器无法保存求签进度。请允许会话存储，以免付款返回后丢失记录。',
    pack: '已有问事包？前往账户兑换',
  },
  en: {
    title: 'Optional paid in-depth reading', note: 'Actual charge is in HKD. The same stick/category is never charged twice after unlocking.',
    consent: 'I have read the Terms and Privacy Policy, and agree to send my optional question to a third-party AI service to create a personalized reading.',
    buy: 'Unlock full reading', generate: 'Generate my full reading', view: 'View saved reading in my account',
    checking: 'Checking existing access…', generating: 'Generating your reading. Do not pay again…',
    pending: 'Payment has not yet been confirmed. Do not pay again; check later or view your account.',
    verify: 'Check payment and access again', owned: 'Already unlocked. No second payment is needed.',
    cancelled: 'Checkout cancelled. Your stick is still here.', failed: 'Cannot verify or generate right now. If you paid, check your account before buying again.',
    login: 'Sign in first, then return to this stick.', storage: 'Session storage is unavailable. Enable it to keep your reading across checkout.',
    pack: 'Already have a question pack? Redeem in your account',
  },
  ja: {
    title: '有料の詳しい解説', note: '実際の請求通貨は香港ドル（HKD）です。同じおみくじと状況は二重請求しません。',
    consent: '利用規約とプライバシーポリシーを読み、任意の質問を第三者AIサービスに送信することに同意します。',
    buy: '詳しい解説を購入', generate: '詳しい解説を生成', view: '購入済みの解説を見る',
    checking: '権利を確認しています…', generating: '生成しています。再度支払わないでください…',
    pending: 'まだ決済が確認できません。再度支払わず、しばらく後で確認してください。',
    verify: '支払いを再確認', owned: '購入済みです。再購入は不要です。',
    cancelled: 'お支払いをキャンセルしました。', failed: '一時的に確認できません。購入済みの場合は再購入しないでください。',
    login: 'ログイン後、このおみくじに戻ります。', storage: '決済後に戻るため、セッション保存を有効にしてください。',
    pack: '回数パックはアカウントから利用',
  },
};


export function LiteMarket() {
  const c = WORDS[getLocale()] ?? WORDS.en!;
  const [situation, setSituation] = useState<Situation>('him');
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<Stick | null>(null);
  const draw = () => {
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    const stick = STICKS[bytes[0]! % STICKS.length]!;
    setResult(stick);
    track('ritual_begin', { category: situation, lite: true, hasQuestion: question.trim().length > 0 });
    track('reading_done', { category: situation, lite: true, stickId: stick.id });
  };

  return (
    <main className="lite-market">
      <div className="lite-market__night">
        <article className="lite-market__paper">
          <p className="lite-market__eyebrow">YUEXIA · 月下集市</p>
          <h1>{c.title}</h1>
          <p>{c.intro}</p>
          <label htmlFor="lite-question">{c.question}</label>
          <textarea
            id="lite-question"
            rows={2}
            maxLength={100}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <fieldset>
            <legend>{c.label}</legend>
            <div className="lite-market__choices">
              {SITUATIONS.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={situation === s}
                  onClick={() => { setSituation(s); setResult(null); }}
                >{c.choices[i]}</button>
              ))}
            </div>
          </fieldset>
          <button className="lite-market__draw" type="button" onClick={draw}>{result ? c.again : c.draw}</button>
          {result && (
            <section className="lite-market__result" aria-live="polite">
              <h2>{result.no} · {result.grade}</h2>
              <p className="lite-market__poem">{result.poem}</p>
              <p>{result.verdict[situation]}</p>
              <a href={localizeHref('/sign/' + result.id)}>{c.reading}</a>
            </section>
          )}
          <p className="lite-market__note">{c.notes}</p>
          <nav className="lite-market__nav">
            <a href={localizeHref('/account')}>{getLocale() === 'en' ? 'My paid readings' : getLocale() === 'ja' ? '購入済み解説' : getLocale() === 'zh-Hans' ? '我的已购解读' : '我的已購解讀'}</a>
            <a href={localizeHref('/market#yuelao')}>{c.retry}</a>
            <a href={localizeHref('/')}>{c.home}</a>
          </nav>
        </article>
      </div>
    </main>
  );
}
