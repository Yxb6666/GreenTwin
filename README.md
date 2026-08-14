# GreenTwin

兰考县和美乡村数字孪生决策平台。项目面向县域“三生空间”（生产、生活、生态）治理场景，将二维 GIS、三维数字孪生、指标评估、治理闭环和 AI 辅助研判整合到一个 Web 应用中。

> 当前仓库是基于 Vue 3、TypeScript 和 Vite 的演示与联调版本。地图、影像、DEM、POI 等能力依赖外部 GIS 服务；AI 报告和智能助手需要单独配置服务端密钥。

## 主要功能

| 模块 | 路由 | 能力概览 |
| --- | --- | --- |
| 登录 | `/login` | 本地演示账户注册、登录、会话恢复和受保护路由跳转 |
| 主控大屏 | `/master` | 县域概览、乡镇聚焦、人口/产业/土地/治理专题、POI 与 DEM 分析、三生雷达研判 |
| 三生评估 | `/sansheng` | 生产/生活/生态指标评估、乡镇对比、地图专题、DeepSeek 结构化报告和 Word 导出 |
| 三生模拟 | `/twin` | SuperMap 三维场景、天气与治理方案模拟、模型落点、图层控制、公园等时圈和场景截图 |
| 乡村治理 | `/governance` | 治理问题筛选与详情、热力图、闭环处置、SHP 导出和 AI 决策助手 |

公共地图工具还提供底图切换、缩放、测距、测面、定位、全屏和 PNG 导出等能力。

## 技术栈

- Vue 3、TypeScript、Pinia、Vue Router
- Vite 7、Vitest、ESLint、Prettier
- Leaflet、SuperMap iClient for Leaflet、SuperMap iClient3D for WebGL
- Node.js 同源服务、DeepSeek API、可选视觉模型和 Blender 自动化
- `docx`、`@mapbox/shp-write`、JSZip 等报告与空间数据导出工具

## 快速开始

### 环境要求

- Node.js `>= 22.12.0`
- npm（使用仓库中的 `package-lock.json`）
- 可访问项目配置的 SuperMap/iServer 等外部服务
- 可选：Blender，用于 3D Agent 和自动场景生成

### 安装与启动

```bash
git clone https://github.com/Yxb6666/GreenTwin.git
cd GreenTwin
npm ci
npm run dev
```

打开 Vite 输出的本地地址（通常为 `http://localhost:5173`）。根路由会跳转到 `/master`；首次使用时在 `/login` 创建本地演示账户即可。

登录模块的数据仅保存在当前浏览器中，适用于演示环境，不应作为生产身份认证方案。具体边界见 [`docs/account-login.md`](docs/account-login.md)。

## 环境变量

需要 AI 或 Blender 能力时，复制环境变量模板并填写本地配置：

```bash
# Windows PowerShell
Copy-Item .env.example .env.local
```

常用变量如下：

| 变量 | 用途 | 是否必需 |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | 三生报告、治理助手、决策助手和 3D Agent | 使用 AI 能力时必需 |
| `DEEPSEEK_MODEL` | DeepSeek 模型名称 | 否，模板提供默认值 |
| `DEEPSEEK_API_BASE_URL` | DeepSeek API 基础地址 | 否 |
| `VISION_API_KEY` | 决策助手的可选图片理解能力 | 否 |
| `VISION_MODEL` / `VISION_API_BASE_URL` | 视觉模型及其兼容 API 地址 | 否 |
| `VITE_ARCGIS_ACCESS_TOKEN` | ArcGIS 前端底图访问凭据 | 使用对应底图时需要 |
| `VITE_MAPBOX_ACCESS_TOKEN` | Mapbox 等时圈接口凭据 | 使用等时圈分析时需要 |
| `BLENDER_EXECUTABLE` | Blender 可执行文件的绝对路径 | 使用三维生成时需要 |
| `HOST` / `PORT` | 生产 Node 服务监听地址和端口 | 否，默认 `127.0.0.1:8080` |

`.env.local` 已被 Git 忽略。不要把 API 密钥、私钥或长期令牌写入源码、`public/`、运行时配置或提交记录。

## 运行时 GIS 配置

现场服务统一配置在 [`public/config/runtime-config.json`](public/config/runtime-config.json)。该文件会原样进入构建产物，因此可以在不重新构建前端的情况下按部署环境调整。

主要配置项包括：

- `apiBaseUrl`、普通请求超时和 AI 报告超时；
- 二维地图中心、缩放级别与 `EPSG4326`/`EPSG3857` 坐标系；
- ArcGIS、Mapbox 公共访问配置；
- SuperMap Leaflet/WebGL SDK 地址；
- 影像底图、行政区划、POI、道路、水系、建筑、人口、GDP 和土地利用服务；
- DEM、土地利用栅格以及白膜、倾斜摄影、点云 S3M 服务。

当前二维业务地图以 `supermap.mapServices.base` 为影像底图，以 `township` 为行政区划叠加层。应用会读取乡镇服务范围并自适应视图，`map.center` 和 `map.zoom` 是范围读取失败时的回退值。对于未启用动态投影的 EPSG:4326 iServer 服务，客户端会按经纬度范围请求透明影像，再由 Leaflet 对齐到 EPSG:3857 底图。

跨域部署时，需要同时确认 iServer CORS、HTTPS 混合内容、浏览器凭据来源限制和网络可达性。

## 开发命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器及本地 API 中间件 |
| `npm run type-check` | 执行 Vue 与 TypeScript 类型检查 |
| `npm run lint:check` | 检查 ESLint 问题，不修改文件 |
| `npm run lint` | 自动修复可安全处理的 ESLint 问题 |
| `npm run format` | 使用 Prettier 格式化 `src/` |
| `npm run test:unit` | 运行一次 Vitest 单元测试 |
| `npm run build` | 类型检查并生成生产构建 |
| `npm run start` | 托管 `dist/` 并启动生产 API 服务 |

提交前建议执行完整验证：

```bash
npm run lint:check
npm run test:unit
npm run build
```

## 项目结构

```text
GreenTwin/
├─ public/                 # 静态资源、业务数据和运行时配置
├─ server/                 # AI、GIS 代理和三维模拟的 Node 中间件
├─ src/
│  ├─ app/                 # 应用外壳
│  ├─ config/              # 运行时配置加载与校验
│  ├─ features/            # 登录、主控、三生评估、模拟、治理模块
│  ├─ gis/                 # Leaflet 与 SuperMap 3D 集成
│  ├─ router/              # 路由与访问保护
│  ├─ shared/              # 公共组件、组合式函数和决策助手
│  └─ styles/              # 全局样式与设计变量
├─ tests/                  # Vitest 单元与回归测试
├─ scripts/                # 数据生成和 Blender 辅助脚本
├─ docs/                   # 专题说明文档
├─ legacy/                 # 迁移前静态页面，仅供效果对照
└─ SPEC.md                 # 产品需求与技术规格
```

## 构建与部署

```bash
npm ci
npm run build
npm run start
```

生产构建输出到 `dist/`，内置 Node 服务默认监听 `http://127.0.0.1:8080`，同时提供静态文件、SPA 路由回退和 `/api` 接口。若改用 Nginx、Caddy 等服务器托管静态文件，需要把未知前端路径回退到 `index.html`，并将 `/api` 转发到对应后端服务。

部署前请检查：

1. `runtime-config.json` 中的所有现场服务地址可从用户浏览器访问。
2. 服务端密钥只存在于部署环境，不进入前端构建产物。
3. 外部服务已配置允许的来源、访问频率与 HTTPS。
4. 正式环境已用服务端认证替换浏览器本地演示账户。

## 测试与文档

Vitest 自动发现 `tests/**/*.spec.ts`，现有测试覆盖运行时配置、登录、地图服务、专题渲染、测量、治理数据、报告、AI 中间件和三维模拟等关键行为。

- [产品需求与技术规格](SPEC.md)
- [账户登录模块说明](docs/account-login.md)
- [DeepSeek 三生空间报告说明](docs/deepseek-report.md)
- [治理 GeoJSON 数据说明](public/data/governance/README.md)
- [乡镇边界数据说明](public/data/lankao-township-streets/README.md)
- [三维模型资源说明](public/models/README.md)

## 安全说明

本项目中的 AI 结果用于辅助研判，不能替代法定规划、实地调查和专家审查。生产部署应补充服务端身份认证、HTTPS、访问频控、日志脱敏、密钥轮换和用量监控。
