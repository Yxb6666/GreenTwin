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


def add_box(name, location, dimensions, value):
    bpy.ops.mesh.primitive_cube_add(location=location)
    item = bpy.context.object
    item.name = name
    item.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    item.data.materials.append(value)
    return item


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

    for index, y in enumerate((-70, -35, 10, 52, 78)):
        side = -1 if index % 2 == 0 else 1
        add_box(
            f"VillageBuilding_{index + 1:02d}",
            (side * 12, y, 2.2),
            (8, 12, 4.4),
            material(f"BuildingMaterial_{index + 1:02d}", (0.58, 0.44 + index * 0.025, 0.30, 1.0), roughness=0.9),
        )

    bpy.context.scene.world.color = (0.025, 0.04, 0.045)


def main():
    config_path, output_path = read_arguments()
    with open(config_path, "r", encoding="utf-8") as stream:
        config = json.load(stream)
    build_scene(config)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
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
