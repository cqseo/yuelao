# 月老 V2：零新增云费用的本地支付与 AI 交付集成验收

日期：2026-11-09。分支：`feat/yuelao-local-e2e`，基于 PR #8。

## 目标和边界

用户明确不同意购买按小时计费的 Supabase 测试分支，因此采用一次性本地 Docker PostgreSQL 17。此脚本**不能连接任何生产/云数据库**，也不会发起真实 Stripe Checkout、Stripe 测试扣款或 OpenAI 网络请求。

保留月老原正式 Worker 与正式 Supabase 数据库原样。公开 UI 预览站仍关闭登录、付款和 AI 生成。

## 一键执行

```bash
pnpm install
pnpm test:local:payments
```
环境：Node.js 24、pnpm、Docker Engine、openssl、bash。命令会随机生成数据库测试密码，动态选择 localhost 端口，自动销毁 Docker 容器。数据库数据全部虚构，不复制生产用户数据。为防止误触真实数据库，测试代码只允许 `postgresql://127.0.0.1` 或 localhost，且数据库名必须为 `postgres`，SQL 仅针对 allowlist 表和函数。

## 真正调用的项目代码与数据库

- `createTestCheckout`：通过本地 PostgREST 形状适配器写入真实 `profiles`、`orders` 表；服务器确定三次包价格 HKD 4800（HK$48），验证付款成功/取消页面位于本地域名。
- `StripeProvider.parseWebhook` + `settleStripeWebhook`：Stripe 官方 SDK 对模拟事件生成与检查 HMAC，调用真实 PostgreSQL 的 `settle_stripe_payment` RPC。Webhook 的付款状态/金额是**固定的测试事实**，未通过 Stripe API 向第三方读取。
- 同 ID 和不同 ID Webhook 并发后，一个订单只创建一份 `entitlements`，同一个 `payments` 身份只记录一次。
- `redeemPackRequest` 与 `consume_pack_use`：包次数字段实际写入 PostgreSQL，同样的籤文二次兑换不再扣次数。
- `generatePaidReading`：使用完全本地的伪造 OpenAI HTTP 响应，读取真实籤文和免费解读，测试 claim lease、存储正文、再次读取不重复生成。
- `paidReadingResponse` 和 `accountSnapshot`：真实 SQL 校验本人和其他用户的报告、已购订单、剩余次数。
- 部分退款使用模拟的 Stripe 签名 `charge.refunded` 通知，真实 PostgreSQL `revoke_for_refund` 让之前兑换的 AI 报告无法继续读取，冻结余下次数。
- 金额不足的另一笔付款必须返回 500（供 Stripe 重试/人工处理），订单保留 `pending` 且不授予任何权益。
- 检查 `anon`、`authenticated` 没有资金/AI 授权 RPC 的 EXECUTE 权限，只有 `service_role` 可调用。

## 本次结果

从新容器导入 **100 支繁体籤文 + 100 支简体转换籤文**，再成功加载全部资金与 AI 迁移。一键脚本已完成完整闭环；退出后测试容器自动销毁。

## 在正常 Supabase db reset 上发现的额外阻碍

目前仓库中部分旧的简体籤文 _migration_ 会按时间戳先于 `supabase/seed.sql` 执行，但它们引用了尚未导入的 `sticks` 行，**从全新项目执行原顺序可能外键失败**。为了验证运行时业务，脚本在结构迁移和 `sticks.source` 字段创建后先导入籤文，再执行旧的简体籤文数据迁移。这个专用顺序只在可销毁的本地 QA 容器执行。

**这不是对正式数据库的迁移修复。** 在生产/隔离 staging 真实部署前仍需单独设计不会篡改已应用迁移版本的全新初始化方案并完成 `supabase db reset` 验收。

## 尚未完成

- 当前 Stripe 沙盒已连接，但原 Webhook 指向正式站。不能把真实测试事件送往该地址。后续必须先配置独立的、正确验签且拥有对应测试数据库的集成环境。
- 实际 Stripe Sandbox 支付、延迟/失败状态持久化、Webhook 重试、退款是下一步网络联调项。这份测试使用官方 SDK 签名但 **不代表真实 Stripe API 交易通过**。
- 实际 Supabase OTP 邮件/真实登录、隔离站点保护、真实 OpenAI 密钥/模型成本与内容审核、客服和隐私条款均未完成。
- 正式付款功能仍是 `sk_test_` 或 `rk_test_` 专用，生产 Live 模式被程序禁止，不能直接上线收费。

## 开发注意

- 如果需要更接近真实环境、而仍不支付 Supabase 分支费用，可在自有机器以 Docker 启动 Supabase 本地堆栈（Auth + PostgREST + PostgreSQL）继续测试。此仓库当前脚本只做与钱和权益相关的 PostgreSQL/RPC 全链路。
- 不要将任何真密钥存到 GitHub。任何支付联调只可使用月老自己的沙盒，而不能借用其他品牌沙盒。
