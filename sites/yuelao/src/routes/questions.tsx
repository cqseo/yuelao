import { createFileRoute, Link } from '@tanstack/react-router';
import { pageHead } from '~/i18n/seo';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';
import site from '../../site.config';

type Copy = {
  title: string; metaTitle: string; description: string; lead: string;
  beforeTitle: string; before: string[]; casesTitle: string;
  cases: { title: string; question1: string; question2: string; note: string }[];
  ritualTitle: string; ritual: string; sourcesTitle: string; sources: string;
  sourceA: string; sourceB: string; start: string; jiao: string; directory: string; method: string;
};

// These are writing prompts, not predictions of another person's feelings or outcomes.
const COPY: Record<string, Copy> = {
  "zh-Hant": {
    "title": "月老求籤可以問什麼？單身、曖昧、交往與復合問題範例",
    "metaTitle": "月老求籤可以問什麼？單身、曖昧、復合提問指南｜月下",
    "description": "向月老求籤前不知道怎麼問？整理單身求姻緣、曖昧、交往與婚姻、分手復合的具體提問範例，還有免費線上月老求籤入口。",
    "lead": "想求月老籤，卻不知道該怎麼開口？比起一次問「感情會不會順利」，可以先聚焦一段關係、一個困擾和一個可行動的選擇。問題寫得清楚，是為了幫助自己看懂籤意，不代表籤詩能知道對方的真實想法。",
    "beforeTitle": "求籤前，先把問題整理成三個部分",
    "before": [
      "只問一件事：先選最想釐清的一個決定，不要把脫單、復合、婚姻一次混在同一題。",
      "說清當下情境：是剛認識、曖昧、穩定交往，還是已分手？可以在心裡默想，無須把個人資料交給網站。",
      "把重點放在自己能做的事：例如是否該溝通、慢一點、建立界線或尋求支持，不要把解讀當作對他人心意的證據。"
    ],
    "casesTitle": "四種常見感情情境與提問範例",
    "cases": [
      {
        "title": "單身求姻緣",
        "question1": "我最近想認識新對象，現在適合主動參加朋友聚會嗎？",
        "question2": "認識某位新朋友後，我應該多花時間了解，還是先觀察自己的期待？",
        "note": "把焦點放在認識新人的方式，而非要求籤詩保證何時遇見正緣。"
      },
      {
        "title": "曖昧與單戀",
        "question1": "和對方認識一段時間，我適合主動表達想更了解彼此嗎？",
        "question2": "對方回覆不穩定，我現在該清楚詢問、放慢腳步，還是保持距離？",
        "note": "不要僅靠籤詩猜測對方是否喜歡自己；尊重實際回應與界線。"
      },
      {
        "title": "交往與婚姻",
        "question1": "我們最近常因時間安排爭執，我應該先提出一個具體的溝通方式嗎？",
        "question2": "對未來規劃看法不同，現在是適合一起談清楚的時候嗎？",
        "note": "若涉及安全、控制、暴力或重大決定，請優先尋求現實中的可信支持。"
      },
      {
        "title": "分手與復合",
        "question1": "分手後仍有牽掛，我應該在尊重對方意願的前提下聯絡一次嗎？",
        "question2": "如果對方已清楚表示不想聯繫，我現在是否該把重心放回自己的生活？",
        "note": "復合必須是雙方自願的選擇，籤詩不能代替對方的明確意願。"
      }
    ],
    "ritualTitle": "整理好問題後，怎麼線上求月老籤？",
    "ritual": "月下的免費求籤在 3D 月老殿進行：想好問題、選擇情境、搖籤、擲筊確認，然後閱讀籤文和白話判詞。求籤不需要登入；如要付費深度解讀，再由你自行決定。數位儀式是文化互動，不等同廟宇法會或對感情結果的保證。",
    "sourcesTitle": "提問與現場參拜有什麼不同？",
    "sources": "高雄三鳳宮的公開擲筊程序建議請示一事為原則。臺北艋舺龍山寺也有自己的月老參拜、求紅線流程；如果親自去廟裡，應遵守廟方告示，不要把線上示意當作通用的祭儀規則。",
    "sourceA": "高雄三鳳宮：一事一問的擲筊程序",
    "sourceB": "艋舺龍山寺：月老參拜與求紅線說明",
    "start": "免費開始線上月老求籤",
    "jiao": "聖筊、笑筊、陰筊怎麼看？",
    "directory": "查看月老靈籤100首",
    "method": "籤文來源與解讀方法"
  },
  "zh-Hans": {
    "title": "月老求签可以问什么？单身、暧昧、恋爱与复合提问范例",
    "metaTitle": "月老求签可以问什么？单身、暧昧、复合提问指南｜月下",
    "description": "整理适合向月老求签的感情问题：单身姻缘、暧昧、恋爱婚姻和分手复合，并提供免费的线上求签入口。",
    "lead": "想求月老签，却不知道怎么问？不妨聚焦一段关系、一个困扰和一个可以采取的选择。问清问题，是为了帮助自己理解签意，而不是证明另一个人的真实想法。",
    "beforeTitle": "求签前先明确三件事",
    "before": [
      "一次只问一件事，不要把脱单、复合和婚姻放在同一个问题里。",
      "明确当前处境：刚认识、暧昧、交往还是分手？不需要向网站填写私人资料。",
      "关注自己能够做的事：沟通、放慢步调、建立边界，不把签文当作别人心意的证据。"
    ],
    "casesTitle": "四种常见感情情境与问题示例",
    "cases": [
      {
        "title": "单身求姻缘",
        "question1": "最近想认识新朋友，我适合主动参加聚会吗？",
        "question2": "认识新对象后，我应该花时间了解还是先整理自己的期待？",
        "note": "关注真实行动，而不是要求签文保证什么时候遇到正缘。"
      },
      {
        "title": "暧昧与单恋",
        "question1": "认识对方一段时间，现在适合坦诚表达想多了解彼此吗？",
        "question2": "对方回复不稳定，我应当清楚沟通还是先放慢脚步？",
        "note": "尊重真实的回应和界限，不用签文猜测对方是否喜欢自己。"
      },
      {
        "title": "交往与婚姻",
        "question1": "我们常为时间安排争执，我应该主动提出新的沟通方式吗？",
        "question2": "对未来规划有分歧，现在适合一起谈清楚吗？",
        "note": "涉及安全、暴力、控制或重大决策时应寻求现实支持。"
      },
      {
        "title": "分手与复合",
        "question1": "分手后仍有牵挂，我应当在尊重对方意愿时联系一次吗？",
        "question2": "对方明确不愿联系，我是否应该先把重心放回生活？",
        "note": "复合需要双方自愿，签诗不能代替对方的实际意愿。"
      }
    ],
    "ritualTitle": "整理好问题后如何线上求签？",
    "ritual": "在月下 3D 月老殿先想问题、选择情况、摇签、掷筊确认，再阅读免费的签文与判词。求签无需登录，付费深度解读是可选功能。线上仪式是数字模拟，并不保证感情结果。",
    "sourcesTitle": "线下参拜的不同之处",
    "sources": "高雄三凤宫建议掷筊时一次以一件事为原则；台北艋舺龙山寺有自己的月老参拜规则。实地参拜应遵守庙方公告。",
    "sourceA": "高雄三凤宫：一次询问一件事",
    "sourceB": "艋舺龙山寺：月老参拜说明",
    "start": "免费开始线上月老求签",
    "jiao": "掷筊三种结果怎么理解？",
    "directory": "查看月老灵签100首",
    "method": "签文来源与解读方法"
  },
  "en": {
    "title": "What Can You Ask Yue Lao? Love and Relationship Question Examples",
    "metaTitle": "What to Ask Yue Lao | Single, Dating & Reconciliation Questions | YUEXIA",
    "description": "Examples of clear questions to ask Yue Lao about meeting someone, uncertain feelings, relationships, marriage and getting back together. Start a free online fortune-stick ritual.",
    "lead": "Not sure what to ask Yue Lao? A question about one relationship and one decision is easier to reflect on than a sweeping request to predict your love life. The verse cannot verify someone else's private thoughts.",
    "beforeTitle": "Three ways to prepare your question",
    "before": [
      "Ask about one situation at a time instead of combining several unrelated topics.",
      "Clarify where you are: newly acquainted, uncertain, partnered or separated. You do not have to give personal details to the site.",
      "Focus on actions within your control—communication, boundaries, patience and support—not presumed facts about another person's feelings."
    ],
    "casesTitle": "Four relationship situations and example questions",
    "cases": [
      {
        "title": "Single and hoping to meet someone",
        "question1": "Would it help me to accept an invitation to meet new people?",
        "question2": "Should I spend more time getting to know this person or examine my expectations first?",
        "note": "The verse cannot promise when a soulmate will appear."
      },
      {
        "title": "Uncertain feelings or a crush",
        "question1": "Is this a good time to express that I would like to know this person better?",
        "question2": "Their replies are inconsistent. Should I ask clearly or slow down?",
        "note": "Use actual communication and respect boundaries, not a prediction of their feelings."
      },
      {
        "title": "In a relationship or marriage",
        "question1": "We keep arguing about time together. Should I propose a specific way to talk?",
        "question2": "Our future plans differ. Is now a good time for an honest discussion?",
        "note": "For safety concerns or major life decisions, prioritize trusted real-world help."
      },
      {
        "title": "Breakup and reconciliation",
        "question1": "If I respect their wishes, would reaching out once be appropriate?",
        "question2": "They clearly do not want contact. Should I focus on moving forward?",
        "note": "Reconciliation requires mutual consent; a verse cannot substitute for it."
      }
    ],
    "ritualTitle": "How to draw a Yue Lao stick online",
    "ritual": "At YUEXIA, bring one question to the 3D Yue Lao Hall, choose your situation, draw a stick, confirm with digital moon blocks and read the free interpretation. Drawing needs no sign-in; an optional paid in-depth reading is separate. This is an interactive cultural experience, not a temple ceremony or a guaranteed prediction.",
    "sourcesTitle": "What about visiting a real temple?",
    "sources": "Kaohsiung Sanfong Temple recommends asking about one matter per cast, while Taipei's Longshan Temple describes its own Yue Lao and red-thread customs. Follow each temple's instructions when visiting in person.",
    "sourceA": "Sanfong Temple: one question per cast",
    "sourceB": "Longshan Temple: Yue Lao visiting guidance",
    "start": "Draw a free Yue Lao stick",
    "jiao": "What do the moon-block results mean?",
    "directory": "Read all 100 fortune sticks",
    "method": "Sources and methodology"
  },
  "ja": {
    "title": "月老に何を聞く？独身・片思い・交際・復縁の質問例",
    "metaTitle": "月老のおみくじで何を聞く？恋愛の質問例｜月下",
    "description": "独身、片思い、交際、結婚、復縁など、月老のおみくじに向けた具体的な質問の例と無料オンライン体験を紹介します。",
    "lead": "月老に何を聞けばいいか迷ったら、一つの関係と一つの選択に焦点を当ててみましょう。おみくじは他人の気持ちを証明するものではなく、自分の考えを整理する手がかりです。",
    "beforeTitle": "質問する前に考えたい三つのこと",
    "before": [
      "一度に一つのテーマを選びます。",
      "現在の状況を整理します。個人情報を入力する必要はありません。",
      "自分でできる行動や相手の意思を尊重することに目を向けます。"
    ],
    "casesTitle": "四つの恋愛場面と質問例",
    "cases": [
      {
        "title": "独身・出会い",
        "question1": "新しい人に出会うため、友人の集まりに参加してみるべき？",
        "question2": "気になる人をもっと知る前に、自分の期待を整理した方がいい？",
        "note": "いつ運命の相手に出会うかを保証するものではありません。"
      },
      {
        "title": "片思い・曖昧な関係",
        "question1": "もっと親しくなりたい気持ちを率直に伝える時期？",
        "question2": "返事が不安定な相手に、確認するか少し距離を置くか？",
        "note": "相手の本心は直接の対話で確かめましょう。"
      },
      {
        "title": "交際・結婚",
        "question1": "一緒に過ごす時間について具体的に話し合うべき？",
        "question2": "将来の考え方が違うとき、今きちんと話すべき？",
        "note": "安全や重大な決断は現実の信頼できる支援を優先してください。"
      },
      {
        "title": "別れ・復縁",
        "question1": "相手の意思を尊重したうえで一度連絡するのは適切？",
        "question2": "連絡を望まない相手には、前を向くことを優先すべき？",
        "note": "復縁には双方の同意が必要です。"
      }
    ],
    "ritualTitle": "質問が決まったらオンラインでおみくじを",
    "ritual": "月下の3D月老殿で質問を考え、状況を選び、籤を引き、ポエで確認して無料の解説を読みます。おみくじにログインは不要です。有料の詳しい解説は任意です。デジタル体験は寺廟の儀式や予言ではありません。",
    "sourcesTitle": "実際の寺廟では？",
    "sources": "高雄三鳳宮は一度に一件の質問を勧めています。台北龍山寺には月老参拝の独自の作法があります。実際に参拝する際は現地の案内に従ってください。",
    "sourceA": "高雄三鳳宮：一事一問",
    "sourceB": "龍山寺：月老への参拝案内",
    "start": "無料のおみくじを引く",
    "jiao": "ポエの結果の意味",
    "directory": "月老おみくじ100首",
    "method": "出典と解説方法"
  },
  "ko": {
    "title": "월하노인에게 무엇을 물을까요? 연애·짝사랑·재회 질문 예시",
    "metaTitle": "월하노인에게 물을 연애 질문 | YUEXIA",
    "description": "싱글, 썸, 연애와 결혼, 이별과 재회에 대해 월하노인 점괘에 가져갈 질문 예시를 살펴보세요.",
    "lead": "월하노인에게 무엇을 물을지 고민된다면 한 관계와 한 가지 선택에 집중해 보세요. 점괘는 상대방의 실제 감정을 증명하기 위한 것이 아니라 생각을 정리하는 계기입니다.",
    "beforeTitle": "질문 전에 기억할 세 가지",
    "before": [
      "한 번에 한 가지 문제만 생각합니다.",
      "현재 관계의 단계를 분명히 합니다. 사이트에 개인정보를 입력할 필요가 없습니다.",
      "상대의 속마음을 단정하기보다 내 의사소통, 선택과 경계에 집중합니다."
    ],
    "casesTitle": "네 가지 연애 상황과 질문 예시",
    "cases": [
      {
        "title": "싱글과 새로운 만남",
        "question1": "새로운 사람을 만나기 위해 모임에 나가 보는 것이 좋을까?",
        "question2": "이 사람을 더 알아보기 전에 내 기대를 정리해야 할까?",
        "note": "점괘가 운명의 상대를 만날 시기를 보장하지는 않습니다."
      },
      {
        "title": "썸과 짝사랑",
        "question1": "상대를 더 알아가고 싶다고 솔직하게 말해도 될까?",
        "question2": "답장이 일정하지 않을 때 직접 물어보는 편이 좋을까?",
        "note": "상대방의 의사는 실제 대화를 통해 확인하세요."
      },
      {
        "title": "연애와 결혼",
        "question1": "서로의 시간을 어떻게 보낼지 구체적으로 대화해야 할까?",
        "question2": "미래 계획이 다를 때 지금 솔직히 이야기할까?",
        "note": "안전이나 중대한 결정에는 현실에서 믿을 수 있는 도움을 우선하세요."
      },
      {
        "title": "이별과 재회",
        "question1": "상대의 의사를 존중하며 한 번 연락해도 괜찮을까?",
        "question2": "상대가 연락을 원하지 않는다면 앞으로 나아가야 할까?",
        "note": "재회에는 양쪽 모두의 동의가 필요합니다."
      }
    ],
    "ritualTitle": "질문을 정했다면 온라인 점괘 체험",
    "ritual": "3D 월하노인 사당에서 질문과 상황을 정한 뒤 점괘를 뽑고 디지털 교배로 확인하고 무료 해석을 읽습니다. 추첨에는 로그인이 필요하지 않습니다. 유료 상세 해석은 선택 사항입니다. 실제 사찰 의식이나 미래 예측 보장은 아닙니다.",
    "sourcesTitle": "실제 사찰에서는?",
    "sources": "가오슝 산펑궁은 한 번에 한 문제를 묻도록 안내합니다. 타이베이 룽산사에는 월하노인 참배의 별도 규칙이 있습니다. 현지 안내를 따르세요.",
    "sourceA": "산펑궁: 한 번에 한 가지 질문",
    "sourceB": "룽산사: 월하노인 참배 안내",
    "start": "무료 월하노인 점괘 뽑기",
    "jiao": "교배 결과의 의미",
    "directory": "100개 점괘 보기",
    "method": "자료 출처와 해석 방식"
  },
  "th": {
    "title": "ควรถามเทพเย่ว์เหล่าเรื่องอะไร? ตัวอย่างคำถามความรัก",
    "metaTitle": "ตัวอย่างคำถามเทพเย่ว์เหล่า เรื่องคนโสด ความรัก และการคืนดี | YUEXIA",
    "description": "ตัวอย่างคำถามเกี่ยวกับการพบรัก ความสัมพันธ์ที่ไม่ชัดเจน คู่รัก การแต่งงาน และการกลับมาคืนดี พร้อมเสี่ยงเซียมซีออนไลน์ฟรี",
    "lead": "หากไม่แน่ใจว่าจะถามเทพเย่ว์เหล่าเรื่องอะไร ลองเลือกความสัมพันธ์หนึ่งเรื่องและการตัดสินใจหนึ่งอย่าง การเสี่ยงเซียมซีช่วยทบทวนความคิด ไม่สามารถยืนยันความรู้สึกที่แท้จริงของอีกคนได้",
    "beforeTitle": "สามข้อก่อนเริ่มถาม",
    "before": [
      "ถามทีละหนึ่งเรื่อง ไม่รวมหลายประเด็นไว้ด้วยกัน",
      "นึกถึงสถานการณ์ปัจจุบัน โดยไม่จำเป็นต้องกรอกข้อมูลส่วนตัวลงในเว็บไซต์",
      "เน้นสิ่งที่ตนเองทำได้ เช่น การสื่อสาร การเคารพขอบเขต และการขอความช่วยเหลือ"
    ],
    "casesTitle": "ตัวอย่างคำถามในสี่สถานการณ์",
    "cases": [
      {
        "title": "โสดและอยากพบคนใหม่",
        "question1": "ควรออกไปพบปะผู้คนผ่านกิจกรรมของเพื่อนหรือไม่?",
        "question2": "ควรทำความรู้จักคนนี้ต่อ หรือทบทวนความคาดหวังของตัวเองก่อน?",
        "note": "เซียมซีไม่รับประกันว่าจะพบคู่แท้เมื่อใด"
      },
      {
        "title": "คนที่ชอบและความสัมพันธ์ไม่ชัดเจน",
        "question1": "ควรบอกอย่างตรงไปตรงมาว่าอยากรู้จักเขามากขึ้นหรือไม่?",
        "question2": "หากอีกฝ่ายตอบไม่สม่ำเสมอ ควรพูดคุยให้ชัดเจนหรือรอก่อน?",
        "note": "ความรู้สึกของอีกฝ่ายต้องเคารพและสอบถามผ่านการสื่อสารจริง"
      },
      {
        "title": "คู่รักและการแต่งงาน",
        "question1": "ควรเสนอให้คุยกันเรื่องเวลาที่ใช้ร่วมกันหรือไม่?",
        "question2": "เมื่อมองอนาคตต่างกัน ควรพูดคุยอย่างตรงไปตรงมาตอนนี้หรือไม่?",
        "note": "เรื่องความปลอดภัยและการตัดสินใจสำคัญควรพึ่งพาความช่วยเหลือในชีวิตจริง"
      },
      {
        "title": "เลิกราและกลับมาคืนดี",
        "question1": "ควรติดต่ออีกครั้งโดยเคารพความต้องการของเขาหรือไม่?",
        "question2": "หากเขาไม่ต้องการให้ติดต่อ ควรหันมาดูแลชีวิตของตัวเองหรือไม่?",
        "note": "การคืนดีต้องเกิดจากความยินยอมของทั้งสองฝ่าย"
      }
    ],
    "ritualTitle": "เมื่อมีคำถามแล้ว เริ่มเสี่ยงเซียมซีอย่างไร?",
    "ritual": "เข้าสู่ศาลเทพเย่ว์เหล่า 3D คิดคำถาม เลือกสถานการณ์ จับเซียมซี โยนปวยจำลองเพื่อยืนยัน แล้วอ่านคำตีความฟรี ไม่ต้องล็อกอินเพื่อจับเซียมซี ส่วนคำอธิบายเชิงลึกแบบชำระเงินเป็นทางเลือก นี่คือประสบการณ์ดิจิทัล ไม่ใช่พิธีวัดหรือการรับประกันอนาคต",
    "sourcesTitle": "แล้วการไปวัดจริงต่างกันอย่างไร?",
    "sources": "วัดซานฟงในเกาสงแนะนำให้ถามทีละเรื่อง ส่วนวัดหลงซานในไทเปมีขั้นตอนบูชาเทพเย่ว์เหล่าเฉพาะของตนเอง โปรดทำตามคำแนะนำของแต่ละวัด",
    "sourceA": "วัดซานฟง: ถามทีละเรื่อง",
    "sourceB": "วัดหลงซาน: คำแนะนำการบูชาเทพเย่ว์เหล่า",
    "start": "เริ่มเสี่ยงเซียมซีฟรี",
    "jiao": "ผลปวยทั้งสามหมายถึงอะไร?",
    "directory": "ดูเซียมซี 100 บท",
    "method": "ที่มาและวิธีตีความ"
  }
};
const copyFor = (locale: string) => COPY[locale] ?? COPY.en!;

export const Route = createFileRoute('/questions')({
  head: () => {
    const locale = getLocale();
    const c = copyFor(locale);
    return pageHead(site, {
      title: c.metaTitle,
      description: c.description,
      path: localizeHref('/questions', { locale }),
      jsonLd: [{ '@type': 'Article', headline: c.title, description: c.description,
        inLanguage: locale, mainEntityOfPage: site.url + localizeHref('/questions', { locale }),
        publisher: { '@type': 'Organization', name: 'YUEXIA' } }],
    });
  },
  component: YueLaoQuestions,
});

function YueLaoQuestions() {
  const c = copyFor(getLocale());
  return (
    <article className="legal">
      <h1>{c.title}</h1>
      <p>{c.lead}</p>
      <h2>{c.beforeTitle}</h2>
      <ol>{c.before.map((item) => <li key={item}>{item}</li>)}</ol>
      <h2>{c.casesTitle}</h2>
      {c.cases.map((item) => (
        <section key={item.title}>
          <h3>{item.title}</h3>
          <ul><li>{item.question1}</li><li>{item.question2}</li></ul>
          <p>{item.note}</p>
        </section>
      ))}
      <h2>{c.ritualTitle}</h2>
      <p>{c.ritual}</p>
      <p><a href={localizeHref('/market#yuelao')}>{c.start}</a></p>
      <h2>{c.sourcesTitle}</h2>
      <p>{c.sources}</p>
      <ul>
        <li><a href="https://www.sunfong.org.tw/?act=menuinfo&amp;ml_id=20220720011" target="_blank" rel="noopener noreferrer">{c.sourceA}</a></li>
        <li><a href="https://lungshan.org.tw/Tour_Guide/search" target="_blank" rel="noopener noreferrer">{c.sourceB}</a></li>
      </ul>
      <nav aria-label={c.title}>
        <p><Link to={localizeHref('/jiaobei')}>{c.jiao}</Link></p>
        <p><Link to={localizeHref('/signs')}>{c.directory}</Link></p>
        <p><Link to={localizeHref('/methodology')}>{c.method}</Link></p>
      </nav>
    </article>
  );
}
