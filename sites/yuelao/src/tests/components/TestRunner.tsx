import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { track } from '~/lib/track';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';
import { getTest, inLocale, type TestDefinition } from '../catalog';
import { type Answer, evaluateQuiz } from '../engine';

export function TestRunner({ test }: { test: TestDefinition }) {
  const locale = getLocale();
  const zh = locale === 'zh-Hans';
  const copy = (traditional: string, simplified: string) => (zh ? simplified : traditional);
  const [answers, setAnswers] = useState<Array<Answer | null>>(() =>
    Array.from({ length: test.questions.length }, () => null),
  );
  const [position, setPosition] = useState(0);
  const [complete, setComplete] = useState(false);
  const [shareStatus, setShareStatus] = useState('');
  const total = test.questions.length;
  const selected = answers[position];
  const result = complete ? evaluateQuiz(test, answers) : null;
  const related = getTest(test.related);

  const choose = (answer: Answer) => {
    if (position === 0 && answers[0] === null) {
      track('test_started', { quiz_id: test.slug });
    }
    setAnswers((current) => current.map((value, i) => (i === position ? answer : value)));
  };

  const next = () => {
    if (selected === null) return;
    if (position < total - 1) {
      setPosition((i) => i + 1);
      return;
    }
    // Track completion only; never collect answers, inferred results, or personal details.
    track('test_completed', { quiz_id: test.slug });
    setComplete(true);
  };

  const reset = () => {
    setAnswers(Array.from({ length: total }, () => null));
    setPosition(0);
    setComplete(false);
    setShareStatus('');
  };

  const share = async () => {
    const url = new URL(window.location.pathname, window.location.origin).toString();
    const text = copy('這份免費的情感自查也許能幫你整理想法。', '这份免费的情感自查也许能帮你整理想法。');
    // Share the quiz invitation, never private results or the user's answers.
    try {
      if (navigator.share) {
        await navigator.share({ title: inLocale(test.title, locale), text, url });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setShareStatus(copy('已複製測驗連結', '已复制测试链接'));
        return;
      }
    } catch {
      // A cancelled share or unavailable clipboard is not a fatal error.
    }
    setShareStatus(copy('請複製瀏覽器網址分享', '请复制浏览器网址分享'));
  };

  return (
    <div className="quiz-panel" key={test.slug}>
      {result ? (
        <section className="quiz-result" aria-labelledby="quiz-result-heading">
          <p className="quiz-kicker">
            {copy('你的自我整理', '你的自我整理')} · {copy('已完成', '已完成')}
          </p>
          <h2 id="quiz-result-heading">{inLocale(test.outcomes[result.band].heading, locale)}</h2>
          <p className="quiz-result-lead">{inLocale(test.outcomes[result.band].explanation, locale)}</p>
          <div className="quiz-fact">
            <span className="quiz-fact-number">
              {result.concerns} / {result.answered}
            </span>
            <span>
              {copy(
                '題選擇了「經常」；這是回答摘要，不是出軌率或人格分數。',
                '题选择了“经常”；这是回答摘要，不是出轨率或人格分数。',
              )}
            </span>
          </div>
          <div className="quiz-advice">
            <h3>{copy('可以先做的一件事', '可以先做的一件事')}</h3>
            <p>{inLocale(test.outcomes[result.band].step, locale)}</p>
          </div>
          <p className="quiz-caution">{inLocale(test.caution, locale)}</p>
          <div className="quiz-actions">
            <button type="button" className="quiz-button" onClick={reset}>
              {copy('重新測驗', '重新测试')}
            </button>
            <button type="button" className="quiz-button secondary" onClick={() => void share()}>
              {copy('分享測驗', '分享测试')}
            </button>
          </div>
          {shareStatus && (
            <p className="quiz-note" role="status">
              {shareStatus}
            </p>
          )}
          <div className="quiz-related">
            <h3>{copy('接下來，你也可以', '接下来，你也可以')}</h3>
            <div className="quiz-related-links">
              <Link to={localizeHref('/ritual')}>
                {copy('求一支月老籤，換個角度整理心事', '求一支月老签，换个角度整理心事')}
              </Link>
              {related && (
                <Link to={localizeHref(`/tests/${related.slug}`)}>{inLocale(related.title, locale)}</Link>
              )}
            </div>
            <p className="quiz-note">
              {copy(
                '月老籤提供文化與自我反思體驗，不是對現實事件的預言。',
                '月老签提供文化与自我反思体验，不是对现实事件的预言。',
              )}
            </p>
          </div>
        </section>
      ) : (
        <section aria-label={copy('正在進行的測驗', '正在进行的测试')}>
          <div className="quiz-progress-header">
            <span>{copy('情感自查', '情感自查')}</span>
            <span>
              {position + 1} / {total}
            </span>
          </div>
          <div
            className="quiz-progress"
            role="progressbar"
            aria-label={copy('測驗進度', '测试进度')}
            aria-valuenow={position + 1}
            aria-valuemin={0}
            aria-valuemax={total}
          >
            <span style={{ width: `${((position + 1) / total) * 100}%` }} />
          </div>
          <fieldset className="quiz-question" key={position}>
            <legend>
              <span className="quiz-question-index">0{position + 1}</span>
              {inLocale(test.questions[position]!, locale)}
            </legend>
            <div className="quiz-options">
              {([copy('很少或沒有', '很少或没有'), copy('偶爾', '偶尔'), copy('經常', '经常')] as const).map(
                (label, value) => (
                  <label className={`quiz-option ${selected === value ? 'selected' : ''}`} key={label}>
                    <input
                      type="radio"
                      name={`question-${position}`}
                      value={value}
                      checked={selected === value}
                      onChange={() => choose(value as Answer)}
                    />
                    <span>{label}</span>
                    <span className="quiz-option-mark" aria-hidden="true">
                      {selected === value ? '✓' : '○'}
                    </span>
                  </label>
                ),
              )}
            </div>
          </fieldset>
          <div className="quiz-actions">
            <button
              type="button"
              className="quiz-button secondary"
              disabled={position === 0}
              onClick={() => setPosition((i) => Math.max(0, i - 1))}
            >
              {copy('上一題', '上一题')}
            </button>
            <button type="button" className="quiz-button" disabled={selected === null} onClick={next}>
              {position === total - 1 ? copy('查看免費結果', '查看免费结果') : copy('下一題', '下一题')}
            </button>
          </div>
          <p className="quiz-note">
            {copy(
              '無需登入；回答只用於本次頁面計算，重新整理就會清除。',
              '无需登录；回答只用于本次页面计算，刷新就会清除。',
            )}
          </p>
        </section>
      )}
    </div>
  );
}
