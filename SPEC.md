# GreenTwin Vue 前端重构需求与技术规格

> 文档状态：需求已确认，Vue 迁移已实施
> 版本：1.0
> 日期：2026-08-01
> 适用项目：兰考县和美乡村数字孪生决策平台（GreenTwin）

## 1. 文档目的

本文档统一描述 GreenTwin 从静态 HTML 页面迁移到 Vue 前端框架的业务需求、技术架构、模块边界、服务接入方式、迁移步骤和验收标准，作为后续开发、联调、测试及比赛现场部署的依据。

本文档中的“迁移”指在基本保留现有视觉和交互的前提下，将页面改造成结构清晰、可复用、可配置、可维护的 Vue 应用，不等同于重新设计产品或新增业务系统。

## 2. 项目现状

### 2.1 现有页面

| 文件 | 当前模块 | 主要能力 |
| --- | --- | --- |
| `legacy/Master.html` | 主控大屏静态基线 | 人口、GDP、三生评价、土地利用、DEM、治理问题、决策方案及二维专题地图 |
| `legacy/sansheng.html` + `legacy/js/sansheng.js` | 三生空间综合分析静态基线 | 指标体系、权重配置、综合计算、专题图层、乡镇排名、优势短板和报告导出 |
| `legacy/twin.html` | 数字孪生场景静态基线 | SuperMap WebGL/Cesium 三维场景、S3M 图层控制、模式切换、视点漫游和雷达图 |
| `legacy/governance.html` | 乡村治理静态基线 | 问题总览、组合筛选、空间落图、热点/聚类/状态图层、详情、状态更新和统计图表 |

### 2.2 当前技术形态

- 四个页面彼此独立，没有统一入口和前端路由。
- HTML、CSS、业务数据、DOM 操作和地图生命周期存在较强耦合。
- Leaflet、SuperMap iClient 和 Cesium/SuperMap WebGL 主要通过远程全局脚本加载。
- iServer、S3M 和业务接口地址尚未集中管理；代码中同时存在公网示例地址、`localhost` 地址和占位地址。
- 部分业务数据为前端硬编码模拟数据，适合原型展示，不适合作为正式接口契约。
- 页面包含计时器、窗口监听、`ResizeObserver`、Leaflet 地图和三维 Viewer；迁移后必须在组件卸载时完整清理。
- 当前 `tmp/` 为未纳入版本控制的目录，本次规格不要求处理其中内容。

### 2.3 需要解决的问题

1. 四个模块缺少统一产品入口，比赛演示时切换不连贯。
2. 服务地址散落在源码中，现场环境变化时修改和重新构建成本高。
3. 直接操作 DOM 的脚本难以复用、测试和维护。
4. 地图、三维引擎与页面生命周期没有统一封装，路由切换后可能产生重复实例、监听器或显存泄漏。
5. 公共视觉样式和交互状态存在重复实现，后续统一调整成本高。

## 3. 已确认的产品意图

- **目标**：把现有四个静态页面完整迁移为 Vue 应用，并完成组件化、路由化和统一配置。
- **用户**：SuperMap 杯现场答辩人员与评委。
- **主要场景**：电脑连接横屏大屏进行现场展示和模块演示。
- **系统结构**：统一平台入口，主控大屏作为首页；三生空间分析、数字孪生、乡村治理作为独立全屏模块。
- **数据前提**：默认比赛现场存在稳定可用的 SuperMap iServer、三维场景和业务后端接口；模拟数据仅用于开发联调。
- **成功标准**：模块切换顺畅，地图和三维服务稳定加载，现有核心交互完整保留，能够连续完成比赛演示。
- **展示目标**：优先适配 1920×1080 横屏，同时兼容常见笔记本横屏；不要求手机端适配。
- **视觉边界**：保留现有深色科技大屏风格，仅统一导航、设计变量、间距、交互状态和响应式表现。

## 4. 项目范围

### 4.1 本次包含

1. 创建 Vue 3 + Vite + TypeScript 单页应用。
2. 建立统一入口、应用壳层和 Vue Router 路由。
3. 将四个现有页面迁移为 Vue 页面和可复用组件。
4. 集中管理运行时配置、iServer 地址、三维场景地址和业务 API 地址。
5. 封装 HTTP 请求、二维地图和三维场景的初始化及销毁逻辑。
6. 将硬编码模拟数据迁移至开发专用 mock 层，并建立 TypeScript 数据模型。
7. 保留现有指标计算、筛选、地图联动、图表绘制、状态更新、视点漫游和导出等已实现交互。
8. 完成大屏与常见笔记本横屏适配。
9. 建立基础代码质量、单元测试和现场演示流程测试。

### 4.2 本次不包含

- 大规模视觉重做或品牌体系重建。
- 未经确认的新业务模块和新算法。
- 用户登录、角色权限、组织管理等复杂权限系统。
- 手机端和小尺寸竖屏适配。
- SSR、SEO、微前端或多租户架构。
- 断网时完整离线运行的保障方案。
- iServer、三维数据、数据库和后端服务本身的建设与运维。
- 原页面中仅有视觉占位、尚无真实业务逻辑的按钮功能扩建；此类功能需在获得后端契约后另行确认。

## 5. 信息架构与路由

### 5.1 路由设计

| 路径 | 路由名称 | 页面 | 加载策略 |
| --- | --- | --- | --- |
| `/` | Root | 重定向至 `/master` | 同步 |
| `/master` | Master | 主控大屏 | 首屏加载 |
| `/sansheng` | Sansheng | 三生空间综合分析 | 路由懒加载 |
| `/twin` | Twin | 数字孪生场景 | 路由懒加载，三维 SDK 按需加载 |
| `/governance` | Governance | 乡村治理 | 路由懒加载 |
| `/:pathMatch(.*)*` | NotFound | 轻量错误页并提供返回首页入口 | 路由懒加载 |

### 5.2 统一入口与导航

- 主控大屏为默认首页。
- 应用提供统一模块导航，至少包含四个模块名称、当前模块高亮和返回主控入口。
- 导航应保持轻量，可采用顶部按钮、边缘悬浮入口或可收起侧栏，不长期遮挡地图和图表。
- 页面标题、当前时间、服务状态等公共能力尽量复用，但不强制四个模块采用完全相同的页头布局。
- 支持浏览器前进、后退和直接访问具体路由。
- 页面切换后，Leaflet 和三维场景必须正确重新计算容器尺寸。

## 6. 功能需求

### 6.1 公共功能

| 编号 | 需求 |
| --- | --- |
| FR-COM-001 | 用户可从任一模块进入其他模块，并能一键返回主控大屏。 |
| FR-COM-002 | 应用启动时加载运行时配置，配置成功后再初始化需要服务地址的页面。 |
| FR-COM-003 | 地图或接口加载期间显示明确的加载状态，不允许长时间无反馈空白。 |
| FR-COM-004 | 服务失败时显示可读的错误位置、错误类型和重试入口；本次不要求提供离线业务替代。 |
| FR-COM-005 | 公共时钟、按钮、面板、图例、提示消息和空数据状态使用统一组件或样式。 |
| FR-COM-006 | 所有事件监听器、计时器、观察器、地图实例和三维 Viewer 在页面卸载时释放。 |
| FR-COM-007 | 页面核心交互不得依赖浏览器全局 ID 查询；通过 Vue 响应式状态、模板引用和组件事件实现。 |

### 6.2 主控大屏

| 编号 | 需求 |
| --- | --- |
| FR-MAS-001 | 展示人口密度、GDP、三生综合评价、土地利用、治理问题和服务状态等综合指标。 |
| FR-MAS-002 | 支持人口、GDP、土地利用和治理问题专题图层切换，并同步更新图层说明和图例。 |
| FR-MAS-003 | 展示村庄点位及与当前专题对应的视觉编码。 |
| FR-MAS-004 | 展示 DEM 高程、坡度、低洼风险和建设适宜区等信息。 |
| FR-MAS-005 | 展示治理问题摘要和决策方案摘要。 |
| FR-MAS-006 | “导出图件、生成报告、方案推演”等当前占位操作保留入口；只有后端提供明确契约后才纳入真实业务验收。 |

### 6.3 三生空间综合分析

| 编号 | 需求 |
| --- | --- |
| FR-SAN-001 | 支持生态、生活、生产三类指标切换和指标明细展示。 |
| FR-SAN-002 | 支持三类权重调整、自动归一化、重新计算和恢复默认值。 |
| FR-SAN-003 | 保留指标方向处理、单维度得分和综合得分计算逻辑；计算函数必须独立并可单元测试。 |
| FR-SAN-004 | 展示县域综合指数、乡镇排名、选中乡镇得分和雷达图。 |
| FR-SAN-005 | 支持综合、生态、生活、生产、优势和短板等专题图层切换。 |
| FR-SAN-006 | 点击排名项或地图乡镇点位时，排名、得分、诊断和指标表联动更新。 |
| FR-SAN-007 | 支持生成分析报告和导出报告；后端接口未接入前，可保留当前前端生成方式用于开发验证。 |

### 6.4 数字孪生场景

| 编号 | 需求 |
| --- | --- |
| FR-TWI-001 | 初始化 SuperMap iClient3D for WebGL/Cesium Viewer，并加载约定的 S3M 三维场景。 |
| FR-TWI-002 | 支持三维白膜、倾斜摄影实景、激光雷达点云模式切换。 |
| FR-TWI-003 | 支持建筑、道路、水系、树木、工坊和治理问题等图层显隐控制。 |
| FR-TWI-004 | 支持村委会、泡桐林、工坊集群等预设视点的平滑漫游。 |
| FR-TWI-005 | 展示三维资产概览和“三生”空间评价雷达图。 |
| FR-TWI-006 | 显示三维引擎初始化、场景加载和运行状态；错误不得阻断导航与非三维 UI。 |
| FR-TWI-007 | 离开页面时释放 Viewer、场景事件和 WebGL 资源，避免重复进入页面后显存持续增长。 |

### 6.5 乡村治理

| 编号 | 需求 |
| --- | --- |
| FR-GOV-001 | 展示问题总数、待审核、处理中、已办结、闭环率和高紧急问题数量。 |
| FR-GOV-002 | 支持关键词、问题类型、乡镇、村庄、时间范围和紧急程度组合筛选及重置。 |
| FR-GOV-003 | 支持问题点、热点分析、聚类分析和处置状态图层切换。 |
| FR-GOV-004 | 地图点位、最新上报列表和当前问题详情保持选中状态联动。 |
| FR-GOV-005 | 支持查看问题照片、联系方式和更新处置状态。 |
| FR-GOV-006 | 状态更新成功后刷新统计、列表、详情、地图和图表；失败时恢复原状态并提示原因。 |
| FR-GOV-007 | 展示村庄问题分布、热点图和处置状态统计。 |
| FR-GOV-008 | 支持按当前筛选条件导出问题清单；导出格式由后端能力确定。 |

## 7. 技术选型

| 类别 | 选型 | 说明 |
| --- | --- | --- |
| 核心框架 | Vue 3 | 使用组合式 API 和单文件组件。 |
| 开发语言 | TypeScript | 明确接口、领域数据、地图图层和组件属性类型，降低联调错误。 |
| 构建工具 | Vite | 用于开发服务器、环境模式、构建和代码分割。 |
| 路由 | Vue Router | 单页路由；除主控首屏外均使用动态导入。 |
| 状态管理 | Pinia | 仅管理跨组件或跨页面共享状态，不存放 Leaflet/Viewer 等不可序列化实例。 |
| 二维 GIS | Leaflet + SuperMap iClient for Leaflet 浏览器 SDK | Leaflet 由 npm 锁定；iClient SDK 按运行时配置加载与 iServer 兼容的固定版本，避免引入未使用的大型传递依赖。 |
| 三维 GIS | 与现场服务匹配的 SuperMap iClient3D for WebGL | SDK 版本必须与 S3M 服务验证兼容；不得自行替换为不匹配的原生 Cesium 版本。 |
| HTTP | 基于原生 `fetch` 的 TypeScript 请求封装 | 统一超时、取消、错误映射和响应解析，避免为少量接口额外引入依赖。 |
| 图表 | 保留现有 Canvas/CSS 实现 | 优先保持视觉一致；本阶段不因框架迁移强制引入新图表库。 |
| 测试 | Vitest + Vue Test Utils + Playwright | 分别覆盖算法、组件交互和现场演示主流程。 |
| 代码质量 | ESLint + Prettier | 统一 TypeScript、Vue 和样式代码格式。 |
| 包管理 | npm | 生成并提交 lockfile，保证比赛设备安装结果一致。 |

工程应使用 Vue 官方 `create-vue` 脚手架生成，启用 TypeScript、Vue Router、Pinia、Vitest、Playwright、ESLint 和 Prettier。Node.js 版本应满足创建项目时 Vue 官方工具链的要求，并在 `.nvmrc` 或 `package.json#engines` 中锁定团队实际使用版本。

## 8. 目标工程结构

```text
GreenTwin/
├─ public/
│  ├─ config/
│  │  └─ runtime-config.example.json
│  └─ vendor/                    # 必要时放置经授权、锁版本的三维 SDK 静态资源
├─ src/
│  ├─ app/
│  │  ├─ App.vue
│  │  └─ AppShell.vue
│  ├─ router/
│  │  └─ index.ts
│  ├─ config/
│  │  ├─ runtime.ts
│  │  └─ schema.ts
│  ├─ services/
│  │  ├─ http.ts
│  │  ├─ master.service.ts
│  │  ├─ sansheng.service.ts
│  │  ├─ twin.service.ts
│  │  └─ governance.service.ts
│  ├─ gis/
│  │  ├─ leaflet/
│  │  │  ├─ useLeafletMap.ts
│  │  │  └─ supermapLayers.ts
│  │  └─ supermap3d/
│  │     ├─ loadSdk.ts
│  │     ├─ useSuperMapViewer.ts
│  │     └─ sceneLayers.ts
│  ├─ shared/
│  │  ├─ components/
│  │  ├─ composables/
│  │  ├─ constants/
│  │  ├─ types/
│  │  └─ utils/
│  ├─ features/
│  │  ├─ master/
│  │  ├─ sansheng/
│  │  ├─ twin/
│  │  └─ governance/
│  ├─ stores/
│  │  └─ app.ts
│  ├─ styles/
│  │  ├─ tokens.css
│  │  ├─ reset.css
│  │  ├─ layout.css
│  │  └─ utilities.css
│  ├─ mocks/                     # 仅 development/test 模式启用
│  ├─ main.ts
│  └─ env.d.ts
├─ tests/
│  ├─ unit/
│  └─ e2e/
├─ index.html
├─ package.json
├─ package-lock.json
├─ tsconfig.json
├─ vite.config.ts
└─ SPEC.md
```

每个 `features/<module>/` 目录原则上包含：

```text
components/   # 该模块专用组件
composables/  # 该模块交互和生命周期逻辑
stores/       # 仅在多个组件共享复杂状态时创建
types.ts      # 领域模型
constants.ts  # 图例、默认值、固定枚举
<Module>View.vue
```

## 9. 组件与状态设计

### 9.1 公共组件建议

- `ModuleNavigator`：模块导航和当前路由高亮。
- `ScreenHeader`：标题、副标题、状态和时间插槽。
- `PanelCard` / `PanelHeader`：统一面板结构。
- `MetricCard`：指标卡片。
- `LayerSwitcher`：二维/三维图层切换公共交互外观。
- `MapLegend`：地图图例。
- `LoadingOverlay`：模块或服务加载状态。
- `ErrorState`：错误说明、请求标识和重试操作。
- `EmptyState`：筛选无结果或接口空数据提示。
- `AppToast`：统一操作反馈。

### 9.2 状态归属原则

- 单组件内使用 `ref`、`reactive` 和 `computed`。
- 同一模块内多个组件共享的状态可放入该模块 Pinia store。
- 应用级配置、当前服务状态等放入 `useAppStore`。
- URL 可表达的页面位置放入 Vue Router，不重复存入 Pinia。
- Leaflet Map、Layer、Marker 和三维 Viewer 使用 `shallowRef` 保存在 composable 内，不存入 Pinia。
- 后端返回数据不得由展示组件直接修改；状态更新通过 service/store action 完成。

### 9.3 DOM 迁移原则

- 原 `getElementById`、`querySelectorAll` 和手工创建节点改为 Vue 模板、`v-for`、`v-if`、事件绑定和模板引用。
- 手工图表 Canvas 可继续使用，但绘制由 composable 管理，并通过 `ResizeObserver` 响应尺寸变化。
- `setInterval`、`window` 事件、观察器和地图事件必须在 `onBeforeUnmount` 中清理。
- 地图初始化在 `onMounted` + `nextTick` 后执行，容器可见或路由激活后调用尺寸刷新。

## 10. 运行时配置

### 10.1 配置策略

现场 iServer 或后端地址可能与开发环境不同，因此不能只依赖 Vite 构建时环境变量。应用应优先在启动时读取可在构建后修改的 `/config/runtime-config.json`，验证成功后再挂载 Vue 应用；`.env.*` 仅用于开发默认值和构建参数。

运行时配置示例：

```json
{
  "appTitle": "兰考县和美乡村数字孪生决策平台",
  "apiBaseUrl": "http://127.0.0.1:8080/api",
  "requestTimeoutMs": 10000,
  "map": {
    "center": [34.82, 114.82],
    "zoom": 10,
    "crs": "EPSG4326"
  },
  "supermap": {
    "leafletSdkUrl": "https://iclient.supermap.io/dist/leaflet/iclient-leaflet.min.js",
    "mapServices": {
      "base": "http://127.0.0.1:8090/iserver/services/map-lankao/rest/maps/base",
      "population": "http://127.0.0.1:8090/iserver/services/map-lankao/rest/maps/population_density",
      "gdp": "http://127.0.0.1:8090/iserver/services/map-lankao/rest/maps/gdp_grid",
      "landuse": "http://127.0.0.1:8090/iserver/services/map-lankao/rest/maps/land_use"
    },
    "realspace": {
      "whiteModel": "http://127.0.0.1:8090/iserver/services/3D-lankao/rest/realspace/datas/white-model/config",
      "oblique": "http://127.0.0.1:8090/iserver/services/3D-lankao/rest/realspace/datas/oblique/config",
      "lidar": "http://127.0.0.1:8090/iserver/services/3D-lankao/rest/realspace/datas/lidar/config"
    }
  }
}
```

以上地址仅表示配置结构，不代表真实服务名称。实施时必须以现场服务清单为准。

### 10.2 配置要求

- 使用运行时 schema 校验必填项、URL、坐标、缩放级别和超时时间。
- 配置加载失败时进入启动错误页，明确显示缺失字段，不以空白页结束。
- `VITE_*` 变量会进入浏览器构建产物，禁止放置数据库密码、私钥或长期有效的服务密钥。
- 服务需要认证时，由后端代理或现场认可的短期令牌机制处理。
- 前端页面、API、iServer 和 SDK 资源应使用一致协议，避免 HTTPS 页面请求 HTTP 资源导致 Mixed Content 阻断。
- iServer 和业务后端必须提前配置比赛访问源的 CORS。

## 11. 后端与数据契约

### 11.1 通用约定

- JSON 字段使用稳定命名，前后端以 TypeScript 类型或 OpenAPI 文档对齐。
- 所有列表提供唯一 ID；经纬度明确坐标系和顺序，禁止仅写“坐标”而不说明含义。
- 日期时间使用 ISO 8601，并明确时区；界面按 Asia/Shanghai 展示。
- 数值明确单位、精度、空值含义和统计周期。
- 请求失败至少返回业务错误码、用户可读信息和可追踪的请求 ID。
- 页面不得直接依赖后端原始字段；由 service 层映射为前端领域模型。

建议响应外形：

```ts
interface ApiResponse<T> {
  code: string
  message: string
  data: T
  requestId?: string
}
```

### 11.2 前端需要的服务能力

具体 URL 以后端现有接口为准，前端至少需要以下领域方法：

| 模块 | 前端服务方法 | 目的 |
| --- | --- | --- |
| 主控 | `getDashboardOverview()` | 获取综合指标、图表数据、治理摘要和方案摘要 |
| 三生 | `getIndicatorSystem()` | 获取指标、方向、单位和默认权重 |
| 三生 | `getTownEvaluationData()` | 获取乡镇基础指标和空间定位信息 |
| 三生 | `calculateEvaluation(payload)` | 后端承担正式评价时提交权重并返回结果 |
| 三生 | `generateEvaluationReport(payload)` | 生成正式分析报告 |
| 数字孪生 | `getTwinAssets()` | 获取三维资产统计、图层元数据和视点配置 |
| 治理 | `getGovernanceSummary(filters)` | 获取处置总览统计 |
| 治理 | `getGovernanceIssues(filters)` | 获取问题列表、详情和空间信息 |
| 治理 | `updateIssueStatus(id, status)` | 更新处置状态 |
| 治理 | `exportGovernanceIssues(filters)` | 导出当前筛选结果 |

### 11.3 开发模拟数据

- mock 仅在 `development` 和 `test` 模式启用，正式比赛构建默认关闭。
- mock 数据必须实现与真实接口相同的 TypeScript 类型，不允许页面内再维护另一套结构。
- mock 开关不是离线保障功能，不应在正式页面向用户暴露。

## 12. GIS 技术实现

### 12.1 二维地图

- Leaflet 使用 npm 模块并提交 lockfile；SuperMap iClient for Leaflet 通过运行时配置加载与现场 iServer 兼容的固定 SDK。
- 正式部署时应将经过验证的 iClient SDK 放入受控静态资源位置或稳定内网地址，避免依赖未锁版本的公共 CDN。
- 地图创建、底图加载、专题图层、标记图层、图例和销毁分别封装。
- 业务组件只传入图层配置和领域数据，不直接操作全局 `window.L`。
- 地图容器尺寸变化时使用 `ResizeObserver` 节流调用 `invalidateSize()`。
- 切换专题图层时复用地图实例，只替换相应图层，不重复创建 Map。
- 所有图层、标记、弹窗和事件在组件卸载时移除，最后调用 `map.remove()`。
- 坐标系、投影、底图范围和行政边界必须与 iServer 服务清单一致。

### 12.2 三维场景

- 使用现场验证通过的 SuperMap iClient3D for WebGL SDK，不单独升级其内置 Cesium。
- SDK 可通过项目内受控静态资源或指定的稳定部署地址加载，版本和文件校验值应记录在部署说明中。
- `loadSdk.ts` 保证 SDK 只加载一次，并将“加载脚本”“创建 Viewer”“打开 S3M 场景”分为不同状态。
- `useSuperMapViewer.ts` 负责 Viewer 创建、场景打开、图层索引、相机飞行、尺寸变化和资源释放。
- S3M 图层不得仅依赖显示名称查找；应在配置中记录稳定图层键及其业务类型。
- 模式切换通过图层显隐或场景配置完成，不重复打开同一份大体量数据。
- Viewer 初始化失败时保留页面框架、状态说明和导航，避免整个 SPA 崩溃。
- 路由离开时停止相机动画，解绑事件，销毁 Viewer，并验证重复进入不会创建多个 WebGL context。

## 13. 视觉与响应式规范

### 13.1 设计基线

- 基准画布：1920×1080，横屏。
- 兼容验证：1366×768、1440×900、1920×1080。
- 浏览器目标：比赛设备上的当前稳定版 Chrome 或 Microsoft Edge。
- 保留深色科技大屏、青绿强调色、半透明面板、地图中心布局和高信息密度风格。

### 13.2 样式实现

- 从现有 CSS 中提取颜色、边框、阴影、字号、间距和层级为 `tokens.css` 变量。
- 公共样式保持全局，模块专用样式放入对应 Vue SFC 或模块样式文件。
- 优先使用 CSS Grid、Flex、`clamp()` 和 `minmax()`；避免继续增加写死的绝对定位。
- 1366×768 下允许适度压缩间距和字号，但不能出现核心面板遮挡、地图不可操作或页面水平滚动。
- 图表与地图使用实际容器尺寸绘制，并考虑 `devicePixelRatio`，避免大屏模糊。
- 动效应短促、可预期，不使用影响地图帧率的大面积持续动画。

### 13.3 可用性

- 所有按钮必须具备默认、悬停、激活、禁用和加载状态。
- 地图与图表颜色需配合文字/图例表达，不能只依赖颜色区分类别。
- 关键操作反馈使用统一 Toast 或状态栏。
- 空数据、加载失败、配置错误和无 WebGL 支持均应提供明确提示。

## 14. 性能与稳定性要求

以下指标以最终比赛电脑、现场局域网和约定数据规模为测量环境：

- 应用壳层和主控基础 UI 在 3 秒内可操作，不等待三维 SDK。
- 已加载模块间切换在 1 秒内完成基本 UI 呈现。
- 三维场景在 10 秒内出现首个有意义画面；超时后显示加载状态与诊断信息。
- 四个页面均使用路由级代码分割，三维 SDK 不进入主控首屏同步加载链路。
- 同一路由连续进入和退出 5 次后，不出现重复地图、重复计时器、重复事件响应或明显持续内存增长。
- 连续完成一次完整答辩流程时，不出现未处理 Promise 错误和导致交互中断的控制台异常。
- API 请求支持超时与取消；快速切换筛选或路由时，过期响应不得覆盖最新状态。

## 15. 测试策略

### 15.1 单元测试

重点覆盖：

- 权重归一化、正向/负向/半负向指标处理。
- 单维度和综合得分计算。
- 优势、短板判定。
- 治理组合筛选、闭环率和统计聚合。
- API 数据到前端领域模型的映射。
- 运行时配置校验。

### 15.2 组件测试

- 导航与当前路由高亮。
- 权重输入联动和重置。
- 乡镇列表、地图选择和详情联动。
- 治理筛选、选中项和状态更新的成功/失败路径。
- Loading、Empty、Error 和 Toast 状态。

### 15.3 E2E 与人工测试

Playwright 冒烟流程至少包含：

1. 打开 `/master` 并切换四类专题图层。
2. 进入 `/sansheng`，调整权重、重算、选择乡镇并生成报告。
3. 进入 `/twin`，确认场景加载、切换模式和图层、执行预设漫游。
4. 进入 `/governance`，组合筛选、选择问题、更新状态并导出。
5. 通过浏览器前进/后退重复访问各模块，确认实例正常创建和销毁。

最终必须在真实比赛电脑、真实 iServer、真实 S3M 服务和真实后端上进行人工验收；仅通过 mock 测试不构成完成。

## 16. 验收标准

### 16.1 工程验收

- `npm install`、`npm run dev`、`npm run build`、`npm run test:unit` 和 `npm run test:e2e` 可按项目说明运行。
- 构建无 TypeScript 错误，核心代码无 ESLint 错误。
- 服务地址不散落在 Vue 组件中，均从运行时配置或 service 层取得。
- 除受控 SDK 加载适配器外，业务代码不依赖 `window.L`、`window.Cesium` 等全局对象。
- 路由均可直接刷新访问，部署服务器已配置 SPA history fallback。

### 16.2 功能验收

- 四个模块均能从统一导航进入，返回主控大屏路径明确。
- 第 6 章列出的既有核心交互全部可用。
- 真实二维地图服务、S3M 三维服务和业务接口均接入并完成联调。
- 加载、空数据、错误、操作成功和操作失败均有明确状态。
- 状态更新、筛选和地图/图表联动结果一致。

### 16.3 视觉验收

- 与当前静态页面进行同分辨率截图对比，核心布局、信息层级、色彩和主要视觉效果保持一致。
- 1920×1080 下无滚动条、遮挡、溢出和明显留白异常。
- 1366×768 和 1440×900 下核心内容完整可用。
- 地图、Canvas 图表和文字在设备像素比大于 1 的显示器上保持清晰。

### 16.4 现场验收

- 使用比赛部署地址冷启动系统并完整演练至少 3 次。
- 演练覆盖四个模块、主要操作、页面返回和浏览器刷新。
- 记录最终浏览器版本、SDK 版本、服务地址、构建版本和演示数据版本。
- 比赛前冻结依赖与构建产物，不在现场临时执行未经验证的依赖升级。

## 17. 迁移实施顺序

### 阶段 0：联调前置确认

- 获取 iServer 服务清单、地图名、坐标系、访问协议和 CORS 状态。
- 获取 S3M 场景地址、图层稳定键、SDK 版本和相机初始视点。
- 获取业务 API/OpenAPI 文档、示例响应和错误码。
- 明确主控占位按钮是否有真实后端能力。

### 阶段 1：建立 Vue 工程

- 使用 `create-vue` 建立 Vue 3 + TypeScript 工程。
- 配置 Router、Pinia、测试、代码质量工具和路径别名。
- 建立运行时配置加载、应用启动错误页和统一 AppShell。
- 原静态页面暂时保留，作为迁移对照基线，不立即删除。

### 阶段 2：公共视觉与基础组件

- 提取现有主题变量和公共布局。
- 实现导航、页头、面板、指标卡、图例、Toast、Loading 和 Error 组件。
- 完成三档横屏尺寸验证。

### 阶段 3：迁移主控与三生模块

- 先迁移主控，验证路由、二维地图和基础图表模式。
- 再迁移三生模块，拆出可测试的评价算法和联动状态。

### 阶段 4：迁移乡村治理模块

- 迁移筛选、统计、列表、详情、地图和状态更新。
- 接入真实治理接口并验证失败回滚。

### 阶段 5：迁移数字孪生模块

- 完成三维 SDK 加载适配和 Viewer 生命周期封装。
- 接入 S3M 图层、模式切换、图层控制和视点漫游。
- 重点验证 WebGL、显存和重复进入页面的稳定性。

### 阶段 6：真实环境联调与收尾

- 切换真实运行时配置，完成全流程 E2E 和人工演练。
- 对比静态页面视觉，修复布局偏差。
- 在完成同等功能验收并保留 Git 历史后，再决定是否将旧 HTML 移入 `legacy/` 或删除。

## 18. 关键风险与控制

| 风险 | 影响 | 控制措施 |
| --- | --- | --- |
| iServer、iClient、S3M SDK 版本不匹配 | 图层或场景无法加载 | 阶段 0 获取版本矩阵，在最小验证页完成兼容性测试后锁版本 |
| HTTP/HTTPS 混用或 CORS 未配置 | 浏览器直接阻断请求 | 部署前统一协议并使用比赛访问源做真实测试 |
| 三维 SDK 进入首屏包 | 主控加载慢、构建包过大 | `/twin` 路由和 SDK 双重懒加载 |
| 路由切换未销毁地图实例 | 内存、显存增长，重复事件 | composable 统一管理资源并执行重复进出测试 |
| 现场地址变化 | 构建产物失效 | 使用构建后可编辑的 `runtime-config.json` |
| 后端字段临时变化 | 页面渲染错误 | service 映射层、类型校验、示例响应和接口冻结 |
| 迁移同时大改 UI | 返工且难以判断功能是否等价 | 先做忠实迁移，仅处理已确认的统一样式和适配 |
| 模拟数据与真实数据口径不同 | 演示数字不一致 | mock 与真实接口共用类型，正式构建关闭 mock |

## 19. 开发启动前必须取得的输入

1. 现场 iServer 版本及完整二维地图服务清单。
2. SuperMap iClient for Leaflet 的兼容版本。
3. SuperMap iClient3D for WebGL SDK 包或稳定部署地址及版本。
4. S3M 场景地址、图层键、坐标系和推荐初始视点。
5. 业务后端基础 URL、接口文档、示例数据、认证方式和错误码。
6. 比赛电脑的操作系统、浏览器版本、显卡/WebGL 能力和网络环境。
7. 主控“导出图件、生成报告、方案推演”等入口的真实业务范围。

如果这些输入未全部取得，仍可使用 mock 完成 Vue 结构迁移，但不能判定真实服务联调和现场验收已经完成。

## 20. 技术参考

- [Vue Quick Start](https://vuejs.org/guide/quick-start.html)：官方 `create-vue`、Vite、单文件组件和组合式 API 指南。
- [Vue Router Lazy Loading Routes](https://router.vuejs.org/guide/advanced/lazy-loading.html)：路由动态导入和代码分割。
- [Pinia Introduction](https://pinia.vuejs.org/introduction.html)：Vue 官方推荐状态管理方案及 TypeScript 支持。
- [Vite Env Variables and Modes](https://vite.dev/guide/env-and-mode.html)：构建时环境变量、模式及客户端变量安全边界。
- [SuperMap iClient JavaScript](https://iclient.supermap.io/web/)：iClient 产品、Vue 支持及 npm 包命名说明。
- [SuperMap iClient for Leaflet Development Guide](https://iclient.supermap.io/9.0.1/en/web/introduction/leafletDevelop.html)：Leaflet 模块化引用和 iServer 图层加载示例。
