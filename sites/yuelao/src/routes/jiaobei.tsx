import { createFileRoute, Link } from '@tanstack/react-router';
import { pageHead } from '~/i18n/seo';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';
import site from '../../site.config';

type Copy = {
  title: string; metaTitle: string; description: string; lead: string;
  resultTitle: string; outcomes: { label: string; text: string }[];
  stepsTitle: string; steps: string[]; cautionTitle: string; caution: string;
  sourcesTitle: string; sources: string; sourceA: string; sourceB: string;
  start: string; directory: string; method: string; questions: string;
};

// Public cultural sources are not partners or endorsements. No claim that a simulated cast is a temple ceremony.
const COPY: Record<string, Copy> = {
  "zh-Hant": {
    "title": "月老擲筊怎麼看？聖筊、笑筊、陰筊意思與求籤流程",
    "metaTitle": "擲筊怎麼看？聖筊、笑筊、陰筊意思｜月老求籤指南｜月下",
    "description": "了解擲筊時聖筊、笑筊、陰筊的傳統意思，以及月下線上月老求籤的擲筊確認流程。引用寺廟與文化機構公開資料，區分民俗說明與數位模擬。",
    "lead": "擲筊是臺灣民間信仰常見的請示方式。兩片月牙形筊杯落下後，通常依其組合分為聖筊、笑筊與陰筊。月下保留這個文化元素，讓你在數位月老殿求籤時練習停下來、確認問題，再閱讀籤意。",
    "resultTitle": "聖筊、笑筊、陰筊分別代表什麼？",
    "outcomes": [
      {
        "label": "聖筊（允筊）",
        "text": "一平一凸的組合，一般表示請示獲得肯定或允許；在求籤流程中常用來確認本次籤詩。"
      },
      {
        "label": "笑筊",
        "text": "傳統上多解讀為問題尚未說清、時機未明或難以裁示；可先重新整理要問的事，不宜把它直接當作「是」。"
      },
      {
        "label": "陰筊（無筊）",
        "text": "常被解讀為否定或暫不適宜。不同寺廟對後續能否重擲、需間隔多久有自己的規範，現場應以廟方指示為準。"
      }
    ],
    "stepsTitle": "在月下線上求籤，擲筊出現在哪一步？",
    "steps": [
      "先選一件感情疑問，將問題整理清楚；不用輸入姓名、生日或地址才能求籤。",
      "進入 3D 月老殿，依畫面指引搖動籤筒，待籤落定後才會看見籤號。",
      "按介面指引擲筊確認；請依系統顯示的「聖筊／笑筊／陰筊」結果理解本次數位流程。",
      "確認後閱讀免費籤詩與白話判詞，也能前往 100 首籤文目錄按號查閱。"
    ],
    "cautionTitle": "線上擲筊與實體寺廟一樣嗎？",
    "caution": "不一樣。月下的搖籤、擲筊是網站互動模擬，並非任何宮廟代你完成的祭儀；數位結果不代表神明確實同意，也不保證感情未來。各寺廟的求紅線、請籤、連續聖筊次數與擲筊解說可能不同，親自參拜時請遵守該廟公告。",
    "sourcesTitle": "參考資料與使用限制",
    "sources": "以下是民俗文化和廟宇對擲筊的公開解說，不是月下的合作夥伴或背書，也不代表它們認可本站的數位流程。",
    "sourceA": "高雄三鳳宮：擲筊程序及結果判斷",
    "sourceB": "國立傳統藝術中心：筊杯典藏",
    "start": "免費到月老殿求一支籤",
    "directory": "查看月老靈籤100首",
    "method": "籤文來源與解讀方法",
    "questions": "月老求籤適合問什麼？"
  },
  "zh-Hans": {
    "title": "月老掷筊怎么看？圣筊、笑筊、阴筊含义与求签流程",
    "metaTitle": "掷筊怎么看？圣筊、笑筊、阴筊含义｜月下",
    "description": "了解掷筊时圣筊、笑筊、阴筊的传统含义，以及月下线上月老求签的掷筊确认流程。区分传统民俗与数字互动。",
    "lead": "掷筊是台湾民间信仰中常见的请示方式。两片月牙形筊杯落下后，通常根据组合分成圣筊、笑筊与阴筊。月下把这一文化元素融入线上月老求签体验。",
    "resultTitle": "圣筊、笑筊、阴筊分别意味着什么？",
    "outcomes": [
      {
        "label": "圣筊（允筊）",
        "text": "一平一凸的组合，通常表示肯定或允许；在求签时常用于确认抽到的签。"
      },
      {
        "label": "笑筊",
        "text": "一般表示问题不够明确、时机未定或无法裁示。建议先理清问题，不要直接理解为同意。"
      },
      {
        "label": "阴筊（无筊）",
        "text": "常表示否定或暂时不适宜。是否可以再次掷筊，应以具体寺庙的流程为准。"
      }
    ],
    "stepsTitle": "月下线上求签的掷筊在哪一步？",
    "steps": [
      "先想好一个具体感情问题，无需填写姓名、生日或住址。",
      "进入 3D 月老殿，按照提示摇动签筒，签落定后才显示签号。",
      "按照画面提示掷筊确认，以系统显示的圣筊、笑筊或阴筊结果为准。",
      "完成流程后阅读免费的签诗和白话解读，也可以去 100 首签文目录查阅。"
    ],
    "cautionTitle": "线上掷筊等同于寺庙仪式吗？",
    "caution": "不等同。月下提供的是数字互动模拟，不是寺庙代为举行的仪式，也没有超自然效果保证。不同寺庙的求签与求红线规则可能不同，线下请遵守庙方要求。",
    "sourcesTitle": "资料来源与说明",
    "sources": "以下是文化机构与寺庙对传统掷筊的介绍，不表示它们与月下合作或为线上功能背书。",
    "sourceA": "高雄三凤宫：掷筊程序与结果",
    "sourceB": "台湾传统艺术中心：筊杯典藏",
    "start": "免费前往月老殿求签",
    "directory": "查看月老灵签100首",
    "method": "签文来源与解读方法",
    "questions": "月老求签可以问什么？"
  },
  "en": {
    "title": "Yue Lao Moon Blocks: What Do the Three Results Mean?",
    "metaTitle": "Yue Lao Moon Blocks: Holy, Laughing and Negative Casts | YUEXIA",
    "description": "Understand the three traditional jiaobei moon-block results and how the free online Yue Lao fortune-stick ritual works at YUEXIA.",
    "lead": "Jiaobei are paired crescent-shaped divination blocks used in Taiwanese folk-religious practice. A cast is traditionally read as a holy, laughing or negative result. YUEXIA recreates this moment as part of a digital Yue Lao fortune-stick experience.",
    "resultTitle": "What do the three moon-block results mean?",
    "outcomes": [
      {
        "label": "Holy cast (sheng jiao)",
        "text": "One flat side and one curved side; commonly understood as permission or an affirmative response, and often used to confirm a drawn stick."
      },
      {
        "label": "Laughing cast (xiao jiao)",
        "text": "Often understood as uncertainty or a question that needs clarification. It should not be read as a clear yes."
      },
      {
        "label": "Negative cast (yin jiao)",
        "text": "Commonly interpreted as a negative response or a sign to stop for now. Follow the instructions of any physical temple you visit."
      }
    ],
    "stepsTitle": "How moon blocks work in YUEXIA's online ritual",
    "steps": [
      "Think of one relationship question. You do not need to submit your name, birth date or address.",
      "Enter the 3D Yue Lao Hall and follow the instructions to draw a stick. Its number appears only after it lands.",
      "Cast the digital moon blocks and follow the result shown on screen.",
      "Read the free interpretation or browse the index of 100 fortune sticks."
    ],
    "cautionTitle": "Is an online cast the same as a temple ceremony?",
    "caution": "No. YUEXIA offers an interactive digital simulation, not a rite performed by a temple. It does not verify a deity's approval or predict a relationship outcome. Temple customs, including repeated-cast requirements, may differ.",
    "sourcesTitle": "Sources and scope",
    "sources": "The cultural references below explain traditional practice. Neither organization is affiliated with or endorses YUEXIA's simulation.",
    "sourceA": "Kaohsiung Sanfong Temple: jiaobei procedure",
    "sourceB": "National Center for Traditional Arts: jiaobei collection",
    "start": "Draw a free stick in Yue Lao Hall",
    "directory": "Browse all 100 fortune sticks",
    "method": "Sources and interpretation method",
    "questions": "What can I ask Yue Lao?"
  },
  "ja": {
    "title": "月老のおみくじとポエ：聖筊・笑筊・陰筊の意味",
    "metaTitle": "ポエ（擲筊）の意味と月老オンラインおみくじ｜月下",
    "description": "月老のおみくじで使うポエ（擲筊）の三つの結果と、月下の無料オンライン体験を解説します。実際の寺廟の儀式とは区別しています。",
    "lead": "ポエ（筊杯）は台湾の民間信仰で神意をうかがうために使われる、三日月形の一対の道具です。月下ではこの文化をデジタル月老殿の体験として再現しています。",
    "resultTitle": "聖筊・笑筊・陰筊とは？",
    "outcomes": [
      {
        "label": "聖筊",
        "text": "平らな面と曲面が一つずつ出る組み合わせ。伝統的には許可や肯定を表すとされます。"
      },
      {
        "label": "笑筊",
        "text": "問いが不明確で判断がつかない、または時期が定まらない状態を表すとされます。"
      },
      {
        "label": "陰筊",
        "text": "否定的な返答や、いまは適切でないという意味に解釈されます。寺廟の決まりに従ってください。"
      }
    ],
    "stepsTitle": "月下のオンラインおみくじでの流れ",
    "steps": [
      "恋愛について一つの質問を考えます。氏名や住所の入力は不要です。",
      "3D月老殿で案内に沿って籤を引きます。籤番号は落ちてから表示されます。",
      "画面上でポエを投げ、表示された結果を確かめます。",
      "無料の解説を読み、必要に応じて100首の一覧を見ます。"
    ],
    "cautionTitle": "オンラインと実際の寺廟の違い",
    "caution": "月下のポエはデジタル上の再現であり、寺廟が行う儀式ではありません。超自然的な結果や恋愛の未来を保証しません。現地の作法や連続して聖筊が必要な回数は寺廟ごとに異なります。",
    "sourcesTitle": "参考資料",
    "sources": "以下の公開資料は文化的な参考資料です。月下との提携や推奨を意味しません。",
    "sourceA": "高雄三鳳宮：ポエの手順",
    "sourceB": "国立伝統芸術センター：筊杯の収蔵資料",
    "start": "月老殿で無料のおみくじを引く",
    "directory": "月老おみくじ100首",
    "method": "出典と解説方法",
    "questions": "月老に何を聞けばいい？"
  },
  "ko": {
    "title": "월하노인 점괘의 교배: 성교·소교·음교는 무슨 뜻일까요?",
    "metaTitle": "월하노인 점괘와 교배 결과 안내 | YUEXIA",
    "description": "전통적인 교배(자오베이)의 세 가지 결과와 YUEXIA의 무료 온라인 월하노인 점괘 체험을 알아보세요.",
    "lead": "교배는 대만 민간신앙에서 질문에 대한 응답을 구할 때 사용하는 초승달 모양의 두 조각입니다. YUEXIA는 이를 디지털 월하노인 사당에서 체험하도록 재현합니다.",
    "resultTitle": "성교·소교·음교의 의미",
    "outcomes": [
      {
        "label": "성교 (聖筊)",
        "text": "평평한 면과 볼록한 면이 하나씩 나오는 조합으로, 일반적으로 긍정이나 허락을 뜻합니다."
      },
      {
        "label": "소교 (笑筊)",
        "text": "질문이 불분명하거나 아직 판단하기 어렵다는 의미로 해석됩니다. 명확한 긍정은 아닙니다."
      },
      {
        "label": "음교 (陰筊)",
        "text": "부정적인 응답 또는 지금은 적절하지 않다는 뜻으로 해석됩니다. 실제 사찰의 규칙을 따르세요."
      }
    ],
    "stepsTitle": "YUEXIA 온라인 점괘의 순서",
    "steps": [
      "연애에 관해 하나의 질문을 생각합니다. 이름이나 주소는 입력하지 않아도 됩니다.",
      "3D 월하노인 사당에서 안내에 따라 점괘 막대를 뽑습니다.",
      "화면에서 교배를 던지고 표시된 결과를 확인합니다.",
      "무료 해석을 읽거나 100개 점괘 목록을 살펴봅니다."
    ],
    "cautionTitle": "온라인 체험과 실제 사찰 의식의 차이",
    "caution": "YUEXIA는 디지털 체험으로, 실제 사찰이 수행하는 의식이 아닙니다. 초자연적 결과나 연애의 미래를 보장하지 않습니다. 사찰별 절차를 존중해 주세요.",
    "sourcesTitle": "참고 자료",
    "sources": "아래 링크는 문화적 설명을 위한 자료이며 YUEXIA와의 제휴나 보증을 의미하지 않습니다.",
    "sourceA": "가오슝 산펑궁: 교배 절차",
    "sourceB": "국립전통예술센터: 교배 소장품",
    "start": "월하노인 사당에서 무료 점괘 뽑기",
    "directory": "100개 점괘 살펴보기",
    "method": "자료 출처와 해석 방식",
    "questions": "월하노인에게 무엇을 물을까?"
  },
  "th": {
    "title": "การเสี่ยงปวยถามเทพเย่ว์เหล่า: ผลทั้งสามแบบหมายถึงอะไร?",
    "metaTitle": "วิธีอ่านผลปวย (Jiaobei) และเสี่ยงเซียมซีเย่ว์เหล่า | YUEXIA",
    "description": "ทำความเข้าใจผลปวยสามแบบตามประเพณี และวิธีเสี่ยงเซียมซีความรักออนไลน์ฟรีบน YUEXIA",
    "lead": "ปวยเป็นไม้รูปพระจันทร์เสี้ยวสองชิ้นที่ใช้ในการเสี่ยงทายตามความเชื่อพื้นบ้านของไต้หวัน YUEXIA จำลองขั้นตอนนี้ในศาลเทพเย่ว์เหล่าแบบดิจิทัล",
    "resultTitle": "ผลปวยสามแบบหมายถึงอะไร?",
    "outcomes": [
      {
        "label": "เซิ่งเจี่ยว (聖筊)",
        "text": "ด้านเรียบหนึ่งด้านและด้านโค้งหนึ่งด้าน โดยทั่วไปหมายถึงคำตอบเชิงบวกหรือการยินยอม"
      },
      {
        "label": "เซี่ยวเจี่ยว (笑筊)",
        "text": "มักสื่อว่าคำถามยังไม่ชัดเจนหรือยังตัดสินไม่ได้ ไม่ควรตีความว่าเป็นคำตอบว่าใช่"
      },
      {
        "label": "อินเจี่ยว (陰筊)",
        "text": "โดยทั่วไปสื่อถึงคำตอบเชิงลบหรือยังไม่เหมาะสม หากไปวัดจริงควรทำตามกติกาของวัด"
      }
    ],
    "stepsTitle": "ขั้นตอนออนไลน์ของ YUEXIA",
    "steps": [
      "คิดคำถามเกี่ยวกับความสัมพันธ์เพียงหนึ่งเรื่อง ไม่ต้องกรอกชื่อหรือที่อยู่",
      "เข้าสู่ศาลเย่ว์เหล่า 3D แล้วทำตามคำแนะนำเพื่อจับเซียมซี",
      "โยนปวยจำลองและดูผลที่ปรากฏบนหน้าจอ",
      "อ่านคำตีความฟรีหรือดูสารบัญเซียมซี 100 บท"
    ],
    "cautionTitle": "เหมือนพิธีในวัดจริงหรือไม่?",
    "caution": "ไม่เหมือนกัน YUEXIA เป็นเพียงการจำลองแบบดิจิทัล ไม่ใช่พิธีที่วัดทำให้ และไม่รับประกันผลเหนือธรรมชาติหรืออนาคตความรัก แต่ละวัดอาจมีขั้นตอนต่างกัน",
    "sourcesTitle": "แหล่งอ้างอิง",
    "sources": "ลิงก์ต่อไปนี้ใช้ประกอบคำอธิบายทางวัฒนธรรม ไม่ได้แสดงว่าหน่วยงานเหล่านี้สนับสนุน YUEXIA",
    "sourceA": "วัดซานฟง เกาสง: วิธีเสี่ยงปวย",
    "sourceB": "ศูนย์ศิลปะดั้งเดิมแห่งชาติ: วัตถุจัดแสดงปวย",
    "start": "เสี่ยงเซียมซีฟรีที่ศาลเย่ว์เหล่า",
    "directory": "ดูเซียมซีครบ 100 บท",
    "method": "ที่มาและวิธีตีความ",
    "questions": "ควรถามเย่ว์เหล่าเรื่องอะไร?"
  }
};
const copyFor = (locale: string) => COPY[locale] ?? COPY.en!;

export const Route = createFileRoute('/jiaobei')({
  head: () => {
    const locale = getLocale();
    const c = copyFor(locale);
    return pageHead(site, {
      title: c.metaTitle,
      description: c.description,
      path: localizeHref('/jiaobei', { locale }),
      jsonLd: [{ '@type': 'Article', headline: c.title, description: c.description,
        inLanguage: locale, mainEntityOfPage: site.url + localizeHref('/jiaobei', { locale }),
        publisher: { '@type': 'Organization', name: 'YUEXIA' } }],
    });
  },
  component: JiaobeiGuide,
});

function JiaobeiGuide() {
  const c = copyFor(getLocale());
  return (
    <article className="legal">
      <h1>{c.title}</h1>
      <p>{c.lead}</p>
      <h2>{c.resultTitle}</h2>
      <ul>
        {c.outcomes.map((item) => <li key={item.label}><strong>{item.label}：</strong>{item.text}</li>)}
      </ul>
      <h2>{c.stepsTitle}</h2>
      <ol>{c.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      <p><a href={localizeHref('/market#yuelao')}>{c.start}</a></p>
      <h2>{c.cautionTitle}</h2>
      <p>{c.caution}</p>
      <h2>{c.sourcesTitle}</h2>
      <p>{c.sources}</p>
      <ul>
        <li><a href="https://www.sunfong.org.tw/?act=menuinfo&amp;ml_id=20220720011" target="_blank" rel="noopener noreferrer">{c.sourceA}</a></li>
        <li><a href="https://collections.ncfta.gov.tw/pages/product/view.aspx?id=11200404203" target="_blank" rel="noopener noreferrer">{c.sourceB}</a></li>
      </ul>
      <nav aria-label={c.title}>
        <p><Link to={localizeHref('/questions')}>{c.questions}</Link></p>
        <p><Link to={localizeHref('/signs')}>{c.directory}</Link></p>
        <p><Link to={localizeHref('/methodology')}>{c.method}</Link></p>
      </nav>
    </article>
  );
}
