import { createFileRoute, Link } from '@tanstack/react-router';
import { pageHead } from '@yuelao/core/seo';
import { useEffect, useRef, useState } from 'react';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';
import { COMPANION_START, COMPANION_STARTERS, type CompanionTheme, guidedReply } from '~/site/companion';
import site from '../../site.config';

export const Route = createFileRoute('/chat')({
  head: () =>
    pageHead(site, {
      title: '與月老聊聊｜免費情感陪伴 · 月老',
      description:
        '把曖昧、分手、關係困惑慢慢說出來。月老免費引導式對話陪你整理情緒、理解界線；目前為互動指引，非即時 AI 模型。',
      path: localizeHref('/chat', { locale: getLocale() }),
    }),
  component: CompanionPage,
});

type Message = { id: number; role: 'assistant' | 'user'; text: string };

function CompanionPage() {
  const locale = getLocale();
  const zh = locale === 'zh-Hans';
  const t = (hant: string, hans: string) => (zh ? hans : hant);
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, role: 'assistant', text: COMPANION_START[locale] },
  ]);
  const [theme, setTheme] = useState<CompanionTheme>('general');
  const [question, setQuestion] = useState('');
  const [turn, setTurn] = useState(0);
  const [suggestions, setSuggestions] = useState(COMPANION_STARTERS.map((s) => s[locale]));
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const composing = useRef(false);

  const lastMessageId = messages[messages.length - 1]?.id;
  useEffect(() => {
    if (lastMessageId !== undefined) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [lastMessageId]);

  function send(text: string) {
    const value = text.trim().slice(0, 400);
    if (!value || busy) return;
    setBusy(true);
    const reply = guidedReply(value, theme, turn, locale);
    const userId = nextId.current++;
    const answerId = nextId.current++;
    const additions: Message[] = [
      { id: userId, role: 'user', text: value },
      { id: answerId, role: 'assistant', text: reply.text },
    ];
    setMessages((current) => [...current, ...additions].slice(-30));
    setTheme(reply.theme);
    setSuggestions(reply.followups);
    setTurn((n) => n + 1);
    setQuestion('');
    setBusy(false);
  }

  function reset() {
    setMessages([{ id: 0, role: 'assistant', text: COMPANION_START[locale] }]);
    setTheme('general');
    setSuggestions(COMPANION_STARTERS.map((s) => s[locale]));
    setTurn(0);
    setQuestion('');
    nextId.current = 1;
  }

  return (
    <article className="serene-page chat-page">
      <div className="serene-backline">
        <Link to={localizeHref('/')}>{t('← 回到月老', '← 回到月老')}</Link>
        <span>{t('心事不必整理好了才說', '心事不必整理好了才说')}</span>
      </div>

      <header className="chat-heading">
        <span className="serene-eyebrow">A QUIET CONVERSATION / 月下對話</span>
        <h1>{t('月老，聽我說。', '月老，听我说。')}</h1>
        <p>{t('有些話，不必急著得到答案。從一句心事開始。', '有些话，不必急着得到答案。从一句心事开始。')}</p>
      </header>

      <div className="chat-layout">
        <aside className="chat-aside">
          <div className="chat-symbol" aria-hidden="true">
            <div className="chat-thread-ring">
              <span>緣</span>
            </div>
            <span className="chat-symbol-caption">
              {t('願你心明，亦被溫柔以待', '愿你心明，亦被温柔以待')}
            </span>
          </div>
          <p className="serene-eyebrow">{t('月老想對你說', '月老想对你说')}</p>
          <blockquote>
            {t(
              '世間最好的紅線，不是綁住誰，而是牽著人走向清楚與自在。',
              '世间最好的红线，不是绑住谁，而是牵着人走向清楚与自在。',
            )}
          </blockquote>
          <Link to={localizeHref('/daily')}>{t('先領今日心箋', '先领今日心笺')} ↗</Link>
        </aside>

        <section className="chat-panel" aria-label={t('與月老的對話', '与月老的对话')}>
          <div className="chat-panel-head">
            <div>
              <span className="chat-online-dot" aria-hidden="true" />
              <strong>{t('月老 · 心語', '月老 · 心语')}</strong>
              <small>{t('免費互動指引', '免费互动指引')}</small>
            </div>
            <button type="button" onClick={reset}>
              {t('清除對話', '清除对话')}
            </button>
          </div>

          <div className="chat-transcript" aria-live="polite" aria-relevant="additions text">
            {messages.map((message) => (
              <div key={message.id} className={`chat-message ${message.role}`}>
                <div className="chat-message-avatar" aria-hidden="true">
                  {message.role === 'assistant' ? '月' : t('我', '我')}
                </div>
                <div className="chat-message-body">
                  <span className="chat-message-name">
                    {message.role === 'assistant' ? t('月老', '月老') : t('你', '你')}
                  </span>
                  <p>{message.text}</p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {suggestions.length > 0 && (
            <div className="chat-prompts">
              {suggestions.map((suggestion) => (
                <button type="button" key={suggestion} onClick={() => send(suggestion)} disabled={busy}>
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <form
            className="chat-composer"
            onSubmit={(event) => {
              event.preventDefault();
              send(question);
            }}
          >
            <label htmlFor="chat-input">{t('寫下你的心事', '写下你的心事')}</label>
            <div>
              <textarea
                id="chat-input"
                value={question}
                onChange={(e) => setQuestion(e.target.value.slice(0, 400))}
                onCompositionStart={() => {
                  composing.current = true;
                }}
                onCompositionEnd={() => {
                  composing.current = false;
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !composing.current) {
                    event.preventDefault();
                    send(question);
                  }
                }}
                rows={2}
                maxLength={400}
                placeholder={t('想說什麼，都可以從這裡開始…', '想说什么，都可以从这里开始…')}
              />
              <button
                type="submit"
                disabled={!question.trim() || busy}
                aria-label={t('送出心事', '发送心事')}
              >
                ↗
              </button>
            </div>
            <p>{t('Enter 送出 · Shift + Enter 換行', 'Enter 发送 · Shift + Enter 换行')}</p>
          </form>
          <p className="chat-privacy">
            {t(
              '目前為免費的預設情境引導式對話，並非即時 AI 或真人諮詢。內容只留在本頁，不傳送伺服器，也不會替你斷定別人的想法。',
              '目前为免费的预设情境引导式对话，并非实时 AI 或真人咨询。内容只留在本页，不发送服务器，也不会替你断定别人的想法。',
            )}
          </p>
        </section>
      </div>
    </article>
  );
}
