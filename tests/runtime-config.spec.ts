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
      township: string
    }
  }
}

describe('runtime-config 乡镇地图服务', () => {
  it('使用可加载的 Lankao_Township 地图资源及其 EPSG:4326 坐标系', () => {
    const configPath = resolve(process.cwd(), 'public/config/runtime-config.json')
    const config = JSON.parse(readFileSync(configPath, 'utf8')) as RuntimeConfigFixture

    expect(config.supermap.mapServices.township).toBe(
      'http://118.89.55.214:8090/iserver/services/Lankao_Township/rest/maps/Lankao_Township',
    )
    expect(config.map.crs).toBe('EPSG4326')
    expect(config.map.center).toEqual([34.885212666, 114.974247107])
  })
})
