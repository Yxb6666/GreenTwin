const FLOOR_PATTERNS = [
  { pattern: /三[层栋]|三层|三楼/, floors: 3 },
  { pattern: /两[层栋]|二层|双层|二楼/, floors: 2 },
  { pattern: /一[层栋]|单层|一层/, floors: 1 },
]

const TYPE_PATTERNS = [
  { type: 'pavilion', label: '亭', pattern: /亭|榭|观景台/ },
  { type: 'tower', label: '楼阁', pattern: /塔|楼阁|宝塔|鼓楼|钟楼/ },
  { type: 'gate', label: '牌楼', pattern: /牌楼|门楼|大门/ },
  { type: 'courtyard', label: '合院', pattern: /四合院|宅院|庭院|院子|合院/ },
  { type: 'hall', label: '大殿', pattern: /殿|厅堂|堂|祠堂|庙/ },
]

function parseNumber(value, fallback, minimum, maximum) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(maximum, Math.max(minimum, number))
}

function parseDimensions(prompt, fallbackWidth, fallbackDepth) {
  const widthMatch = prompt.match(/宽[约]?(\d+(?:\.\d+)?)米/)
  const depthMatch = prompt.match(/深[约]?(\d+(?:\.\d+)?)米/)
  const pairMatch = prompt.match(
    /(\d+(?:\.\d+)?)\s*[xX×*]\s*(\d+(?:\.\d+)?)\s*米/,
  )
  const width = widthMatch
    ? parseNumber(widthMatch[1], fallbackWidth, 8, 30)
    : pairMatch
      ? parseNumber(pairMatch[1], fallbackWidth, 8, 30)
      : fallbackWidth
  const depth = depthMatch
    ? parseNumber(depthMatch[1], fallbackDepth, 8, 24)
    : pairMatch
      ? parseNumber(pairMatch[2], fallbackDepth, 8, 24)
      : fallbackDepth
  return { width, depth }
}

export function parseBuildingPrompt(prompt, requestedStyle) {
  const text = prompt || ''
  const style = ['traditional-chinese', 'modern', 'rural'].includes(
    requestedStyle,
  )
    ? requestedStyle
    : /古风|中式|传统|四合院|亭|庙|牌楼|殿|塔|楼阁/.test(text)
      ? 'traditional-chinese'
      : /现代|办公|商业|玻璃|公寓|高层|科技/.test(text)
        ? 'modern'
        : 'rural'

  let buildingType = 'house'
  let typeLabel = '宅院'
  if (style === 'modern') {
    buildingType = 'modern'
    typeLabel = '现代建筑'
  } else if (style === 'rural') {
    buildingType = 'rural'
    typeLabel = '乡村农房'
  }
  for (const entry of TYPE_PATTERNS) {
    if (entry.pattern.test(text)) {
      buildingType = entry.type
      typeLabel = entry.label
      break
    }
  }

  let floors = 1
  for (const entry of FLOOR_PATTERNS) {
    if (entry.pattern.test(text)) {
      floors = entry.floors
      break
    }
  }
  if (buildingType === 'tower') floors = Math.max(floors, 3)
  if (buildingType === 'modern') floors = Math.max(floors, 2)

  const defaults = {
    pavilion: { roof: 'pyramidal', width: 12, depth: 12 },
    tower: { roof: 'pyramidal', width: 14, depth: 12 },
    gate: { roof: 'hipped', width: 18, depth: 7 },
    courtyard: { roof: 'hipped', width: 20, depth: 18 },
    hall: { roof: 'hipped', width: 18, depth: 12 },
    modern: { roof: 'flat', width: 20, depth: 14 },
    rural: { roof: 'gable', width: 16, depth: 12 },
  }[buildingType] ?? { roof: 'hipped', width: 15, depth: 10 }
  const { width, depth } = parseDimensions(text, defaults.width, defaults.depth)

  let roof = defaults.roof
  if (/攒尖|宝顶|尖顶/.test(text)) roof = 'pyramidal'
  else if (/平顶/.test(text)) roof = 'flat'
  else if (/悬山|硬山|人字顶|双坡|坡屋顶|坡顶/.test(text)) roof = 'gable'
  else if (/歇山|庑殿|飞檐|翘角|大屋顶/.test(text)) roof = 'hipped'

  const ornamentLevel = /豪华|精致|精细|繁复|考究|华美|气派/.test(text)
    ? 3
    : /普通|简洁|简单|朴素/.test(text)
      ? 1
      : 2

  return {
    style,
    buildingType,
    typeLabel,
    floors,
    roof,
    width: Number(width.toFixed(1)),
    depth: Number(depth.toFixed(1)),
    columns: /柱|廊/.test(text) || buildingType === 'pavilion',
    railings: /栏|围栏|栏杆|护栏/.test(text) || buildingType === 'pavilion',
    steps: /阶|台阶|台基/.test(text) || buildingType === 'pavilion',
    courtyard:
      /院|围墙|院墙/.test(text) && buildingType !== 'modern' &&
      buildingType !== 'tower',
    plaque:
      /匾|牌匾|题字/.test(text) ||
      (buildingType === 'gate' || buildingType === 'hall'),
    lanterns: /灯笼|灯/.test(text),
    dougong:
      /斗拱|雀替|梁枋/.test(text) ||
      (buildingType === 'hall' && ornamentLevel >= 2),
    balcony: /阳台|露台|回廊/.test(text),
    canopy: /雨棚|挑檐|门廊/.test(text),
    glass: /玻璃|幕墙/.test(text),
    ornamentLevel,
  }
}
