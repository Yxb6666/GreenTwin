// js/governance.js
const TYPE_COLORS = {
  "人居环境类": "#e56b5d",
  "基础设施类": "#f4b44b",
  "空间管控类": "#35d0c6",
  "安全风险类": "#70d27b"
}

const STATUS_COLORS = {
  "待审核": "#f4b44b",
  "已派单": "#35d0c6",
  "处理中": "#70d27b",
  "已办结": "#8f9f97"
}

const DATA = [
  { id: "GK-2026-001", type: "人居环境类", subtype: "垃圾乱堆乱放", photo: "", desc: "村口道路旁垃圾堆放影响通行和卫生。", lon: 114.8172, lat: 34.8248, contact: "张伟", phone: "13800010001", town: "城关乡", village: "东关村", time: "2026-04-27T09:12:00", urgency: "高", status: "待审核" },
  { id: "GK-2026-002", type: "人居环境类", subtype: "污水横流", photo: "", desc: "巷道排污沟破损导致污水外溢。", lon: 114.7865, lat: 34.8613, contact: "李敏", phone: "13800010002", town: "仪封镇", village: "北街村", time: "2026-04-26T15:48:00", urgency: "中", status: "已派单" },
  { id: "GK-2026-003", type: "人居环境类", subtype: "畜禽养殖污染", photo: "", desc: "养殖区污水收集池渗漏，异味明显。", lon: 114.7428, lat: 34.8426, contact: "刘洋", phone: "13800010003", town: "谷营镇", village: "东陈村", time: "2026-04-25T11:35:00", urgency: "高", status: "处理中" },
  { id: "GK-2026-004", type: "基础设施类", subtype: "道路破损", photo: "", desc: "村主干道多处龟裂坑洼，存在安全风险。", lon: 114.8339, lat: 34.7927, contact: "王磊", phone: "13800010004", town: "红庙镇", village: "西李村", time: "2026-04-24T08:05:00", urgency: "高", status: "处理中" },
  { id: "GK-2026-005", type: "基础设施类", subtype: "路灯损坏", photo: "", desc: "村西口两盏路灯不亮，夜间通行视线差。", lon: 114.8764, lat: 34.8132, contact: "赵娜", phone: "13800010005", town: "东坝头镇", village: "南王村", time: "2026-04-22T20:10:00", urgency: "中", status: "待审核" },
  { id: "GK-2026-006", type: "基础设施类", subtype: "排水沟堵塞", photo: "", desc: "降雨后排水缓慢，农户门前长期积水。", lon: 114.7723, lat: 34.7684, contact: "周凯", phone: "13800010006", town: "许河乡", village: "后刘村", time: "2026-04-21T13:25:00", urgency: "中", status: "已办结" },
  { id: "GK-2026-007", type: "空间管控类", subtype: "违建疑似", photo: "", desc: "疑似新增彩钢房，位于村庄建设边界外。", lon: 114.8087, lat: 34.8885, contact: "孙婷", phone: "13800010007", town: "仪封镇", village: "前庄村", time: "2026-04-20T10:18:00", urgency: "高", status: "待审核" },
  { id: "GK-2026-008", type: "空间管控类", subtype: "占用耕地", photo: "", desc: "耕地内发现硬化场地，需核实审批手续。", lon: 114.7292, lat: 34.8267, contact: "马超", phone: "13800010008", town: "谷营镇", village: "小宋村", time: "2026-04-19T16:42:00", urgency: "高", status: "已派单" },
  { id: "GK-2026-009", type: "空间管控类", subtype: "河道侵占", photo: "", desc: "河道边坡存在临时围挡和杂物堆压。", lon: 114.9001, lat: 34.8489, contact: "朱琳", phone: "13800010009", town: "东坝头镇", village: "沿河村", time: "2026-04-17T09:30:00", urgency: "中", status: "处理中" },
  { id: "GK-2026-010", type: "安全风险类", subtype: "危房隐患", photo: "", desc: "老旧房屋墙体开裂，雨天渗漏严重。", lon: 114.7541, lat: 34.8049, contact: "高峰", phone: "13800010010", town: "许河乡", village: "中街村", time: "2026-04-16T14:27:00", urgency: "高", status: "处理中" },
  { id: "GK-2026-011", type: "安全风险类", subtype: "消防通道堵塞", photo: "", desc: "堆物占道导致消防车无法正常通行。", lon: 114.8477, lat: 34.7735, contact: "何静", phone: "13800010011", town: "红庙镇", village: "高庄村", time: "2026-04-15T18:10:00", urgency: "中", status: "已派单" },
  { id: "GK-2026-012", type: "安全风险类", subtype: "积水点", photo: "", desc: "低洼地块雨后积水，影响农机和行人通行。", lon: 114.7926, lat: 34.8355, contact: "郭鹏", phone: "13800010012", town: "城关乡", village: "南关村", time: "2026-04-14T07:58:00", urgency: "低", status: "已办结" }
]

const state = {
  layer: "points",
  selectedId: DATA[0].id,
  filters: {
    keyword: "",
    type: "all",
    town: "all",
    village: "all",
    time: "all",
    urgency: "all"
  }
}

let map = null
let markerLayer = null
let markerMap = new Map()
let toastTimer = null

const dom = {
  currentTime: document.getElementById("currentTime"),
  runStatus: document.getElementById("runStatus"),
  filterKeyword: document.getElementById("filterKeyword"),
  filterType: document.getElementById("filterType"),
  filterTown: document.getElementById("filterTown"),
  filterVillage: document.getElementById("filterVillage"),
  filterTime: document.getElementById("filterTime"),
  filterUrgency: document.getElementById("filterUrgency"),
  latestList: document.getElementById("latestList"),
  latestCount: document.getElementById("latestCount"),
  detail: document.getElementById("problemDetail"),
  mapLegend: document.getElementById("mapLegend"),
  fallbackMap: document.getElementById("fallbackMap"),
  statusDonut: document.getElementById("statusDonut"),
  statusLegend: document.getElementById("statusLegend"),
  villageBars: document.getElementById("villageBars"),
  hotspotChart: document.getElementById("hotspotChart"),
  toast: document.getElementById("toast")
}

function init() {
  initClock()
  initFilters()
  initEvents()
  initMap()
  renderAll()
}

function initClock() {
  updateClock()
  setInterval(updateClock, 1000)
}

function updateClock() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, "0")
  dom.currentTime.textContent = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function initFilters() {
  fillSelect(dom.filterType, ["all", ...new Set(DATA.map(d => d.type))], "全部问题类型")
  fillSelect(dom.filterTown, ["all", ...new Set(DATA.map(d => d.town))], "全部乡镇")
  fillVillageOptions()
}

function fillVillageOptions() {
  const town = state.filters.town
  const villages = town === "all"
    ? [...new Set(DATA.map(d => d.village))]
    : [...new Set(DATA.filter(d => d.town === town).map(d => d.village))]
  fillSelect(dom.filterVillage, ["all", ...villages], "全部村庄")
  dom.filterVillage.value = state.filters.village
  if (![...dom.filterVillage.options].some(o => o.value === state.filters.village)) {
    state.filters.village = "all"
    dom.filterVillage.value = "all"
  }
}

function fillSelect(selectEl, values, allLabel) {
  selectEl.innerHTML = ""
  values.forEach((v, idx) => {
    const op = document.createElement("option")
    op.value = v
    op.textContent = idx === 0 && v === "all" ? allLabel : v
    selectEl.appendChild(op)
  })
}

function initEvents() {
  dom.filterKeyword.addEventListener("input", (e) => {
    state.filters.keyword = e.target.value.trim()
    renderAll()
  })

  dom.filterType.addEventListener("change", (e) => {
    state.filters.type = e.target.value
    renderAll()
  })

  dom.filterTown.addEventListener("change", (e) => {
    state.filters.town = e.target.value
    fillVillageOptions()
    renderAll()
  })

  dom.filterVillage.addEventListener("change", (e) => {
    state.filters.village = e.target.value
    renderAll()
  })

  dom.filterTime.addEventListener("change", (e) => {
    state.filters.time = e.target.value
    renderAll()
  })

  dom.filterUrgency.addEventListener("change", (e) => {
    state.filters.urgency = e.target.value
    renderAll()
  })

  document.getElementById("resetFilters").addEventListener("click", () => {
    state.filters = { keyword: "", type: "all", town: "all", village: "all", time: "all", urgency: "all" }
    dom.filterKeyword.value = ""
    dom.filterType.value = "all"
    dom.filterTown.value = "all"
    fillVillageOptions()
    dom.filterVillage.value = "all"
    dom.filterTime.value = "all"
    dom.filterUrgency.value = "all"
    renderAll()
  })

  document.querySelectorAll(".layer-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      state.layer = btn.dataset.layer
      document.querySelectorAll(".layer-btn").forEach(b => b.classList.toggle("active", b === btn))
      renderMap(getFilteredData())
      renderLegend()
    })
  })

  document.querySelectorAll(".status-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const item = DATA.find(d => d.id === state.selectedId)
      if (!item) return
      item.status = btn.dataset.status
      renderAll()
      showToast(`状态已更新为：${item.status}`)
    })
  })

  document.getElementById("exportBtn").addEventListener("click", () => {
    showToast("问题清单已生成")
  })

  document.getElementById("viewPhotoBtn").addEventListener("click", () => {
    const item = DATA.find(d => d.id === state.selectedId)
    if (!item) return
    showToast(`已查看照片：${item.id}`)
  })

  document.getElementById("viewContactBtn").addEventListener("click", () => {
    const item = DATA.find(d => d.id === state.selectedId)
    if (!item) return
    showToast(`联系方式：${item.phone}`)
  })

  // 监听热点图容器的实际尺寸变化，确保获取到准确的宽高后再绘制
  const hotspotContainer = dom.hotspotChart.parentElement;
  const resizeObserver = new ResizeObserver(() => {
    // 使用 requestAnimationFrame 防止频繁触发导致卡顿
    requestAnimationFrame(() => {
      drawHotspotChart(getFilteredData());
      if (!window.L) drawFallbackMap(getFilteredData());
    });
  });
  resizeObserver.observe(hotspotContainer);
}

function getFilteredData() {
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  return DATA.filter(d => {
    if (state.filters.keyword) {
      const k = state.filters.keyword.toLowerCase()
      const hit = d.id.toLowerCase().includes(k) || d.desc.toLowerCase().includes(k)
      if (!hit) return false
    }
    if (state.filters.type !== "all" && d.type !== state.filters.type) return false
    if (state.filters.town !== "all" && d.town !== state.filters.town) return false
    if (state.filters.village !== "all" && d.village !== state.filters.village) return false
    if (state.filters.urgency !== "all" && d.urgency !== state.filters.urgency) return false
    if (state.filters.time !== "all") {
      const diff = now - new Date(d.time).getTime()
      if (diff > Number(state.filters.time) * dayMs) return false
    }
    return true
  })
}

function renderAll() {
  const rows = getFilteredData()
  if (!rows.some(r => r.id === state.selectedId)) {
    state.selectedId = rows.length ? rows[0].id : null
  }

  renderOverview(rows)
  renderLatest(rows)
  renderDetail()
  renderStatusButtons()
  renderLegend()
  renderMap(rows)
  renderVillageBars(rows)
  drawHotspotChart(rows)
  renderStatusChart(rows)
}

function renderOverview(rows) {
  const total = rows.length
  const pending = rows.filter(r => r.status === "待审核").length
  const processing = rows.filter(r => r.status === "处理中").length
  const closed = rows.filter(r => r.status === "已办结").length
  const high = rows.filter(r => r.urgency === "高").length
  const rate = total ? ((closed / total) * 100).toFixed(1) : "0.0"

  document.getElementById("statTotal").textContent = String(total)
  document.getElementById("statPending").textContent = String(pending)
  document.getElementById("statProcessing").textContent = String(processing)
  document.getElementById("statClosed").textContent = String(closed)
  document.getElementById("statClosureRate").textContent = `${rate}%`
  document.getElementById("statHighUrgent").textContent = String(high)
}

function renderLatest(rows) {
  const list = [...rows].sort((a, b) => new Date(b.time) - new Date(a.time))
  dom.latestCount.textContent = `${list.length}条`
  dom.latestList.innerHTML = ""

  list.forEach(item => {
    const card = document.createElement("article")
    card.className = `issue-item${item.id === state.selectedId ? " active" : ""}`
    card.addEventListener("click", () => {
      state.selectedId = item.id
      renderDetail()
      renderLatest(rows)
      highlightMapSelection()
    })

    const title = document.createElement("h3")
    title.textContent = `${item.type} / ${item.subtype}`

    const pill = document.createElement("span")
    const urgencyCls = item.urgency === "高" ? "pill-urgency-high" : item.urgency === "中" ? "pill-urgency-medium" : "pill-urgency-low"
    pill.className = `pill ${urgencyCls}`
    pill.textContent = item.urgency

    const desc = document.createElement("p")
    desc.textContent = item.desc

    const status = document.createElement("span")
    status.className = "status-badge"
    status.textContent = `状态：${item.status}`

    card.appendChild(title)
    card.appendChild(pill)
    card.appendChild(desc)
    card.appendChild(status)
    dom.latestList.appendChild(card)
  })
}

function renderDetail() {
  const item = DATA.find(d => d.id === state.selectedId)
  if (!item) {
    dom.detail.innerHTML = "<p>暂无数据</p>"
    return
  }

  const photoUrl = item.photo || buildPhoto(item)
  dom.detail.innerHTML = `
    <img class="detail-photo" src="${photoUrl}" alt="现场照片" />
    <dl class="detail-grid">
      <dt>问题编号</dt><dd>${item.id}</dd>
      <dt>问题类型</dt><dd>${item.type}</dd>
      <dt>问题子类型</dt><dd>${item.subtype}</dd>
      <dt>问题描述</dt><dd>${item.desc}</dd>
      <dt>联系人</dt><dd>${item.contact}</dd>
      <dt>联系方式</dt><dd>${item.phone}</dd>
      <dt>所属乡镇</dt><dd>${item.town}</dd>
      <dt>所属村庄</dt><dd>${item.village}</dd>
      <dt>上报时间</dt><dd>${formatTime(item.time)}</dd>
      <dt>紧急程度</dt><dd>${item.urgency}</dd>
      <dt>处理状态</dt><dd>${item.status}</dd>
      <dt>经纬度</dt><dd>${item.lon.toFixed(6)}, ${item.lat.toFixed(6)}</dd>
    </dl>
  `
}

function renderStatusButtons() {
  const item = DATA.find(d => d.id === state.selectedId)
  document.querySelectorAll(".status-btn").forEach(btn => {
    btn.classList.toggle("active", item && item.status === btn.dataset.status)
  })
}

function formatTime(iso) {
  const d = new Date(iso)
  const p = (n) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function buildPhoto(item) {
  const color = TYPE_COLORS[item.type] || "#35d0c6"
  const txt = encodeURIComponent(`${item.subtype} / ${item.village}`)
  const svg = `
  <svg xmlns='http://www.w3.org/2000/svg' width='640' height='360'>
    <defs>
      <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0%' stop-color='${color}' stop-opacity='0.85'/>
        <stop offset='100%' stop-color='#1a2624' stop-opacity='1'/>
      </linearGradient>
    </defs>
    <rect width='100%' height='100%' fill='url(#g)'/>
    <rect x='18' y='18' width='604' height='324' fill='none' stroke='rgba(255,255,255,0.3)'/>
    <text x='28' y='58' fill='white' font-size='20' font-family='Arial'>乡村治理现场照片（模拟）</text>
    <text x='28' y='98' fill='white' font-size='16' font-family='Arial'>${txt}</text>
  </svg>`
  return `data:image/svg+xml;charset=UTF-8,${svg}`
}

function initMap() {
  if (!window.L) {
    document.getElementById("governanceMap").style.display = "none"
    dom.fallbackMap.style.display = "block"
    drawFallbackMap(getFilteredData())
    return
  }

  map = L.map("governanceMap", { zoomControl: false, attributionControl: false }).setView([34.82, 114.81], 10)
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18 }).addTo(map)
  markerLayer = L.layerGroup().addTo(map)
}

function renderMap(rows) {
  if (!window.L || !map || !markerLayer) {
    drawFallbackMap(rows)
    return
  }

  markerLayer.clearLayers()
  markerMap.clear()

  if (state.layer === "cluster") {
    renderCluster(rows)
  } else {
    rows.forEach(item => {
      if (state.layer === "hotspot") {
        L.circle([item.lat, item.lon], {
          radius: item.urgency === "高" ? 520 : item.urgency === "中" ? 380 : 260,
          stroke: false,
          fillOpacity: 0.14,
          fillColor: TYPE_COLORS[item.type]
        }).addTo(markerLayer)
      }

      const color = state.layer === "status" ? STATUS_COLORS[item.status] : TYPE_COLORS[item.type]
      const marker = L.circleMarker([item.lat, item.lon], {
        radius: item.id === state.selectedId ? 10 : 7,
        color: "#dbe7e2",
        weight: item.id === state.selectedId ? 2 : 1,
        fillColor: color,
        fillOpacity: 0.9
      })

      marker.on("click", () => {
        state.selectedId = item.id
        renderDetail()
        renderLatest(rows)
        renderStatusButtons()
        highlightMapSelection()
      })

      marker.bindPopup(`${item.id}<br>${item.subtype}<br>${item.status}`)
      marker.addTo(markerLayer)
      markerMap.set(item.id, marker)
    })
  }

  highlightMapSelection()
}

function renderCluster(rows) {
  const grid = new Map()
  rows.forEach(item => {
    const key = `${Math.round(item.lat * 60) / 60}_${Math.round(item.lon * 60) / 60}`
    if (!grid.has(key)) grid.set(key, [])
    grid.get(key).push(item)
  })

  grid.forEach(group => {
    const lat = group.reduce((s, n) => s + n.lat, 0) / group.length
    const lon = group.reduce((s, n) => s + n.lon, 0) / group.length
    const count = group.length
    const marker = L.circleMarker([lat, lon], {
      radius: 8 + count * 3,
      color: "#dbe7e2",
      weight: 1,
      fillColor: "#35d0c6",
      fillOpacity: 0.75
    })
    marker.bindTooltip(`聚类 ${count} 条`, { permanent: true, direction: "center", className: "cluster-tip" })
    marker.on("click", () => {
      state.selectedId = group[0].id
      renderDetail()
      renderLatest(rows)
      renderStatusButtons()
      map.flyTo([group[0].lat, group[0].lon], 12, { duration: 0.5 })
    })
    marker.addTo(markerLayer)
  })
}

function highlightMapSelection() {
  if (!window.L || !map) return
  markerMap.forEach((m, id) => {
    const selected = id === state.selectedId
    m.setStyle({ radius: selected ? 10 : 7, weight: selected ? 2 : 1 })
    if (selected) map.panTo(m.getLatLng(), { animate: true, duration: 0.4 })
  })
}

function renderLegend() {
  const sets = {
    points: [
      ["人居环境类", TYPE_COLORS["人居环境类"]],
      ["基础设施类", TYPE_COLORS["基础设施类"]],
      ["空间管控类", TYPE_COLORS["空间管控类"]],
      ["安全风险类", TYPE_COLORS["安全风险类"]]
    ],
    hotspot: [
      ["热点强", "#e56b5d"],
      ["热点中", "#f4b44b"],
      ["热点弱", "#70d27b"]
    ],
    cluster: [
      ["聚类问题点", "#35d0c6"]
    ],
    status: [
      ["待审核", STATUS_COLORS["待审核"]],
      ["已派单", STATUS_COLORS["已派单"]],
      ["处理中", STATUS_COLORS["处理中"]],
      ["已办结", STATUS_COLORS["已办结"]]
    ]
  }

  dom.mapLegend.innerHTML = sets[state.layer].map(([name, color]) => `
    <span class="legend-item"><i class="legend-dot" style="background:${color}"></i>${name}</span>
  `).join("")
}

function drawFallbackMap(rows) {
  const c = dom.fallbackMap
  const box = c.getBoundingClientRect()
  c.width = box.width || 800
  c.height = box.height || 500
  const ctx = c.getContext("2d")
  ctx.clearRect(0, 0, c.width, c.height)

  ctx.fillStyle = "#0d1616"
  ctx.fillRect(0, 0, c.width, c.height)

  ctx.strokeStyle = "rgba(53,208,198,0.18)"
  for (let x = 20; x < c.width; x += 40) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, c.height)
    ctx.stroke()
  }
  for (let y = 20; y < c.height; y += 40) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(c.width, y)
    ctx.stroke()
  }

  rows.forEach((r) => {
    const x = ((r.lon - 114.68) / (115.00 - 114.68)) * c.width
    const y = c.height - ((r.lat - 34.72) / (34.92 - 34.72)) * c.height
    const color = state.layer === "status" ? STATUS_COLORS[r.status] : TYPE_COLORS[r.type]
    ctx.beginPath()
    ctx.fillStyle = color
    ctx.globalAlpha = state.layer === "hotspot" ? 0.25 : 0.95
    ctx.arc(x, y, r.id === state.selectedId ? 11 : 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  })
}

function renderVillageBars(rows) {
  const mapVillage = new Map()
  rows.forEach(r => mapVillage.set(r.village, (mapVillage.get(r.village) || 0) + 1))
  const arr = [...mapVillage.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7)
  const max = arr.length ? arr[0][1] : 1

  dom.villageBars.innerHTML = arr.map(([name, v]) => `
    <div class="village-bar-row">
      <span>${name}</span>
      <div class="village-bar-track"><div class="village-bar-fill" style="width:${(v / max) * 100}%"></div></div>
      <b>${v}</b>
    </div>
  `).join("")
}

function drawHotspotChart(rows) {
  const canvas = dom.hotspotChart;
  
  // 直接获取 Canvas 元素经过 CSS 布局后真实的显示像素大小
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  // 避免在网格系统尚未计算完毕时绘制（防止长宽为0导致报错）
  if (width === 0 || height === 0) return;

  const dpr = window.devicePixelRatio || 1;

  // 仅仅修改内部画板的像素密度，千万不要去修改 canvas.style.width ！
  // CSS 里的 width: 100% 会完美锁死它的外观大小。
  canvas.width = width * dpr;
  canvas.height = height * dpr;

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  rows.forEach((r) => {
    // 经纬度映射逻辑，根据获取到的真实 width 和 height 进行等比换算
    const x = ((r.lon - 114.68) / (115.00 - 114.68)) * width;
    const y = height - ((r.lat - 34.72) / (34.92 - 34.72)) * height;
    
    // 半径缩小，避免光晕混在一起
    const radius = r.urgency === "高" ? 20 : r.urgency === "中" ? 14 : 10; 
    
    // 实心渐变，让它像一个个小灯泡一样亮起来
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    const color = TYPE_COLORS[r.type];
    g.addColorStop(0, hexToRgba(color, 0.95));  // 中心高亮
    g.addColorStop(0.4, hexToRgba(color, 0.5)); // 中间柔和
    g.addColorStop(1, hexToRgba(color, 0.0));   // 边缘透明

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

function renderStatusChart(rows) {
  const counts = {
    "待审核": rows.filter(r => r.status === "待审核").length,
    "已派单": rows.filter(r => r.status === "已派单").length,
    "处理中": rows.filter(r => r.status === "处理中").length,
    "已办结": rows.filter(r => r.status === "已办结").length
  }

  const total = rows.length || 1
  const doneRate = ((counts["已办结"] / total) * 100).toFixed(1)
  dom.statusDonut.dataset.rate = `闭环 ${doneRate}%`

  const a = (counts["待审核"] / total) * 360
  const b = (counts["已派单"] / total) * 360 + a
  const c = (counts["处理中"] / total) * 360 + b

  dom.statusDonut.style.background = `
    conic-gradient(
      ${STATUS_COLORS["待审核"]} 0deg ${a}deg,
      ${STATUS_COLORS["已派单"]} ${a}deg ${b}deg,
      ${STATUS_COLORS["处理中"]} ${b}deg ${c}deg,
      ${STATUS_COLORS["已办结"]} ${c}deg 360deg
    )
  `

  dom.statusLegend.innerHTML = Object.keys(counts).map(k => {
    const pct = ((counts[k] / total) * 100).toFixed(0)
    return `
      <div class="status-legend-row">
        <span>${k}</span>
        <div class="status-track"><i style="width:${pct}%;background:${STATUS_COLORS[k]}"></i></div>
        <b>${counts[k]}</b>
      </div>
    `
  }).join("")
}

function hexToRgba(hex, alpha) {
  const m = hex.replace("#", "")
  const r = parseInt(m.substring(0, 2), 16)
  const g = parseInt(m.substring(2, 4), 16)
  const b = parseInt(m.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function showToast(msg) {
  dom.toast.textContent = msg
  dom.toast.classList.add("show")
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => dom.toast.classList.remove("show"), 1600)
}

init()
