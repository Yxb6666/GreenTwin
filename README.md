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

当前二维业务地图使用 `supermap.mapServices.base` 作为影像底图，并将 `supermap.mapServices.township` 作为透明行政区划边界叠加层。
行政区划服务地址可指向发布地图的 iServer REST 服务根目录，例如
`http://118.89.55.214:8090/iserver/services/Lankao_map_units/rest`；应用会自动解析同名地图资源及要素查询地址。应用保持 EPSG:3857，
加载原始坐标系为 EPSG:4326 的乡镇服务时，客户端按影像瓦片的经纬度范围请求透明 `image.png`，再由 Leaflet 对齐到
EPSG:3857 底图；这是因为该 iServer 服务未启用动态投影。三维场景仍使用 `mapServices.base` 作为影像底图。
行政区划叠加层绘制服务返回的全部 20 个图面单元，不按行政编码过滤仪封园艺场、造纸林场、柳林林场和兰考林场。
乡镇服务加载后，地图会读取服务范围并自适应缩放、居中显示；`map.center` 和 `map.zoom` 仅作为范围读取失败时的回退值。

原静态页面及其样式、脚本已保存在 `legacy/`，用于迁移效果对照。

详细需求与实现约束见 [SPEC.md](./SPEC.md)。
