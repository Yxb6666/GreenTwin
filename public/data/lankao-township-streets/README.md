# 兰考县乡镇街道校正数据

本目录是一份不覆盖原 iServer 服务的独立派生数据。边界以现有 `Lankao_Township` 要素为基础，依据 `source/reference-map.png` 的乡镇图进行名称更新、要素合并和城区街道重分割。

## 文件说明

- `lankao-township-streets.geojson`：16 个现行乡镇街道，适合业务统计和按行政区展示。
- `lankao-map-units.geojson`：上述 16 个乡镇街道，加上仪封园艺场、造纸林场、柳林林场和兰考林场，共 20 个图面单元；适合复现参考地图的连续分区。
- `lankao-township-streets.csv`：16 个乡镇街道的编码、名称、面积、旧编码和几何处理方式对照表。
- `shapefile/lankao_township_streets.*`：16 个乡镇街道的 Shapefile。
- `shapefile/lankao_map_units.*`：20 个图面单元的 Shapefile。
- `preview.png`、`preview-map-units.png`：两套数据的快速检查图。
- `manifest.json`：坐标系、范围、要素数量、拓扑检查结果和 GeoJSON 的 SHA-256。
- `source/reference-map.png`：本次校正使用的用户提供参考图。

GeoJSON 和 Shapefile 均采用 `EPSG:4326`，坐标顺序为经度、纬度。

## 主要校正

1. 原城关镇、城关乡及三义寨乡局部，按参考图重新分割为兰阳街道、桐乡街道、惠安街道和三义寨乡。
2. 原谷营乡与爪营乡合并为谷营镇。
3. 更新东坝头镇、考城镇、小宋镇、仪封镇、许河镇等名称和乡级代码。
4. 将“固阳镇”规范为“堌阳镇”，并保留本地资料采用的“闫楼乡”写法。
5. 原编码 `410225408` 名称为空；结合参考图“林场”标注及兰考县公开资料，在 20 单元版本中补记为“兰考林场”。

## 质量检查

- 16 单元和 20 单元版本的所有几何均为有效 Polygon/MultiPolygon。
- 已进行两两重叠检查；记录在 `manifest.json` 中的残余值低于 `1e-10` 平方度，属于坐标量化产生的亚平方米级误差。
- 城区新边界由 3375 × 2338 参考图颜色分区配准得到，内部新分界的图面精度约为 20 米；其余外边界沿用原始矢量。

## 数据来源与适用范围

- 原始几何：[SuperMap iServer Lankao_Township 服务](http://118.89.55.214:8090/iserver/services/Lankao_Township/rest/maps/Lankao_Township)
- 现行区划名称核对：[河南政务服务网兰考县事项页](https://www.hnzwfw.gov.cn/portal/guide/5D49160A06CE8CAA747DE9FF16BB7E80?region=410225000000)
- 编码类型规则：[国家统计局《统计用区划代码和城乡划分代码编制规则》](https://www.stats.gov.cn/sj/tjbz/gjtjbz/202302/t20230213_1902741.html)

该数据适用于本项目的地图展示、空间统计和方案演示，不应替代自然资源、民政部门发布的法定行政界线成果，也不适用于确权、勘界或工程放样。

## 重新生成

在具备 Python、GeoPandas、Shapely、Rasterio、OpenCV、Pillow 和 Matplotlib 的环境中运行：

```powershell
python scripts/generate_lankao_township_data.py `
  --reference-map public/data/lankao-township-streets/source/reference-map.png `
  --output public/data/lankao-township-streets
```
