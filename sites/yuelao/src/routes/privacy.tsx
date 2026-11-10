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

      <h2>{getLocale() === 'zh-Hans' ? '游客身份与邮箱绑定' : '訪客身份與郵箱綁定'}</h2>
      <p>
        {getLocale() === 'zh-Hans'
          ? '游客账号功能目前正在安全验收。开放后，当你进入需要保存个人记录的「我的」页面并通过安全验证时，系统可能创建一个不需要邮箱的临时账号，生成随机用户 ID，并通过安全 Cookie 保存会话。这个临时账号在清除浏览器数据、更换设备或退出登录后可能无法找回；展示给你的短编号并不是找回凭证。你可以自行选择绑定邮箱，系统会发送一次性验证码，在验证成功后为同一用户 ID 增加邮箱身份。验证码与反滥用验证可能由 Supabase Auth 和 Cloudflare Turnstile 处理。免费求签、每日心笺以及原本在本机的签到数据不会因创建游客账号而自动同步到云端。'
          : '訪客帳號功能目前正在安全驗收。開放後，當你進入需要保存個人記錄的「我的」頁面並通過安全驗證時，系統可能建立一個不需要郵箱的臨時帳號，生成隨機使用者 ID，並透過安全 Cookie 保存登入狀態。這個臨時帳號在清除瀏覽器資料、更換裝置或登出後可能無法找回；顯示的短編號並不是找回憑證。你可自行選擇綁定郵箱，系統會寄送一次性驗證碼，驗證成功後為同一使用者 ID 增加郵箱身份。驗證碼及防濫用驗證可能由 Supabase Auth 與 Cloudflare Turnstile 處理。免費求籤、每日心箋及原先存在本機的簽到資料不會因建立訪客帳號而自動同步到雲端。'}
      </p>

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
