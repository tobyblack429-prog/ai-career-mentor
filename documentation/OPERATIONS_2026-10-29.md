# 2026-10-29 运行维护记录

## GitHub 自动任务

- 已为 `tobyblack429-prog/ai-career-mentor` 开启 Issues。每周市场核验流程依赖它创建待办。
- 手动运行已成功：[运行记录](https://github.com/tobyblack429-prog/ai-career-mentor/actions/runs/40722480927)。
- 已创建[市场数据核验待办 #1](https://github.com/tobyblack429-prog/ai-career-mentor/issues/1)。定时任务仍为北京时间周一 09:17，实际开始时间可能受平台排队影响。
- 该任务仅提醒核验，不能当作市场数据已自动更新的证明。
- 已在 GitHub 停用旧的 `Deploy Backend to Render` 工作流，状态为 `disabled_manually`。当前部署使用 Vercel，不需要补填 Render 密钥。如以后迁回 Render，可按需要重新配置并启用。

## 后端限流故障处理

全局请求限流使用 Redis。此前 Redis 连接故障可能令 `/ping` 与 `/health` 也返回通用 500，无法区分应用存活和依赖不可用。

本次变更：

- Redis 请求限流连接和读写超时均为 3 秒，存储异常统一转换为中文 503，并提供重试提示。
- `/api/ping` 作为存活探针，不消耗限流存储。
- `/api/health` 作为就绪检查，报告数据库状态；公开匿名模式下同时检查 Redis。依赖不可用返回 503 和 `degraded`，不会假报正常。
- 匿名访客身份隔离、公开 AI 总额和 IP 限额保持有效；限额存储不可用时仍拒绝 AI 请求。
- 自动化测试使用独立数据库并模拟 Redis 故障，不调用真实模型服务。

## 上线验收

上述缺陷是源码中确认的故障处理问题；线上 500 的最终原因仍需 Vercel 运行日志核实，不能仅凭现象断定是 Redis。

部署后应检查：

1. `/dashboard` 返回成功。
2. `/api/ping` 返回 200 和 `pong: true`。
3. `/api/health` 返回 200，数据库及公开模式的 Redis 均为 `connected`。
4. 匿名会话可建立，再使用演示数据验证 AI 功能及不同访客数据隔离。

如果 Redis 服务已被归档，应先在对应免费档服务管理页确认恢复选项；不要关闭限额来绕过故障，也不要在未确认费用前升级付费档。密钥只在平台加密环境变量中配置。
