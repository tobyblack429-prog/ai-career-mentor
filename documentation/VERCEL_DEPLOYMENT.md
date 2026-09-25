# Vercel 公共演示版部署说明

本项目使用一个 Vercel Services 项目部署 Next.js 前端和 FastAPI 后端。`vercel.json` 将 `/api/*` 路由到后端，其余路径路由到前端。

## 上线前提

1. 在 Vercel 创建项目，根目录为仓库根目录，并使用 `vercel.json` 中的 Services 配置。
2. 通过 Vercel Marketplace 连接免费档 Neon Postgres；确认项目的 `DATABASE_URL` 指向 PostgreSQL，而非本机 SQLite。
3. 通过 Marketplace 连接免费档 Upstash Redis；在项目环境变量中将 Redis 的 TLS/TCP 连接串保存为 `REDIS_URL`。不要将 REST URL 当作 `redis-py` 的 `REDIS_URL`。
4. 在 Vercel 项目设置中添加以下加密环境变量，适用于 Production（如需预览完整功能，也添加到 Preview）：

   | 名称 | 值 |
   | --- | --- |
   | `APP_ENV` | `production` |
   | `PUBLIC_ANONYMOUS_ACCESS` | `true` |
   | `AUTH_DISABLED` | `false` |
   | `SECRET_KEY` | 新生成的高强度随机密钥，不能沿用本地密钥 |
   | `LLM_PROVIDER` | `siliconflow` |
   | `SILICONFLOW_MODEL` | 在供应商价格页确认当前免费的模型 ID |
   | `SILICONFLOW_API_KEY` | 仅填入 Vercel 的加密环境变量，不写入仓库 |
   | `DATABASE_URL` | Marketplace 提供的 PostgreSQL 连接串 |
   | `REDIS_URL` | Upstash 提供的 `rediss://` TLS/TCP 连接串 |

5. 不要设置 `NEXT_PUBLIC_API_URL`，生产前端默认使用同域 `/api`。不要上传 `backend/.env` 或 `frontend/.env.local`。
6. 免费档资源可能有限额或改变价格。确认订单页面为免费档后再创建；不要启用自动升级到付费档。

## 验收

- `/` 能加载首页，`/api/health` 返回数据库 `connected`。
- 打开 `/dashboard` 会创建仅属于当前浏览器的 HttpOnly 访客会话；不同浏览器的简历和面试历史互不可见。
- 测试简历解析、AI 分析、路线图、市场分析和面试连接。匿名限额必须可用；Redis 连接失败时 API 应拒绝请求，而不是无约束地消耗模型额度。
- 清除浏览器 Cookie 会失去旧匿名会话，无法找回原来的数据；不要把真实敏感简历当作公开演示数据。

Vercel 插件可部署源码并检查部署日志，但目前该插件不提供 Marketplace 资源创建和加密环境变量写入接口；这两项必须在 Vercel 项目设置中完成，再重新部署并验证。
