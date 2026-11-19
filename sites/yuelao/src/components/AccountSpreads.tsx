import { pillarName, STEMS, stemElement } from '@yuelao/core/bazi';
import { SIGNS, ZODIAC } from '@yuelao/core/match';
import { cardName, parseSpread } from '@yuelao/core/spread';
import { useState } from 'react';
import { uiPrefix } from '~/i18n/locale';
import { tr } from '~/i18n/ui';
import { track } from '~/lib/track';
import { liteRequest } from '~/market/lite-billing';
import { caiStickByNo } from '~/ritual/caishen';

// 帳戶頁：塔羅館、算命攤買過的完整解讀（2026-11-19）。以前只能回原處填一樣的資料才找得回來；
// 現在直接列在這裡。已付款但還沒生成的，可以在這裡請伺服器動筆（問題沒存，所以不針對問題寫）。

export type AccountSpread = { spread: string; locale: string; createdAt: string; body: string | null };

function describe(key: string): { kind: [string, string]; detail: string } {
  const p = parseSpread(key);
  if (!p) return { kind: ['完整解讀', '完整解读'], detail: '' };
  if (p.deck === 'match')
    return {
      kind: ['合緣配對', '合缘配对'],
      detail: `${ZODIAC[p.a.zodiac - 1]}（${SIGNS[p.a.sign - 1]}）× ${ZODIAC[p.b.zodiac - 1]}（${SIGNS[p.b.sign - 1]}）`,
    };
  if (p.deck === 'love')
    return {
      kind: ['個人姻緣盤', '个人姻缘盘'],
      detail: `屬${ZODIAC[p.zodiac - 1]}．${SIGNS[p.sign - 1]}．${p.year} 年`,
    };
  if (p.deck === 'bazi')
    return {
      kind:
        p.topic === 'year'
          ? [`${p.flow} 年運`, `${p.flow} 年运`]
          : p.topic === 'career'
            ? ['八字．事業', '八字．事业']
            : p.topic === 'wealth'
              ? ['八字．財運', '八字．财运']
              : ['八字命盤', '八字命盘'],
      detail: `${[p.year, p.month, p.day].map(pillarName).join(' ')}${p.hour ? ` ${pillarName(p.hour)}` : ''}．${STEMS[p.day.stem]}${stemElement(p.day.stem)}日主`,
    };
  if (p.deck === 'cai') {
    const st = caiStickByNo(p.no);
    return {
      kind: p.topic === 'career' ? ['求財籤．事業', '求财签．事业'] : ['求財籤．財運', '求财签．财运'],
      detail: st ? `第 ${st.no} 籤．${st.grade}` : `第 ${p.no} 籤`,
    };
  }
  return {
    kind: p.deck === 'lnm' ? ['雷諾曼', '雷诺曼'] : ['塔羅', '塔罗'],
    detail: p.cards.map((c) => `${cardName(p.deck, c.id)}${c.reversed ? '（逆）' : ''}`).join('、'),
  };
}

function Body({ text }: { text: string }) {
  return (
    <div className="account-spread-body">
      {text
        .split(/\n{2,}/)
        .map((b) => b.trim())
        .filter(Boolean)
        .map((b, i) => {
          const head = b.match(/^【[^】]{1,12}】/);
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: static paragraphs of one reading
            <p key={i}>
              {head && <b>{head[0]}</b>}
              {head ? b.slice(head[0].length).replace(/^\n/, '') : b}
            </p>
          );
        })}
    </div>
  );
}

export function AccountSpreads({ items, zh }: { items: AccountSpread[]; zh: boolean }) {
  const t = (hant: string, hans: string) => (zh ? hans : tr(hant));
  const [bodies, setBodies] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  if (!items.length) return null;

  async function generate(item: AccountSpread) {
    if (busy) return;
    setBusy(item.spread);
    setError('');
    track('account_spread_generate');
    try {
      const res = await liteRequest('/api/account/spread/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          spread: item.spread,
          locale: item.locale,
          ui: uiPrefix(),
          question: '',
          sit: '',
          consent: true,
        }),
      });
      if (!res.ok && res.status !== 202) throw new Error('generate_failed');
      for (let i = 0; i < 30; i++) {
        const r = await liteRequest(
          `/api/account/spread?spread=${encodeURIComponent(item.spread)}&locale=${encodeURIComponent(item.locale)}`,
        );
        if (r.ok) {
          const d = (await r.json()) as { state?: string; body?: string };
          if (d.state === 'ready' && d.body) {
            setBodies((b) => ({ ...b, [item.spread]: d.body! }));
            return;
          }
        }
        await new Promise((r) => setTimeout(r, 2500));
      }
      throw new Error('timeout');
    } catch {
      setError(
        t('這次沒寫成。已付款的不會重複扣款，請再試一次。', '这次没写成。已付款的不会重复扣款，请再试一次。'),
      );
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="account-panel" aria-labelledby="account-spreads">
      <h2 id="account-spreads">{t('塔羅館、算命攤的完整解讀', '塔罗馆、算命摊的完整解读')}</h2>
      <ul className="account-spreads">
        {items.map((item) => {
          const d = describe(item.spread);
          const body = item.body ?? bodies[item.spread];
          return (
            <li key={`${item.spread}|${item.locale}`}>
              <details>
                <summary>
                  <b>{t(d.kind[0], d.kind[1])}</b>
                  <span>{d.detail}</span>
                  <small>{new Date(item.createdAt).toLocaleDateString(zh ? 'zh-CN' : 'zh-TW')}</small>
                </summary>
                {body ? (
                  <Body text={body} />
                ) : (
                  <div className="account-spread-pending">
                    <p>
                      {t(
                        '已付款，還沒生成。可以回到原處、填一樣的資料，讓解讀針對你的問題寫；或在這裡直接生成（不針對問題）。',
                        '已付款，还没生成。可以回到原处、填一样的资料，让解读针对你的问题写；或在这里直接生成（不针对问题）。',
                      )}
                    </p>
                    <button type="button" disabled={!!busy} onClick={() => void generate(item)}>
                      {busy === item.spread
                        ? t('正在寫，大約半分鐘…', '正在写，大约半分钟…')
                        : t('直接生成', '直接生成')}
                    </button>
                  </div>
                )}
              </details>
            </li>
          );
        })}
      </ul>
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
    </section>
  );
}
