import { createFileRoute, Link } from '@tanstack/react-router';
import { pageHead } from '~/i18n/seo';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';
import site from '../../site.config';

type Copy = {
  title: string;
  metaTitle: string;
  description: string;
  intro: string;
  originalTitle: string;
  original: string;
  referencesTitle: string;
  references: string;
  freeTitle: string;
  free: string;
  ritualTitle: string;
  ritual: string;
  aiTitle: string;
  ai: string;
  limitsTitle: string;
  limits: string;
  directory: string;
  privacy: string;
  about: string;
};

const COPY: Record<string, Copy> = {
  'zh-Hant': {
    title: '籤文來源與解讀方法',
    metaTitle: '月老靈籤100首｜籤文出處、判詞與 AI 解讀方法',
    description: '月下如何整理月老靈籤100首、標註典故、撰寫免費判詞，以及可選的付費 AI 解讀？查看來源、方法與限制。',
    intro: '本頁說明月下的籤文從何而來、哪些內容是我們寫的，以及數位求籤和 AI 解讀的邊界。這些說明用來讓你分辨文化資料、介面體驗與個人化文字，並不是對籤詩神效的保證。',
    originalTitle: '一、原始籤詩和典故',
    original: '本站以公開流傳的「月老聖籤一百籤」為籤號和詩句的整理基礎。籤頁的「出處」欄位，是該句可辨認的古典典故來源；沒有相應標註時，我們不強行指定某部古籍。公開版本之間可能存在用字差異。原文和判詞不等於任何特定廟宇的官方詮釋。',
    referencesTitle: '參考資料與對照入口',
    references: '整理過程參考台灣好廟網的月老聖籤一百籤，以及玄燈命理的月老靈籤目錄。這兩個外部頁面是版本對照線索，不代表合作、引用授權或背書；更不表示我們逐句完成了獨立學術考證。',
    freeTitle: '二、免費判詞是本站事先撰寫',
    free: '每一支籤有「問他／曖昧」、「單身／脫單」、「複合」三個方向的免費判詞，另有行動建議。它們是本站針對籤詩意象撰寫的固定內容，不是每個使用者抽籤後由 AI 即時生成，也不是對某位真實人物心意的事實判斷。',
    ritualTitle: '三、數位抽籤和擲筊',
    ritual: '搖籤和擲筊是網站裡的數位互動模擬。介面呈現籤筒、筊杯和結果，讓人以熟悉的文化形式停下來思考；它不是由實體寺廟執行的儀式，也沒有超自然結果保證。',
    aiTitle: '四、付費 AI 深度解讀是獨立功能',
    ai: '如果你主動選擇付費深讀，系統可依所選的籤、問法與你自願填寫的問題，向第三方 AI 模型服務產生較長的解讀。這與公開的免費判詞不同，內容可能出錯、帶有不確定性，也不能用來證明對方的感情或替代個人判斷。請勿輸入不願提供給第三方的敏感資料；資料處理方式請見隱私權頁。',
    limitsTitle: '五、怎樣使用結果更合適',
    limits: '把它當作理解自身感受、界限和選擇的文字提示。不要僅憑籤詩、AI 回答或測驗結果決定重大感情、醫療、法律或財務事項；若牽涉他人意願，仍需要真實溝通與尊重。',
    directory: '查看全部100支籤',
    privacy: '閱讀隱私權',
    about: '關於月下',
  },
  'zh-Hans': {
    title: '签文来源与解读方法',
    metaTitle: '月老灵签100首｜签诗出处、判词与 AI 解读方法',
    description: '月下如何整理月老灵签100首、标注典故、撰写免费判词，以及提供可选付费 AI 解读？查看资料来源和方法。',
    intro: '本页说明月下的签文从哪里来、哪些内容由本站编写，以及数字求签与 AI 解读的边界。目的在于区分文化资料、互动体验与个性化文字，不保证任何超自然效果。',
    originalTitle: '一、原始签诗与典故',
    original: '本站以公开流传的「月老圣签一百签」作为签号和诗句的整理基础。签页标明的「出处」是可辨认的古典典故；没有标注时，不强行指定某部古籍。不同公开版本可能存在用字差异，也不代表任何特定庙宇的官方解释。',
    referencesTitle: '参考资料与比对入口',
    references: '整理时参考台湾好庙网的月老圣签一百签，以及玄灯命理的月老灵签目录。这些外部网页仅作为版本对照，不代表合作、授权或背书，也不声称逐句完成独立学术考证。',
    freeTitle: '二、免费判词由本站预先编写',
    free: '每支签按「问他／暧昧」「单身／脱单」「复合」三个方向提供免费判词及行动建议。这是根据签诗意象编写的固定内容，不是每位用户抽签后由 AI 实时生成，也无法证明其他人的真实感情。',
    ritualTitle: '三、数字抽签与掷筊',
    ritual: '摇签和掷筊是网站中的数字互动模拟，不是实体寺庙举行的仪式，不提供超自然结果保证。',
    aiTitle: '四、付费 AI 深度解读是独立功能',
    ai: '如果你主动购买深度解读，系统可根据所选签文、问法及自愿填写的问题，将相关内容发送至第三方 AI 模型服务以生成长篇文字。内容可能出错，不能替代个人判断。请勿输入不愿提供给第三方的敏感资料，处理方式详见隐私政策。',
    limitsTitle: '五、如何使用这些结果',
    limits: '把它视为整理自身感受、界限和选择的参考。不要仅凭签诗、AI 回答或测试结果作出重大的感情、医疗、法律或财务决定；他人的意愿仍需要真实沟通和尊重。',
    directory: '查看全部100支签',
    privacy: '阅读隐私说明',
    about: '关于月下',
  },
  en: {
    title: 'Sources and methodology',
    metaTitle: 'Yuelao Oracle Methodology | Sources, Free Readings and AI',
    description: 'How YUEXIA documents traditional Yuelao oracle verses, writes its free interpretations and distinguishes optional AI-generated readings.',
    intro: 'This page explains where the Yuelao verses come from, which text YUEXIA writes, and the limits of its digital ritual and optional AI features. These are cultural and editorial explanations, not a claim of supernatural accuracy.',
    originalTitle: '1. Verses and classical references',
    original: 'The numbered verses follow a publicly circulated collection known as the 100 Yuelao oracle sticks. Classical references appear on individual stick pages where identifiable. Different public versions may vary; none of these texts should be taken as an official interpretation from a particular temple.',
    referencesTitle: 'Public reference pages',
    references: 'The collection was compared with the public lists on Taiwan Temples and DestineAI. These are reference points, not affiliated partners, licensors or endorsers. The site does not claim an independent scholarly verification of every line.',
    freeTitle: '2. What the free readings are',
    free: 'Each stick contains prewritten guidance for relationship uncertainty, being single and reconciliation. These are site-written fixed interpretations of the imagery, not personalized live AI outputs and not evidence of another person’s feelings.',
    ritualTitle: '3. Digital drawing and divination blocks',
    ritual: 'The shaking and jiaobei casting are digital simulations. They are not physical ceremonies carried out by a temple and do not guarantee an outcome.',
    aiTitle: '4. Optional paid AI readings',
    ai: 'If you choose a paid in-depth reading, the selected verse, question category and any optional question you provide can be sent to a third-party AI model to generate longer text. This output may be inaccurate or uncertain. Do not include information you would not want to share with a third party; consult our privacy policy for data handling details.',
    limitsTitle: '5. How to use the results',
    limits: 'Treat them as prompts for reflection, not as factual predictions. Do not base major relationship, medical, legal or financial decisions solely on an oracle, AI text or quiz result. Real-world communication and consent remain essential.',
    directory: 'Browse the 100 sticks',
    privacy: 'Privacy policy',
    about: 'About YUEXIA',
  },
  ja: {
    title: 'おみくじの出典と解説方法',
    metaTitle: '月老おみくじの出典・解説方法｜月下',
    description: '月下が参照する月老おみくじ100首、無料解説、デジタル体験と任意のAI解説の違いについて説明します。',
    intro: '月老おみくじの出典、サイトが独自に書いた文章、デジタル体験とAI解説の限界について説明します。超自然的な効果を保証するものではありません。',
    originalTitle: '1. 詩の原文と典拠',
    original: '広く流通する月老おみくじ100首を参照して、番号と詩を整理しています。典拠が確認できる場合は各ページに記載します。公開版には表記差があり、特定寺廟による公式解釈ではありません。',
    referencesTitle: '参考にした公開資料',
    references: '台湾好廟網と玄燈命理に公開されている月老おみくじ一覧を照合資料として参照しています。提携・認可・推薦関係を意味せず、全文の学術的検証を主張するものではありません。',
    freeTitle: '2. 無料の解説文',
    free: '各おみくじの恋愛・独身・復縁についての短い解説は当サイトが事前に作成した固定文章です。抽選のたびにAIが生成するものではなく、他人の気持ちを証明しません。',
    ritualTitle: '3. デジタル抽選と筊杯',
    ritual: '抽選や筊杯の操作はデジタル上の再現です。実在寺廟で行う儀式ではなく、結果を保証しません。',
    aiTitle: '4. 任意の有料AI解説',
    ai: '有料解説を選択した場合、おみくじの内容、質問の種類、任意入力した質問を第三者AIサービスへ送信し、長い文章を生成する場合があります。誤りが含まれる可能性があります。個人情報を入力する前にプライバシーポリシーをご確認ください。',
    limitsTitle: '5. 結果との向き合い方',
    limits: '自己理解のきっかけとして利用してください。大きな恋愛・医療・法律・金銭の判断を、おみくじやAIの回答だけで決めないでください。',
    directory: '全100首を読む',
    privacy: 'プライバシー',
    about: '月下について',
  },
};

const copyFor = (locale: string) => COPY[locale] ?? COPY.en!;

export const Route = createFileRoute('/methodology')({
  head: () => {
    const locale = getLocale();
    const c = copyFor(locale);
    return pageHead(site, {
      title: c.metaTitle,
      description: c.description,
      path: localizeHref('/methodology', { locale }),
      jsonLd: [{
        '@type': 'WebPage',
        name: c.title,
        inLanguage: locale,
        description: c.description,
        about: { '@type': 'Thing', name: 'Yuelao oracle sticks and interpretive methodology' },
      }],
    });
  },
  component: Methodology,
});

function Methodology() {
  const c = copyFor(getLocale());
  return (
    <article className="legal">
      <h1>{c.title}</h1>
      <p>{c.intro}</p>
      <h2>{c.originalTitle}</h2>
      <p>{c.original}</p>
      <h2>{c.referencesTitle}</h2>
      <p>{c.references}</p>
      <ul>
        <li><a href="https://temples.tw/stick/fs_yuelao" target="_blank" rel="noopener noreferrer">台灣好廟網 · 月老聖籤一百籤</a></li>
        <li><a href="https://destineai.com/oracle/yuelao" target="_blank" rel="noopener noreferrer">玄燈命理 · 月老靈籤100首</a></li>
      </ul>
      <h2>{c.freeTitle}</h2>
      <p>{c.free}</p>
      <h2>{c.ritualTitle}</h2>
      <p>{c.ritual}</p>
      <h2>{c.aiTitle}</h2>
      <p>{c.ai}</p>
      <h2>{c.limitsTitle}</h2>
      <p>{c.limits}</p>
      <nav aria-label={c.title}>
        <p><Link to={localizeHref('/signs')}>{c.directory}</Link></p>
        <p><Link to={localizeHref('/privacy')}>{c.privacy}</Link></p>
        <p><Link to={localizeHref('/about')}>{c.about}</Link></p>
      </nav>
    </article>
  );
}
