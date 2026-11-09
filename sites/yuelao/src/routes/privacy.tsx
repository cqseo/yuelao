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

      <h2>{m.legal_privacy_choices_heading()}</h2>
      <p>{m.legal_privacy_choices_body()}</p>
    </LegalPage>
  );
}
