# 仓库指南

## 项目结构与模块组织

GreenTwin 是基于 Vue 3、TypeScript 和 Vite 的单页应用。应用入口与路由分别位于 `src/main.ts` 和 `src/router/`。页面级模块放在 `src/features/<feature>/`，可复用组件与组合式函数放在 `src/shared/`。GIS 集成集中在 `src/gis/`，运行时配置逻辑位于 `src/config/`，全局样式位于 `src/styles/`。静态资源存放在 `public/`，其中 `public/config/runtime-config.json` 用于现场服务配置。单元测试位于 `tests/`。`legacy/` 仅作为迁移参考，`dist/` 是构建产物，`tmp/` 用于临时文件。

## 构建、测试与开发命令

请使用 Node.js 22.12 或更高版本，并通过 `npm ci` 按锁文件安装依赖。

- `npm run dev`：启动 Vite 本地开发服务器。
- `npm run type-check`：检查 Vue 与 TypeScript 类型。
- `npm run lint:check`：检查 ESLint 问题，不修改文件。
- `npm run lint`：自动修复可安全处理的 ESLint 问题。
- `npm run format`：使用 Prettier 格式化 `src/`。
- `npm run test:unit`：在 jsdom 环境中运行一次 Vitest 测试。
- `npm run build`：完成类型检查并将生产构建输出到 `dist/`。

提交拉取请求前，应运行 `npm run lint:check`、`npm run test:unit` 和 `npm run build`。

## 编码风格与命名规范

遵循现有的两空格缩进、无扩展名导入和 TypeScript 单引号风格。Vue 组件使用 PascalCase，如 `PanelCard.vue`；函数与组合式函数使用 camelCase，如 `useRuntimeConfig`；功能目录和 URL 路径使用 kebab-case。导入 `src/` 下模块时优先使用 `@/` 别名。页面专属的数据和逻辑应与对应功能放在一起，只有实际复用的代码才移入 `shared/`。

## 测试规范

Vitest 自动发现 `tests/**/*.spec.ts`。测试套件应以被测模块或行为命名，并通过聚焦的 `it(...)` 用例覆盖正常、边界和回退场景。目前未配置覆盖率门槛，但新增业务逻辑和缺陷修复必须补充相应的回归测试。

## 提交与拉取请求规范

提交信息必须使用简洁、准确的中文描述。可保留 Conventional Commits 的英文类型和作用域，例如 `feat(map): 接入影像底图` 或 `fix(tooling): 补充配置依赖`，但冒号后的内容必须为中文。每个提交只包含一项连贯变更。

每次完成代码或文档修改后，必须先执行与变更相符的验证，再创建准确、简洁的 Git 提交，并将当前分支推送到已配置的远程仓库。若验证、提交或推送失败，应明确说明原因，不得静默跳过。

拉取请求需说明变更目的、受影响的路由或模块、验证命令及配置变化；关联相关议题，并为可见的界面变化附上截图。禁止将密码、私钥或长期令牌写入运行时配置或提交到仓库。
