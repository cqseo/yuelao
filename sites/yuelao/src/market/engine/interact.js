// 廣場上的兩顆圓鈕（參考心安宮）：
//   左下「互動」：分類列出可以去做的事，點一項角色自己走過去、到了就做。
//   右下「動作」：揮手、作揖、合十、比心，附近的路人會回應。
// 這裡只管畫面與開關；每一項做什麼由 main.js 傳進來的 run(id) 決定。

export const ACT_TABS = [
  {
    id: 'pray',
    name: '祈福',
    items: [
      { id: 'incense', name: '上香', sub: '殿前銅爐' },
      { id: 'wish', name: '許願', sub: '池邊繫紅線' },
      { id: 'room:yuelao', name: '求籤', sub: '月老殿' },
      { id: 'room:sutra', name: '抄經', sub: '每日心箋' },
    ],
  },
  { id: 'halls', name: '殿堂', items: [] }, // 由 main.js 依 world.rooms 填
  {
    id: 'stroll',
    name: '閒遊',
    items: [
      { id: 'sit', name: '池邊坐坐', sub: '歇一會兒' },
      { id: 'feed', name: '餵魚', sub: '池裡的錦鯉' },
      { id: 'kneel', name: '殿前跪拜', sub: '靜一靜心' },
      { id: 'look', name: '換身衣裳', sub: '外觀' },
    ],
  },
];

export const EMOTES = [
  ['wave', '揮手'],
  ['bow', '作揖'],
  ['pray', '合十'],
  ['heart', '比心'],
];

/**
 * @param {{ root: HTMLElement, halls: {id:string,name:string,sub:string,open:boolean}[],
 *   run: (id: string) => void, emote: (id: string) => void }} o
 */
export function createInteract({ root, halls, run, emote }) {
  ACT_TABS[1].items = halls.map((h) => ({
    id: `room:${h.id}`,
    name: h.name,
    sub: h.open ? h.sub : h.note || '籌備中',
    off: !h.open,
  }));
  let tab = 'pray';
  let open = null; // 'act' | 'emote' | null

  const actBtn = el('button', { id: 'act-btn', className: 'orb', type: 'button' });
  actBtn.innerHTML = '<i aria-hidden="true">◇</i><span>互動</span>';
  actBtn.setAttribute('aria-controls', 'act-menu');
  const emoteBtn = el('button', { id: 'emote-btn', className: 'orb', type: 'button' });
  emoteBtn.innerHTML = '<i aria-hidden="true">✋</i><span>動作</span>';
  emoteBtn.setAttribute('aria-controls', 'emote-menu');
  const actMenu = el('div', { id: 'act-menu', className: 'sheet' });
  actMenu.setAttribute('role', 'dialog');
  actMenu.setAttribute('aria-label', '互動');
  const emoteMenu = el('div', { id: 'emote-menu', className: 'sheet' });
  emoteMenu.setAttribute('role', 'dialog');
  emoteMenu.setAttribute('aria-label', '動作');
  root.append(actBtn, emoteBtn, actMenu, emoteMenu);

  function renderAct() {
    const t = ACT_TABS.find((x) => x.id === tab) || ACT_TABS[0];
    actMenu.innerHTML = `<nav class="tabs">${ACT_TABS.map(
      (x) =>
        `<button type="button" data-tab="${x.id}" class="${x.id === tab ? 'on' : ''}">${x.name}</button>`,
    ).join('')}</nav>
      <div class="grid">${t.items
        .map(
          (it) =>
            `<button type="button" data-run="${it.id}"${it.off ? ' disabled' : ''}><b>${it.name}</b><span>${it.sub}</span></button>`,
        )
        .join('')}</div>`;
  }
  emoteMenu.innerHTML = `<div class="grid four">${EMOTES.map(
    ([id, name]) => `<button type="button" data-emote="${id}"><b>${name}</b></button>`,
  ).join('')}</div>`;

  function show(which) {
    open = open === which ? null : which;
    if (open === 'act') renderAct();
    actMenu.classList.toggle('show', open === 'act');
    emoteMenu.classList.toggle('show', open === 'emote');
    actBtn.setAttribute('aria-expanded', String(open === 'act'));
    emoteBtn.setAttribute('aria-expanded', String(open === 'emote'));
    actBtn.classList.toggle('on', open === 'act');
    emoteBtn.classList.toggle('on', open === 'emote');
  }
  actBtn.onclick = () => show('act');
  emoteBtn.onclick = () => show('emote');
  actMenu.onclick = (e) => {
    const b = /** @type {HTMLElement} */ (e.target).closest('button');
    if (!b) return;
    if (b.dataset.tab) {
      tab = b.dataset.tab;
      renderAct();
    } else if (b.dataset.run) {
      show(null);
      run(b.dataset.run);
    }
  };
  emoteMenu.onclick = (e) => {
    const b = /** @type {HTMLElement} */ (e.target).closest('button');
    if (b?.dataset.emote) {
      show(null);
      emote(b.dataset.emote);
    }
  };

  return {
    /** 走動時才顯示兩顆圓鈕；開了面板就收起。 */
    visible(v) {
      actBtn.classList.toggle('show', v);
      emoteBtn.classList.toggle('show', v);
      if (!v && open) show(null);
    },
    close() {
      if (open) show(null);
    },
    get isOpen() {
      return !!open;
    },
  };
}

function el(tag, props) {
  return Object.assign(document.createElement(tag), props);
}
