import { tr } from '~/i18n/ui';

export type CompanionLocale = 'zh-Hant' | 'zh-Hans';
export type CompanionTheme =
  | 'reunion'
  | 'trust'
  | 'crush'
  | 'communication'
  | 'lonely'
  | 'self'
  | 'safety'
  | 'general';

export interface CompanionAnswer {
  text: string;
  theme: CompanionTheme;
  followups: string[];
}

type Bilingual = { 'zh-Hant': string; 'zh-Hans': string };
const both = (hant: string, hans: string): Bilingual => ({ 'zh-Hant': hant, 'zh-Hans': hans });

export const COMPANION_START: Bilingual = both(
  '你來了。先不急著求一個答案，把你最放不下的那件事，慢慢說給我聽。',
  '你来了。先不急着求一个答案，把你最放不下的那件事，慢慢说给我听。',
);

export const COMPANION_STARTERS: Bilingual[] = [
  both('他忽冷忽熱，我該怎麼辦？', '他忽冷忽热，我该怎么办？'),
  both('分手後，我還想聯絡他。', '分手后，我还想联系他。'),
  both('我總是想太多，很累。', '我总是想太多，很累。'),
  both('喜歡一個人，怎麼開口？', '喜欢一个人，怎么开口？'),
];

const reflections: Record<
  Exclude<CompanionTheme, 'safety'>,
  {
    answer: Bilingual[];
    followups: Bilingual[];
  }
> = {
  reunion: {
    answer: [
      both(
        '放不下並不奇怪。先分清楚：你想念的是這個人，還是曾經被理解、被陪伴的感覺？這兩件事可能不一樣。',
        '放不下并不奇怪。先分清楚：你想念的是这个人，还是曾经被理解、被陪伴的感觉？这两件事可能不一样。',
      ),
      both(
        '想聯絡之前，可以先問自己：上次分開的原因，有沒有真正改變？如果沒有，重新開始可能仍會遇見同樣的難題。',
        '想联系之前，可以先问自己：上次分开的原因，有没有真正改变？如果没有，重新开始可能仍会遇见同样的难题。',
      ),
    ],
    followups: [
      both('最讓你難過的是哪一件事？', '最让你难过的是哪一件事？'),
      both('你想聯絡，是想說清楚，還是怕失去？', '你想联系，是想说清楚，还是怕失去？'),
    ],
  },
  trust: {
    answer: [
      both(
        '懷疑一段關係會讓人很耗力。但猜測不是證據，也不能用一次測驗判定對方的心。你可以先看具體發生了什麼，再決定是否需要坦白溝通。',
        '怀疑一段关系会让人很耗力。但猜测不是证据，也不能用一次测试判定对方的心。你可以先看具体发生了什么，再决定是否需要坦白沟通。',
      ),
      both(
        '信任不代表忽略自己的不舒服，也不代表要追查對方的一切。把感受說清楚，觀察是否願意回應，比反覆猜測更有幫助。',
        '信任不代表忽略自己的不舒服，也不代表要追查对方的一切。把感受说清楚，观察是否愿意回应，比反复猜测更有帮助。',
      ),
    ],
    followups: [
      both('有沒有一件具體發生的事，讓你不安？', '有没有一件具体发生的事，让你不安？'),
      both('你希望對方怎麼做，才會感到被尊重？', '你希望对方怎么做，才会感到被尊重？'),
    ],
  },
  crush: {
    answer: [
      both(
        '喜歡一個人，不必一下子把所有心意交出去。先試試一個輕鬆的邀約，也留空間讓對方自由回答。',
        '喜欢一个人，不必一下子把所有心意交出去。先试试一个轻松的邀约，也留空间让对方自由回答。',
      ),
      both(
        '曖昧的難處是：你看見一些訊號，卻不知道對方的意思。月老不能替別人讀心，但你可以用一個不施壓的問題，慢慢換取清楚。',
        '暧昧的难处是：你看见一些信号，却不知道对方的意思。月老不能替别人读心，但你可以用一个不施压的问题，慢慢换取清楚。',
      ),
    ],
    followups: [
      both('你們現在會主動找彼此聊天嗎？', '你们现在会主动找彼此聊天吗？'),
      both('如果對方沒有同樣的心意，你希望怎麼照顧自己？', '如果对方没有同样的心意，你希望怎么照顾自己？'),
    ],
  },
  communication: {
    answer: [
      both(
        '有時最難的不是沒有話，而是不知道怎麼開口。你可以從「我最近感受到……」開始，不急著替對方下定義。',
        '有时最难的不是没有话，而是不知道怎么开口。你可以从“我最近感受到……”开始，不急着替对方下定义。',
      ),
      both(
        '真正能讓人靠近的對話，需要有人說，也有人聽。試著選一個彼此不匆忙的時刻，只談一件具體的事。',
        '真正能让人靠近的对话，需要有人说，也有人听。试着选一个彼此不匆忙的时刻，只谈一件具体的事。',
      ),
    ],
    followups: [
      both('你最想被理解的是哪一句話？', '你最想被理解的是哪一句话？'),
      both('如果只說一件事，你會先說什麼？', '如果只说一件事，你会先说什么？'),
    ],
  },
  lonely: {
    answer: [
      both(
        '一個人撐著會累，想有人陪是很自然的事。今天不必立刻把自己變得堅強；先照顧好睡眠、飲食，也試著向信任的人說說。',
        '一个人撑着会累，想有人陪是很自然的事。今天不必立刻把自己变得坚强；先照顾好睡眠、饮食，也试着向信任的人说说。',
      ),
      both(
        '你現在的感覺值得被認真對待。與其急著尋找一個確定的結局，不如先問問：此刻什麼能讓你舒服一點？',
        '你现在的感觉值得被认真对待。与其急着寻找一个确定的结局，不如先问问：此刻什么能让你舒服一点？',
      ),
    ],
    followups: [
      both('最近哪個時刻，你最想有人陪？', '最近哪个时刻，你最想有人陪？'),
      both('今晚可以為自己做一件什麼小事？', '今晚可以为自己做一件什么小事？'),
    ],
  },
  self: {
    answer: [
      both(
        '你可以喜歡一個人，也依然有權保有自己的時間與界線。真正值得的關係，不需要你一直縮小自己。',
        '你可以喜欢一个人，也依然有权保有自己的时间与界限。真正值得的关系，不需要你一直缩小自己。',
      ),
      both(
        '把目光從「他會怎樣」轉回「我想怎樣」，也許事情會慢慢明朗。你的需要和感受，不該一直排在最後。',
        '把目光从“他会怎样”转回“我想怎样”，也许事情会慢慢明朗。你的需要和感受，不该一直排在最后。',
      ),
    ],
    followups: [
      both('這件事裡，你最不想再委屈自己的是什麼？', '这件事里，你最不想再委屈自己的是什么？'),
      both('如果朋友遇到同樣的事，你會對他說什麼？', '如果朋友遇到同样的事，你会对他说什么？'),
    ],
  },
  general: {
    answer: [
      both(
        '我在聽。月老不替你下命定的結論，只想陪你把紛亂的心事理出一條線。先說說，這件事最讓你在意的是什麼？',
        '我在听。月老不替你下命定的结论，只想陪你把纷乱的心事理出一条线。先说说，这件事最让你在意的是什么？',
      ),
      both(
        '如果現在還沒有答案，也沒有關係。試著把事情分成兩部分：你能決定的，和你無法替別人決定的。先從前者開始。',
        '如果现在还没有答案，也没有关系。试着把事情分成两部分：你能决定的，和你无法替别人决定的。先从前者开始。',
      ),
    ],
    followups: [
      both('這件事裡，什麼是你能先做的一步？', '这件事里，什么是你能先做的一步？'),
      both('你最希望這段對話幫你看清什麼？', '你最希望这段对话帮你看清什么？'),
    ],
  },
};

function detectTheme(input: string, previous: CompanionTheme): CompanionTheme {
  const s = input.toLowerCase();
  if (
    /自殺|自杀|自殘|自残|不想活|想死|結束生命|结束生命|家暴|被打|威脅|威胁|傷害自己|伤害自己|暴力/.test(s) ||
    /suicid|kill myself|want to die|end my life|self[- ]?harm|hurt myself|abus|hits? me|threat|violen/.test(s)
  )
    return 'safety';
  if (
    /分手|前任|複合|复合|斷聯|断联|挽回|回來|回来|重新開始|重新开始/.test(s) ||
    /break ?up|broke up|\bex\b|get back together|reconcil|no contact|win (him|her|them) back/.test(s)
  )
    return 'reunion';
  if (
    /出軌|出轨|騙我|骗我|第三者|曖昧別人|暧昧别人|不信任|欺騙|欺骗|背叛|偷看手機|偷看手机/.test(s) ||
    /cheat|lying|lied|betray|trust|affair|another (guy|girl|person)/.test(s)
  )
    return 'trust';
  if (
    /喜歡|喜欢|暗戀|暗恋|曖昧|暧昧|告白|表白|心動|心动|約會|约会|追求/.test(s) ||
    /crush|\blike (him|her|them|someone)|confess|ask (him|her|them) out|\bdate|dating/.test(s)
  )
    return 'crush';
  if (
    /溝通|沟通|冷戰|冷战|吵架|道歉|說清楚|说清楚|怎麼說|怎么说|開口|开口|訊息|消息/.test(s) ||
    /talk|argu|fight|apolog|message|text|silent|say it/.test(s)
  )
    return 'communication';
  if (
    /難過|难过|孤單|孤单|寂寞|累|焦慮|焦虑|失眠|想太多|壓力|压力|傷心|伤心/.test(s) ||
    /sad|lonely|alone|tired|anxi|insomnia|can't sleep|overthink|stress|hurt/.test(s)
  )
    return 'lonely';
  if (
    /自己|界線|界限|底線|底线|委屈|放下|自尊|成長|成长/.test(s) ||
    /myself|boundar|self-esteem|let go|grow/.test(s)
  )
    return 'self';
  return previous === 'safety' ? 'general' : previous;
}

export function guidedReply(
  message: string,
  previous: CompanionTheme,
  turn: number,
  locale: CompanionLocale,
): CompanionAnswer {
  const normalized = message.trim().slice(0, 400);
  const theme = detectTheme(normalized, previous);
  if (theme === 'safety') {
    return {
      theme,
      text:
        locale === 'zh-Hans'
          ? '听到这些，我更关心你现在是否安全。如果有人正在伤害或威胁你，先离开危险环境，联系你信任的人或当地紧急服务；如果你有伤害自己的念头，也请尽快寻求现实中的专业支持。这里的对话无法替代即时帮助。'
          : tr(
              '聽到這些，我更關心你現在是否安全。如果有人正在傷害或威脅你，先離開危險環境，聯絡你信任的人或當地緊急服務；如果你有傷害自己的念頭，也請儘快尋求現實中的專業支持。這裡的對話無法取代即時幫助。',
            ),
      followups: [],
    };
  }
  const category = reflections[theme];
  const index = Math.max(0, turn) % category.answer.length;
  // 非中文介面拿到的是繁體，再查內容字典換成當地語言
  const say = (v: Bilingual) => (locale === 'zh-Hans' ? v[locale] : tr(v['zh-Hant']));
  return {
    text: `${say(category.answer[index]!)}\n\n${say(category.followups[index]!)}`,
    theme,
    followups: [
      say(category.followups[(index + 1) % category.followups.length]!),
      locale === 'zh-Hans' ? '我想先照顾自己的感受。' : tr('我想先照顧自己的感受。'),
    ],
  };
}
