import type { GovernanceIssue } from "@/features/governance/data";
import { scoreTown, towns, type Town } from "@/features/sansheng/model";
import type { TownshipFeature } from "@/gis/leaflet/townshipFeatures";
import { gdpTrend, latestPopulationDensity } from "./data";
import { GREENTWIN_MAP_COLORS, POI_CATEGORY_COLORS } from "./mapThemeColors";

export type MasterMapThemeKey =
  | "population"
  | "gdp"
  | "poi"
  | "landuse"
  | "sansheng"
  | "governance";

export interface MasterMapTheme {
  key: MasterMapThemeKey;
  label: string;
  description: string;
}

export interface ThemeLegendItem {
  label: string;
  color: string;
  value?: number;
  kind?: "area" | "line" | "dot";
}

export interface TownshipMetricBreakdown {
  label: string;
  value: number;
  color: string;
}

export interface TownshipThemeMetric {
  value: number;
  label: string;
  meta: string;
  color: string;
  radius?: number;
  details?: string[];
  breakdown?: TownshipMetricBreakdown[];
  dataAvailable?: boolean;
}

export interface PoiThemeCounts {
  publicService: number;
  industry: number;
  cultureTourism: number;
  total: number;
}

export function toggleMasterMapTheme(
  currentTheme: MasterMapThemeKey | null,
  nextTheme: MasterMapThemeKey,
): MasterMapThemeKey | null {
  return currentTheme === nextTheme ? null : nextTheme;
}

export const landUseSource = [
  {
    name: "耕地与设施农业",
    shortLabel: "耕地",
    value: 42,
    color: GREENTWIN_MAP_COLORS.landUse.farmland,
  },
  {
    name: "林地草地",
    shortLabel: "林草",
    value: 19,
    color: GREENTWIN_MAP_COLORS.landUse.forest,
  },
  {
    name: "村庄建设用地",
    shortLabel: "村建",
    value: 17,
    color: GREENTWIN_MAP_COLORS.landUse.construction,
  },
  {
    name: "水域沟渠",
    shortLabel: "水域",
    value: 10,
    color: GREENTWIN_MAP_COLORS.landUse.water,
  },
  {
    name: "其他用地",
    shortLabel: "其他",
    value: 12,
    color: GREENTWIN_MAP_COLORS.landUse.other,
  },
];

export const masterMapThemes: MasterMapTheme[] = [
  {
    key: "population",
    label: "人口密度",
    description: "按 16 个行政区实际值分位分级",
  },
  { key: "gdp", label: "GDP", description: "按行政区展示经济强度分布" },
  { key: "poi", label: "POI", description: "公共服务、产业和文旅兴趣点聚合" },
  {
    key: "landuse",
    label: "土地利用",
    description: "兰考县真实土地利用栅格分类",
  },
  {
    key: "sansheng",
    label: "三生评价",
    description: "使用三生模型真实的生态、生活、生产协同得分",
  },
  {
    key: "governance",
    label: "治理问题",
    description: "按行政区聚合治理问题数量",
  },
];

export const masterMapThemeLegends: Record<
  MasterMapThemeKey,
  ThemeLegendItem[]
> = {
  population: [
    { label: "低密度", color: GREENTWIN_MAP_COLORS.population[0] },
    { label: "较低", color: GREENTWIN_MAP_COLORS.population[1] },
    { label: "中等", color: GREENTWIN_MAP_COLORS.population[2] },
    { label: "较高", color: GREENTWIN_MAP_COLORS.population[3] },
    { label: "高密度", color: GREENTWIN_MAP_COLORS.population[4] },
  ],
  gdp: [
    { label: "低强度", color: GREENTWIN_MAP_COLORS.gdp[0] },
    { label: "较低", color: GREENTWIN_MAP_COLORS.gdp[1] },
    { label: "中等", color: GREENTWIN_MAP_COLORS.gdp[2] },
    { label: "较高", color: GREENTWIN_MAP_COLORS.gdp[3] },
    { label: "高强度", color: GREENTWIN_MAP_COLORS.gdp[4] },
  ],
  poi: [
    { label: "公共服务", color: POI_CATEGORY_COLORS.publicService, kind: "dot" },
    { label: "产业节点", color: POI_CATEGORY_COLORS.industry, kind: "dot" },
    { label: "文旅资源", color: POI_CATEGORY_COLORS.cultureTourism, kind: "dot" },
  ],
  landuse: landUseSource.map((item) => ({
    label: item.name,
    color: item.color,
  })),
  sansheng: [
    { label: "协同偏弱", color: GREENTWIN_MAP_COLORS.sansheng[0] },
    { label: "稳步提升", color: GREENTWIN_MAP_COLORS.sansheng[1] },
    { label: "良好", color: GREENTWIN_MAP_COLORS.sansheng[2] },
    { label: "优秀", color: GREENTWIN_MAP_COLORS.sansheng[3] },
  ],
  governance: [
    {
      label: "1–4 处",
      color: GREENTWIN_MAP_COLORS.governance.low,
      kind: "dot",
    },
    {
      label: "5–9 处",
      color: GREENTWIN_MAP_COLORS.governance.medium,
      kind: "dot",
    },
    {
      label: "10 处及以上",
      color: GREENTWIN_MAP_COLORS.governance.high,
      kind: "dot",
    },
  ],
};

const populationPalette = masterMapThemeLegends.population.map(
  (item) => item.color,
);
const gdpPalette = masterMapThemeLegends.gdp.map((item) => item.color);
const sanshengPalette = masterMapThemeLegends.sansheng.map(
  (item) => item.color,
);
const defaultWeights = { ecology: 34, life: 33, production: 33 };
const latestGdpYiYuan = gdpTrend.at(-1)?.gdpYiYuan ?? 475.3;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function scaleColor(
  value: number,
  minimum: number,
  maximum: number,
  palette: string[],
) {
  if (palette.length === 0) return "#3dd6c4";
  if (maximum <= minimum) return palette[0]!;
  const ratio = clamp((value - minimum) / (maximum - minimum), 0, 1);
  return palette[
    Math.min(palette.length - 1, Math.floor(ratio * palette.length))
  ]!;
}

function hashFeature(feature: TownshipFeature, index: number) {
  const source = `${feature.code}-${feature.name}-${index}`;
  let hash = 0;
  for (const character of source)
    hash = (hash * 31 + character.charCodeAt(0)) % 9973;
  return hash;
}

function findSanshengTown(feature: TownshipFeature): Town | undefined {
  const featureName = feature.name.trim();
  return towns.find((town) => town.name === featureName);
}

function relatedIssues(feature: TownshipFeature, issues: GovernanceIssue[]) {
  const featureName = feature.name.trim();
  return issues.filter((issue) => issue.town.trim() === featureName);
}

export function resolveTownshipThemeMetric(
  themeKey: MasterMapThemeKey,
  feature: TownshipFeature,
  index: number,
  issues: GovernanceIssue[] = [],
  poiMetricsByTownship: ReadonlyMap<string, PoiThemeCounts> = new Map(),
): TownshipThemeMetric {
  const seed = hashFeature(feature, index);
  const sanshengTown = findSanshengTown(feature);

  if (themeKey === "population") {
    const density = Math.round(
      clamp(
        latestPopulationDensity +
          (seed % 220) -
          95 +
          ((sanshengTown?.life.residentialRatio ?? 62) - 62) * 1.6,
        520,
        920,
      ),
    );
    return {
      value: density,
      label: `${density} 人/km²`,
      meta: "人口密度分位分级",
      color: populationPalette[0]!,
    };
  }

  if (themeKey === "gdp") {
    const productionScore = sanshengTown
      ? scoreTown(sanshengTown, defaultWeights).production
      : 72;
    const gdpYiYuan = Number(
      clamp(
        latestGdpYiYuan / 18 + productionScore * 0.26 + (seed % 110) / 10,
        22,
        62,
      ).toFixed(1),
    );
    return {
      value: gdpYiYuan,
      label: `${gdpYiYuan.toFixed(1)} 亿元`,
      meta: "地区生产总值估算强度",
      color: scaleColor(gdpYiYuan, 22, 62, gdpPalette),
    };
  }

  if (themeKey === "poi") {
    const poiCounts = poiMetricsByTownship.get(feature.code);
    if (!poiCounts) {
      return {
        value: 0,
        label: "暂无数据",
        meta: "真实 POI 数据加载中或未匹配到该行政区",
        color: GREENTWIN_MAP_COLORS.noData,
        details: ["公共服务 0", "产业节点 0", "文旅资源 0"],
        breakdown: masterMapThemeLegends.poi.map((item) => ({
          ...item,
          value: 0,
        })),
        dataAvailable: false,
      };
    }
    const breakdown = [
      { ...masterMapThemeLegends.poi[0]!, value: poiCounts.publicService },
      { ...masterMapThemeLegends.poi[1]!, value: poiCounts.industry },
      { ...masterMapThemeLegends.poi[2]!, value: poiCounts.cultureTourism },
    ];
    const total = poiCounts.total;
    return {
      value: total,
      label: `${total} 个`,
      meta: "真实 POI 聚合点",
      color: GREENTWIN_MAP_COLORS.poi.aggregate,
      radius: clamp(8 + Math.sqrt(total) * 1.1, 11, 21),
      details: breakdown.map((item) => `${item.label} ${item.value}`),
      breakdown,
    };
  }

  if (themeKey === "landuse") {
    return {
      value: 0,
      label: "真实栅格",
      meta: "Lankao-Land 影像服务",
      color: "transparent",
    };
  }

  if (themeKey === "sansheng") {
    if (!sanshengTown) {
      return {
        value: 0,
        label: "暂无数据",
        meta: "未匹配到三生模型的同名行政区",
        color: GREENTWIN_MAP_COLORS.noData,
        dataAvailable: false,
      };
    }
    const scores = scoreTown(sanshengTown, defaultWeights);
    return {
      value: scores.composite,
      label: `${scores.composite.toFixed(1)} 分`,
      meta: "三生协同指数",
      color: sanshengPalette[0]!,
      details: [
        `生态 ${scores.ecology.toFixed(1)}`,
        `生活 ${scores.life.toFixed(1)}`,
        `生产 ${scores.production.toFixed(1)}`,
      ],
      dataAvailable: true,
    };
  }

  const townIssues = relatedIssues(feature, issues);
  const urgent = townIssues.filter((issue) => issue.urgency === "高").length;
  const processing = townIssues.filter(
    (issue) => issue.status === "处理中" || issue.status === "已派单",
  ).length;
  const total = townIssues.length;
  const color =
    total >= 10
      ? GREENTWIN_MAP_COLORS.governance.high
      : total >= 5
        ? GREENTWIN_MAP_COLORS.governance.medium
        : GREENTWIN_MAP_COLORS.governance.low;
  return {
    value: total,
    label: `${total} 处`,
    meta: total > 0 ? "治理问题聚合点" : "暂无上报问题",
    color,
    radius: total > 0 ? clamp(7 + Math.sqrt(total) * 2.2, 9, 18) : undefined,
    details: [`高紧急 ${urgent}`, `处置中 ${processing}`],
  };
}

function applyQuantileColors(
  metrics: TownshipThemeMetric[],
  palette: string[],
) {
  const valid = metrics
    .map((metric, index) => ({ metric, index }))
    .filter(({ metric }) => metric.dataAvailable !== false)
    .sort((first, second) => first.metric.value - second.metric.value);
  valid.forEach(({ metric }, rank) => {
    metric.color =
      palette[
        Math.min(
          palette.length - 1,
          Math.floor((rank * palette.length) / valid.length),
        )
      ]!;
  });
}

export function resolveTownshipThemeMetrics(
  themeKey: MasterMapThemeKey | null,
  features: TownshipFeature[],
  issues: GovernanceIssue[] = [],
  poiMetricsByTownship: ReadonlyMap<string, PoiThemeCounts> = new Map(),
): TownshipThemeMetric[] {
  if (themeKey == null) return [];
  const metrics = features.map((feature, index) =>
    resolveTownshipThemeMetric(
      themeKey,
      feature,
      index,
      issues,
      poiMetricsByTownship,
    ),
  );
  if (themeKey === "population")
    applyQuantileColors(metrics, populationPalette);
  if (themeKey === "sansheng") applyQuantileColors(metrics, sanshengPalette);
  return metrics;
}
