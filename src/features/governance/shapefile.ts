import { write } from '@mapbox/shp-write'
import JSZip from 'jszip'
import type { GovernanceIssue } from './data'

const SHAPEFILE_NAME = 'governance_issues'
const WGS84_PRJ =
  'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["Degree",0.017453292519943295]]'

type DbfValue = string | number

interface DbfField {
  name: string
  type: 'C' | 'N'
  size: number
  decimals?: number
}

interface ShapefileParts {
  shp: DataView
  shx: DataView
}

function copyDataView(view: DataView) {
  const bytes = new Uint8Array(view.byteLength)
  bytes.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength))
  return bytes
}

export const governanceShapefileFields: DbfField[] = [
  { name: 'ISSUE_ID', type: 'C', size: 24 },
  { name: 'TYPE', type: 'C', size: 48 },
  { name: 'SUBTYPE', type: 'C', size: 64 },
  { name: 'DESCRIPT', type: 'C', size: 254 },
  { name: 'CONTACT', type: 'C', size: 48 },
  { name: 'PHONE', type: 'C', size: 24 },
  { name: 'TOWN_CODE', type: 'C', size: 16 },
  { name: 'TOWN', type: 'C', size: 48 },
  { name: 'VILL_CODE', type: 'C', size: 20 },
  { name: 'VILLAGE', type: 'C', size: 64 },
  { name: 'ADDRESS', type: 'C', size: 160 },
  { name: 'LNG', type: 'N', size: 18, decimals: 8 },
  { name: 'LAT', type: 'N', size: 18, decimals: 8 },
  { name: 'URGENCY', type: 'C', size: 12 },
  { name: 'STATUS', type: 'C', size: 24 },
  { name: 'CHANNEL', type: 'C', size: 32 },
  { name: 'DATA_CLASS', type: 'C', size: 32 },
  { name: 'REPORT_AT', type: 'C', size: 24 },
]

function issueToRecord(issue: GovernanceIssue): Record<string, DbfValue> {
  return {
    ISSUE_ID: issue.id,
    TYPE: issue.type,
    SUBTYPE: issue.subtype,
    DESCRIPT: issue.description,
    CONTACT: issue.contact,
    PHONE: issue.phone,
    TOWN_CODE: issue.townCode,
    TOWN: issue.town,
    VILL_CODE: issue.villageCode,
    VILLAGE: issue.village,
    ADDRESS: issue.address,
    LNG: issue.longitude,
    LAT: issue.latitude,
    URGENCY: issue.urgency,
    STATUS: issue.status,
    CHANNEL: issue.channel,
    DATA_CLASS: issue.dataClass,
    REPORT_AT: issue.time,
  }
}

function truncateUtf8(value: string, maxBytes: number) {
  const encoder = new TextEncoder()
  let result = ''
  let byteLength = 0
  for (const character of value) {
    const encodedLength = encoder.encode(character).length
    if (byteLength + encodedLength > maxBytes) break
    result += character
    byteLength += encodedLength
  }
  return encoder.encode(result)
}

export function createUtf8Dbf(
  records: Record<string, DbfValue>[],
  fields: DbfField[] = governanceShapefileFields,
) {
  const headerLength = 32 + fields.length * 32 + 1
  const recordLength =
    1 + fields.reduce((total, field) => total + field.size, 0)
  const bytes = new Uint8Array(headerLength + recordLength * records.length + 1)
  const view = new DataView(bytes.buffer)
  const now = new Date()

  bytes[0] = 0x03
  bytes[1] = now.getFullYear() - 1900
  bytes[2] = now.getMonth() + 1
  bytes[3] = now.getDate()
  view.setUint32(4, records.length, true)
  view.setUint16(8, headerLength, true)
  view.setUint16(10, recordLength, true)

  fields.forEach((field, index) => {
    const offset = 32 + index * 32
    const name = new TextEncoder().encode(field.name.slice(0, 10))
    bytes.set(name, offset)
    bytes[offset + 11] = field.type.charCodeAt(0)
    bytes[offset + 16] = field.size
    bytes[offset + 17] = field.decimals ?? 0
  })
  bytes[headerLength - 1] = 0x0d

  records.forEach((record, recordIndex) => {
    let offset = headerLength + recordIndex * recordLength
    bytes[offset] = 0x20
    offset += 1
    fields.forEach((field) => {
      bytes.fill(0x20, offset, offset + field.size)
      const rawValue = record[field.name] ?? ''
      const formatted =
        field.type === 'N'
          ? Number(rawValue)
              .toFixed(field.decimals ?? 0)
              .slice(0, field.size)
          : String(rawValue)
      const encoded = truncateUtf8(formatted, field.size)
      const valueOffset =
        field.type === 'N' ? offset + field.size - encoded.length : offset
      bytes.set(encoded, valueOffset)
      offset += field.size
    })
  })
  bytes[bytes.length - 1] = 0x1a
  return bytes
}

function createPointShapefileParts(issues: GovernanceIssue[]) {
  return new Promise<ShapefileParts>((resolve, reject) => {
    const records = issues.map(issueToRecord)
    const geometries = issues.map((issue) => [issue.longitude, issue.latitude])
    write(records, 'POINT', geometries, (error, files) => {
      if (error) {
        reject(error)
        return
      }
      resolve(files)
    })
  })
}

export async function createGovernanceShapefileArchive(
  issues: GovernanceIssue[],
) {
  if (issues.length === 0) throw new Error('当前没有可导出的治理问题要素')

  const records = issues.map(issueToRecord)
  const parts = await createPointShapefileParts(issues)
  const zip = new JSZip()
  zip.file(`${SHAPEFILE_NAME}.shp`, copyDataView(parts.shp))
  zip.file(`${SHAPEFILE_NAME}.shx`, copyDataView(parts.shx))
  zip.file(`${SHAPEFILE_NAME}.dbf`, createUtf8Dbf(records))
  zip.file(`${SHAPEFILE_NAME}.prj`, WGS84_PRJ)
  zip.file(`${SHAPEFILE_NAME}.cpg`, 'UTF-8')
  const archive = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
  })
  return new Uint8Array(archive)
}
