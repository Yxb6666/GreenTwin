(function () {
  "use strict";

  const dimensionMeta = {
    ecology: {
      label: "生态指标",
      color: "#70d27b",
      indicators: [
        { key: "ecoLandRatio", name: "生态用地占比", direction: "正向", unit: "%", weight: 0.2 },
        { key: "waterRatio", name: "水域面积占比", direction: "正向", unit: "%", weight: 0.2 },
        { key: "waterNetwork", name: "水网密度", direction: "正向", unit: "分", weight: 0.2 },
        { key: "slope", name: "坡度", direction: "负向", unit: "分", weight: 0.2 },
        { key: "buildDisturbance", name: "建设用地干扰强度", direction: "负向", unit: "分", weight: 0.2 }
      ]
    },
    life: {
      label: "生活指标",
      color: "#35d0c6",
      indicators: [
        { key: "residentialRatio", name: "居住用地占比", direction: "正向", unit: "%", weight: 0.2 },
        { key: "poiDensity", name: "公共服务 POI 密度", direction: "正向", unit: "个/km²", weight: 0.2 },
        { key: "educationAccess", name: "教育设施可达性", direction: "正向", unit: "分", weight: 0.2 },
        { key: "medicalAccess", name: "医疗设施可达性", direction: "正向", unit: "分", weight: 0.2 },
        { key: "roadAccess", name: "道路通达性", direction: "正向", unit: "分", weight: 0.2 }
      ]
    },
    production: {
      label: "生产空间",
      color: "#f4b44b",
      indicators: [
        { key: "farmlandRatio", name: "耕地面积占比", direction: "正向", unit: "%", weight: 0.2 },
        { key: "constructionRatio", name: "建设用地占比", direction: "半负向", unit: "%", weight: 0.2 },
        { key: "industryPoi", name: "产业 POI 密度", direction: "正向", unit: "个/km²", weight: 0.2 },
        { key: "roadDensity", name: "道路密度", direction: "正向", unit: "km/km²", weight: 0.2 },
        { key: "mainRoadDistance", name: "到主要道路距离", direction: "负向", unit: "分", weight: 0.2 }
      ]
    }
  };

  // 数据替换位置：后续接入 SuperMap iServer、统计服务或县域数据库时，可替换 towns 数组并保留字段结构。
  const towns = [
    {
      name: "城关镇",
      lat: 34.82,
      lng: 114.82,
      ecology: { ecoLandRatio: 66, waterRatio: 58, waterNetwork: 63, slope: 32, buildDisturbance: 48 },
      life: { residentialRatio: 82, poiDensity: 88, educationAccess: 91, medicalAccess: 89, roadAccess: 92 },
      production: { farmlandRatio: 62, constructionRatio: 56, industryPoi: 84, roadDensity: 86, mainRoadDistance: 24 }
    },
    {
      name: "仪封镇",
      lat: 34.88,
      lng: 114.79,
      ecology: { ecoLandRatio: 72, waterRatio: 61, waterNetwork: 68, slope: 18, buildDisturbance: 42 },
      life: { residentialRatio: 69, poiDensity: 64, educationAccess: 72, medicalAccess: 66, roadAccess: 78 },
      production: { farmlandRatio: 84, constructionRatio: 39, industryPoi: 76, roadDensity: 74, mainRoadDistance: 31 }
    },
    {
      name: "谷营镇",
      lat: 34.76,
      lng: 114.91,
      ecology: { ecoLandRatio: 70, waterRatio: 54, waterNetwork: 66, slope: 22, buildDisturbance: 38 },
      life: { residentialRatio: 64, poiDensity: 61, educationAccess: 68, medicalAccess: 62, roadAccess: 73 },
      production: { farmlandRatio: 86, constructionRatio: 34, industryPoi: 72, roadDensity: 70, mainRoadDistance: 36 }
    },
    {
      name: "红庙镇",
      lat: 34.74,
      lng: 114.71,
      ecology: { ecoLandRatio: 75, waterRatio: 69, waterNetwork: 73, slope: 20, buildDisturbance: 36 },
      life: { residentialRatio: 61, poiDensity: 56, educationAccess: 64, medicalAccess: 58, roadAccess: 67 },
      production: { farmlandRatio: 82, constructionRatio: 31, industryPoi: 68, roadDensity: 66, mainRoadDistance: 42 }
    },
    {
      name: "堌阳镇",
      lat: 34.93,
      lng: 114.68,
      ecology: { ecoLandRatio: 78, waterRatio: 64, waterNetwork: 71, slope: 16, buildDisturbance: 34 },
      life: { residentialRatio: 66, poiDensity: 59, educationAccess: 70, medicalAccess: 63, roadAccess: 75 },
      production: { farmlandRatio: 88, constructionRatio: 30, industryPoi: 81, roadDensity: 77, mainRoadDistance: 29 }
    },
    {
      name: "东坝头镇",
      lat: 34.89,
      lng: 114.98,
      ecology: { ecoLandRatio: 80, waterRatio: 76, waterNetwork: 79, slope: 24, buildDisturbance: 44 },
      life: { residentialRatio: 58, poiDensity: 52, educationAccess: 61, medicalAccess: 57, roadAccess: 64 },
      production: { farmlandRatio: 79, constructionRatio: 33, industryPoi: 66, roadDensity: 63, mainRoadDistance: 48 }
    },
    {
      name: "葡萄架乡",
      lat: 34.69,
      lng: 114.84,
      ecology: { ecoLandRatio: 74, waterRatio: 57, waterNetwork: 62, slope: 19, buildDisturbance: 37 },
      life: { residentialRatio: 57, poiDensity: 49, educationAccess: 60, medicalAccess: 55, roadAccess: 68 },
      production: { farmlandRatio: 90, constructionRatio: 27, industryPoi: 74, roadDensity: 71, mainRoadDistance: 39 }
    },
    {
      name: "许河乡",
      lat: 34.79,
      lng: 115.02,
      ecology: { ecoLandRatio: 69, waterRatio: 52, waterNetwork: 59, slope: 21, buildDisturbance: 41 },
      life: { residentialRatio: 55, poiDensity: 47, educationAccess: 57, medicalAccess: 52, roadAccess: 62 },
      production: { farmlandRatio: 83, constructionRatio: 29, industryPoi: 65, roadDensity: 61, mainRoadDistance: 52 }
    }
  ];

  const layerConfig = {
    composite: {
      label: "三生综合指数专题图",
      metric: "composite",
      description: "综合叠加生态韧性、生活服务和生产空间三类指数，采用分级设色表达县域三生空间协同水平。",
      legend: [["#e56b5d", "低值短板"], ["#f4b44b", "中等提升"], ["#70d27b", "良好协调"], ["#35d0c6", "高值优势"]]
    },
    ecology: {
      label: "生态空间分级设色图",
      metric: "ecologyScore",
      description: "突出生态用地、水域水网与建设干扰的空间差异，模拟生态连续性和水系缓冲保护水平。",
      legend: [["#305b46", "一般生态"], ["#4f8e5e", "稳定生态"], ["#70d27b", "优势生态"], ["#a8e6ad", "核心生态"]]
    },
    life: {
      label: "生活服务可达性专题图",
      metric: "lifeScore",
      description: "模拟公共服务 POI、教育医疗和道路通达性核密度分布，用于识别村庄生活服务补齐方向。",
      legend: [["#28506a", "覆盖不足"], ["#3a83a3", "基本覆盖"], ["#35d0c6", "服务较好"], ["#9df2ec", "高可达"]]
    },
    production: {
      label: "生产空间支撑能力图",
      metric: "productionScore",
      description: "综合耕地、产业 POI、道路密度和主干路距离，表达农业生产和产业节点支撑能力。",
      legend: [["#6f4b20", "支撑偏弱"], ["#a8752c", "稳步提升"], ["#f4b44b", "生产优势"], ["#ffd27b", "重点集聚"]]
    },
    advantage: {
      label: "优势区域识别图",
      metric: "composite",
      description: "提取综合指数和单项指数高值区域，模拟优势发展节点、农文旅融合节点与产业集聚片区。",
      legend: [["#35d0c6", "综合优势"], ["#70d27b", "生态优势"], ["#f4b44b", "生产优势"], ["#65a8ff", "服务优势"]]
    },
    shortage: {
      label: "短板区域识别图",
      metric: "composite",
      description: "聚焦公共服务覆盖不足、水系周边建设扰动和交通可达性弱区，为治理项目排序提供依据。",
      legend: [["#e56b5d", "明显短板"], ["#f4b44b", "一般短板"], ["#b891ff", "结构失衡"], ["#65a8ff", "服务缺口"]]
    }
  };

  const state = {
    selectedTownName: "仪封镇",
    activeDimension: "ecology",
    activeLayer: "composite",
    weights: { ecology: 0.34, life: 0.33, production: 0.33 },
    normalizedWeights: { ecology: 0.34, life: 0.33, production: 0.33 },
    scoredTowns: [],
    leafletMap: null,
    leafletMarkers: []
  };

  const $ = (selector) => document.querySelector(selector);

  function normalizeWeights(weights) {
    const safe = {
      ecology: Math.max(0, Number(weights.ecology) || 0),
      life: Math.max(0, Number(weights.life) || 0),
      production: Math.max(0, Number(weights.production) || 0)
    };
    const sum = safe.ecology + safe.life + safe.production;
    if (sum <= 0) {
      return { ecology: 0.34, life: 0.33, production: 0.33, sum: 1, normalized: true };
    }
    return {
      ecology: safe.ecology / sum,
      life: safe.life / sum,
      production: safe.production / sum,
      sum,
      normalized: Math.abs(sum - 1) > 0.001
    };
  }

  function normalizeIndicator(value, direction) {
    const numeric = Math.max(0, Math.min(100, Number(value) || 0));
    if (direction === "负向") {
      return 100 - numeric;
    }
    if (direction === "半负向") {
      const ideal = 35;
      return Math.max(45, 100 - Math.abs(numeric - ideal) * 1.5);
    }
    return numeric;
  }

  function calculateDimensionScore(town, dimension) {
    const meta = dimensionMeta[dimension];
    const totalWeight = meta.indicators.reduce((sum, item) => sum + item.weight, 0);
    const score = meta.indicators.reduce((sum, item) => {
      return sum + normalizeIndicator(town[dimension][item.key], item.direction) * item.weight;
    }, 0) / totalWeight;
    return Number(score.toFixed(1));
  }

  function calculateCompositeScore(scores, weights) {
    const value = scores.ecologyScore * weights.ecology + scores.lifeScore * weights.life + scores.productionScore * weights.production;
    return Number(value.toFixed(1));
  }

  function scoreAllTowns() {
    const normalized = normalizeWeights(state.weights);
    state.normalizedWeights = {
      ecology: normalized.ecology,
      life: normalized.life,
      production: normalized.production
    };
    $("#weightHint").textContent = normalized.normalized
      ? `已归一化：原始总和 ${normalized.sum.toFixed(2)}`
      : `权重总和 ${normalized.sum.toFixed(2)}`;

    state.scoredTowns = towns.map((town) => {
      const scores = {
        ecologyScore: calculateDimensionScore(town, "ecology"),
        lifeScore: calculateDimensionScore(town, "life"),
        productionScore: calculateDimensionScore(town, "production")
      };
      return {
        ...town,
        ...scores,
        composite: calculateCompositeScore(scores, state.normalizedWeights),
        shortageType: getShortageType(scores)
      };
    }).sort((a, b) => b.composite - a.composite);
  }

  function getShortageType(scores) {
    const entries = [
      ["生态短板", scores.ecologyScore],
      ["生活服务短板", scores.lifeScore],
      ["生产支撑短板", scores.productionScore]
    ].sort((a, b) => a[1] - b[1]);
    return entries[0][0];
  }

  function getSelectedTown() {
    return state.scoredTowns.find((town) => town.name === state.selectedTownName) || state.scoredTowns[0];
  }

  function getCountyScores() {
    const total = state.scoredTowns.length || 1;
    const sum = state.scoredTowns.reduce((acc, town) => {
      acc.ecology += town.ecologyScore;
      acc.life += town.lifeScore;
      acc.production += town.productionScore;
      acc.composite += town.composite;
      return acc;
    }, { ecology: 0, life: 0, production: 0, composite: 0 });
    return {
      ecology: Number((sum.ecology / total).toFixed(1)),
      life: Number((sum.life / total).toFixed(1)),
      production: Number((sum.production / total).toFixed(1)),
      composite: Number((sum.composite / total).toFixed(1))
    };
  }

  function renderClock() {
    const now = new Date();
    $("#clock").textContent = now.toLocaleString("zh-CN", { hour12: false });
  }

  function renderIndicatorTabs() {
    document.querySelectorAll("#indicatorTabs .tab-btn").forEach((button) => {
      button.classList.toggle("active", button.dataset.dimension === state.activeDimension);
    });
    $("#indicatorScope").textContent = dimensionMeta[state.activeDimension].label;
  }

  function renderIndicatorList() {
    const town = getSelectedTown();
    const meta = dimensionMeta[state.activeDimension];
    $("#indicatorList").innerHTML = meta.indicators.map((item) => {
      const raw = town[state.activeDimension][item.key];
      const score = normalizeIndicator(raw, item.direction);
      return `
        <div class="indicator-item">
          <div class="indicator-top"><strong>${item.name}</strong><span>${score.toFixed(1)} 分</span></div>
          <div class="indicator-meta"><span>当前值 ${raw}${item.unit}</span><span>${item.direction}</span></div>
          <div class="score-bar"><span style="width:${score}%"></span></div>
        </div>`;
    }).join("");
  }

  function renderWeights() {
    syncWeightControl("ecoWeight", "ecoWeightValue", state.weights.ecology);
    syncWeightControl("lifeWeight", "lifeWeightValue", state.weights.life);
    syncWeightControl("productionWeight", "productionWeightValue", state.weights.production);
  }

  function syncWeightControl(rangeId, inputId, value) {
    $(`#${rangeId}`).value = value.toFixed(2);
    $(`#${inputId}`).value = value.toFixed(2);
  }

  function updateWeightFromControl(key, value) {
    state.weights[key] = Math.max(0, Math.min(1, Number(value) || 0));
    renderWeights();
  }

  function renderScoreCards() {
    const county = getCountyScores();
    const selected = getSelectedTown();
    $("#countyComposite").textContent = county.composite.toFixed(1);
    $("#countyEcology").textContent = county.ecology.toFixed(1);
    $("#countyLife").textContent = county.life.toFixed(1);
    $("#countyProduction").textContent = county.production.toFixed(1);
    $("#selectedTownName").textContent = selected.name;
    $("#selectedComposite").textContent = selected.composite.toFixed(1);
    $("#selectedEcology").textContent = selected.ecologyScore.toFixed(1);
    $("#selectedLife").textContent = selected.lifeScore.toFixed(1);
    $("#selectedProduction").textContent = selected.productionScore.toFixed(1);
    renderRadar(county);
  }

  function renderRadar(scores) {
    const canvas = $("#radarCanvas");
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2 + 6;
    const radius = 70;
    const axes = [
      { label: "生态", value: scores.ecology, color: "#70d27b" },
      { label: "生活", value: scores.life, color: "#35d0c6" },
      { label: "生产", value: scores.production, color: "#f4b44b" }
    ];
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(136, 190, 185, 0.28)";
    ctx.fillStyle = "rgba(53, 208, 198, 0.06)";
    for (let step = 1; step <= 4; step += 1) {
      drawPolygon(ctx, axes.length, cx, cy, radius * step / 4);
    }
    axes.forEach((axis, index) => {
      const point = polarPoint(cx, cy, radius, index, axes.length);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      ctx.fillStyle = axis.color;
      ctx.font = "12px Microsoft YaHei";
      ctx.textAlign = point.x < cx - 5 ? "right" : point.x > cx + 5 ? "left" : "center";
      ctx.fillText(`${axis.label} ${axis.value.toFixed(1)}`, point.x + (point.x < cx ? -8 : 8), point.y + 4);
    });
    ctx.beginPath();
    axes.forEach((axis, index) => {
      const point = polarPoint(cx, cy, radius * axis.value / 100, index, axes.length);
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.closePath();
    ctx.fillStyle = "rgba(53, 208, 198, 0.24)";
    ctx.strokeStyle = "#35d0c6";
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
  }

  function drawPolygon(ctx, count, cx, cy, radius) {
    ctx.beginPath();
    for (let index = 0; index < count; index += 1) {
      const point = polarPoint(cx, cy, radius, index, count);
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function polarPoint(cx, cy, radius, index, count) {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / count;
    return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
  }

  function renderRanking() {
    const max = Math.max(...state.scoredTowns.map((town) => town.composite));
    $("#rankingList").innerHTML = state.scoredTowns.map((town, index) => `
      <div class="ranking-item ${town.name === state.selectedTownName ? "active" : ""}" data-town="${town.name}">
        <div class="ranking-top"><strong>${index + 1}. ${town.name}</strong><b>${town.composite.toFixed(1)}</b></div>
        <div class="ranking-bar"><span style="width:${town.composite / max * 100}%; background:${getScoreColor(town.composite)}"></span></div>
        <div class="ranking-meta"><span>生态 ${town.ecologyScore.toFixed(1)} / 生活 ${town.lifeScore.toFixed(1)} / 生产 ${town.productionScore.toFixed(1)}</span><span>${town.shortageType}</span></div>
      </div>
    `).join("");
    document.querySelectorAll(".ranking-item").forEach((item) => {
      item.addEventListener("click", () => selectTown(item.dataset.town));
    });
  }

  function renderDiagnosis() {
    const town = getSelectedTown();
    const strongest = getStrongestDimension(town);
    const weakest = getWeakestDimension(town);
    const layerText = layerConfig[state.activeLayer].label;
    $("#diagnosisLayer").textContent = layerText;
    const content = [
      ["优势指标", `${strongest.label}表现突出，泡桐产业 POI 密度、道路通达性和生态用地连续性形成稳定支撑。`],
      ["短板指标", `${weakest.label}相对偏弱，部分村庄公共服务 POI 覆盖不足，水网周边建设干扰仍需压降。`],
      ["空间分布", `${town.name}在${layerText}中呈现中心节点集聚、外围村庄梯度递减的特征，沿主要道路和水系形成带状差异。`],
      ["治理建议", "优先补齐公共服务设施，控制水系两侧建设扰动，完善乡镇节点与村庄之间的慢行和公交接驳。"],
      ["发展建议", "依托泡桐产业、特色农业和黄河文化资源，培育农文旅融合节点，推动生产、生活、生态空间协同提升。"]
    ];
    $("#diagnosisList").innerHTML = content.map((item) => `
      <div class="diagnosis-item"><strong>${item[0]}</strong><span>${item[1]}</span></div>
    `).join("");
  }

  function getStrongestDimension(town) {
    return [
      { key: "ecology", label: "生态空间", value: town.ecologyScore },
      { key: "life", label: "生活服务", value: town.lifeScore },
      { key: "production", label: "生产空间", value: town.productionScore }
    ].sort((a, b) => b.value - a.value)[0];
  }

  function getWeakestDimension(town) {
    return [
      { key: "ecology", label: "生态空间", value: town.ecologyScore },
      { key: "life", label: "生活服务", value: town.lifeScore },
      { key: "production", label: "生产空间", value: town.productionScore }
    ].sort((a, b) => a.value - b.value)[0];
  }

  function renderIndicatorTable() {
    const town = getSelectedTown();
    const rows = [];
    Object.keys(dimensionMeta).forEach((dimension) => {
      dimensionMeta[dimension].indicators.forEach((item) => {
        const raw = town[dimension][item.key];
        const score = normalizeIndicator(raw, item.direction);
        const dimensionWeight = state.normalizedWeights[dimension];
        const finalWeight = dimensionWeight * item.weight;
        rows.push({
          name: item.name,
          raw: `${raw}${item.unit}`,
          score,
          weight: finalWeight,
          contribution: score * finalWeight
        });
      });
    });
    $("#indicatorTable").innerHTML = rows.map((row) => `
      <tr>
        <td>${row.name}</td>
        <td>${row.raw}</td>
        <td>${row.score.toFixed(1)}</td>
        <td>${row.weight.toFixed(3)}</td>
        <td>${row.contribution.toFixed(2)}</td>
      </tr>
    `).join("");
  }

  function renderProcessFlow() {
    const steps = ["数据输入", "指标计算", "指标标准化", "权重设置", "综合指数计算", "结果可视化", "自动生成报告"];
    $("#processFlow").innerHTML = steps.map((step, index) => `
      <div class="process-step"><span>${step}</span><i>${index < 5 ? "已完成" : "模拟运行"}</i></div>
    `).join("");
  }

  function renderMapLayer() {
    const config = layerConfig[state.activeLayer];
    $("#mapMode").textContent = config.label;
    $("#mapDescription").textContent = config.description;
    $("#legend").innerHTML = config.legend.map((item) => `<span><i style="background:${item[0]}"></i>${item[1]}</span>`).join("");
    document.querySelectorAll("#layerSwitch button").forEach((button) => {
      button.classList.toggle("active", button.dataset.layer === state.activeLayer);
    });
    drawFallbackMap();
    renderLeafletMarkers();
    renderDiagnosis();
  }

  function initLeafletMap() {
    // SuperMap 服务替换位置：真实部署时可在此加入 L.supermap.tiledMapLayer(url) 或业务专题图层。
    const mapElement = $("#leafletMap");
    if (!window.L || !mapElement) {
      return;
    }
    try {
      mapElement.style.display = "block";
      state.leafletMap = window.L.map(mapElement, {
        center: [34.82, 114.82],
        zoom: 10,
        zoomControl: false,
        attributionControl: false
      });
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        opacity: 0.2
      }).addTo(state.leafletMap);
    } catch (error) {
      mapElement.style.display = "none";
      state.leafletMap = null;
    }
  }

  function renderLeafletMarkers() {
    if (!state.leafletMap || !window.L) {
      return;
    }
    state.leafletMarkers.forEach((marker) => marker.remove());
    state.leafletMarkers = state.scoredTowns.map((town) => {
      const color = getTownLayerColor(town);
      const marker = window.L.circleMarker([town.lat, town.lng], {
        radius: town.name === state.selectedTownName ? 10 : 7,
        color,
        weight: 2,
        fillColor: color,
        fillOpacity: town.name === state.selectedTownName ? 0.78 : 0.48
      }).addTo(state.leafletMap);
      marker.on("click", () => selectTown(town.name));
      marker.bindTooltip(`${town.name} ${town.composite.toFixed(1)}`, { direction: "top" });
      return marker;
    });
  }

  function drawFallbackMap() {
    const canvas = $("#fallbackMap");
    const stage = canvas.parentElement;
    const rect = stage.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    drawCountyShape(ctx, rect.width, rect.height);
    drawWater(ctx, rect.width, rect.height);
    drawRoads(ctx, rect.width, rect.height);
    drawThematicPatches(ctx, rect.width, rect.height);
    drawTownPoints(ctx, rect.width, rect.height);
  }

  function drawCountyShape(ctx, width, height) {
    const points = [
      [0.21, 0.18], [0.45, 0.08], [0.72, 0.14], [0.86, 0.34], [0.82, 0.62],
      [0.66, 0.84], [0.38, 0.9], [0.16, 0.73], [0.1, 0.43]
    ];
    ctx.beginPath();
    points.forEach((point, index) => {
      const x = point[0] * width;
      const y = point[1] * height;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = "rgba(38, 82, 66, 0.28)";
    ctx.strokeStyle = "rgba(53, 208, 198, 0.62)";
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
  }

  function drawWater(ctx, width, height) {
    ctx.save();
    ctx.strokeStyle = "rgba(101, 168, 255, 0.48)";
    ctx.lineWidth = 3;
    drawCurve(ctx, [[0.06, 0.3], [0.28, 0.36], [0.48, 0.3], [0.74, 0.42], [0.95, 0.38]], width, height);
    ctx.lineWidth = 1.4;
    drawCurve(ctx, [[0.18, 0.62], [0.38, 0.54], [0.56, 0.6], [0.78, 0.55]], width, height);
    ctx.restore();
  }

  function drawRoads(ctx, width, height) {
    ctx.save();
    ctx.strokeStyle = "rgba(244, 180, 75, 0.5)";
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 2;
    drawCurve(ctx, [[0.17, 0.82], [0.36, 0.62], [0.55, 0.46], [0.84, 0.23]], width, height);
    drawCurve(ctx, [[0.27, 0.12], [0.42, 0.38], [0.58, 0.66], [0.72, 0.88]], width, height);
    ctx.restore();
  }

  function drawCurve(ctx, points, width, height) {
    ctx.beginPath();
    points.forEach((point, index) => {
      const x = point[0] * width;
      const y = point[1] * height;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  function drawThematicPatches(ctx, width, height) {
    const sorted = [...state.scoredTowns].sort((a, b) => a.lng - b.lng);
    sorted.forEach((town, index) => {
      const point = projectTown(town, width, height);
      const color = getTownLayerColor(town);
      const radius = state.activeLayer === "life" ? 78 : state.activeLayer === "shortage" ? 62 : 68;
      const gradient = ctx.createRadialGradient(point.x, point.y, 4, point.x, point.y, radius);
      gradient.addColorStop(0, hexToRgba(color, state.activeLayer === "shortage" ? 0.45 : 0.4));
      gradient.addColorStop(1, hexToRgba(color, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius + (index % 3) * 12, 0, Math.PI * 2);
      ctx.fill();

      if (state.activeLayer === "ecology" || state.activeLayer === "shortage") {
        ctx.strokeStyle = hexToRgba(color, 0.42);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 34, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
  }

  function drawTownPoints(ctx, width, height) {
    state.scoredTowns.forEach((town) => {
      const point = projectTown(town, width, height);
      const selected = town.name === state.selectedTownName;
      const color = getTownLayerColor(town);
      ctx.beginPath();
      ctx.arc(point.x, point.y, selected ? 8 : 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.strokeStyle = selected ? "#fff" : "rgba(255,255,255,0.7)";
      ctx.lineWidth = selected ? 2 : 1;
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = selected ? "#fff" : "rgba(237, 247, 243, 0.86)";
      ctx.font = selected ? "700 13px Microsoft YaHei" : "12px Microsoft YaHei";
      ctx.fillText(town.name, point.x + 10, point.y - 8);
      ctx.fillStyle = "rgba(5, 18, 20, 0.78)";
      ctx.fillRect(point.x + 10, point.y + 1, 40, 18);
      ctx.fillStyle = color;
      ctx.fillText(town.composite.toFixed(1), point.x + 14, point.y + 15);
    });
  }

  function projectTown(town, width, height) {
    const minLng = 114.62;
    const maxLng = 115.08;
    const minLat = 34.66;
    const maxLat = 34.96;
    return {
      x: (town.lng - minLng) / (maxLng - minLng) * width * 0.78 + width * 0.1,
      y: (1 - (town.lat - minLat) / (maxLat - minLat)) * height * 0.78 + height * 0.1
    };
  }

  function getTownLayerColor(town) {
    if (state.activeLayer === "advantage") {
      const strongest = getStrongestDimension(town).key;
      return strongest === "ecology" ? "#70d27b" : strongest === "life" ? "#65a8ff" : "#f4b44b";
    }
    if (state.activeLayer === "shortage") {
      const weakest = getWeakestDimension(town).key;
      return weakest === "life" ? "#e56b5d" : weakest === "ecology" ? "#b891ff" : "#f4b44b";
    }
    const score = town[layerConfig[state.activeLayer].metric];
    return getScoreColor(score);
  }

  function getScoreColor(score) {
    if (score >= 82) return "#35d0c6";
    if (score >= 74) return "#70d27b";
    if (score >= 66) return "#f4b44b";
    return "#e56b5d";
  }

  function hexToRgba(hex, alpha) {
    const value = hex.replace("#", "");
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function selectTown(name) {
    state.selectedTownName = name;
    renderAll(false);
  }

  function generateReport() {
    const town = getSelectedTown();
    const strongest = getStrongestDimension(town);
    const weakest = getWeakestDimension(town);
    const report = [
      `【区域总体评价】${town.name}三生空间综合指数为 ${town.composite.toFixed(1)} 分，处于${town.composite >= 80 ? "高水平协同" : town.composite >= 72 ? "良好提升" : "重点提升"}区间。`,
      `【三生指数得分】生态 ${town.ecologyScore.toFixed(1)} 分，生活 ${town.lifeScore.toFixed(1)} 分，生产 ${town.productionScore.toFixed(1)} 分。当前权重为生态 ${state.normalizedWeights.ecology.toFixed(2)}、生活 ${state.normalizedWeights.life.toFixed(2)}、生产 ${state.normalizedWeights.production.toFixed(2)}。`,
      `【优势指标】${strongest.label}为主要优势，泡桐产业 POI 密度、道路通达性较好，生态用地连续性较强。`,
      `【短板指标】${weakest.label}仍需提升，部分村庄公共服务 POI 覆盖不足，水网周边建设干扰偏高。`,
      "【空间分布特征】高值区沿主干道路、产业节点和生态廊道呈带状集聚，低值区主要出现在服务半径末端和交通联系较弱村庄。",
      "【治理建议】优先补齐公共服务设施，控制水系两侧建设扰动，加强生态缓冲区管控和道路节点慢行连通。",
      "【发展建议】发展农文旅融合节点，联动泡桐产业、特色农业和黄河文化资源，形成生产增效、生活提质、生态增绿的综合提升路径。"
    ].join("\n");
    $("#reportOutput").textContent = report;
    return report;
  }

  function exportReport() {
    const report = $("#reportOutput").textContent.includes("【区域总体评价】")
      ? $("#reportOutput").textContent
      : generateReport();
    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `三生空间综合分析报告-${getSelectedTown().name}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function bindEvents() {
    $("#indicatorTabs").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-dimension]");
      if (!button) return;
      state.activeDimension = button.dataset.dimension;
      renderIndicatorTabs();
      renderIndicatorList();
    });

    $("#layerSwitch").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-layer]");
      if (!button) return;
      state.activeLayer = button.dataset.layer;
      renderMapLayer();
    });

    [
      ["ecoWeight", "ecoWeightValue", "ecology"],
      ["lifeWeight", "lifeWeightValue", "life"],
      ["productionWeight", "productionWeightValue", "production"]
    ].forEach(([rangeId, inputId, key]) => {
      $(`#${rangeId}`).addEventListener("input", (event) => updateWeightFromControl(key, event.target.value));
      $(`#${inputId}`).addEventListener("input", (event) => updateWeightFromControl(key, event.target.value));
    });

    $("#recalculateBtn").addEventListener("click", () => {
      scoreAllTowns();
      renderAll(false);
      generateReport();
    });

    $("#resetWeightBtn").addEventListener("click", () => {
      state.weights = { ecology: 0.34, life: 0.33, production: 0.33 };
      renderWeights();
      scoreAllTowns();
      renderAll(false);
    });

    $("#generateReportBtn").addEventListener("click", generateReport);
    $("#exportReportBtn").addEventListener("click", exportReport);

    $("#fallbackMap").addEventListener("click", (event) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const nearest = state.scoredTowns.map((town) => {
        const point = projectTown(town, rect.width, rect.height);
        return { town, distance: Math.hypot(point.x - x, point.y - y) };
      }).sort((a, b) => a.distance - b.distance)[0];
      if (nearest && nearest.distance < 42) {
        selectTown(nearest.town.name);
      }
    });

    window.addEventListener("resize", () => {
      drawFallbackMap();
      if (state.leafletMap) state.leafletMap.invalidateSize();
    });
  }

  function renderAll(includeWeights) {
    if (includeWeights) {
      renderWeights();
    }
    renderIndicatorTabs();
    renderIndicatorList();
    renderScoreCards();
    renderRanking();
    renderDiagnosis();
    renderIndicatorTable();
    renderProcessFlow();
    renderMapLayer();
  }

  function init() {
    renderClock();
    setInterval(renderClock, 1000);
    scoreAllTowns();
    bindEvents();
    initLeafletMap();
    renderAll(true);
    generateReport();
  }

  document.addEventListener("DOMContentLoaded", init);

  window.normalizeWeights = normalizeWeights;
  window.calculateDimensionScore = calculateDimensionScore;
  window.calculateCompositeScore = calculateCompositeScore;
  window.renderRadar = renderRadar;
  window.renderRanking = renderRanking;
  window.renderIndicatorTable = renderIndicatorTable;
  window.renderMapLayer = renderMapLayer;
  window.generateReport = generateReport;
  window.exportReport = exportReport;
})();
