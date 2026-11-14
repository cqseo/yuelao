import { audio, localPath } from './util.js';

// 許願池：池邊的面板。寫一句願望、繫一條紅線；看樹上大家掛的願望牌，替別人「同願」，或檢舉。
// 讀寫都經 Market.tsx 傳進來的 api（它再呼叫 /api/wishes），這裡不碰網路細節。
// 所有使用者寫的字一律用 textContent 或先跳脫，絕不當 HTML 塞進畫面。

export const WISH_TAGS = [
  ['seek', '求緣'],
  ['keep', '守緣'],
  ['reunion', '復合'],
  ['self', '為自己'],
  ['others', '為別人'],
];
const TAG_NAME = Object.fromEntries(WISH_TAGS);
const REASONS = [
  ['personal_info', '露了個人資料'],
  ['harassment', '騷擾或攻擊'],
  ['sexual', '色情'],
  ['spam', '廣告'],
  ['other', '其他'],
];
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

function ago(iso) {
  const m = (Date.now() - new Date(iso).getTime()) / 60000;
  if (!(m >= 0)) return '';
  if (m < 60) return '剛剛';
  if (m < 60 * 24) return `${Math.floor(m / 60)} 小時前`;
  return `${Math.floor(m / 60 / 24)} 天前`;
}

const ERRORS = {
  wish_contact: '願望裡好像有電話、帳號或聯絡方式。掛在樹上人人看得到，拿掉再繫吧。',
  wish_link: '願望裡不能放連結。',
  wish_abuse: '這句話掛不上樹。換個說法，好好許一個願吧。',
  wish_flagged: '這句話沒通過審核，換個說法再試一次。',
  invalid_wish: '一句話就好，四十個字以內，不換行。',
  daily_limit: '今天已經繫過一條紅線了，明天再來。',
  site_cap: '今天池邊的紅線已經繫滿了，明天早點來。',
  login_required: '要先登入才能許願。',
  wishes_disabled: '許願池還在準備，過幾天再來。',
};

/**
 * @param {{ ui: any, world: any, api: any, emit: (n: string, p?: object) => void, onClose: () => void }} o
 */
export function createPool({ ui, world, api, emit, onClose }) {
  let data = null; // 最近一次 list() 的結果
  let open = false;
  let tag = 'seek';
  let draft = '';
  let note = '';
  let care = false;
  let busy = false;
  let reporting = null; // 正在選檢舉理由的願望 id
  let focus = null; // 從樹上點開的那一塊
  let fresh = null;

  async function refresh() {
    if (!api) return false;
    const next = await api.list();
    if (!next) return false;
    data = next;
    world.setWishes(
      data.wishes.filter((w) => w.status === 'shown'),
      fresh,
    );
    fresh = null;
    if (open) render();
    return true;
  }

  function mineToday() {
    if (!data) return null;
    const today = new Date().toISOString().slice(0, 10);
    return data.wishes.find((w) => w.mine && w.createdAt.slice(0, 10) === today) || null;
  }

  function writeBlock() {
    if (!api || !data) return '<p class="note">正在看樹上掛了哪些願望。</p>';
    if (!data.enabled) return '<p class="note">許願池還在準備，現在只能看看。過幾天再來繫紅線。</p>';
    if (data.loginRequired)
      return `<p class="note">寫願望要先登入。掛上樹的願望人人看得到，但不會顯示是誰寫的。</p>
        <button class="ghost linkbtn" data-a="login">去登入</button>`;
    const mine = mineToday();
    if (mine)
      return `<div class="wish mine">
          <p class="kicker">你今天的願望</p>
          <p class="body">${esc(mine.body)}</p>
          <div class="meta"><span>${TAG_NAME[mine.tag] || ''}　${mine.status === 'shown' ? '已掛上樹' : '等待審核，通過後掛上樹'}</span>
          <button class="tiny" data-a="withdraw:${esc(mine.id)}">撤下</button></div>
        </div>`;
    if (!data.canWish) return '<p class="note">今天已經繫過一條紅線了，明天再來。</p>';
    return `<p class="kicker">許一個願</p>
      <div class="chips wish-tags">${WISH_TAGS.map(
        ([id, name]) =>
          `<button type="button" data-a="tag:${id}" class="${tag === id ? 'on' : ''}">${name}</button>`,
      ).join('')}</div>
      <form class="ask" id="wish-form">
        <input id="wish-input" maxlength="${data.maxChars || 40}" autocomplete="off" placeholder="一句話就好" aria-label="你的願望" />
        <button class="seal" type="submit"${busy ? ' disabled' : ''}>繫上紅線</button>
      </form>
      <p class="note small">不寫全名、電話或帳號。願望先經審核再掛上樹，人人看得到，但不會顯示是誰寫的；一天一個。<a href="/privacy">隱私說明</a></p>`;
  }

  function wishItem(w) {
    const actions =
      reporting === w.id
        ? `<div class="chips report">${REASONS.map(([id, name]) => `<button type="button" data-a="reason:${esc(w.id)}:${id}">${name}</button>`).join('')}<button type="button" data-a="cancel">不檢舉了</button></div>`
        : `<div class="meta"><span>${TAG_NAME[w.tag] || ''}　${ago(w.createdAt)}</span>
            ${
              w.mine
                ? '<span class="own">你的</span>'
                : `<button class="bless${w.blessed ? ' on' : ''}" data-a="bless:${esc(w.id)}" aria-pressed="${w.blessed}">同願 ${w.blessings || ''}</button>
                   <button class="tiny" data-a="report:${esc(w.id)}">檢舉</button>`
            }</div>`;
    return `<li class="wish${focus === w.id ? ' focus' : ''}${w.mine ? ' mine' : ''}" id="wish-${esc(w.id)}">
      <p class="body">${esc(w.body)}</p>${actions}</li>`;
  }

  function render() {
    if (!open) return;
    const shown = data ? data.wishes.filter((w) => w.status === 'shown') : [];
    if (focus) {
      const i = shown.findIndex((w) => w.id === focus);
      if (i > 0) shown.unshift(...shown.splice(i, 1));
    }
    ui.panel(
      `<h2>許願池</h2>
       ${care ? `<div class="care"><p>聽起來你現在很不好受。這不是一個人扛的事——找一個信得過的人說說，或聯絡當地的心理支持熱線；如果有立即的危險，請打當地的緊急電話。</p><button class="tiny" data-a="care-ok">我知道了</button></div>` : ''}
       ${writeBlock()}
       <p class="note" id="wish-note" role="status">${esc(note)}</p>
       <p class="kicker">樹上的願望</p>
       ${shown.length ? `<ul class="wishes">${shown.map(wishItem).join('')}</ul>` : '<p class="note">樹上還沒有願望牌。你可以掛第一塊。</p>'}
       <button class="ghost" data-a="close">離開池邊</button>`,
      act,
      true,
    );
    const form = document.getElementById('wish-form');
    const input = document.getElementById('wish-input');
    if (input) {
      input.value = draft;
      input.oninput = () => {
        draft = input.value;
      };
    }
    if (form)
      form.onsubmit = (e) => {
        e.preventDefault();
        void make();
      };
    if (focus) document.getElementById(`wish-${focus}`)?.scrollIntoView({ block: 'nearest' });
  }

  async function make() {
    const body = draft.replace(/\s+/g, ' ').trim();
    if (!body || busy) return;
    busy = true;
    note = '正在繫紅線';
    care = false;
    render();
    const r = await api.make(body, tag);
    busy = false;
    if (r.ok) {
      draft = '';
      emit('wish_make', { tag, status: r.status });
      audio.bell(392, 0.18, 4);
      note = r.status === 'shown' ? '紅線繫好了，願望牌掛上樹了。' : '紅線繫好了。願望等審核通過就會掛上樹。';
      fresh = r.id;
      await refresh();
      return;
    }
    if (r.care) care = true;
    note = r.care ? '' : ERRORS[r.code] || '這會兒池邊太擠，稍後再試。';
    if (r.code === 'login_required') await refresh();
    render();
  }

  async function act(a) {
    const [cmd, id, extra] = a.split(':');
    if (cmd === 'close') return close();
    if (cmd === 'login') {
      api.leaving();
      location.assign(localPath('/login'));
      return;
    }
    if (cmd === 'care-ok') {
      care = false;
      return render();
    }
    if (cmd === 'tag') {
      tag = id;
      return render();
    }
    if (cmd === 'cancel') {
      reporting = null;
      return render();
    }
    if (cmd === 'report') {
      if (data?.loginRequired) {
        note = '登入後才能檢舉。';
        return render();
      }
      reporting = id;
      return render();
    }
    if (busy) return;
    busy = true;
    let r;
    if (cmd === 'bless') {
      if (data?.loginRequired) {
        busy = false;
        note = '登入後才能同願。';
        return render();
      }
      r = await api.bless(id);
      if (r.ok && r.result === 'blessed') {
        emit('wish_bless');
        audio.tick(660, 0.05, 0.05);
        note = '你也替這個願望繫了一條紅線。';
      } else if (r.ok && r.result === 'already') note = '你已經同願過了。';
      else note = '這會兒繫不上，稍後再試。';
    } else if (cmd === 'reason') {
      r = await api.report(id, extra);
      reporting = null;
      if (r.ok) emit('wish_report', { reason: extra });
      note = r.ok
        ? r.result === 'already'
          ? '你已經檢舉過這一則了。'
          : '收到了，我們會看一下。'
        : '這會兒送不出去，稍後再試。';
    } else if (cmd === 'withdraw') {
      r = await api.withdraw(id);
      if (r.ok) emit('wish_withdraw');
      note = r.ok ? '願望撤下了。今天的紅線不會退回，明天可以再許。' : '這會兒撤不下來，稍後再試。';
    }
    busy = false;
    // refresh() 拿到新列表會自己重畫；拿不到時至少把提示畫出來
    if (!(await refresh())) render();
  }

  function show(focusId = null) {
    open = true;
    focus = focusId;
    reporting = null;
    note = '';
    emit('wish_pool_open', { from: focusId ? 'plate' : 'pool' });
    render();
    void refresh();
  }
  function close() {
    if (!open) return;
    open = false;
    focus = null;
    ui.panel('');
    onClose?.();
  }

  return {
    refresh,
    show,
    close,
    get isOpen() {
      return open;
    },
  };
}
