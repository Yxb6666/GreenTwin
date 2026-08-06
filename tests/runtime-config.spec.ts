import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

interface RuntimeConfigFixture {
  map: {
    center: [number, number]
    crs: string
  }
  supermap: {
    mapServices: {
      base: string
      township: string
    }
  }
}

describe('runtime-config 乡镇地图服务', () => {
  it('保留 EPSG:3857 影像底图视图并配置 Lankao_Township 叠加资源', () => {
    const configPath = resolve(process.cwd(), 'public/config/runtime-config.json')
    const config = JSON.parse(readFileSync(configPath, 'utf8')) as RuntimeConfigFixture

    expect(config.supermap.mapServices.base).toContain('/map-geovis-img/rest/maps/GEOVIS_Img')
    expect(config.supermap.mapServices.township).toBe(
      'http://118.89.55.214:8090/iserver/services/Lankao_Township/rest/maps/Lankao_Township',
    )
    expect(config.map.crs).toBe('EPSG3857')
    expect(config.map.center).toEqual([34.82, 114.82])
  })
})
