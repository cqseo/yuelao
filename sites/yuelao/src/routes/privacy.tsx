import { createFileRoute } from '@tanstack/react-router';
import { pageHead } from '@yuelao/core/seo';
import { m } from '~/paraglide/messages.js';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';
import { LegalPage } from '~/site/legal';
import site from '../../site.config';

export const Route = createFileRoute('/privacy')({
  head: () =>
    pageHead(site, {
      title: m.legal_privacy_meta_title({ siteName: site.name }),
      description: m.legal_privacy_meta_description({ siteName: site.name }),
      path: localizeHref('/privacy', { locale: getLocale() }),
    }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage title={m.legal_privacy_title()} intro={m.legal_privacy_intro({ siteName: site.name })}>
      <h2>{m.legal_privacy_collect_heading()}</h2>
      <p>{m.legal_privacy_collect_body()}</p>

      <h2>{m.legal_privacy_processors_heading()}</h2>
      <p>{m.legal_privacy_processors_body()}</p>

      <h2>{m.legal_privacy_retention_heading()}</h2>
      <p>{m.legal_privacy_retention_body()}</p>

      <h2>{m.legal_privacy_cookies_heading()}</h2>
      <p>{m.legal_privacy_cookies_body()}</p>

      <h2>{getLocale() === 'zh-Hans' ? '每日签到与引导对话' : '每日簽到與引導對話'}</h2>
      <p>
        {getLocale() === 'zh-Hans'
          ? '每日签到只使用此浏览器的 localStorage 保存日期和连续天数，不记录姓名或账户，不跨设备同步，不是可兑换金额的积分。清除浏览器网站数据会清除签到记录。当前月老引导对话只在页面内存中处理输入，不发送到服务器，也不会储存聊天记录；离开页面或清除对话即无法恢复。'
          : '每日簽到只使用此瀏覽器的 localStorage 保存日期與連續天數，不記錄姓名或帳戶、不跨設備同步，也不是可兌換金額的積分。清除瀏覽器網站資料會清除簽到紀錄。現階段月老引導對話只在頁面記憶體中處理輸入，不送到伺服器，也不儲存聊天記錄；離開頁面或清除對話即無法恢復。'}
      </p>

      <h2>{getLocale() === 'zh-Hans' ? '可选的 AI 即时对话' : '可選的 AI 即時對話'}</h2>
      <p>
        {getLocale() === 'zh-Hans'
          ? '即时 AI 对话默认关闭。只有在该功能经过验收、登录后明确勾选同意时，系统才会向第三方模型服务发送你本次输入和最近最多 6 条对话，以生成回复。本站不保存聊天原文；数据库只记录每日使用次数。第三方服务可能按其安全与滥用监控政策保留相关日志。AI 回答不是命运预测，也不能替代现实中的专业支持。'
          : '即時 AI 對話預設關閉。只有在該功能經過驗收、登入後明確勾選同意時，系統才會向第三方模型服務傳送你本次輸入及最近最多 6 條對話，以生成回覆。本站不保存聊天原文；資料庫只記錄每日使用次數。第三方服務可能按其安全與濫用監控政策保留相關日誌。AI 回答不是命運預測，也不能取代現實中的專業支援。'}
      </p>

      <h2>{getLocale() === 'zh-Hans' ? '许愿池' : '許願池'}</h2>
      <p>
        {getLocale() === 'zh-Hans'
          ? '在集市许愿池写下的愿望会公开挂在许愿树上，所有访客都看得到，但不显示是谁写的；本站数据库会记录愿望与你账户的对应，用来限制每天一个、让你撤下自己的愿望，以及处理检举。愿望公开前会先经过审核：本站先自动筛掉联系方式、链接与明显的辱骂；如启用自动审核，只会把愿望这一句话发送到第三方内容审核服务，不发送你的账户或身份资料；未启用或审核服务出错时，愿望会等人工审核。你可以随时撤下自己的愿望；删除账户时，愿望、同愿与检举记录会一并删除。请不要在愿望里写全名、电话或其他能认出某个人的资料。'
          : '在集市許願池寫下的願望會公開掛在許願樹上，所有訪客都看得到，但不顯示是誰寫的；本站資料庫會記錄願望與你帳戶的對應，用來限制每天一個、讓你撤下自己的願望，以及處理檢舉。願望公開前會先經過審核：本站先自動篩掉聯絡方式、連結與明顯的辱罵；如啟用自動審核，只會把願望這一句話送到第三方內容審核服務，不傳送你的帳戶或身分資料；未啟用或審核服務出錯時，願望會等人工審核。你可以隨時撤下自己的願望；刪除帳戶時，願望、同願與檢舉紀錄會一併刪除。請不要在願望裡寫全名、電話或其他能認出某個人的資料。'}
      </p>

      <h2>{m.legal_privacy_choices_heading()}</h2>
      <p>{m.legal_privacy_choices_body()}</p>
    </LegalPage>
  );
}
