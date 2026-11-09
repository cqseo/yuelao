# 月老账号模式修正：先匿名游客，再绑定邮箱（方案与上线门槛）

2026-11-09。**阶段一代码已提交，但未完成云端集成验收、未开启功能开关或在正式库创建游客用户。** 所有改动仅在 GitHub 草稿 PR #16 中；禁止登录或操作用户 VPS。

## 当前真实实现状态（代码已提交，非上线证明）

- `POST /api/auth/guest`：同源 + Turnstile `guest_create` + `GUEST_AUTH_ENABLED=true` 后才可创建 Supabase 匿名用户，设置 Secure HttpOnly cookie；有有效会话时不得重复建号，refresh 失败不得静默新建。
- `GET /api/auth/guest/status`：返回游客／已绑定状态和短展示编号，不返回 token。
- `POST /api/auth/guest/link`：验证当前游客会话 + Turnstile `email_link`，使用 `updateUser({email})`，不新建邮箱账号。
- `POST /api/auth/guest/verify`：验证 `email_change` 六位 OTP，要求返回的完整 `user.id` 与游客相同，签发更新后的 HttpOnly cookie。
- `/account`：打开「我的」时自动检查身份，首次通过 Turnstile 后建立游客账号，展示「访客编号」与后绑定邮箱表单。公开首页继续免登录，**暂不在每次访问首页时自动调用 Supabase 建号**以防刷号及不必要的数据库成本。
- `/login`：若已有游客会话，导向「我的」绑定邮箱，防止误使用普通邮箱 OTP 创建第二个账号。
- 构建开关 `VITE_AUTH_ENABLED` 和 `VITE_GUEST_AUTH_ENABLED` 必须均为 true 才呈现游客账户 UI；Worker `GUEST_AUTH_ENABLED` 默认 false；邮箱／Turnstile 配置缺失时 API 拒绝创建或绑定。
- `pnpm test:auth:guest`：已提交游客创建、重复访问、同一 ID 邮箱绑定及异常测试代码；**本分支仍没有 CI 结果或真实 OTP / 浏览器验收**。


## 1. 为什么修正

参考站菩提苑在公开「更多」页面写明可以「用吉祥号或手机号在新设备恢复」记录：
https://putiyuan.pages.dev/more/

这表明它重视账户/记录找回，但仅凭公开网页**不能确认**第一次打开站点就创建了后端账号，也不能推定它的具体认证实现。

月老应该学习实际产品逻辑而不复制验证不明的技术：**先体验、后台保留游客身份、需要跨设备保存时再绑定邮箱**。登录/绑定不是访问免费内容的门槛。

## 2. 推荐用户流程

1. 新设备首次打开月老：展示免费求签、情感测验、每日心笺，不弹登录。提供「我的」固定入口。
2. 首次真正使用需要保存的个人功能时，前端自动 POST 到 Cloudflare Worker `/api/auth/guest`；在受控条件下由 Supabase `signInAnonymously()` 创建真实匿名用户（`auth.users.id`），Worker 设置 `HttpOnly; Secure; SameSite=Lax; Path=/` 的 host-only cookie。页面可显示「访客」与非敏感短展示编号，但**编号不是登录凭证**。
3. 同一浏览器再次访问，通过 HttpOnly cookie 恢复原游客会话，不重复建号；access 过期使用 refresh cookie 滚动更新。若 cookie 均不可用，提示游客数据可能丢失，绝不擅自猜测/合并用户。
4. 游客继续使用免费功能，自己决定何时「绑定邮箱以跨设备找回」。保留无需登录的公共阅读能力。
5. 绑定时必须针对**现有游客会话**调用 Supabase Auth `updateUser({email})`，并按 Supabase `Change email address` 模板验证六位验证码（而非普通新用户 `signInWithOtp()`）。成功后检查 **User ID 不变**，让原个人数据、订单与已解锁权益留在原账号上。应刷新 cookie 并重新校验 `is_anonymous=false`。
6. 若邮箱已有别的账户，提供「改用已有账户登录」和可选的人工确认/受控数据迁移；**绝不将两账户简单自动合并**，以防冒领他人订单或导出隐私数据。
7. 邮箱绑定后再开放异设备登录与未来的付款；当前 Stripe Test-only 结账与正式付款仍维持关闭，AI 即时聊天继续关闭。

## 3. Supabase 选型与重要区别

官方文档：https://supabase.com/docs/guides/auth/auth-anonymous

- `signInAnonymously()`：真实 `auth.users` 身份，有独立 UUID 与会话；这和用于公开客户端 API 的 `anon` key **不是**一回事。
- 匿名用户携带 `is_anonymous=true`，却使用 PostgreSQL `authenticated` 角色。**所有 RLS / RPC / API 都要审计**，不能只依赖 `TO authenticated` 判断有无绑定邮箱。
- `updateUser({email})` 成功并完成验证可升级匿名账号并保持同一 UUID；必须在真实隔离环境验证它与 OTP、cookie 的完整流程。
- `signInWithOtp()` 是「以邮箱登录或创建邮箱账号」，不能替代游客的「绑定」，否则很容易生成**第二个**用户 ID 丢失游客记录。
- 匿名身份未绑定前，在删除浏览器数据、退出登录或换设备后可能无法恢复。因此绑定前必须清楚提示，并把恢复凭证与公开展示编号严格区分。
- 匿名账号会增加 Supabase Auth 用户数、MAU 和邮件/数据库成本；严禁在没有防滥用保护时对爬虫和所有主页请求无条件创建。建议首次有价值的用户互动时无感创建；UI 感受仍是“无需注册，已获得游客身份”。

## 4. 月老现有代码差距（当前不是已实现）

- `packages/core/src/auth.ts` 的 `getUserFromRequest` 要求 user.email，天然排除游客；需要新增单独 guest principal，而不能放宽所有付款/AI 路由的权限。
- `packages/core/src/auth-session.ts` 现有 HttpOnly cookie 可复用，但要处理游客刷新和账号升级后的 cookie 旋转。
- `packages/core/src/auth-handlers.ts` 目前的 send/verify 是新邮箱账号登录；游客绑定需要新的 `link-email` / `verify-link`，不能只重命名 UI。
- `/account` 目前只支持真实邮箱账号，并展示订单和套餐；应分为游客概览（可用功能、保护提示、绑定邮箱）和已验证账号（订单、已购权益）。
- 每日签到仍存在浏览器 localStorage，不要宣称已跨设备同步。若未来同步，需明示选择并实现迁移、冲突解决和数据删除。
- 签诗免费内容不用为获取游客身份而阻塞首屏。

## 5. 必须先完成的安全门槛

- 功能开关默认 false；Cloudflare 正确账户、隔离测试环境、公开页面缓存/CDN/SSR 与访客 cookie 隔离经过审核。
- Supabase 项目先确认「Allow anonymous sign-ins」与「Allow manual linking」的项目级配置；绝不擅自在正式库启用并生成匿名用户。
- Cloudflare WAF/IP/设备滥用率限制、Turnstile（在高风险动作或异常请求时）、限流/重复请求去重，防止每次页面加载创建账户。
- RLS：按 `user_id=auth.uid()` 的读写还需审核匿名访问边界；订单、支付、权益发放、深度解读维持仅已验证永久用户才能触发，`service_role` 仅 Worker 服务端持有。
- 账号恢复：不能“只输入吉祥号”就恢复；应要求邮箱验证或等价的独立强凭据。恢复码如需设计，必须足够随机、一次性/可撤销、不与展示编号混用。
- 真实 E2E 验收：首次访问不强制注册 → 首次交互仅生成一人 → 重复刷新不重复建号 → 游客可保存有限记录 → 邮箱验证码验证 → UUID 不变 → 换设备登录可见本人记录 → 其他账号不能读取 → 退出/清 Cookie 提示正确 → 支付仍关闭 → AI 聊天仍关闭。
- 禁止向用户 VPS、宝塔等开发、测试、构建、部署或清理；只通过 GitHub、正确 Cloudflare Worker 和 Supabase 的授权操作。

## 6. 优先顺序

P0：确认游客账号策略及防滥用设计、独立预览环境、账号 API 与邮箱绑定 E2E。

P1：在「我的姻缘簿」显示游客/已绑定状态，提供绑定入口和永久数据说明。

P2：将用户明确选择保存的签文/签到同步到个人记录，公开分享时不带私人关系问题；继续优化回访路径。

P3：再处理 Stripe 沙盒交付和正式充值；AI 即时聊天按用户要求不开放。
