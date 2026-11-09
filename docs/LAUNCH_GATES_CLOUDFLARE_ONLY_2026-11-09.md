# 月老上线收尾：仅 Cloudflare + Supabase + Stripe，不使用用户服务器

更新：2026-11-09。本文是实际配置与验证的检查表，**不是已完成生产充值的声明**。

## 运行边界

- 前端和 API 仅部署到 `cqseo` Cloudflare Workers；源代码在 GitHub `cqseo/yuelao`。
- 账号、签文、订单、权益使用 Supabase `yuelao`；支付使用独立的 Stripe `yuelao 沙盒` / Live 账户。
- **禁止**在用户 VPS、宝塔、`/tmp`、`/root`、`/opt` 内下载、构建、测试、部署或清理本项目。
- 不创建收费 Supabase branch；没有独立测试数据库之前，不要将 Stripe Sandbox 与正式数据库联调。
- AI 即时聊天 `AI_CHAT_ENABLED=false`；付费深度解读 `AI_ENABLE_TEST_GENERATION=false`；Checkout `BILLING_ENABLE_TEST_CHECKOUT=false`。本变更不打开任何开关。

## 已经完成的安全准备（数据库）

- 正式 Supabase 有 100 支繁体源签、100 支简体签文；原有签文内容校验保持一致。
- 已按 GitHub 迁移版本对齐 13 项历史迁移，包含付款结算、退款撤销、付费解读、Checkout 失败/过期状态；AI 聊天额度迁移未部署（当前不需要）。
- 支付及交付 RPC 限定 `service_role`，匿名与普通认证角色不可直接调用。数据库已就绪不等于实际支付联调通过。

## 新增：游客身份上线门槛（PR #16，尚未在正式环境启用）

1. 在隔离的 Supabase 测试库应用 `20261109200000_guest_profile_email_nullable.sql`，确认 `public.profiles.email` 允许 NULL，已有 profiles 不变化、RLS 仍启用；未通过这一步不能开放游客建号。
2. Supabase Auth 测试库开启 Anonymous Sign-Ins 和 Manual Linking。仅当浏览器进入「我的」时在受保护的 Turnstile 验证后自动建号，避免对所有主页爬虫创建用户。确认初次建号自动 upsert 自己的 profile，重复访问不会创建新用户。
3. 先验收游客创建、刷新 cookie、游客自己保存记录、绑定邮箱 `updateUser` + `email_change` 六位 OTP、相同完整 UUID、跨设备邮箱登录。验证短编号绝不能成为登录凭据。
4. 登录 UI 需要构建开关 `VITE_AUTH_ENABLED=true` 与 `VITE_GUEST_AUTH_ENABLED=true`，同时 Cloudflare Worker `GUEST_AUTH_ENABLED=true`；**目前三个开关都未启用**。Turnstile Site Key 在构建时，Secret Key 是 Worker Secret；暂不打开真正 AI 聊天或真实支付。
5. 已提交 `pnpm test:auth:guest` 和测试用假 Supabase 客户端；**新代码测试尚未真实执行**，不能只凭测试文件存在就认定通过。用户 VPS 完全禁止访问。

## 第一关：邮箱验证码登录（不可跳过）

1. 准备**月老自己的**已验证发件域名，不能挪用其他项目的 Resend 已验证域名。为 Supabase Auth 配置专属 SMTP / 发信服务、发件人地址、限制和送达监控。
2. 在 Supabase Auth 的 **Magic Link 邮件模板**中显示六位验证码 `{{ .Token }}`，而不是只发送 Magic Link；确认验证码过期时间和频率限制。
3. 在管理 `cqseo` Worker 的 Cloudflare 账户里为目标域创建 Turnstile widget，允许对应预览域名及正式域名。其 **site key** 是公开的，在 Vite 构建环境配置 `VITE_TURNSTILE_SITE_KEY`；其 **secret key** 只能存到 Worker secret `TURNSTILE_SECRET_KEY`。
4. 本次后端在发邮件前向 Cloudflare `siteverify` 验证 Turnstile 的 `success`、`hostname` 与 `action=auth_send`。如 secret 缺失、令牌无效或验证服务失败，拒绝发送（fail closed）。因为服务器已经验证并消耗单次 token，不要同时让 Supabase CAPTCHA 再次消耗同一令牌。
5. 在正式开放前配置 Cloudflare WAF/IP 请求速率限制、Supabase Auth 邮件频率限制，并用**真实测试邮箱**完成六位验证码发送、登录、刷新、退出、重登全流程。
6. 验收后再在构建环境把 `VITE_AUTH_ENABLED=true`。未完成时保持禁用，不暴露未配置的登录界面。

## 第二关：Stripe 沙盒集成（不能对生产真实数据实验）

1. 现有独立的 `yuelao 沙盒` Webhook 已定向 `https://yuelao-v2-staging-20261109.cqseo.workers.dev/api/webhooks/stripe`，**目前停用**；正式 Live 账户没有已就绪的生产 Webhook。
2. 预览 Worker 当前没有隔离的测试数据库、测试 Stripe Secret Key 或匹配的 Webhook signing secret。必须先拥有隔离数据层和受保护预览环境，再为**该预览 Worker**配置测试密钥；绝不连接正式 Supabase 用户/订单表。
3. 准备付费正文的实际交付能力，并审核模型费用及退款；当前测试 Checkout 被 `AI_ENABLE_TEST_GENERATION=false` 正确阻断。**AI 即时聊天与付费解读是两条不同功能线**，前者继续不开放。
4. 只有上述条件全部满足，才开启预览 Worker 的 `BILLING_ENABLE_TEST_CHECKOUT=true` 并启用沙盒 Webhook。测试真实 Stripe Sandbox Checkout、签名、重复事件、异步成功/失败、订单过期、次数包领取、部分退款及撤销后访问控制。
5. 当前 `/api/billing/checkout` 代码是 **test-only**，硬性拒绝 Stripe Live Key；正式收款不能通过把 `sk_live` 填进去或直接切换开关来实现，必须另外开发和验收正式模式。
6. Live 上线前需要真实品牌域名、有效客服邮箱、明确价格/币种、付款与退款条款、数据删除说明以及明确的支付风险评估。

## Cloudflare Worker 配置约束

- `sites/yuelao/wrangler.jsonc` 不写空字符串 `SUPABASE_URL` / `SUPABASE_ANON_KEY` 占位，避免部署时覆盖 Worker 机密绑定。
- `SUPABASE_URL`、`SUPABASE_ANON_KEY`（公开可见的项目配置）、`SUPABASE_SERVICE_ROLE_KEY`（私密）、`TURNSTILE_SECRET_KEY`（私密）应在 Cloudflare 对**正确的 Worker 与环境**分别绑定。绝不将 service-role 或 Turnstile secret 放到 Vite `VITE_*`、git 或前端。
- 当前 ChatGPT 内的 Cloudflare 连接没有授权 `cqseo` 账户，不能用另一账户替代部署；先连对账户再执行 Cloudflare 发布。GitHub 代码更新本身**不会**自动修改正式 Worker。
- 不使用 VPS 或用户远程服务器做构建。允许使用独立的云端 CI / 托管构建，但需明确环境和密钥边界；不要将真实密钥放入日志。

## 验收证据的范围

- GitHub 代码静态核对不等于编译、浏览器 E2E、真实邮件或 Stripe 实际付款已经通过。
- 没有独立数据测试环境、SMTP、Turnstile 和匹配的 Worker Secret 时，正式站的登录与充值都应继续拒绝请求。
- 保持 `AI_CHAT_ENABLED=false` 直到用户另行明确要求开放。
