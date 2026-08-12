import json
import math
import os
import sys

import bpy


def read_arguments():
    separator = sys.argv.index("--")
    return sys.argv[separator + 1], sys.argv[separator + 2]


def material(name, color, metallic=0.0, roughness=0.7):
    value = bpy.data.materials.new(name)
    value.diffuse_color = color
    value.use_nodes = True
    shader = value.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    if color[3] < 1:
        shader.inputs["Alpha"].default_value = color[3]
        value.surface_render_method = "DITHERED"
    return value


def add_box(name, location, dimensions, value, build_stage=1):
    bpy.ops.mesh.primitive_cube_add(location=location)
    item = bpy.context.object
    item.name = name
    item.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    item.data.materials.append(value)
    item["build_stage"] = build_stage
    return item


def add_traditional_building():
    stone = material("AncientStone", (0.35, 0.34, 0.31, 1.0), roughness=0.92)
    timber = material("AncientTimber", (0.30, 0.075, 0.035, 1.0), roughness=0.72)
    plaster = material("AncientWall", (0.82, 0.76, 0.62, 1.0), roughness=0.9)
    tile = material("AncientTile", (0.075, 0.09, 0.085, 1.0), roughness=0.68)
    gold = material("AncientTrim", (0.72, 0.45, 0.12, 1.0), metallic=0.25, roughness=0.5)

    add_box("AncientFoundation", (0, 18, 0.35), (18, 14, 0.7), stone, 1)
    add_box("AncientMainHall", (0, 18, 3.2), (15, 11, 5.0), plaster, 2)
    for x in (-6.4, -2.15, 2.15, 6.4):
        add_box(f"AncientColumn_{x}", (x, 12.35, 3.4), (0.5, 0.5, 5.6), timber, 2)
    add_box("AncientBeam", (0, 12.35, 6.0), (16.5, 0.65, 0.65), timber, 2)

    for z, width in ((6.35, 19.5), (6.75, 17.0), (7.15, 14.0), (7.55, 10.5), (7.9, 6.0)):
        add_box(f"AncientRoof_{z}", (0, 18, z), (width, 15.5, 0.42), tile, 3)
    add_box("AncientRidge", (0, 18, 8.3), (1.0, 16.2, 0.7), gold, 3)
    add_box("AncientPlaque", (0, 12.0, 5.0), (4.2, 0.3, 1.05), gold, 4)
    for x in (-8.8, 8.8):
        for y in (11.0, 25.0):
            bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.45, location=(x, y, 6.7))
            ornament = bpy.context.object
            ornament.name = "AncientRoofOrnament"
            ornament.data.materials.append(gold)
            ornament["build_stage"] = 4


def add_modern_building():
    concrete = material("ModernConcrete", (0.55, 0.58, 0.57, 1.0), roughness=0.7)
    glass = material("ModernGlass", (0.08, 0.32, 0.42, 0.78), metallic=0.12, roughness=0.2)
    accent = material("ModernAccent", (0.12, 0.65, 0.58, 1.0), metallic=0.18, roughness=0.4)
    add_box("ModernFoundation", (0, 18, 0.4), (18, 14, 0.8), concrete, 1)
    add_box("ModernMainVolume", (-2.8, 18, 4.6), (11, 11, 8.4), glass, 2)
    add_box("ModernSideVolume", (5.2, 19, 3.2), (5, 9, 5.6), concrete, 2)
    add_box("ModernRoof", (-2.8, 18, 9.0), (12, 12, 0.45), concrete, 3)
    add_box("ModernCanopy", (1.5, 11.7, 3.0), (8, 2.5, 0.35), accent, 4)


def add_rural_building():
    brick = material("RuralBrick", (0.52, 0.28, 0.16, 1.0), roughness=0.9)
    wall = material("RuralWall", (0.78, 0.68, 0.5, 1.0), roughness=0.92)
    roof = material("RuralRoof", (0.34, 0.12, 0.07, 1.0), roughness=0.82)
    add_box("RuralFoundation", (0, 18, 0.3), (17, 13, 0.6), brick, 1)
    add_box("RuralMainHouse", (0, 18, 3.1), (15, 11, 5.0), wall, 2)
    add_box("RuralRoofLower", (0, 18, 6.0), (17, 13, 0.55), roof, 3)
    add_box("RuralRoofUpper", (0, 18, 6.55), (13, 10, 0.55), roof, 3)
    add_box("RuralEntrance", (0, 12.2, 2.4), (3.2, 0.6, 4.0), brick, 4)


def add_outlets(count, road_length, road_width, value):
    interval = road_length / max(count + 1, 2)
    for index in range(count):
        y = -road_length / 2 + interval * (index + 1)
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=20,
            radius=0.32,
            depth=0.16,
            location=(road_width / 2 - 0.45, y, 0.29),
            rotation=(math.radians(90), 0, 0),
        )
        outlet = bpy.context.object
        outlet.name = f"Outlet_{index + 1:02d}"
        outlet.data.materials.append(value)


def build_scene(config):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    road_length = 186.0
    road_width = 6.0
    road_height = 0.22 + config["roadRaiseHeight"]
    ditch_width = config["ditchWidth"]
    ditch_depth = config["ditchDepth"]

    soil = material("Soil", (0.16, 0.28, 0.12, 1.0), roughness=0.95)
    asphalt = material("Road", (0.16, 0.19, 0.20, 1.0), roughness=0.82)
    concrete = material("Ditch", (0.43, 0.48, 0.46, 1.0), roughness=0.88)
    water = material("Water", (0.04, 0.48, 0.66, 0.68), metallic=0.05, roughness=0.2)
    warning = material("Outlet", (0.92, 0.55, 0.08, 1.0), metallic=0.25, roughness=0.45)

    add_box("Ground", (0, 0, -0.25), (64, 220, 0.5), soil)
    add_box("Road", (0, 0, road_height / 2), (road_width, road_length, road_height), asphalt)

    ditch_x = road_width / 2 + ditch_width / 2 + 0.35
    bottom_z = -ditch_depth + 0.08
    add_box("DitchBottom", (ditch_x, 0, bottom_z), (ditch_width, road_length, 0.16), concrete)
    add_box("DitchOuterWall", (ditch_x + ditch_width / 2, 0, -ditch_depth / 2), (0.14, road_length, ditch_depth), concrete)
    add_box("DitchInnerWall", (ditch_x - ditch_width / 2, 0, -ditch_depth / 2), (0.14, road_length, ditch_depth), concrete)
    add_box("DitchWater", (ditch_x, 0, bottom_z + 0.12), (max(ditch_width - 0.18, 0.12), road_length - 1, 0.08), water)

    water_length = min(42.0, 14.0 + ditch_depth * 24.0)
    add_box("Waterlogging", (-0.8, -18, road_height + 0.04), (road_width - 0.5, water_length, 0.06), water)
    add_outlets(config["outletCount"], road_length, road_width, warning)

    for index, y in enumerate((-70, -35, 52, 78)):
        side = -1 if index % 2 == 0 else 1
        add_box(
            f"VillageBuilding_{index + 1:02d}",
            (side * 12, y, 2.2),
            (8, 12, 4.4),
            material(f"BuildingMaterial_{index + 1:02d}", (0.58, 0.44 + index * 0.025, 0.30, 1.0), roughness=0.9),
        )

    if config.get("buildingStyle") == "traditional-chinese":
        add_traditional_building()
    elif config.get("buildingStyle") == "modern":
        add_modern_building()
    else:
        add_rural_building()

    bpy.context.scene.world.color = (0.025, 0.04, 0.045)


def main():
    config_path, output_path = read_arguments()
    with open(config_path, "r", encoding="utf-8") as stream:
        config = json.load(stream)
    build_scene(config)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    stem, extension = os.path.splitext(output_path)
    for stage in range(1, 5):
        bpy.ops.object.select_all(action="DESELECT")
        for item in bpy.context.scene.objects:
            if item.type == "MESH" and item.get("build_stage", 1) <= stage:
                item.select_set(True)
        bpy.ops.export_scene.gltf(
            filepath=f"{stem}-stage-{stage}{extension}",
            export_format="GLB",
            use_selection=True,
            export_apply=True,
            export_cameras=False,
            export_lights=False,
        )
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format="GLB",
        export_apply=True,
        export_cameras=False,
        export_lights=False,
    )
    print(json.dumps({"status": "completed", "output": output_path}, ensure_ascii=False))


if __name__ == "__main__":
    main()
