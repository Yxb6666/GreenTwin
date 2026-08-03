# DeepSeek 三生空间报告

## 配置

1. 复制 `.env.example` 为 `.env.local`。
2. 在 `.env.local` 中设置 `DEEPSEEK_API_KEY`，不要在前端代码、`runtime-config.json` 或 Git 提交中保存密钥。
3. 开发环境运行 `npm run dev`，Vite 会在同源 `/api/reports/sansheng` 提供服务端代理。
4. 生产环境先运行 `npm run build`，再运行 `npm run start`。Node 服务同时托管 `dist/` 和报告接口，默认地址为 `http://127.0.0.1:8080`。

## 工作流程

前端只提交当前乡镇的三生得分、归一化权重、县域均值、排名及 15 项指标。服务端校验数据后调用 DeepSeek Chat Completions，并要求返回结构化 JSON 报告。服务端会再次校验模型输出，再把报告返回给页面。

报告弹窗支持导出标准 `.docx` Word 文档，包含标题、生成信息、执行摘要、总体评价、分维度分析、优势短板、行动建议、风险、结论及免责声明。

默认模型为 `deepseek-v4-flash`，可通过 `DEEPSEEK_MODEL` 调整。接口超时默认 90 秒，页面等待上限为 120 秒。

## 安全说明

- `DEEPSEEK_API_KEY` 仅在 Node 进程中读取，不会进入浏览器构建产物。
- 服务端限制请求体大小、数值范围和指标数量，不接受用户自定义提示词。
- 生产部署时应在网关层增加身份认证、HTTPS、访问频控和用量监控。
- AI 报告仅用于辅助研判，不能替代法定规划、实地调查和专家审查。

## 官方文档

- Chat Completions：https://api-docs.deepseek.com/api/create-chat-completion
- 模型与计费：https://api-docs.deepseek.com/quick_start/pricing
- JSON Output：https://api-docs.deepseek.com/guides/json_mode/
