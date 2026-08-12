import json
import math
import os
import sys

import bpy
from mathutils import Vector


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


def add_beveled_box(name, location, dimensions, value, build_stage=1, bevel=0.06):
    item = add_box(name, location, dimensions, value, build_stage)
    if bevel > 0:
        modifier = item.modifiers.new(name="Soft edges", type="BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    return item


def add_cylinder(name, location, radius, depth, value, build_stage=2, vertices=12):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
    )
    item = bpy.context.object
    item.name = name
    item.data.materials.append(value)
    item["build_stage"] = build_stage
    bevel = item.modifiers.new(name="Rounded edges", type="BEVEL")
    bevel.width = min(radius * 0.12, 0.045)
    bevel.segments = 2
    return item


def add_beam_between(name, start, end, radius, value, build_stage=3, vertices=8):
    start_point = Vector(start)
    end_point = Vector(end)
    direction = end_point - start_point
    item = add_cylinder(
        name,
        (start_point + end_point) / 2,
        radius,
        direction.length,
        value,
        build_stage,
        vertices,
    )
    item.rotation_mode = "QUATERNION"
    item.rotation_quaternion = direction.to_track_quat("Z", "Y")
    return item


def add_roof_mesh(name, vertices, faces, value, build_stage=3):
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    item = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(item)
    item.data.materials.append(value)
    item["build_stage"] = build_stage
    solidify = item.modifiers.new(name="Roof thickness", type="SOLIDIFY")
    solidify.thickness = 0.18
    bevel = item.modifiers.new(name="Roof edge softness", type="BEVEL")
    bevel.width = 0.055
    bevel.segments = 2
    return item


def add_traditional_building():
    stone = material("AncientStone", (0.33, 0.32, 0.29, 1.0), roughness=0.9)
    stone_light = material("AncientStoneLight", (0.53, 0.51, 0.45, 1.0), roughness=0.86)
    timber = material("AncientVermilion", (0.40, 0.045, 0.025, 1.0), roughness=0.64)
    timber_dark = material("AncientDarkTimber", (0.16, 0.035, 0.018, 1.0), roughness=0.72)
    plaster = material("AncientWall", (0.82, 0.76, 0.61, 1.0), roughness=0.88)
    window = material("AncientWindow", (0.055, 0.13, 0.14, 1.0), metallic=0.08, roughness=0.3)
    tile = material("AncientTile", (0.055, 0.085, 0.09, 1.0), metallic=0.08, roughness=0.52)
    tile_highlight = material("AncientTileHighlight", (0.10, 0.16, 0.16, 1.0), metallic=0.08, roughness=0.46)
    gold = material("AncientTrim", (0.70, 0.40, 0.08, 1.0), metallic=0.28, roughness=0.42)

    # Stage 1: two-level stone platform and ceremonial front steps.
    add_beveled_box("AncientLowerPlatform", (0, 18, 0.28), (20.5, 16.5, 0.56), stone, 1, 0.14)
    add_beveled_box("AncientUpperPlatform", (0, 18, 0.72), (18.8, 14.8, 0.36), stone_light, 1, 0.1)
    for index in range(4):
        add_beveled_box(
            f"AncientFrontStep_{index + 1:02d}",
            (0, 10.35 - index * 0.42, 0.16 + index * 0.16),
            (6.8 - index * 0.45, 0.85, 0.32),
            stone_light,
            1,
            0.045,
        )

    # Stage 2: walls, columns, beams and a readable timber facade.
    add_beveled_box("AncientMainHall", (0, 18.6, 3.4), (14.6, 8.8, 5.1), plaster, 2, 0.08)
    column_x = (-7.25, -4.35, -1.45, 1.45, 4.35, 7.25)
    for row, y in (("Front", 13.25), ("Rear", 23.45)):
        for index, x in enumerate(column_x):
            add_cylinder(
                f"Ancient{row}Column_{index + 1:02d}",
                (x, y, 3.65),
                0.31,
                5.75,
                timber,
                2,
                16,
            )
    for x in (-7.25, 7.25):
        for y in (16.6, 20.0):
            add_cylinder("AncientSideColumn", (x, y, 3.65), 0.31, 5.75, timber, 2, 16)

    for y in (13.25, 23.45):
        add_beveled_box("AncientLongBeam", (0, y, 6.0), (15.8, 0.48, 0.5), timber_dark, 2, 0.08)
        add_beveled_box("AncientPaintedBeam", (0, y, 5.58), (15.2, 0.34, 0.3), gold, 2, 0.05)
    for x in (-7.25, 7.25):
        add_beveled_box("AncientSideBeam", (x, 18.35, 6.0), (0.48, 10.7, 0.5), timber_dark, 2, 0.08)

    # Front doors and windows with geometric lattice instead of flat wall panels.
    panel_centers = (-5.8, -4.35, -2.9, -1.45, 0, 1.45, 2.9, 4.35, 5.8)
    for index, x in enumerate(panel_centers):
        is_door = abs(x) <= 1.5
        add_beveled_box(
            f"AncientFacadePanel_{index + 1:02d}",
            (x, 13.02, 3.25),
            (1.18, 0.14, 3.65 if is_door else 2.8),
            timber if is_door else window,
            2,
            0.035,
        )
        panel_height = 3.5 if is_door else 2.65
        for offset in (-0.42, 0, 0.42):
            add_beveled_box(
                "AncientLatticeVertical",
                (x + offset, 12.91, 3.25),
                (0.055, 0.08, panel_height),
                gold,
                4,
                0.015,
            )
        for offset in (-0.9, 0, 0.9):
            add_beveled_box(
                "AncientLatticeHorizontal",
                (x, 12.90, 3.25 + offset),
                (1.08, 0.08, 0.055),
                gold,
                4,
                0.015,
            )

    # Stage 3: a proper hipped roof with lifted corners and individual tile ribs.
    eave_x, eave_y, ridge_x = 9.75, 7.25, 5.35
    center_y, eave_z, corner_z, ridge_z = 18.35, 6.55, 6.95, 9.35
    roof_vertices = [
        (-eave_x, center_y - eave_y, corner_z),
        (eave_x, center_y - eave_y, corner_z),
        (eave_x, center_y + eave_y, corner_z),
        (-eave_x, center_y + eave_y, corner_z),
        (-ridge_x, center_y, ridge_z),
        (ridge_x, center_y, ridge_z),
        (-eave_x * 0.72, center_y - eave_y, eave_z),
        (eave_x * 0.72, center_y - eave_y, eave_z),
        (eave_x * 0.72, center_y + eave_y, eave_z),
        (-eave_x * 0.72, center_y + eave_y, eave_z),
    ]
    roof_faces = [
        (0, 6, 4), (6, 7, 5, 4), (7, 1, 5),
        (3, 4, 9), (9, 4, 5, 8), (8, 5, 2),
        (0, 4, 3), (1, 2, 5),
    ]
    add_roof_mesh("AncientHippedRoof", roof_vertices, roof_faces, tile, 3)

    # Tile ribs follow the roof pitch and remain light enough for WebGL.
    for index in range(19):
        x = -8.55 + index * 0.95
        ridge_target_x = max(-ridge_x, min(ridge_x, x))
        eave_height = eave_z + max(abs(x) - eave_x * 0.72, 0) * 0.14
        for direction in (-1, 1):
            y = center_y + direction * eave_y
            add_beam_between(
                f"AncientRoofTileRib_{direction}_{index:02d}",
                (x, y, eave_height + 0.12),
                (ridge_target_x, center_y, ridge_z + 0.12),
                0.075,
                tile_highlight,
                3,
                8,
            )
    for direction in (-1, 1):
        x = direction * eave_x
        for index in range(7):
            y = center_y - 5.7 + index * 1.9
            ridge_target_y = center_y
            eave_height = eave_z + abs(y - center_y) * 0.055
            add_beam_between(
                f"AncientSideTileRib_{direction}_{index:02d}",
                (x, y, eave_height + 0.13),
                (direction * ridge_x, ridge_target_y, ridge_z + 0.13),
                0.075,
                tile_highlight,
                3,
                8,
            )
    add_beam_between(
        "AncientMainRidge",
        (-ridge_x - 0.45, center_y, ridge_z + 0.28),
        (ridge_x + 0.45, center_y, ridge_z + 0.28),
        0.24,
        gold,
        3,
        12,
    )
    for start, end in (
        ((-ridge_x, center_y, ridge_z), (-eave_x, center_y - eave_y, corner_z)),
        ((ridge_x, center_y, ridge_z), (eave_x, center_y - eave_y, corner_z)),
        ((-ridge_x, center_y, ridge_z), (-eave_x, center_y + eave_y, corner_z)),
        ((ridge_x, center_y, ridge_z), (eave_x, center_y + eave_y, corner_z)),
    ):
        add_beam_between("AncientHipRidge", start, end, 0.19, gold, 3, 10)

    # Stage 4: simplified dougong, plaque, railing and roof ornaments.
    for x in column_x:
        for y in (12.95, 23.75):
            add_beveled_box("AncientBracketArm", (x, y, 6.18), (1.25, 0.44, 0.22), timber, 4, 0.05)
            add_beveled_box("AncientBracketBlock", (x, y, 6.43), (0.68, 0.68, 0.25), gold, 4, 0.05)
    add_beveled_box("AncientPlaqueFrame", (0, 12.78, 5.15), (4.3, 0.24, 1.15), gold, 4, 0.08)
    add_beveled_box("AncientPlaque", (0, 12.62, 5.15), (3.8, 0.12, 0.82), timber_dark, 4, 0.05)

    for side in (-1, 1):
        for index in range(5):
            x = side * (5.2 + index * 0.7)
            add_cylinder("AncientBalustradePost", (x, 11.1, 1.35), 0.09, 1.15, stone_light, 4, 10)
        add_beveled_box("AncientBalustradeRail", (side * 6.6, 11.1, 1.58), (3.3, 0.13, 0.14), stone_light, 4, 0.04)

    for x in (-ridge_x - 0.25, ridge_x + 0.25):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.34, location=(x, center_y, ridge_z + 0.3))
        ornament = bpy.context.object
        ornament.name = "AncientRidgeOrnament"
        ornament.scale = (1.45, 0.72, 0.9)
        ornament.data.materials.append(gold)
        ornament["build_stage"] = 4
    for side in (-1, 1):
        for index in range(3):
            bpy.ops.mesh.primitive_cone_add(
                vertices=10,
                radius1=0.18,
                radius2=0.06,
                depth=0.48,
                location=(side * (2.1 + index * 0.82), center_y, ridge_z + 0.54),
            )
            beast = bpy.context.object
            beast.name = "AncientRidgeBeast"
            beast.data.materials.append(gold)
            beast["build_stage"] = 4


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
