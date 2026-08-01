# GreenTwin

兰考县和美乡村数字孪生决策平台 Vue 前端。项目包含主控大屏、三生空间分析、数字孪生场景和乡村治理四个模块。

## 本地开发

```bash
npm install
npm run dev
```

默认访问 `http://localhost:5173/master`。

## 验证与构建

```bash
npm run type-check
npm run lint:check
npm run test:unit
npm run build
```

生产构建输出到 `dist/`。部署服务器需要把未知路径回退到 `index.html`，以支持 Vue Router 直接刷新。

## 现场服务配置

编辑 `public/config/runtime-config.json` 可配置：

- 二维地图中心点、缩放级别和坐标系；
- SuperMap iClient for Leaflet SDK 地址；
- SuperMap iServer 地图服务地址；
- SuperMap WebGL SDK 地址；
- 白膜、倾斜摄影和点云 S3M 服务地址；
- 业务后端基础地址和请求超时。

该文件会原样复制到构建产物，可以在构建后按现场环境修改。前端公开配置中不要存放密码、私钥或长期令牌。

原静态页面及其样式、脚本已保存在 `legacy/`，用于迁移效果对照。

详细需求与实现约束见 [SPEC.md](./SPEC.md)。
