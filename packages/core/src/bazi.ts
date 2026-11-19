// 算命攤．八字命盤（站長 2026-11-19，第三期）：以感情為主的八字簡盤。
// 前端用萬年曆（lunar-javascript）把生日、時辰換成四柱的天干地支編號；生日與時辰不送出、不存。
// 這裡只用編號推：五行多寡、日主強弱（簡化算法）、夫妻宮、配偶星、桃花，付款、生成、讀取都用同一份。
// 屬簡化的民間算法：不排大運、不論格局與神煞細節，文案照實說。

import { yearGanzhi, yearZodiac } from './love';
import { BRANCH, ZODIAC, ZODIAC_RELATION_NAME, zodiacRelation } from './match';

export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
export const ELEMENTS = ['木', '火', '土', '金', '水'] as const;
export type Element5 = (typeof ELEMENTS)[number];

/** 天干五行：甲乙木、丙丁火、戊己土、庚辛金、壬癸水。 */
export const stemElement = (s: number): Element5 => ELEMENTS[Math.floor(s / 2)]!;
/** 地支本氣五行：子水 丑土 寅木 卯木 辰土 巳火 午火 未土 申金 酉金 戌土 亥水。 */
const BRANCH_EL: Element5[] = ['水', '土', '木', '木', '土', '火', '火', '土', '金', '金', '土', '水'];
export const branchElement = (b: number): Element5 => BRANCH_EL[b]!;
const isYang = (s: number) => s % 2 === 0;
/** 地支藏干（天干編號）：本氣在前。 */
const HIDDEN: number[][] = [
  [9], // 子：癸
  [5, 9, 7], // 丑：己癸辛
  [0, 2, 4], // 寅：甲丙戊
  [1], // 卯：乙
  [4, 1, 9], // 辰：戊乙癸
  [2, 6, 4], // 巳：丙庚戊
  [3, 5], // 午：丁己
  [5, 3, 1], // 未：己丁乙
  [6, 8, 4], // 申：庚壬戊
  [7], // 酉：辛
  [4, 7, 3], // 戌：戊辛丁
  [8, 0], // 亥：壬甲
];
const HIDDEN_WEIGHTS = [[1], [0.7, 0.3], [0.6, 0.3, 0.1]];

const idx = (e: Element5) => ELEMENTS.indexOf(e);
/** a 生 b？（木生火、火生土、土生金、金生水、水生木） */
const generates = (a: Element5, b: Element5) => (idx(a) + 1) % 5 === idx(b);
/** a 剋 b？（木剋土、土剋水、水剋火、火剋金、金剋木） */
const controls = (a: Element5, b: Element5) => (idx(a) + 2) % 5 === idx(b);

export type Gender = 'm' | 'f' | 'n';
/** 看哪方面（2026-11-19 加事業、財運、年運）：l 感情、c 事業、w 財運、y 年運（流年是要看的那一年）。 */
export type BaziTopic = 'love' | 'career' | 'wealth' | 'year';
const TOPIC_CODE: Record<BaziTopic, string> = { love: 'l', career: 'c', wealth: 'w', year: 'y' };
const CODE_TOPIC: Record<string, BaziTopic> = { l: 'love', c: 'career', w: 'wealth', y: 'year' };
export const TOPIC_NAME: Record<BaziTopic, string> = {
  love: '感情',
  career: '事業',
  wealth: '財運',
  year: '年運',
};
export interface Pillar {
  stem: number; // 0–9
  branch: number; // 0–11
}
export interface BaziInput {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  /** 不知道時辰就是 null（只排三柱）。 */
  hour: Pillar | null;
  gender: Gender;
  /** 現在的流年（國曆年，立春前算前一年）；年運是要看的那一年。 */
  flow: number;
  /** 沒寫就是感情（第三期上線時的識別字串沒有這一段）。 */
  topic?: BaziTopic;
}

export type Strength = '偏強' | '中和' | '偏弱';
export type BaziTitle = string;
export type Role = '印' | '比劫' | '食傷' | '財' | '官殺';
export const ROLES: Role[] = ['比劫', '印', '食傷', '財', '官殺'];

export interface BaziChart extends BaziInput {
  dayMaster: Element5;
  counts: Record<Element5, number>;
  missing: Element5[];
  strength: Strength;
  /** 夫妻宮：日支。 */
  spousePalace: number;
  /** 配偶星的五行：女命看剋我者（官殺），男命看我剋者（財星）；不說性別時兩者都列。 */
  spouseStars: Element5[];
  /** 配偶星在盤上出現幾次（天干＋地支本氣）。 */
  spouseStarCount: number;
  /** 桃花（以日支起）。 */
  taohua: number;
  /** 今年的天干五行對日主是什麼（生我、同我、我生、我剋、剋我）。 */
  flowRole: Role;
  /** 十神歸成五類，各出現幾次（天干＋地支本氣，含日干本身算在比劫）。 */
  roles: Record<Role, number>;
  /** 流年地支和你的生肖（年支）、日支是什麼關係。 */
  flowToZodiac: string;
  flowToDay: string;
  topic: BaziTopic;
  title: BaziTitle;
}

export function roleOf(dayMaster: Element5, other: Element5): BaziChart['flowRole'] {
  if (other === dayMaster) return '比劫';
  if (generates(other, dayMaster)) return '印';
  if (generates(dayMaster, other)) return '食傷';
  if (controls(dayMaster, other)) return '財';
  return '官殺';
}

/** 事業、財運、年運的總評（簡化看法）；感情沿用日主的說法。 */
function topicTitle(
  topic: BaziTopic,
  love: BaziTitle,
  strength: Strength,
  r: Record<Role, number>,
  flow: Role,
) {
  if (topic === 'career')
    return r.官殺 >= 2 && strength !== '偏弱'
      ? '可擔大任'
      : r.印 >= 2
        ? '貴人提攜'
        : r.食傷 >= 2
          ? '以才立身'
          : '穩紮穩打';
  if (topic === 'wealth')
    return r.財 >= 2 && strength !== '偏弱'
      ? '財來有路'
      : r.財 >= 2
        ? '財多身弱'
        : r.比劫 >= 3
          ? '守財為先'
          : r.食傷 >= 2
            ? '才藝生財'
            : '積少成多';
  if (topic === 'year')
    return { 印: '貴人相扶', 比劫: '同氣相求', 食傷: '才華外放', 財: '求財有望', 官殺: '責任加身' }[flow];
  return love;
}

const TAOHUA_BY_BRANCH = (b: number) =>
  [8, 0, 4].includes(b) ? 9 : [2, 6, 10].includes(b) ? 3 : [5, 9, 1].includes(b) ? 6 : 0;

export function baziChart(input: BaziInput): BaziChart {
  const pillars = [input.year, input.month, input.day, ...(input.hour ? [input.hour] : [])];
  const counts = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 } as Record<Element5, number>;
  for (const p of pillars) {
    counts[stemElement(p.stem)] += 1;
    counts[branchElement(p.branch)] += 1;
  }
  const dayMaster = stemElement(input.day.stem);
  // 強弱（簡化，2026-11-19 細化）：日干以外的天干各算 1；地支照藏干加權（本氣、中氣、餘氣），
  // 月支（月令）權重加倍。幫身（同我、生我）的份量占比 ≥ 0.55 偏強、< 0.35 偏弱，其餘中和。
  let support = 0;
  let total = 0;
  const helps = (e: Element5) => e === dayMaster || generates(e, dayMaster);
  for (const p of pillars) {
    if (p !== input.day) {
      total += 1;
      if (helps(stemElement(p.stem))) support += 1;
    }
    const w = p === input.month ? 2 : 1;
    const hidden = HIDDEN[p.branch]!;
    const weights = HIDDEN_WEIGHTS[hidden.length - 1]!;
    hidden.forEach((stem, i) => {
      total += w * weights[i]!;
      if (helps(stemElement(stem))) support += w * weights[i]!;
    });
  }
  const ratio = support / total;
  const strength: Strength = ratio >= 0.55 ? '偏強' : ratio < 0.35 ? '偏弱' : '中和';
  const official = ELEMENTS.find((e) => controls(e, dayMaster))!;
  const wealth = ELEMENTS.find((e) => controls(dayMaster, e))!;
  const spouseStars =
    input.gender === 'f' ? [official] : input.gender === 'm' ? [wealth] : [official, wealth];
  const spouseStarCount = spouseStars.reduce((n, e) => n + counts[e], 0);
  const flowStem = (((input.flow - 4) % 10) + 10) % 10;
  const roles = { 比劫: 0, 印: 0, 食傷: 0, 財: 0, 官殺: 0 } as Record<Role, number>;
  for (const e of ELEMENTS) roles[roleOf(dayMaster, e)] += counts[e];
  const flowRole = roleOf(dayMaster, stemElement(flowStem));
  const topic = input.topic ?? 'love';
  const flowBranch = yearZodiac(input.flow);
  const rel = (b: number) => {
    const r = zodiacRelation(flowBranch, b + 1);
    return r === 'chong' ? '六沖' : r === 'same' ? '同支' : ZODIAC_RELATION_NAME[r];
  };
  const TITLES: Record<Element5, BaziTitle> = {
    木: '如樹向陽',
    火: '熱烈真誠',
    土: '厚重可靠',
    金: '外冷內熱',
    水: '柔中帶韌',
  };
  return {
    ...input,
    dayMaster,
    counts,
    missing: ELEMENTS.filter((e) => counts[e] === 0),
    strength,
    spousePalace: input.day.branch,
    spouseStars,
    spouseStarCount,
    taohua: TAOHUA_BY_BRANCH(input.day.branch),
    flowRole,
    roles,
    flowToZodiac: rel(input.year.branch),
    flowToDay: rel(input.day.branch),
    topic,
    title: topicTitle(topic, TITLES[dayMaster], strength, roles, flowRole),
  };
}

// ---------- 識別字串：bazi:<年>,<月>,<日>,<時>_<流年>_<性別>[_<主題>]|<雜湊> ----------
// 每柱兩個字：天干 0–9、地支 a–l；不知道時辰寫 xx。例：6g,9h,2a,xx_2026_f
// 主題：沒寫＝感情（第三期上線時的寫法）；_c 事業、_w 財運、_y 年運。
const pillarId = (p: Pillar | null) => (p ? `${p.stem}${String.fromCharCode(97 + p.branch)}` : 'xx');
export const baziIds = (i: BaziInput) =>
  `${pillarId(i.year)},${pillarId(i.month)},${pillarId(i.day)},${pillarId(i.hour)}_${i.flow}_${i.gender}${
    i.topic && i.topic !== 'love' ? `_${TOPIC_CODE[i.topic]}` : ''
  }`;

export function parseBaziIds(ids: string): BaziInput | null {
  const m = /^(\d[a-l]),(\d[a-l]),(\d[a-l]),(\d[a-l]|xx)_(20\d\d)_([mfn])(?:_([cwy]))?$/.exec(ids);
  if (!m) return null;
  const p = (s: string): Pillar => ({ stem: Number(s[0]), branch: s.charCodeAt(1) - 97 });
  const pillars = [p(m[1]!), p(m[2]!), p(m[3]!), m[4] === 'xx' ? null : p(m[4]!)];
  // 干支要陰陽相同（甲子、乙丑…，沒有甲丑）
  if (pillars.some((x) => x && x.stem % 2 !== x.branch % 2)) return null;
  const flow = Number(m[5]);
  if (flow < 2025) return null;
  return {
    year: pillars[0]!,
    month: pillars[1]!,
    day: pillars[2]!,
    hour: pillars[3] ?? null,
    flow,
    gender: m[6] as Gender,
    topic: m[7] ? CODE_TOPIC[m[7]]! : 'love',
  };
}

export const pillarName = (p: Pillar) => `${STEMS[p.stem]}${BRANCH[p.branch]}`;

export const BAZI_TITLE_TEXT: Record<string, string> = {
  可擔大任: '盤上管束、職位的力量足，身也扛得住：適合往需要負責、帶人的位置走。',
  貴人提攜: '生扶你的印星多：學歷、證照、長輩與上司是你的助力，跟對人比單打獨鬥好。',
  以才立身: '表達與才華的食傷多：靠專業、作品、口才吃飯，適合有發揮空間的工作。',
  穩紮穩打: '盤上沒有特別偏重的一股力量：適合一步一步累積資歷，不必急著換跑道。',
  財來有路: '財星明顯、身也撐得住：賺錢的機會看得見，重點是選對方向、守得住。',
  財多身弱: '財星多但身偏弱：機會多卻容易累、容易被拖住，先顧好體力與現金流再擴張。',
  守財為先: '比劫（同輩、競爭）多：錢容易被分走，合夥、借貸、跟風要特別小心。',
  才藝生財: '食傷生財：靠手藝、內容、專業服務賺錢比靠固定薪水更有空間。',
  積少成多: '財星不顯：適合穩定收入、慢慢存，不適合追求一夜致富。',
  貴人相扶: '這一年生扶你的力量來：適合進修、求人、找靠山，遇事多問多請教。',
  同氣相求: '這一年同輩與朋友的力量強：合作、社交多，也要留意競爭與破財。',
  才華外放: '這一年是表現的一年：適合推作品、爭取曝光，說話做事別太衝。',
  求財有望: '這一年財星到：賺錢、談條件的機會多，量力而為，別貪快。',
  責任加身: '這一年壓力與責任到：可能升職、接重任，也可能被規矩綁住，穩住節奏。',
  如樹向陽: '木日主，像一棵往光裡長的樹：重承諾、肯付出，在感情裡要的是一起成長。',
  熱烈真誠: '火日主，喜歡就藏不住：熱情直接、真心待人，也要學會給感情一點慢下來的時間。',
  厚重可靠: '土日主，給人安穩的感覺：不輕易動心，一旦認定就很長情，最怕被辜負。',
  外冷內熱: '金日主，外表理性、有原則，心裡其實很在乎；說出口的愛不多，做的比說的多。',
  柔中帶韌: '水日主，敏感、善解人意，看起來隨和，其實很有自己的主意。',
};

const ROLE_TEXT: Record<BaziChart['flowRole'], string> = {
  印: '今年的天干生扶你，貴人與安全感較多，適合被照顧、也適合好好談一次心。',
  比劫: '今年和你同氣，朋友圈熱鬧、自我意識強；感情上要留意競爭或各忙各的。',
  食傷: '今年是你表達的一年，魅力與話題都多；把想法說出口，但別說得太衝。',
  財: '今年財星出現，對男命是緣分較近的一年；對所有人都是務實經營的一年。',
  官殺: '今年官殺透出，對女命是緣分較近的一年；對所有人都是壓力與規矩較多的一年。',
};

const roleLine = (c: BaziChart) => ROLES.map((r) => `${r}${c.roles[r]}`).join('、');

/** 事業、財運、年運的免費說明。 */
function topicLines(c: BaziChart): { label: string; text: string }[] {
  const five = {
    label: `五行．日主${c.dayMaster}${c.strength}`,
    text: `四柱裡${ELEMENTS.map((e) => `${e}${c.counts[e]}`).join('、')}${c.missing.length ? `，缺${c.missing.join('、')}` : '，五行都有'}。日主${c.dayMaster}${c.strength}；十神分布：${roleLine(c)}。`,
  };
  const year = `${c.flow} ${yearGanzhi(c.flow)}年`;
  if (c.topic === 'career')
    return [
      five,
      {
        label: `官殺 ${c.roles.官殺}．印 ${c.roles.印}`,
        text: `官殺代表職位、規矩與壓力，印代表學習、資歷與貴人。${c.roles.官殺 === 0 ? '盤上官殺不顯，比起進大機構爬階梯，更適合自己掌握節奏的工作。' : c.roles.官殺 >= 3 ? '官殺多，責任與壓力常找上你，要懂得替自己減壓、選對主管。' : '官殺適中，有規矩也有空間。'}${c.roles.印 >= 2 ? '印星有力，進修與證照對你特別有用。' : ''}`,
      },
      {
        label: `食傷 ${c.roles.食傷}`,
        text:
          c.roles.食傷 >= 2
            ? '食傷是表達與才華，盤上不少：適合需要創意、溝通、作品的工作，也適合斜槓。'
            : '食傷不多：比起站到台前，你更適合把專業做深、把事情做穩。',
      },
      { label: year, text: ROLE_WORK[c.flowRole] },
    ];
  if (c.topic === 'wealth')
    return [
      five,
      {
        label: `財星 ${c.roles.財}`,
        text: `財星代表你能掌握的錢與資源。${c.roles.財 === 0 ? '盤上財星不顯，民間說是錢要靠流年或後天經營引動，穩定收入加儲蓄最實在。' : c.roles.財 >= 3 ? '財星多，賺錢的門路不少，關鍵是身能不能扛：別同時開太多戰線。' : '財星適中，有進帳的能力，重在規劃。'}`,
      },
      {
        label: `比劫 ${c.roles.比劫}．食傷 ${c.roles.食傷}`,
        text: `${c.roles.比劫 >= 3 ? '比劫多，錢容易被朋友、合夥、人情分走，借錢與擔保要謹慎。' : '比劫不重，守財的能力還可以。'}${c.roles.食傷 >= 2 ? '食傷能生財：靠技能、作品、服務賺錢比較順。' : ''}`,
      },
      { label: year, text: ROLE_MONEY[c.flowRole] },
    ];
  // 年運
  return [
    five,
    {
      label: `${year}．${c.flowRole}`,
      text: `${yearGanzhi(c.flow)}年的天干對你的日主是「${c.flowRole}」。事業上，${ROLE_WORK[c.flowRole].replace(/^今年/, '這一年')}財運上，${ROLE_MONEY[c.flowRole].replace(/^今年/, '這一年')}`,
    },
    {
      label: `太歲．生肖${c.flowToZodiac}`,
      text:
        c.flowToZodiac === '六沖'
          ? `${c.flow} 年的地支和你的生肖相沖，民間叫沖太歲：變動多，大決定多想一步，不必驚慌。`
          : c.flowToZodiac === '同支'
            ? `${c.flow} 年是你的本命年：心情與節奏容易起伏，先照顧好自己。`
            : `${c.flow} 年的地支和你的生肖是「${c.flowToZodiac}」${c.flowToZodiac === '六合' || c.flowToZodiac === '三合' ? '，人緣與助力比較多' : ''}。`,
    },
    {
      label: `日支．${c.flowToDay}`,
      text:
        c.flowToDay === '六沖'
          ? '流年沖到日支（夫妻宮、自己的位置）：生活、住處或感情容易有變動，提早安排。'
          : c.flowToDay === '六合' || c.flowToDay === '三合'
            ? '流年合到日支：身邊的關係比較順，適合把感情或合作往前推。'
            : c.flowToDay === '六害' || c.flowToDay === '相刑'
              ? '流年和日支相害或相刑：身邊的人容易有小摩擦、小誤會，話早點說開就好。'
              : '流年和日支沒有明顯沖合，生活面相對平穩。',
    },
  ];
}

const ROLE_WORK: Record<Role, string> = {
  印: '今年生扶你：適合進修、考證、找貴人或內部轉調。',
  比劫: '今年同輩力量強：合作與競爭都多，適合結盟，也要守住自己的位置。',
  食傷: '今年利表現：推作品、提案、爭取曝光，說話別太衝。',
  財: '今年財星到：適合談條件、接案、做出看得見的成績。',
  官殺: '今年官殺到：責任與壓力加重，可能升職或接重任，也要防過勞。',
};
const ROLE_MONEY: Record<Role, string> = {
  印: '今年重積累：學本事、存底子，比急著賺快錢好。',
  比劫: '今年比劫到：人情與合夥開銷多，借貸、擔保、跟風投資要小心。',
  食傷: '今年食傷生財：靠技能與作品賺錢的機會多。',
  財: '今年財星到：進帳機會多，量力而為，先求穩再求多。',
  官殺: '今年官殺到：開銷與責任多，錢先顧好、少冒險。',
};

/** 免費結果的幾行說明。 */
export function baziLines(c: BaziChart): { label: string; text: string }[] {
  if (c.topic !== 'love') return topicLines(c);
  const spouseWord =
    c.gender === 'f' ? '官殺（代表伴侶）' : c.gender === 'm' ? '財星（代表伴侶）' : '官殺與財星（代表伴侶）';
  const star =
    c.spouseStarCount === 0
      ? `盤上沒有${spouseWord}的${c.spouseStars.join('、')}，民間說是緣分要靠後天、靠流年引動，不必心急。`
      : c.spouseStarCount >= 3
        ? `${spouseWord}的${c.spouseStars.join('、')}出現 ${c.spouseStarCount} 次，桃花與選擇都多，難的是定下來。`
        : `${spouseWord}的${c.spouseStars.join('、')}出現 ${c.spouseStarCount} 次，緣分有，關鍵在時機。`;
  return [
    {
      label: `五行．日主${c.dayMaster}${c.strength}`,
      text: `四柱裡${ELEMENTS.map((e) => `${e}${c.counts[e]}`).join('、')}${c.missing.length ? `，缺${c.missing.join('、')}` : '，五行都有'}。日主${c.dayMaster}${c.strength}。`,
    },
    {
      label: `夫妻宮．${BRANCH[c.spousePalace]}${branchElement(c.spousePalace)}`,
      text: `日支是夫妻宮，你的是「${BRANCH[c.spousePalace]}」（${branchElement(c.spousePalace)}）。${star}`,
    },
    {
      label: `桃花．屬${ZODIAC[c.taohua]}`,
      text: `以日支起桃花在「${BRANCH[c.taohua]}」：屬${ZODIAC[c.taohua]}的人、${ZODIAC[c.taohua]}年或${ZODIAC[c.taohua]}月，人緣比較旺。`,
    },
    {
      label: `${c.flow} ${yearGanzhi(c.flow)}年`,
      text: ROLE_TEXT[c.flowRole],
    },
  ];
}

/** 給付費解讀的提示用。 */
export function baziFacts(c: BaziChart) {
  return {
    pillars: {
      year: pillarName(c.year),
      month: pillarName(c.month),
      day: pillarName(c.day),
      hour: c.hour ? pillarName(c.hour) : '不詳（只排三柱）',
    },
    gender: c.gender === 'f' ? '女' : c.gender === 'm' ? '男' : '未說明',
    dayMaster: `${STEMS[c.day.stem]}${c.dayMaster}（${isYang(c.day.stem) ? '陽' : '陰'}）`,
    strength: c.strength,
    elementCounts: c.counts,
    missing: c.missing,
    spousePalace: `${BRANCH[c.spousePalace]}（${branchElement(c.spousePalace)}）`,
    spouseStars: c.spouseStars,
    spouseStarCount: c.spouseStarCount,
    taohua: `${BRANCH[c.taohua]}${ZODIAC[c.taohua]}`,
    zodiac: ZODIAC[c.year.branch],
    thisYear: { year: c.flow, ganzhi: yearGanzhi(c.flow), roleToDayMaster: c.flowRole },
    topic: TOPIC_NAME[c.topic],
    tenGods: c.roles,
    flowToZodiac: c.flowToZodiac,
    flowToDay: c.flowToDay,
    overall: c.title,
  };
}
