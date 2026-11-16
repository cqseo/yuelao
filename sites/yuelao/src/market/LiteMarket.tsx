import { useState } from 'react';
import { track } from '~/lib/track';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';
import { STICKS, type Stick } from '~/ritual/sticks';
import './lite-market.css';

type Situation = 'him' | 'single' | 'reunion';
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
            <a href={localizeHref('/market#yuelao')}>{c.retry}</a>
            <a href={localizeHref('/')}>{c.home}</a>
          </nav>
        </article>
      </div>
    </main>
  );
}
