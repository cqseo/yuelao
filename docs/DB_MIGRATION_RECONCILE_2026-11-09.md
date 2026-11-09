# 月老：正式数据库迁移对齐与支付/登录验收

日期：2026-11-09

## 发现的真实问题

已通过连接的 Supabase 正式项目核查：

- 现有 100 支繁体原始签文、0 份简体翻译数据；
- 0 个实际账号、订单、付款、权益；
- `paid_ai_readings`、AI 聊天额度表和付费交付准备 RPC 都尚不存在；
- 正式迁移历史包含：
  - `20261107093328_lock_money_rpcs`
  - `20261108045326_profiles_stripe_customer_id`
- 上面这两份原始迁移此前未提交到 GitHub，造成远程 migration history 和本地文件清单不一致。已从正式数据库的 `supabase_migrations.schema_migrations.statements` 只读恢复 SQL，**没有重新在正式数据库执行**。

## 已修复

1. 恢复上述两份历史迁移文件，版本和名称严格匹配正式 Supabase 已应用记录。不要重新执行或在生产重复添加列。
2. 添加 `20261105235959_bootstrap_canonical_sticks.sql`，确保 _先有 100 支 canonical sticks_，旧的 `20261106000001/0003` 简体签文外键插入才能成功。这份新迁移在补缺数据时用 `on conflict (id) do nothing`，**不会覆盖现有签文**；带 source 的旧迁移本来就用 `add column if not exists`。
3. 修改 `tools/run-local-payment-e2e.sh`：按所有 migration 文件的真实版本排序应用，然后才运行 `supabase/seed.sql`，与 Supabase CLI 的 `db reset` 时序一致。以前测试用特殊手动顺序，会掩盖问题。
4. 新增 `tools/test-db-retrofit.sh`：先创建含历史签文的模拟生产库，再套用新 bootstrap 与后续迁移，确保一条已有签文正文不被替换、共 100 行、简体 100 行、付费表/AI 表齐全。
5. 新增 `tools/test-auth-otp.ts`：使用 Supabase Auth Mock 复核：同源保护、无效邮箱/验证码、Email OTP 的 send/verify、Secure+HttpOnly+SameSite cookie、刷新/退出登录。**没有真的给用户寄邮件**。

## 无云费用的验证

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm check
pnpm test:local:payments
pnpm test:db:retrofit
pnpm test:auth:otp
```

- 本地 Docker PostgreSQL 17：真实 migration + seed 顺序完整运行，100 原始签 + 100 简体签；
- 真实项目 SQL RPC + 服务端：模拟 Checkout → SDK 签名支付回调 → 唯一到账权益 → AI 假响应保存 → 退款撤销 → 付款金额不足拒绝；
- 与生产类似、有历史数据的数据库升级：确保不覆盖原有签文；
- 登录：模拟 Supabase Auth 返回码，不触发外部 OTP 邮件，不暴露假 token；
- 所有测试在临时容器运行，测试后删除。

## 仍不能直接上线真实充值的原因

1. **尚未将迁移部署到正式 Supabase**。不要使用 `supabase db reset --linked`，它会破坏生产数据；不要直接调用 apply_migration 给已应用的两份历史 SQL 分配新的版本。应先通过完整的 `supabase migration list --linked` 和 `db push --dry-run --include-all` 审核，并备份，再按可控顺序应用新迁移；此前后执行只读表数/权益/权限对照。这要求具有合适的生产数据库连接权限。
2. **未配置月老专用发信域名或 SMTP**。现有 Resend 的已验证域名属于其他项目，不可混用作月老品牌邮箱。Supabase 默认 SMTP 限流且可能仅能发给已授权组织成员；要上线公开 OTP，必须创建月老已验证发信域名、配置 SMTP/Email Hook、邮件中使用六位验证码模板、做好机器人/邮件轰炸防御。
3. **Stripe 沙盒 Webhook 仍指向原正式 Worker**，无法安全证明测试付款自动交付；必须先在隔离且使用正确 Supabase 迁移的集成环境完成测试。
4. **真实 AI 模型与费用**未授权。模拟答案不等于真实模型调用；保持所有模型开关 false。
5. **正式站支付**仍使用 test-only 程序并主动拒绝 Live mode API key，不能开启真实收款；要先完成独立安全审查。
6. `supportEmail` 仍是占位符，隐私/退款条款与失败订单状态需要进一步完善。

本 PR 不创建付费 Supabase 分支、没有更改任何生产数据库、没有真实扣款/邮件/AI 费用。
