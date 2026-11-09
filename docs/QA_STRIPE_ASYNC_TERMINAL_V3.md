# 月老 Stripe Sandbox：异步付款失败与过期订单状态

## 修复内容

原系统将 `checkout.session.async_payment_failed` 与 `checkout.session.expired` 识别为 Stripe 事件，但当系统重新读取该 Checkout 得到 `payment: null` 时，直接回复 200 并忽略订单状态更新。因此订单会长期停在 `pending`，用户误以为「等待付款」。

现在处理流程：

1. Stripe Webhook **必须签名有效**且 `livemode=false`。正式 `sk_live_*` 的 API Key 仍被应用拒绝。
2. 必须用 Stripe API Secret 重新查询 `checkout.sessions.retrieve`，不能信任 Webhook 的用户输入、`metadata` 或 `payment_status` 原始载荷。
3. `checkout.session.async_payment_failed` 只在 provider **当前** `status=complete` 且 `payment_status=unpaid` 时更新为 `failed`。
4. `checkout.session.expired` 只在 provider **当前** `status=expired` 且 `payment_status=unpaid` 时更新为 `expired`。
5. 已付款和读取到已支付的订单不允许降级；订单 ID 和 Checkout Session ID 必须在数据库中同时匹配；RPC 只允许 `service_role` 执行。
6. 找不到订单或状态未经过重新验证时，不提供成功假象：返回 500/503 让 Stripe 安全重试/运维检查。
7. 用户账号页面现在分别展示「付款失敗」与「已失效」，不再把失败和过期混为一谈。

## 数据库

新增 `20261109073558_checkout_async_terminal_state.sql`，仅扩展 `orders.status` 允许 `failed` 状态和增加 `mark_checkout_unpaid(uuid,text,text)` RPC。不会影响原有已付款订单，未直接部署到正式 Supabase。

## 离线测试

```bash
pnpm lint
pnpm check
pnpm exec tsx tools/test-stripe-webhook.ts
pnpm test:local:payments
```

真实 PostgreSQL 17 临时库（模拟 Stripe SDK 签名事件 + Stripe API 状态 stub）覆盖：

- 付款成功授予权益；重复或乱序通知不重复发放；
- 异步失败后的订单由 pending 变 failed，重复事件幂等；
- Checkout 过期后 pending 变 expired，无付费权益；
- 已支付订单接到迟到的过期事件仍是 paid；
- 所有失败与过期状态仅来自服务器重新获取的当前 Checkout Session；
- 客户端无法调用服务端资金 RPC、金额不足不能得到付费权益、退款撤销已发放内容。

## 尚未完成

这份改动仍在 **Stripe Sandbox 安全开发阶段**。未使用真实 Stripe API 付款，未更新生产 Supabase，未开启生产收费。Stripe Sandbox 的旧 Webhook 仍指向正式站，应在隔离的集成环境重新配置并验收后再实际付款。邮箱 OTP SMTP、生产迁移、真人/模型生成成本与用户退款条款也尚需完成。

**不创建 Supabase 按小时收费的测试分支，不产生真实收款或 OpenAI API 费用。**
