#!/usr/bin/env python3
"""Generate corrected Lankao township/street boundaries from iServer and a reference map."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import urllib.request
from pathlib import Path

import cv2
import geopandas as gpd
import matplotlib

matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from affine import Affine
from matplotlib.patches import Patch
from PIL import Image
from pyproj import Transformer
from rasterio.features import rasterize, shapes
from shapely import coverage_simplify, set_precision
from shapely.geometry import MultiPolygon, Polygon, mapping, shape
from shapely.ops import transform, unary_union

SERVICE_URL = (
    'http://118.89.55.214:8090/iserver/services/'
    'Lankao_Township/rest/maps/Lankao_Township'
)

# The colored county extent in the supplied 3375 x 2338 reference map.
REFERENCE_PIXEL_BOUNDS = (9, 251, 3363, 2252)
REFERENCE_COLORS = {
    'lanyang_or_sanyizhai': (255, 153, 153),
    'tongxiang': (239, 255, 173),
    'huian': (156, 214, 255),
}

DIRECT_DIVISIONS = [
    ('410225101', '410225101', '堌阳镇', '镇'),
    ('410225102', '410225102', '南彰镇', '镇'),
    ('410225103', '410225103', '考城镇', '镇'),
    ('410225104', '410225104', '红庙镇', '镇'),
    ('410225106', '410225202', '东坝头镇', '镇'),
    ('410225107', '410225205', '小宋镇', '镇'),
    ('410225108', '410225210', '仪封镇', '镇'),
    ('410225109', '410225207', '许河镇', '镇'),
    ('410225206', '410225206', '孟寨乡', '乡'),
    ('410225208', '410225208', '葡萄架乡', '乡'),
    ('410225209', '410225209', '闫楼乡', '乡'),
]

SPECIAL_UNITS = [
    ('410225401', '仪封园艺场'),
    ('410225402', '造纸林场'),
    ('410225403', '柳林林场'),
    ('410225408', '兰考林场'),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument('--reference-map', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--service-url', default=SERVICE_URL)
    return parser.parse_args()


def fetch_source_features(service_url: str) -> dict[str, Polygon]:
    payload = {
        'queryMode': 'SqlQuery',
        'queryParameters': {
            'queryParams': [{'name': 'Lankao_Township', 'attributeFilter': '1=1'}],
            'startRecord': 0,
            'expectCount': 100,
            'queryOption': 'ATTRIBUTEANDGEOMETRY',
        },
    }
    request = urllib.request.Request(
        f'{service_url.rstrip("/")}/queryResults.json?returnContent=true',
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        query_result = json.load(response)

    result: dict[str, Polygon] = {}
    for feature in query_result['recordsets'][0]['features']:
        code = str(feature['fieldValues'][0])
        points = feature['geometry']['points']
        offset = 0
        rings = []
        for part_size in feature['geometry']['parts']:
            part = points[offset : offset + part_size]
            rings.append([(point['x'], point['y']) for point in part])
            offset += part_size
        result[code] = Polygon(rings[0], rings[1:])
    return result


def map_transform(source: dict[str, Polygon], image_size: tuple[int, int]) -> Affine:
    bounds = unary_union(list(source.values())).bounds
    min_x, min_y, max_x, max_y = bounds
    pixel_left, pixel_top, pixel_right, pixel_bottom = REFERENCE_PIXEL_BOUNDS
    width, height = image_size
    if width != 3375 or height != 2338:
        scale_x, scale_y = width / 3375, height / 2338
        pixel_left, pixel_right = pixel_left * scale_x, pixel_right * scale_x
        pixel_top, pixel_bottom = pixel_top * scale_y, pixel_bottom * scale_y

    pixel_width = (max_x - min_x) / (pixel_right - pixel_left)
    pixel_height = (max_y - min_y) / (pixel_bottom - pixel_top)
    return Affine(
        pixel_width,
        0,
        min_x - pixel_left * pixel_width,
        0,
        -pixel_height,
        max_y + pixel_top * pixel_height,
    )


def split_urban_divisions(
    source: dict[str, Polygon], reference_map: Path
) -> dict[str, Polygon | MultiPolygon]:
    image = np.asarray(Image.open(reference_map).convert('RGB'))
    height, width = image.shape[:2]
    transform_grid = map_transform(source, (width, height))
    urban_source = unary_union(
        [source['410225100'], source['410225200'], source['410225201']]
    )

    min_x, min_y, max_x, max_y = urban_source.bounds
    inverse = ~transform_grid
    left, top = inverse * (min_x, max_y)
    right, bottom = inverse * (max_x, min_y)
    margin = 20
    crop_left = max(0, int(np.floor(left)) - margin)
    crop_top = max(0, int(np.floor(top)) - margin)
    crop_right = min(width, int(np.ceil(right)) + margin)
    crop_bottom = min(height, int(np.ceil(bottom)) + margin)
    crop = image[crop_top:crop_bottom, crop_left:crop_right]
    crop_transform = transform_grid * Affine.translation(crop_left, crop_top)

    urban_mask = rasterize(
        [(mapping(urban_source), 1)],
        out_shape=crop.shape[:2],
        transform=crop_transform,
        fill=0,
        dtype=np.uint8,
    ).astype(bool)

    distances = []
    seed_mask = cv2.erode(urban_mask.astype(np.uint8), np.ones((7, 7), np.uint8)).astype(bool)
    for color in REFERENCE_COLORS.values():
        seed = np.all(crop == np.asarray(color, dtype=np.uint8), axis=2) & seed_mask
        if not seed.any():
            raise RuntimeError(f'参考图中未找到颜色 {color}')
        distances.append(cv2.distanceTransform((~seed).astype(np.uint8), cv2.DIST_L2, 5))
    classified = np.argmin(np.stack(distances), axis=0)

    regions: dict[str, Polygon | MultiPolygon] = {}
    for class_index, class_name in enumerate(REFERENCE_COLORS):
        class_mask = ((classified == class_index) & urban_mask).astype(np.uint8)
        class_geometries = [
            shape(geometry)
            for geometry, value in shapes(
                class_mask,
                mask=class_mask.astype(bool),
                transform=crop_transform,
            )
            if value == 1
        ]
        regions[class_name] = unary_union(class_geometries).intersection(urban_source)

    # Raster cells can leave sub-pixel slivers at the exact source boundary. Assign each
    # sliver to the touching class so the result is a complete, gap-free coverage.
    coverage = unary_union(list(regions.values()))
    residual = urban_source.difference(coverage)
    residual_parts = list(residual.geoms) if hasattr(residual, 'geoms') else [residual]
    for part in residual_parts:
        if part.is_empty:
            continue
        winner = max(
            regions,
            key=lambda key: part.boundary.intersection(regions[key].boundary).length,
        )
        regions[winner] = unary_union([regions[winner], part])

    pink = regions['lanyang_or_sanyizhai']
    sanyizhai = pink.intersection(source['410225201'])
    lanyang = pink.difference(sanyizhai)
    coverage_parts = [
        lanyang,
        regions['tongxiang'],
        regions['huian'],
        sanyizhai,
    ]
    simplified = coverage_simplify(
        np.asarray(coverage_parts, dtype=object),
        tolerance=0.000035,
        simplify_boundary=False,
    )
    return {
        '410225001': simplified[0],
        '410225002': simplified[1],
        '410225003': simplified[2],
        '410225201': simplified[3],
    }


def make_feature(
    code: str,
    name: str,
    division_type: str,
    geometry: Polygon | MultiPolygon,
    source_codes: list[str],
    method: str,
) -> dict:
    area_transformer = Transformer.from_crs('EPSG:4326', 'EPSG:32650', always_xy=True)
    area_km2 = transform(area_transformer.transform, geometry).area / 1_000_000
    return {
        'type': 'Feature',
        'properties': {
            'adcode': code,
            'name': name,
            'type': division_type,
            'county_code': '410225',
            'county_name': '兰考县',
            'source_codes': source_codes,
            'geometry_method': method,
            'area_km2': round(area_km2, 4),
        },
        'geometry': rounded_mapping(geometry),
    }


def rounded_mapping(geometry: Polygon | MultiPolygon) -> dict:
    geometry = set_precision(geometry, grid_size=0.00000001, mode='valid_output')
    value = mapping(geometry)

    def rounded(item):
        if isinstance(item, (list, tuple)):
            if len(item) == 2 and all(isinstance(coordinate, (int, float)) for coordinate in item):
                return [round(item[0], 8), round(item[1], 8)]
            return [rounded(child) for child in item]
        return item

    return {'type': value['type'], 'coordinates': rounded(value['coordinates'])}


def normalize_coverage(features: list[dict]) -> list[dict]:
    """Remove sub-pixel overlaps introduced by rounding shared boundaries."""
    normalized: list[dict] = []
    claimed = None
    area_transformer = Transformer.from_crs('EPSG:4326', 'EPSG:32650', always_xy=True)
    for feature in features:
        geometry = set_precision(shape(feature['geometry']), grid_size=0.00000001)
        if claimed is not None:
            geometry = set_precision(geometry.difference(claimed), grid_size=0.00000001)
        copied = {
            'type': 'Feature',
            'properties': dict(feature['properties']),
            'geometry': rounded_mapping(geometry),
        }
        copied['properties']['area_km2'] = round(
            transform(area_transformer.transform, geometry).area / 1_000_000,
            4,
        )
        normalized.append(copied)
        claimed = geometry if claimed is None else set_precision(unary_union([claimed, geometry]), grid_size=0.00000001)
    return normalized


def build_datasets(source: dict[str, Polygon], reference_map: Path) -> tuple[list[dict], list[dict]]:
    urban = split_urban_divisions(source, reference_map)
    official: list[dict] = [
        make_feature('410225001', '兰阳街道', '街道', urban['410225001'], ['410225100', '410225200'], '参考图重分割'),
        make_feature('410225002', '桐乡街道', '街道', urban['410225002'], ['410225200', '410225201'], '参考图重分割'),
        make_feature('410225003', '惠安街道', '街道', urban['410225003'], ['410225200'], '参考图重分割'),
    ]

    for new_code, old_code, name, division_type in DIRECT_DIVISIONS:
        official.append(make_feature(new_code, name, division_type, source[old_code], [old_code], '沿用原边界'))

    official.append(
        make_feature(
            '410225105',
            '谷营镇',
            '镇',
            unary_union([source['410225204'], source['410225203']]),
            ['410225204', '410225203'],
            '原谷营乡与爪营乡合并',
        )
    )
    official.append(
        make_feature(
            '410225201',
            '三义寨乡',
            '乡',
            urban['410225201'],
            ['410225201'],
            '参考图校正东界',
        )
    )
    official.sort(key=lambda feature: feature['properties']['adcode'])
    official = normalize_coverage(official)

    map_units = list(official)
    for code, name in SPECIAL_UNITS:
        map_units.append(make_feature(code, name, '类似乡级单位', source[code], [code], '沿用原边界'))
    map_units.sort(key=lambda feature: feature['properties']['adcode'])
    map_units = normalize_coverage(map_units)
    return official, map_units


def validate(features: list[dict], expected_count: int) -> dict:
    if len(features) != expected_count:
        raise RuntimeError(f'要素数量应为 {expected_count}，实际为 {len(features)}')
    geometries = [shape(feature['geometry']) for feature in features]
    if any(geometry.is_empty or not geometry.is_valid for geometry in geometries):
        raise RuntimeError('输出包含空几何或无效几何')

    overlap_area = 0.0
    for index, geometry in enumerate(geometries):
        for other in geometries[index + 1 :]:
            overlap_area += geometry.intersection(other).area
    if overlap_area > 1e-10:
        raise RuntimeError(f'输出要素存在重叠，面积为 {overlap_area}')

    union = unary_union(geometries)
    return {
        'feature_count': len(features),
        'geometry_valid': True,
        'pairwise_overlap_area_degrees2': overlap_area,
        'bounds': [round(value, 6) for value in union.bounds],
        'total_area_km2': round(sum(feature['properties']['area_km2'] for feature in features), 4),
    }


def write_geojson(path: Path, features: list[dict]) -> None:
    collection = {
        'type': 'FeatureCollection',
        'name': path.stem,
        'crs': {'type': 'name', 'properties': {'name': 'urn:ogc:def:crs:OGC:1.3:CRS84'}},
        'features': features,
    }
    path.write_text(
        json.dumps(collection, ensure_ascii=False, separators=(',', ':')),
        encoding='utf-8',
    )


def write_csv(path: Path, features: list[dict]) -> None:
    with path.open('w', encoding='utf-8-sig', newline='') as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=['adcode', 'name', 'type', 'area_km2', 'source_codes', 'geometry_method'],
        )
        writer.writeheader()
        for feature in features:
            properties = feature['properties']
            writer.writerow(
                {
                    **{key: properties[key] for key in ['adcode', 'name', 'type', 'area_km2', 'geometry_method']},
                    'source_codes': '|'.join(properties['source_codes']),
                }
            )


def write_shapefile(directory: Path, filename: str, features: list[dict]) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    rows = []
    geometries = []
    for feature in features:
        properties = feature['properties']
        rows.append(
            {
                'adcode': properties['adcode'],
                'name': properties['name'],
                'type': properties['type'],
                'area_km2': properties['area_km2'],
                'old_codes': '|'.join(properties['source_codes']),
                'method': properties['geometry_method'],
            }
        )
        geometries.append(shape(feature['geometry']))
    frame = gpd.GeoDataFrame(rows, geometry=geometries, crs='EPSG:4326')
    frame.to_file(directory / f'{filename}.shp', encoding='UTF-8', index=False)


def write_preview(path: Path, features: list[dict], title: str) -> None:
    plt.rcParams['font.sans-serif'] = ['Microsoft YaHei', 'SimHei', 'DejaVu Sans']
    plt.rcParams['axes.unicode_minus'] = False
    frame = gpd.GeoDataFrame(
        [feature['properties'] for feature in features],
        geometry=[shape(feature['geometry']) for feature in features],
        crs='EPSG:4326',
    )
    figure, axis = plt.subplots(figsize=(13.5, 7.6), dpi=160)
    colors = {
        '街道': '#f29a9a',
        '镇': '#83cdbb',
        '乡': '#f2d18f',
        '类似乡级单位': '#d9e88f',
    }
    for division_type, group in frame.groupby('type'):
        group.plot(
            ax=axis,
            color=colors[division_type],
            edgecolor='#536b68',
            linewidth=0.55,
            label=division_type,
        )
    for _, row in frame.iterrows():
        point = row.geometry.representative_point()
        axis.text(point.x, point.y, row['name'], ha='center', va='center', fontsize=6.5, color='#163b38')
    axis.set_title(title, fontsize=15)
    axis.set_axis_off()
    axis.legend(
        handles=[Patch(facecolor=color, edgecolor='#536b68', label=name) for name, color in colors.items()],
        loc='lower right',
        frameon=False,
    )
    figure.tight_layout()
    figure.savefig(path, bbox_inches='tight', facecolor='white')
    plt.close(figure)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    args = parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    source = fetch_source_features(args.service_url)
    official, map_units = build_datasets(source, args.reference_map)

    official_path = args.output / 'lankao-township-streets.geojson'
    map_units_path = args.output / 'lankao-map-units.geojson'
    write_geojson(official_path, official)
    write_geojson(map_units_path, map_units)
    write_csv(args.output / 'lankao-township-streets.csv', official)
    write_shapefile(args.output / 'shapefile', 'lankao_township_streets', official)
    write_shapefile(args.output / 'shapefile', 'lankao_map_units', map_units)
    write_preview(args.output / 'preview.png', official, '兰考县现行乡镇街道数据（校正版）')
    write_preview(
        args.output / 'preview-map-units.png',
        map_units,
        '兰考县乡镇街道及图面管理单元（校正版）',
    )

    manifest = {
        'generated_on': '2026-08-06',
        'crs': 'EPSG:4326 / OGC:CRS84',
        'service_url': args.service_url,
        'official_divisions': validate(official, 16),
        'map_units': validate(map_units, 20),
        'files': {
            official_path.name: sha256(official_path),
            map_units_path.name: sha256(map_units_path),
        },
    }
    (args.output / 'manifest.json').write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
