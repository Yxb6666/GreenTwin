"""生成用于 GreenTwin 查询联动演示的非均匀治理问题点要素。"""

from __future__ import annotations

import argparse
import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

from shapely.geometry import Point, shape


TOWN_SETTINGS = {
    "兰阳街道": (16, ["南街社区", "城中社区", "西岗头社区", "城西社区"], "urban"),
    "桐乡街道": (13, ["盆窑社区", "薛楼社区", "王庄社区", "高场社区"], "urban"),
    "惠安街道": (11, ["何寨社区", "陈斗寨社区", "韩村社区", "桂李寨社区"], "urban"),
    "堌阳镇": (8, ["范场村", "梁寨村", "吕堂村", "端庄村"], "general"),
    "南彰镇": (5, ["南彰村", "李家滩村", "胡里村", "刘堡村"], "general"),
    "考城镇": (7, ["城南村", "焦李河村", "马庄村", "南王庄村"], "agriculture"),
    "红庙镇": (6, ["双杨树村", "武营村", "土岭村", "王庄村"], "general"),
    "谷营镇": (8, ["谷东村", "爪营村", "栗东村", "金庙村"], "agriculture"),
    "东坝头镇": (5, ["张庄村", "雷集村", "栗场村", "双井村"], "river"),
    "小宋镇": (5, ["小宋村", "孔庄村", "张笔彩村", "袁寨村"], "general"),
    "仪封镇": (7, ["仪封村", "代庄村", "圈头村", "耿庄村"], "industry"),
    "许河镇": (4, ["许河村", "董堂村", "杨堂村", "张保府村"], "general"),
    "三义寨乡": (6, ["三义寨村", "夹河滩村", "白云山村", "赵楼村"], "river"),
    "孟寨乡": (4, ["孟寨村", "何二庄村", "虎羊寨村", "曹庄村"], "agriculture"),
    "葡萄架乡": (5, ["葡萄架村", "赵垛楼村", "贺村", "回回营村"], "industry"),
    "闫楼乡": (6, ["闫楼村", "郭庄村", "王庄村", "小李庄村"], "agriculture"),
}

ISSUE_TEMPLATES = [
    ("人居环境类", "垃圾堆放", "发现生活垃圾在{place}集中堆放，未及时清运。", "中"),
    ("人居环境类", "污水外溢", "{place}排水井堵塞，污水外溢至道路边缘。", "高"),
    ("人居环境类", "公厕保洁", "{place}公厕保洁不及时，配套设施存在异味。", "低"),
    ("人居环境类", "畜禽粪污", "{place}养殖点粪污收集不规范，存在外溢。", "高"),
    ("基础设施类", "路灯损坏", "{place}连续多盏路灯无法正常照明。", "中"),
    ("基础设施类", "道路破损", "{place}路面出现沉陷和裂缝，影响车辆通行。", "中"),
    ("基础设施类", "排水涵管堵塞", "{place}排水涵管淤积，雨天容易形成积水。", "中"),
    ("基础设施类", "供水压力不足", "{place}用水高峰时段末端管网水压偏低。", "中"),
    ("空间管控类", "疑似违建", "{place}发现新增硬化斑块，需核查审批手续。", "高"),
    ("空间管控类", "宅基地越界", "{place}新建院墙疑似超出宅基地批准范围。", "高"),
    ("空间管控类", "沟渠填埋", "{place}排水沟被土方局部填埋，影响排涝。", "高"),
    ("安全风险类", "危房隐患", "{place}老旧房屋墙体开裂，雨天渗漏严重。", "高"),
    ("安全风险类", "消防通道堵塞", "{place}堆物占道，消防车辆无法正常通行。", "高"),
    ("安全风险类", "电线低垂", "{place}上方线缆低垂，车辆通行存在风险。", "高"),
    ("农业生产类", "灌渠渗漏", "{place}灌渠侧壁破损，输水过程中渗漏明显。", "中"),
    ("农业生产类", "机井故障", "{place}灌溉机井控制柜无法正常启动。", "中"),
    ("农业生产类", "大棚排水不畅", "{place}设施农业排水沟淤堵，影响雨后生产。", "中"),
    ("生态保护类", "岸线垃圾", "{place}散落塑料包装和生活垃圾，需巡查清理。", "中"),
    ("生态保护类", "河道漂浮物", "{place}水面出现成片漂浮物，需要及时清理。", "低"),
    ("生态保护类", "露天焚烧", "{place}发现秸秆焚烧痕迹，需巡查复核。", "高"),
    ("产业发展类", "园区占道堆料", "{place}存在临时堆料，占用生产车辆通道。", "中"),
    ("产业发展类", "冷库噪声", "{place}冷链设备夜间运行噪声影响周边居民。", "中"),
    ("公共服务类", "健身器材损坏", "{place}健身器材连接件松动，存在使用风险。", "低"),
    ("公共服务类", "候车亭破损", "{place}候车亭顶棚破损，雨天无法正常使用。", "中"),
    ("公共服务类", "广播设备故障", "{place}应急广播终端无声音，需检修线路。", "中"),
]

PROFILE_WEIGHTS = {
    "urban": {"人居环境类": 2.4, "基础设施类": 2.2, "公共服务类": 1.8, "空间管控类": 1.4},
    "agriculture": {"农业生产类": 2.8, "基础设施类": 1.6, "人居环境类": 1.2},
    "river": {"生态保护类": 3.0, "安全风险类": 1.8, "空间管控类": 1.6},
    "industry": {"产业发展类": 2.5, "基础设施类": 1.7, "人居环境类": 1.3},
    "general": {"人居环境类": 1.5, "基础设施类": 1.5, "公共服务类": 1.2},
}

PLACE_SUFFIXES = ["主干道", "便民路", "文化广场", "村口", "生产路", "排水沟", "产业片区", "居民点"]
CHANNELS = ["网格巡查", "村民随手拍", "部门巡检", "遥感巡查", "物联感知"]
SURNAMES = "王李张刘陈杨赵黄周吴徐孙胡朱高林何郭马罗梁宋郑谢韩唐冯于董萧程曹袁邓许傅沈曾彭吕苏卢蒋蔡贾丁魏薛叶阎余"
GIVEN_NAMES = ["海", "敏", "刚", "峰", "芳", "洋", "悦", "超", "琳", "静", "勇", "磊", "迪", "妍", "冰", "涛", "浩", "宁", "洁", "晨"]


def random_point_in_polygon(polygon, rng: random.Random) -> Point:
    min_x, min_y, max_x, max_y = polygon.bounds
    for _ in range(20_000):
        point = Point(rng.uniform(min_x, max_x), rng.uniform(min_y, max_y))
        if polygon.contains(point):
            return point
    return polygon.representative_point()


def clustered_point(polygon, anchor: Point, rng: random.Random) -> Point:
    min_x, min_y, max_x, max_y = polygon.bounds
    sigma_x = (max_x - min_x) * rng.uniform(0.035, 0.075)
    sigma_y = (max_y - min_y) * rng.uniform(0.035, 0.075)
    for _ in range(500):
        point = Point(rng.gauss(anchor.x, sigma_x), rng.gauss(anchor.y, sigma_y))
        if polygon.contains(point):
            return point
    return random_point_in_polygon(polygon, rng)


def pick_template(profile: str, rng: random.Random):
    profile_weights = PROFILE_WEIGHTS[profile]
    weights = [profile_weights.get(template[0], 0.65) for template in ISSUE_TEMPLATES]
    return rng.choices(ISSUE_TEMPLATES, weights=weights, k=1)[0]


def pick_status(age_days: int, rng: random.Random) -> str:
    if age_days <= 6:
        return rng.choices(["待审核", "已派单", "处理中", "已办结"], [30, 36, 29, 5], k=1)[0]
    if age_days <= 20:
        return rng.choices(["待审核", "已派单", "处理中", "已办结"], [10, 24, 48, 18], k=1)[0]
    return rng.choices(["待审核", "已派单", "处理中", "已办结"], [3, 9, 31, 57], k=1)[0]


def build_features(boundaries: dict, seed: int):
    rng = random.Random(seed)
    now = datetime(2026, 8, 7, 21, 30, tzinfo=timezone(timedelta(hours=8)))
    records = []

    for town_name, (count, villages, profile) in TOWN_SETTINGS.items():
        boundary_feature = boundaries[town_name]
        polygon = shape(boundary_feature["geometry"])
        anchor_count = 3 if profile == "urban" else 2
        anchors = [polygon.representative_point()]
        anchors.extend(random_point_in_polygon(polygon, rng) for _ in range(anchor_count - 1))

        for town_index in range(count):
            cluster_index = rng.choices(range(anchor_count), weights=[5, 3, 2][:anchor_count], k=1)[0]
            if rng.random() < 0.84:
                point = clustered_point(polygon, anchors[cluster_index], rng)
            else:
                point = random_point_in_polygon(polygon, rng)

            issue_type, subtype, description_pattern, base_urgency = pick_template(profile, rng)
            village = villages[cluster_index % len(villages)] if rng.random() < 0.78 else rng.choice(villages)
            place = f"{village}{rng.choice(PLACE_SUFFIXES)}"
            age_days = min(55, int(rng.expovariate(1 / 17)))
            report_time = now - timedelta(days=age_days, hours=rng.randint(0, 18), minutes=rng.randint(0, 59))
            urgency = base_urgency
            if base_urgency == "中" and rng.random() < 0.18:
                urgency = rng.choice(["高", "低"])
            status = pick_status(age_days, rng)

            records.append(
                {
                    "point": point,
                    "properties": {
                        "type": issue_type,
                        "subtype": subtype,
                        "description": description_pattern.format(place=place),
                        "contact": f"{rng.choice(SURNAMES)}{rng.choice(GIVEN_NAMES)}",
                        "phone": f"138{len(records) + 10001000:08d}"[-11:],
                        "townCode": boundary_feature["properties"]["adcode"],
                        "town": town_name,
                        "villageCode": f"{boundary_feature['properties']['adcode']}{villages.index(village) + 1:03d}",
                        "village": village,
                        "address": place,
                        "time": report_time.isoformat(timespec="seconds"),
                        "urgency": urgency,
                        "status": status,
                        "channel": rng.choices(CHANNELS, [38, 30, 18, 9, 5], k=1)[0],
                        "dataClass": "场景模拟",
                    },
                }
            )

    records.sort(key=lambda record: record["properties"]["time"], reverse=True)
    features = []
    for index, record in enumerate(records, 1):
        issue_id = f"GK-2026-{index:03d}"
        record["properties"]["id"] = issue_id
        features.append(
            {
                "type": "Feature",
                "id": issue_id,
                "geometry": {
                    "type": "Point",
                    "coordinates": [round(record["point"].x, 6), round(record["point"].y, 6)],
                },
                "properties": record["properties"],
            }
        )
    return features


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--boundaries",
        default="public/data/lankao-township-streets/lankao-township-streets.geojson",
    )
    parser.add_argument("--output", default="public/data/governance/governance-issues.geojson")
    parser.add_argument("--seed", type=int, default=20260807)
    args = parser.parse_args()

    boundary_collection = json.loads(Path(args.boundaries).read_text(encoding="utf-8"))
    boundaries = {feature["properties"]["name"]: feature for feature in boundary_collection["features"]}
    features = build_features(boundaries, args.seed)
    collection = {
        "type": "FeatureCollection",
        "name": "lankao_governance_issues_demo",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "metadata": {
            "title": "兰考县乡村治理问题场景模拟要素",
            "generatedOn": "2026-08-07",
            "featureCount": len(features),
            "generationModel": "乡镇差异配额 + 多中心高斯热点 + 少量离散点",
            "purpose": "空间查询、属性查询及图表联动演示",
            "disclaimer": "本数据为可复现的场景模拟数据，不代表真实事件、人员或法定位置。",
        },
        "features": features,
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(collection, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"generated {len(features)} features -> {output}")


if __name__ == "__main__":
    main()
