// twin.js
const state = {
  mode: 'white', // white, photo, lidar
};

const dom = {
  currentTime: document.getElementById("currentTime"),
  radar: document.getElementById("radarChart"),
  roamTip: document.getElementById("roamTip")
};

let viewer = null;
let scene = null;

function init() {
  initClock();
  
  // 使用 try...catch 捕获 WebGL 崩溃，防止它“连累”其他 UI 组件
  try {
    initSuperMap3D(); 
  } catch (error) {
    console.error("SuperMap 3D 引擎初始化被远控环境拦截，但不影响 UI 渲染：", error);
    
    // 顺便把左上角的引擎状态改成飘红报错，显得我们做得很细节
    const statusEl = document.getElementById("runStatus");
    statusEl.textContent = "WebGL 环境受限";
    statusEl.style.color = "var(--type-env)"; // 变成红色
    statusEl.style.textShadow = "none";
  }

  // 现在即使 3D 崩了，下面的事件和图表也一定能正常加载了！
  initEvents();     
  drawRadarChart(); 
  
  window.addEventListener('resize', drawRadarChart);
}

function initClock() {
  const update = () => {
    const d = new Date();
    const p = n => String(n).padStart(2, "0");
    dom.currentTime.textContent = `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };
  update(); setInterval(update, 1000);
}

// ==========================================
// SuperMap iClient3D for WebGL 核心逻辑
// ==========================================
function initSuperMap3D() {
  // 1. 初始化 Cesium Viewer，关闭多余自带控件
  viewer = new Cesium.Viewer('cesiumContainer', {
    infoBox: false,
    selectionIndicator: false,
    navigation: false,
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    // contextOptions: {
    //   webgl: { preserveDrawingBuffer: true } // 允许截图/高性能抗锯齿
    // }
  });

  scene = viewer.scene;
  
  // 开启地下透明、光照等基础设置
  scene.globe.depthTestAgainstTerrain = true;
  
  // 2. 加载 iServer 发布的 S3M 三维服务 (这里用注释写出真实项目如何加载)
  /*
  const S3M_URL = "http://<你的iServer地址>/rest/realspace/datas/LankaoVillage/config";
  const promise = scene.open(S3M_URL);
  
  Cesium.when(promise, function(layers) {
    // 设置相机飞向目标村庄
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(114.8172, 34.8248, 800.0),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0.0
      }
    });
  });
  */

  // 【演示用】因为没有你真实的 iServer 服务，先直接飞到兰考县大概位置看卫星底图
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(114.81, 34.82, 3000.0),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-45),
      roll: 0.0
    }
  });
}

function initEvents() {
  // 1. 三维模式切换 (白膜 / 倾斜摄影 / 激光雷达)
  document.querySelectorAll(".scene-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".scene-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.mode = btn.dataset.mode;
      
      // 在 SuperMap 里，通常通过控制不同 S3M 图层的 visible 属性来实现模式切换
      // 例如：
      // const whiteLayer = scene.layers.find("WhiteModel");
      // const photoLayer = scene.layers.find("ObliquePhotography");
      // if (state.mode === 'white') { whiteLayer.visible = true; photoLayer.visible = false; }
      
      dom.roamTip.textContent = `已切换渲染模式：${btn.textContent}`;
    });
  });

  // 2. 全要素图层控制 (Checkbox)
  document.querySelectorAll(".layer-toggle input").forEach(input => {
    input.addEventListener("change", (e) => {
      const layerName = e.target.value;
      const isVisible = e.target.checked;
      
      // 调用 SuperMap API 控制图层显隐
      if (scene && scene.layers) {
        const layer = scene.layers.find(layerName);
        if (layer) {
          layer.visible = isVisible;
        }
      }
      console.log(`图层 [${layerName}] 显隐状态: ${isVisible}`);
    });
  });

  // 3. 视点智能漫游 (Camera FlyTo)
  const roams = {
    'center': { lon: 114.8172, lat: 34.8248, height: 150, heading: 0, pitch: -30, name: '村委会广场' },
    'forest': { lon: 114.8210, lat: 34.8290, height: 200, heading: 45, pitch: -45, name: '徐场村泡桐林' },
    'industry': { lon: 114.8120, lat: 34.8210, height: 120, heading: -30, pitch: -20, name: '古琴制作工坊集群' }
  };

  document.querySelectorAll(".roam-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = roams[btn.dataset.target];
      dom.roamTip.textContent = `漫游至：${target.name}`;
      dom.roamTip.style.borderColor = "#f4b44b";
      setTimeout(() => dom.roamTip.style.borderColor = "var(--brand-cyan)", 1000);

      // SuperMap Camera 平滑飞行 API
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(target.lon, target.lat, target.height),
        orientation: {
          heading: Cesium.Math.toRadians(target.heading),
          pitch: Cesium.Math.toRadians(target.pitch),
          roll: 0.0
        },
        duration: 2.0 // 飞行时长 2 秒
      });
    });
  });
}


// ----------------------------------------------------------------
// 三生空间评价 - 雷达图 
// ----------------------------------------------------------------
function drawRadarChart() {
  const canvas = dom.radar;
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = rect.width, h = rect.height;
  if(w === 0) return;
  canvas.width = w * dpr; canvas.height = h * dpr;
  
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2, cy = h / 2 + 10;
  const radius = Math.min(w, h) / 2 - 30;
  
  // ★ 这里修改为 3 个边！
  const sides = 3; 
  // ★ 严格对应三生指标
  const labels = ["生产空间", "生活空间", "生态空间"]; 
  // ★ 对应的数据 (分别对应 生产、生活、生态 的得分)
  const data = [0.85, 0.75, 0.92]; 

  // 1. 绘制底部的同心三角形网格
  for (let step = 1; step <= 4; step++) {
    const r = radius * (step / 4);
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const angle = (Math.PI * 2 / sides) * i - Math.PI / 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = "rgba(53, 208, 198, 0.2)";
    ctx.stroke();
  }

  // 2. 绘制3条辐射轴线和标签
  ctx.fillStyle = "#9ab3aa";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 / sides) * i - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    ctx.strokeStyle = "rgba(53, 208, 198, 0.3)";
    ctx.stroke();

    const lx = cx + Math.cos(angle) * (radius + 20);
    const ly = cy + Math.sin(angle) * (radius + 15);
    ctx.fillText(labels[i], lx, ly);
  }

  // 3. 绘制中间的数据填充区域 (三角形)
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 / sides) * i - Math.PI / 2;
    const x = cx + Math.cos(angle) * (radius * data[i]);
    const y = cy + Math.sin(angle) * (radius * data[i]);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = "rgba(53, 208, 198, 0.3)";
  ctx.fill();
  ctx.strokeStyle = "#35d0c6";
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // 4. 绘制3个数据端点的发光圆点
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 / sides) * i - Math.PI / 2;
    const x = cx + Math.cos(angle) * (radius * data[i]);
    const y = cy + Math.sin(angle) * (radius * data[i]);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#35d0c6";
    ctx.fill();
  }
}
init();